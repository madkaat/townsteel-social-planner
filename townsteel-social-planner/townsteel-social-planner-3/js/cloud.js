/* Cloud sync for the planner, using Supabase (auth + database) over plain fetch.
 * No libraries needed. If js/config.js has no Supabase values, this stays off
 * and the planner keeps saving only in this browser.
 *
 * How syncing works:
 * - Your whole planner is one row in the planner_state table, tied to your account.
 * - Every save goes to this browser first (so it's instant and works offline),
 *   then to Supabase about a second later.
 * - Each cloud save bumps a version number. If another browser saved in the
 *   meantime, you're asked which copy to keep instead of silently overwriting.
 * - When you come back to a tab, it checks for newer changes from other browsers.
 */
window.Cloud = (function () {
  "use strict";

  const cfg = window.PLANNER_CONFIG || {};
  // Accept the project URL even if it was copied with /rest/v1 or /auth/v1 on the end
  const base = String(cfg.supabaseUrl || "").trim().replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
  const key = String(cfg.supabaseKey || "").trim();
  const configured = !!(base && key);

  const PREFIX = "townsteel-social-planner-v1";
  const AUTH_KEY = PREFIX + ":auth";
  const META_KEY = PREFIX + ":sync";
  const DATA_KEY = PREFIX;

  let hooks = null;      // { getState, replaceState }
  let ready = false;     // true once the first sync has finished
  let timer = null, retryTimer = null, busy = false;
  let lastSynced = null;
  let status = configured ? "signed-out" : "local";

  // ---------- small storage helpers ----------
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const remove = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
  const meta = () => read(META_KEY) || { version: 0, dirty: false };
  const setMeta = (m) => write(META_KEY, Object.assign(meta(), m));
  let session = read(AUTH_KEY);

  // ---------- status pill ----------
  const LABELS = {
    local: "This browser only",
    "signed-out": "Not signed in",
    saving: "Saving…",
    synced: "Synced",
    offline: "Offline: saved on this device",
    error: "Sync problem"
  };
  function setStatus(s, detail) {
    status = s;
    if (s === "synced") lastSynced = new Date();
    const el = document.getElementById("sync-status");
    if (el) {
      el.textContent = LABELS[s] || s;
      el.dataset.state = s;
      el.title = detail || (s === "synced" && lastSynced ? "Last synced " + lastSynced.toLocaleTimeString() : "");
    }
    const info = document.getElementById("sync-info");
    if (info) info.textContent = describe();
  }
  function describe() {
    if (!configured) return "Not set up. Your planner is saved only in this browser.";
    if (!session) return "Not signed in.";
    const who = session.user && session.user.email ? `Signed in as ${session.user.email}. ` : "";
    if (status === "synced") return who + `All changes saved to the cloud${lastSynced ? " at " + lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}.`;
    if (status === "offline") return who + "Can't reach the cloud right now. Changes are kept on this device and will sync when you're back online.";
    if (status === "saving") return who + "Saving…";
    return who + (LABELS[status] || "");
  }

  // ---------- HTTP ----------
  class HttpError extends Error { constructor(status, body) { super((body && (body.msg || body.message || body.error_description || body.error)) || "HTTP " + status); this.status = status; this.body = body; } }

  async function http(path, { method = "GET", body, auth = true, prefer } = {}) {
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (auth) {
      const s = await validSession();
      if (!s) throw new HttpError(401, { message: "Not signed in" });
      headers.Authorization = "Bearer " + s.access_token;
    }
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = { message: text }; }
    if (!res.ok) throw new HttpError(res.status, json);
    return json;
  }

  // ---------- auth ----------
  function storeSession(s) {
    if (!s || !s.access_token) return null;
    session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: { id: s.user && s.user.id, email: s.user && s.user.email }
    };
    write(AUTH_KEY, session);
    return session;
  }

  async function validSession() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session;
    try {
      const res = await fetch(base + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (res.status >= 400 && res.status < 500) { forgetSession(); return null; } // refresh token no longer valid
      if (!res.ok) return session; // server trouble: try again later with what we have
      return storeSession(await res.json());
    } catch (e) {
      return session; // offline: keep the session, calls will fail and we'll retry
    }
  }

  function forgetSession() { session = null; remove(AUTH_KEY); showAuth(true); setStatus("signed-out"); }

  async function signIn(email, password) {
    const s = await http("/auth/v1/token?grant_type=password", { method: "POST", auth: false, body: { email, password } });
    storeSession(s);
  }

  async function signUp(email, password) {
    const r = await http("/auth/v1/signup", { method: "POST", auth: false, body: { email, password } });
    if (r && r.access_token) { storeSession(r); return true; }
    return false; // email confirmation is turned on: they need to click the link first
  }

  async function signOut() {
    try { if (session) await http("/auth/v1/logout", { method: "POST" }); } catch (e) { /* ignore */ }
    session = null;
    [AUTH_KEY, META_KEY, DATA_KEY].forEach(remove); // don't leave your planner behind on this browser
    location.reload();
  }

  // ---------- database ----------
  const rowPath = () => `/rest/v1/planner_state?user_id=eq.${encodeURIComponent(session.user.id)}`;

  async function pull() {
    const rows = await http(rowPath() + "&select=data,version,updated_at");
    return rows && rows[0] ? rows[0] : null;
  }

  // Returns { ok: true, version } or { conflict: true }
  async function push(data, expectedVersion) {
    if (!expectedVersion) {
      try {
        const rows = await http("/rest/v1/planner_state", { method: "POST", prefer: "return=representation", body: { user_id: session.user.id, data, version: 1 } });
        return { ok: true, version: rows[0].version };
      } catch (e) {
        if (e.status === 409) return { conflict: true }; // a row already exists (made in another browser)
        throw e;
      }
    }
    const rows = await http(`${rowPath()}&version=eq.${expectedVersion}`, {
      method: "PATCH", prefer: "return=representation",
      body: { data, version: expectedVersion + 1, updated_at: new Date().toISOString() }
    });
    return rows && rows.length ? { ok: true, version: rows[0].version } : { conflict: true };
  }

  // ---------- sync ----------
  function isOffline(e) { return !(e instanceof HttpError) || e.status >= 500; }

  function handleError(e) {
    if (e instanceof HttpError && e.status === 401) { forgetSession(); return; }
    if (isOffline(e)) { setStatus("offline"); scheduleRetry(); return; }
    console.error("Cloud sync error", e);
    setStatus("error", e.message);
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (meta().dirty) flush(); else sync(); }, 15000);
  }

  // Both this browser and the cloud changed. Ask which to keep.
  async function resolveConflict(row) {
    let useCloud = true;
    try {
      useCloud = window.confirm(
        "Your planner was changed in another browser since this one last synced.\n\n" +
        "OK: load the version from the cloud (changes made here since the last sync will be replaced).\n" +
        "Cancel: keep this browser's version and overwrite the cloud copy."
      );
    } catch (e) { useCloud = true; }
    if (useCloud) {
      hooks.replaceState(row.data);
      setMeta({ version: row.version, dirty: false });
      setStatus("synced");
    } else {
      const r = await push(hooks.getState(), row.version);
      if (r.ok) { setMeta({ version: r.version, dirty: false }); setStatus("synced"); }
      else setTimeout(sync, 500); // changed again in the meantime, start over
    }
  }

  // Send local changes to the cloud.
  async function flush() {
    clearTimeout(timer);
    if (!session || busy) { if (busy) timer = setTimeout(flush, 500); return; }
    busy = true;
    setStatus("saving");
    try {
      const m = meta();
      const r = await push(hooks.getState(), m.version);
      if (r.ok) { setMeta({ version: r.version, dirty: false }); setStatus("synced"); }
      else {
        const row = await pull();
        if (row) await resolveConflict(row);
        else { const again = await push(hooks.getState(), 0); if (again.ok) { setMeta({ version: again.version, dirty: false }); setStatus("synced"); } }
      }
    } catch (e) { handleError(e); }
    finally { busy = false; }
  }

  // Compare this browser with the cloud and bring them in line.
  async function sync() {
    if (!session || busy) return;
    busy = true;
    let next = null;
    setStatus("saving");
    try {
      const m = meta();
      const row = await pull();
      if (!row) {
        // First time for this account: upload what this browser has.
        const r = await push(hooks.getState(), 0);
        if (r.ok) { setMeta({ version: r.version, dirty: false }); setStatus("synced"); }
        else next = sync;
      } else if (row.version === m.version) {
        if (m.dirty) next = flush; else setStatus("synced");
      } else if (!m.dirty || !m.version) {
        // Cloud is newer (or this browser has never synced): load the cloud copy.
        hooks.replaceState(row.data);
        setMeta({ version: row.version, dirty: false });
        setStatus("synced");
      } else {
        await resolveConflict(row);
      }
    } catch (e) { handleError(e); }
    finally { busy = false; ready = true; }
    if (next) return next();
  }

  // Called by the planner after every local save.
  function changed() {
    if (!configured || !ready) return;
    setMeta({ dirty: true });
    if (!session) return;
    setStatus("saving");
    clearTimeout(timer);
    timer = setTimeout(flush, 1000);
  }

  // ---------- sign-in screen ----------
  function showAuth(show) {
    const el = document.getElementById("auth");
    if (!el) return;
    el.hidden = !show;
    document.body.classList.toggle("locked", show);
    if (show) { const email = el.querySelector("input[name=email]"); if (email) setTimeout(() => email.focus(), 0); }
  }

  function wireAuthForm() {
    const form = document.getElementById("auth-form");
    if (!form) return;
    const msg = document.getElementById("auth-msg");
    const say = (t, isError) => { msg.textContent = t; msg.classList.toggle("error", !!isError); };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const mode = e.submitter && e.submitter.value === "signup" ? "signup" : "signin";
      const email = form.elements.email.value.trim(), password = form.elements.password.value;
      if (password.length < 6) { say("Use a password with at least 6 characters.", true); return; }
      form.querySelectorAll("button").forEach((b) => (b.disabled = true));
      say(mode === "signup" ? "Creating your account…" : "Signing in…");
      try {
        if (mode === "signup") {
          const hasSession = await signUp(email, password);
          if (!hasSession) { say("Account created. Check your email for a confirmation link, then come back and sign in."); return; }
        } else {
          await signIn(email, password);
        }
        form.reset(); say("");
        showAuth(false);
        await sync();
      } catch (err) {
        say(err instanceof HttpError ? friendly(err) : "Can't reach the server. Check your connection and try again.", true);
      } finally {
        form.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    });
  }

  function friendly(err) {
    const m = (err.message || "").toLowerCase();
    if (m.includes("invalid login")) return "That email and password don't match. Try again, or create an account.";
    if (m.includes("not confirmed")) return "Please confirm your email first (check your inbox), then sign in.";
    if (m.includes("already registered") || m.includes("already exists")) return "There's already an account with that email. Sign in instead.";
    if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New accounts are turned off for this planner. Sign in with your existing account.";
    return err.message || "Something went wrong. Try again.";
  }

  // ---------- start ----------
  function start(h) {
    hooks = h;
    setStatus(status);
    if (!configured) return;
    wireAuthForm();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && session && !busy) { if (meta().dirty) flush(); else sync(); }
    });
    window.addEventListener("online", () => { if (session) { if (meta().dirty) flush(); else sync(); } });
    window.addEventListener("beforeunload", (e) => {
      if (session && meta().dirty && navigator.onLine && status === "saving") { e.preventDefault(); e.returnValue = ""; }
    });
    if (session) { showAuth(false); sync(); }
    else showAuth(true);
  }

  return {
    configured,
    start,
    changed,
    syncNow: () => (meta().dirty ? flush() : sync()),
    signOut,
    describe,
    get signedIn() { return !!session; },
    get email() { return session && session.user ? session.user.email : ""; }
  };
})();
