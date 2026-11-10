/* TownSteel Social Planner
 * Plain JavaScript, no build step. Everything you edit is saved in this
 * browser (localStorage). Use Strategy & settings > Export to back it up.
 *
 * The strategy itself (pillars, colors, stages, checklists, weekly rhythm,
 * formats, statuses, working rules) lives in the saved data, not in the code,
 * so it can all be changed from the Strategy & settings page.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "townsteel-social-planner-v1";
  const POSTED = "Posted"; // the one status the Performance page relies on
  const COLOR_COUNT = 8;
  const COLOR_NAMES = ["Blue", "Orange", "Aqua", "Yellow", "Pink", "Green", "Violet", "Red"];
  const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const METRICS = [
    ["impressions", "Impressions"],
    ["reactions", "Reactions"],
    ["comments", "Comments"],
    ["reposts", "Reposts"],
    ["clicks", "Clicks"],
    ["followers", "Followers gained"]
  ];
  const DEFAULT_RULES = [
    "Repurpose footage: one testing video can become a product post, an engineering post, and an ODM post.",
    "Batch the work: plan next week's captions and creative together, not day by day.",
    "Keep audiences distinct: AegisSync speaks to multifamily buyers, ODM to prospective manufacturing partners.",
    "Measure each pillar separately and review after four to six weeks.",
    "Five a week is a target to test. Four strong posts beat five repetitive ones."
  ];
  const DEFAULT_STORY = "We make reliable products, we can build for other businesses, and we offer electronic access designed for real applications.";

  // ---------- Date helpers (all dates are "YYYY-MM-DD" in local time) ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
  const mondayOf = (k) => { const d = fromKey(k); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toKey(d); };
  const todayKey = () => toKey(new Date());
  const fmtDate = (k, opts = { month: "short", day: "numeric" }) => fromKey(k).toLocaleDateString("en-US", opts);
  const weekdayOf = (k) => ((fromKey(k).getDay() + 6) % 7) + 1; // 1 = Mon
  const nextMonday = () => { const t = todayKey(); const m = mondayOf(t); return m === t ? t : addDays(m, 7); };
  const weekParity = (weekKey) => Math.abs(Math.round((fromKey(weekKey) - fromKey("2026-01-05")) / (7 * 864e5))) % 2;

  // ---------- Small utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
  const fmtPct = (n) => (n * 100).toFixed(1) + "%";
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- State ----------
  let state;
  const ui = { view: "calendar", week: null, ideaFilter: "all", ideaStatus: "todo", perfRange: "all" };

  function blankPost(fields) {
    return Object.assign({ id: uid(), date: "", pillar: "", title: "", format: "", goal: "", status: "Idea", stage: "", caption: "", asset: "", notes: "", metrics: {} }, fields);
  }

  // US Thanksgiving (4th Thursday of November) and the day after are low-attention days
  function holidayNote(k) {
    const d = fromKey(k);
    if (d.getMonth() !== 10) return "";
    if (d.getDay() === 4 && d.getDate() >= 22 && d.getDate() <= 28) return "US Thanksgiving. Consider moving this post earlier in the week.";
    if (d.getDay() === 5 && d.getDate() >= 23 && d.getDate() <= 29) return "Day after Thanksgiving. Consider a lighter post or skipping.";
    return "";
  }

  function normalizePillar(p, i) {
    const checklist = (p.checklist || []).map((c) => (typeof c === "string" ? { id: uid(), label: c, done: false } : Object.assign({ id: uid(), label: "", done: false }, c)));
    return {
      id: p.id || uid(),
      name: p.name || "New pillar",
      short: p.short || p.name || "New pillar",
      job: p.job || "",
      audience: p.audience || "",
      goal: p.goal || "",
      color: Number.isInteger(p.color) ? p.color : i % COLOR_COUNT,
      archived: !!p.archived,
      stagesEnabled: !!p.stagesEnabled,
      stages: Array.isArray(p.stages) ? p.stages : [],
      stageNotes: p.stageNotes || {},
      checklistTitle: p.checklistTitle || "Checklist",
      checklist
    };
  }

  function seedPillars() { return SEED_PILLARS.map((p, i) => normalizePillar(clone(p), i)); }

  function buildSeed(startMonday) {
    const posts = SEED_POSTS.map(([w, d, pillar, title, format, goal, stage]) => {
      const date = addDays(startMonday, (w - 1) * 7 + (d - 1));
      return blankPost({ date, pillar, title, format, goal, stage: stage || "", notes: holidayNote(date) });
    });
    const ideas = SEED_IDEAS.map(([pillar, title, format, goal, stage]) => blankPost({ pillar, title, format, goal, stage: stage || "" }));
    const weekFocus = {};
    SEED_WEEK_FOCUS.forEach((f, i) => { weekFocus[addDays(startMonday, i * 7)] = f; });
    return { posts, ideas, weekFocus };
  }

  function freshState() {
    const start = nextMonday();
    const seed = buildSeed(start);
    return {
      version: 2,
      story: DEFAULT_STORY,
      pillars: seedPillars(),
      themes: clone(SEED_THEMES),
      statuses: SEED_STATUSES.slice(),
      formats: SEED_FORMATS.slice(),
      rules: DEFAULT_RULES.slice(),
      posts: seed.posts.concat(seed.ideas),
      weekFocus: seed.weekFocus,
      followerLog: [],
      starterWeek: start
    };
  }

  // Accepts saved data or an imported backup (including older versions) and fills any gaps.
  function normalize(s) {
    const base = freshState();
    let pillars = Array.isArray(s.pillars) && s.pillars.length ? s.pillars.map(normalizePillar) : base.pillars;

    // Version 1 kept ODM stages and checklist in the code. Move them into the ODM pillar.
    if ((s.version || 1) < 2) {
      const seedOdm = base.pillars.find((p) => p.id === "odm");
      const odm = pillars.find((p) => p.id === "odm");
      if (odm && seedOdm && !odm.stages.length) {
        const oldIds = ["offer", "claims", "contact", "landing", "media", "names"];
        Object.assign(odm, { stagesEnabled: true, stages: seedOdm.stages, stageNotes: seedOdm.stageNotes, checklistTitle: seedOdm.checklistTitle });
        odm.checklist = seedOdm.checklist.map((c, i) => Object.assign(c, { done: !!(s.odmChecklist || {})[oldIds[i]] }));
      }
    }

    const themes = {};
    for (let d = 1; d <= 5; d++) {
      const t = (s.themes || {})[d] || base.themes[d];
      let pillar = t.pillar || "", alt = t.alt || "";
      if (pillar.startsWith("alt:")) { [pillar, alt] = pillar.slice(4).split("|"); }
      themes[d] = { name: t.name || "", pillar, alt: alt || "" };
    }

    const statuses = Array.isArray(s.statuses) && s.statuses.length ? s.statuses.slice() : base.statuses;
    if (!statuses.includes(POSTED)) statuses.push(POSTED);

    return {
      version: 2,
      story: typeof s.story === "string" ? s.story : base.story,
      pillars,
      themes,
      statuses,
      formats: Array.isArray(s.formats) ? s.formats : base.formats,
      rules: Array.isArray(s.rules) ? s.rules : base.rules,
      posts: (s.posts || []).map((p) => {
        const post = blankPost(p);
        if (!post.stage && p.odmStage) post.stage = p.odmStage;
        delete post.odmStage;
        return post;
      }),
      weekFocus: s.weekFocus || {},
      followerLog: Array.isArray(s.followerLog) ? s.followerLog : [],
      starterWeek: s.starterWeek || base.starterWeek
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.posts)) return normalize(s);
      }
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return freshState();
  }

  let storageOk = true;
  function writeLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {
      if (storageOk && !(window.Cloud && Cloud.configured)) toast("Your browser is blocking storage. Use Export to keep a copy.");
      storageOk = false;
    }
  }
  // Save to this browser right away, then let cloud sync (if set up) send it to your account
  function save() {
    writeLocal();
    if (window.Cloud) Cloud.changed();
  }

  // ---------- Pillar helpers ----------
  const MISSING = { id: "", short: "No pillar", name: "No pillar", color: -1, stages: [], stagesEnabled: false };
  const pillar = (id) => state.pillars.find((p) => p.id === id) || Object.assign({}, MISSING, { id });
  const activePillars = () => state.pillars.filter((p) => !p.archived);
  const colorVar = (c) => (c >= 0 ? `var(--c${c})` : "var(--text-3)");
  const pc = (id) => `--pc:${colorVar(pillar(id).color)}`;
  const hasStages = (p) => p.stagesEnabled && p.stages.length > 0;
  const scheduled = () => state.posts.filter((p) => p.date);
  const ideas = () => state.posts.filter((p) => !p.date);

  // Active pillars, plus any archived/missing pillar the given posts still use
  function pillarsInUse(posts) {
    const ids = new Set(posts.map((p) => p.pillar));
    const list = state.pillars.filter((p) => !p.archived || ids.has(p.id));
    ids.forEach((id) => { if (!state.pillars.some((p) => p.id === id)) list.push(pillar(id)); });
    return list;
  }

  function pillarOptions(selected) {
    const list = activePillars().slice();
    if (selected && !list.some((p) => p.id === selected)) list.push(pillar(selected));
    return list.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.short)}${p.archived ? " (archived)" : ""}</option>`).join("");
  }

  function themeLabel(t) {
    if (!t || !t.pillar) return "Any pillar";
    return t.alt ? `${pillar(t.pillar).short} / ${pillar(t.alt).short} (every other week)` : pillar(t.pillar).short;
  }

  function defaultPillarForDay(wd, weekKey) {
    const t = state.themes[wd];
    const fallback = (activePillars()[0] || {}).id || "";
    if (!t || !t.pillar) return fallback;
    const pick = t.alt && weekParity(weekKey) === 1 ? t.alt : t.pillar;
    const p = state.pillars.find((x) => x.id === pick);
    return p && !p.archived ? pick : fallback;
  }

  // ---------- Pieces ----------
  const pillarChip = (id) => `<span class="chip" style="${pc(id)}"><span class="dot"></span>${esc(pillar(id).short)}</span>`;
  const statusTag = (s) => `<span class="tag ${s === POSTED ? "st-posted" : ""}">${esc(s)}</span>`;
  const stageTag = (p) => (p.stage && hasStages(pillar(p.pillar)) ? `<span class="tag">${esc(p.stage)}</span>` : "");

  // ---------- View: Calendar ----------
  function renderCalendar() {
    const wk = ui.week;
    const days = [1, 2, 3, 4, 5].map((wd) => addDays(wk, wd - 1));
    const weekPosts = scheduled().filter((p) => p.date >= days[0] && p.date <= days[4]);
    const counts = {};
    weekPosts.forEach((p) => { counts[p.pillar] = (counts[p.pillar] || 0) + 1; });
    const total = weekPosts.length;
    const today = todayKey();
    const legendPillars = pillarsInUse(weekPosts);

    const mixLegend = legendPillars.map((p) => `<span class="chip" style="${pc(p.id)}"><span class="dot"></span>${esc(p.short)} ${counts[p.id] || 0}</span>`).join("");
    const mixBar = legendPillars.filter((p) => counts[p.id]).map((p) => `<span style="${pc(p.id)};flex:${counts[p.id]}"></span>`).join("");

    const cols = days.map((dk, i) => {
      const wd = i + 1;
      const t = state.themes[wd];
      const posts = weekPosts.filter((p) => p.date === dk);
      return `<div class="day ${dk === today ? "today" : ""}">
        <div class="day-head"><span class="day-name">${DAY_NAMES[wd]}</span><span class="day-date">${fmtDate(dk)}</span></div>
        <div class="day-theme">${esc(t && t.name ? t.name : "No theme")}<br><span class="faint">${esc(themeLabel(t))}</span></div>
        ${posts.map(postCard).join("")}
        <button class="add-slot" data-add="${dk}">+ Add post</button>
      </div>`;
    }).join("");

    $("#view-calendar").innerHTML = `
      <div class="week-bar">
        <button class="icon-btn" data-week="-1" aria-label="Previous week">&#8592;</button>
        <button class="icon-btn" data-week="1" aria-label="Next week">&#8594;</button>
        <h2>Week of ${fmtDate(wk, { month: "long", day: "numeric", year: "numeric" })}</h2>
        <button class="btn small" data-week="today">This week</button>
        <input class="week-focus" id="week-focus" type="text" placeholder="Add a focus for this week" value="${esc(state.weekFocus[wk] || "")}" aria-label="Week focus">
        <button class="btn small" id="copy-week">Copy week plan</button>
      </div>
      <div class="mix">
        <span class="faint">${total} post${total === 1 ? "" : "s"} this week</span>
        <div class="mix-bar" aria-hidden="true">${mixBar}</div>
        ${mixLegend}
      </div>
      <div class="week-grid">${cols}</div>`;
  }

  function postCard(p) {
    return `<button class="post-card" style="${pc(p.pillar)}" data-edit="${p.id}">
      <span class="chip">${esc(pillar(p.pillar).short)}</span>
      <span class="title">${esc(p.title || "Untitled post")}</span>
      ${p.format ? `<span class="format">${esc(p.format)}</span>` : ""}
      <span class="meta">${statusTag(p.status)}${stageTag(p)}</span>
      ${p.notes ? `<span class="faint">${esc(p.notes)}</span>` : ""}
    </button>`;
  }

  function copyWeek() {
    const wk = ui.week;
    const lines = [`Week of ${fmtDate(wk, { month: "long", day: "numeric", year: "numeric" })}${state.weekFocus[wk] ? ": " + state.weekFocus[wk] : ""}`, ""];
    for (let wd = 1; wd <= 5; wd++) {
      const dk = addDays(wk, wd - 1);
      const t = state.themes[wd];
      scheduled().filter((p) => p.date === dk).forEach((p) => {
        lines.push(`${DAY_NAMES[wd]} ${fmtDate(dk)}${t && t.name ? ` (${t.name})` : ""} | ${pillar(p.pillar).short}${p.stage ? " | " + p.stage : ""}`);
        lines.push(`  ${p.title}`);
        if (p.format) lines.push(`  Format: ${p.format}`);
        if (p.goal) lines.push(`  Goal: ${p.goal}`);
        lines.push(`  Status: ${p.status}`);
        lines.push("");
      });
    }
    copyText(lines.join("\n"), "Week plan copied");
  }

  function copyText(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed"); }
    ta.remove();
  }

  // ---------- View: Idea bank ----------
  function ideaCard(p) {
    const posted = p.status === POSTED;
    return `<div class="card idea ${posted ? "is-posted" : ""}" style="${pc(p.pillar)}">
      <div class="row spread">${pillarChip(p.pillar)}<span class="row" style="gap:6px">${stageTag(p)}${statusTag(p.status)}</span></div>
      <div class="title">${esc(p.title || "Untitled idea")}</div>
      ${p.format ? `<div class="faint">${esc(p.format)}</div>` : ""}
      ${p.goal ? `<div class="muted" style="font-size:14px">${esc(p.goal)}</div>` : ""}
      ${posted ? `<div class="faint">Add the date it went live to move it onto the calendar and count it in Performance.</div>` : ""}
      <div class="actions">
        ${posted
          ? `<button class="btn small primary" data-edit="${p.id}">Add post date</button>`
          : `<button class="btn small primary" data-schedule="${p.id}">Schedule</button><button class="btn small" data-edit="${p.id}">Edit</button>`}
      </div>
    </div>`;
  }

  function renderIdeas() {
    const all = ideas();
    const byStatus = {
      todo: all.filter((p) => p.status !== POSTED),
      posted: all.filter((p) => p.status === POSTED),
      all
    };
    if (!byStatus[ui.ideaStatus]) ui.ideaStatus = "todo";
    const inStatus = byStatus[ui.ideaStatus];
    const filterPillars = pillarsInUse(inStatus);
    if (ui.ideaFilter !== "all" && !filterPillars.some((p) => p.id === ui.ideaFilter)) ui.ideaFilter = "all";
    const list = inStatus.filter((p) => ui.ideaFilter === "all" || p.pillar === ui.ideaFilter);

    const statusTabs = [["todo", "Not posted yet"], ["posted", POSTED], ["all", "All"]]
      .map(([v, l]) => `<button class="pill-btn ${ui.ideaStatus === v ? "active" : ""}" data-ideastatus="${v}">${esc(l)} <span class="faint">${byStatus[v].length}</span></button>`).join("");
    const pillarTabs = [`<button class="pill-btn ${ui.ideaFilter === "all" ? "active" : ""}" data-ideafilter="all">All pillars <span class="faint">${inStatus.length}</span></button>`]
      .concat(filterPillars.map((p) => `<button class="pill-btn ${ui.ideaFilter === p.id ? "active" : ""}" data-ideafilter="${esc(p.id)}">${esc(p.short)} <span class="faint">${inStatus.filter((x) => x.pillar === p.id).length}</span></button>`)).join("");

    // In "All", keep ideas still in play on top and posted ones in their own section below
    const open = list.filter((p) => p.status !== POSTED), done = list.filter((p) => p.status === POSTED);
    let body;
    if (!list.length) {
      body = `<div class="empty">${ui.ideaStatus === "posted" ? `Nothing marked ${POSTED} in the idea bank.` : "No ideas here yet."}</div>`;
    } else if (ui.ideaStatus === "all" && open.length && done.length) {
      body = `<div class="idea-list">${open.map(ideaCard).join("")}</div>
        <h3 class="list-divider">${POSTED} <span class="faint">${done.length}</span></h3>
        <div class="idea-list">${done.map(ideaCard).join("")}</div>`;
    } else {
      body = `<div class="idea-list">${list.map(ideaCard).join("")}</div>`;
    }

    $("#view-ideas").innerHTML = `
      <div class="section-head row spread">
        <div><h2>Idea bank</h2><p>Unscheduled ideas, swaps for the flexible Friday slot, and ways to repurpose footage. Schedule one when a slot opens up.</p></div>
        <button class="btn primary" data-add="">+ New idea</button>
      </div>
      <div class="filters" role="group" aria-label="Filter by status">${statusTabs}</div>
      <div class="filters" role="group" aria-label="Filter by pillar">${pillarTabs}</div>
      ${body}`;
  }

  // ---------- View: Journeys (stages for any pillar) ----------
  function renderJourneys() {
    const journeys = activePillars().filter(hasStages);
    const body = journeys.map((pl) => {
      const posts = state.posts.filter((p) => p.pillar === pl.id).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
      const col = (stage) => {
        const items = posts.filter((p) => p.stage === stage);
        const note = pl.stageNotes[stage];
        return `<div class="card stage">
          <h3>${esc(stage)} <span class="count">${items.length}</span></h3>
          ${note ? `<p class="faint">${esc(note)}</p>` : ""}
          ${items.map((p) => `<button class="item" data-edit="${p.id}">${esc(p.title || "Untitled")}<small>${p.date ? fmtDate(p.date, { weekday: "short", month: "short", day: "numeric" }) : "In idea bank"} · ${esc(p.status)}</small></button>`).join("") || `<div class="empty">Nothing planned yet</div>`}
        </div>`;
      };
      const untagged = posts.filter((p) => !pl.stages.includes(p.stage));
      const done = pl.checklist.filter((c) => c.done).length;
      return `<section class="journey" style="${pc(pl.id)}">
        <div class="journey-head"><span class="dot" style="width:12px;height:12px"></span><h3>${esc(pl.name)}</h3>
          <button class="btn small" data-editpillar="${pl.id}">Edit stages</button></div>
        <div class="stages" style="--n:${Math.min(pl.stages.length, 5)}">${pl.stages.map(col).join("")}</div>
        ${untagged.length ? `<div class="card" style="margin-bottom:16px"><h3 style="font-size:15px;margin-bottom:8px">Needs a stage (${untagged.length})</h3>${untagged.map((p) => `<button class="btn small" data-edit="${p.id}" style="margin:0 6px 6px 0">${esc(p.title || "Untitled")}</button>`).join("")}</div>` : ""}
        <div class="card">
          <div class="row spread" style="margin-bottom:6px"><h3 style="font-size:16px">${esc(pl.checklistTitle)}</h3><span class="faint">${done} of ${pl.checklist.length} done</span></div>
          ${pl.checklist.map((c) => `
            <div class="check-item ${c.done ? "done" : ""}">
              <label><input type="checkbox" data-check="${pl.id}:${c.id}" ${c.done ? "checked" : ""}><span>${esc(c.label)}</span></label>
              <button class="x" data-delcheck="${pl.id}:${c.id}" aria-label="Remove item">✕</button>
            </div>`).join("")}
          <form class="add-row" data-addcheck="${pl.id}" style="margin-top:12px">
            <input type="text" name="label" placeholder="Add a checklist item" aria-label="New checklist item" required>
            <button class="btn" type="submit">Add</button>
          </form>
        </div>
      </section>`;
    }).join("");

    $("#view-journeys").innerHTML = `
      <div class="section-head"><h2>Journeys</h2>
        <p>Some pillars need to build a story in steps, like ODM: awareness first, then credibility, then a direct invitation. Turn on stages for any pillar in Strategy &amp; settings, then tag each post with its stage.</p></div>
      ${body || `<div class="empty">No pillars have stages turned on. Go to Strategy &amp; settings, edit a pillar, and turn on "Track this pillar in stages".</div>`}`;
  }

  // ---------- View: Performance ----------
  function perfPosts() {
    let list = scheduled().filter((p) => p.status === POSTED);
    if (ui.perfRange !== "all") {
      const from = addDays(todayKey(), -Number(ui.perfRange) * 7);
      list = list.filter((p) => p.date >= from);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }
  const engagements = (m) => num(m.reactions) + num(m.comments) + num(m.reposts) + num(m.clicks);

  function renderPerformance() {
    const list = perfPosts();
    const withData = list.filter((p) => num(p.metrics.impressions) > 0);
    const totImp = list.reduce((s, p) => s + num(p.metrics.impressions), 0);
    const totEng = withData.reduce((s, p) => s + engagements(p.metrics), 0);
    const totImpData = withData.reduce((s, p) => s + num(p.metrics.impressions), 0);
    const totFol = list.reduce((s, p) => s + num(p.metrics.followers), 0);

    const byPillar = pillarsInUse(withData).map((pl) => {
      const ps = withData.filter((p) => p.pillar === pl.id);
      const imp = ps.reduce((s, p) => s + num(p.metrics.impressions), 0);
      const eng = ps.reduce((s, p) => s + engagements(p.metrics), 0);
      return { pl, n: ps.length, avgImp: ps.length ? imp / ps.length : 0, rate: imp ? eng / imp : 0, clicks: ps.reduce((s, p) => s + num(p.metrics.clicks), 0) };
    });
    const maxImp = Math.max(1, ...byPillar.map((b) => b.avgImp));
    const maxRate = Math.max(0.0001, ...byPillar.map((b) => b.rate));
    const bars = (key, max, fmt) => byPillar.map((b) => `
      <div class="hbar" style="${pc(b.pl.id)}" data-tip="${esc(`<b>${esc(b.pl.short)}</b>${b.n} post${b.n === 1 ? "" : "s"} with results<br>Avg impressions: ${fmtNum(b.avgImp)}<br>Engagement rate: ${fmtPct(b.rate)}<br>Clicks: ${fmtNum(b.clicks)}`)}">
        <span class="name">${esc(b.pl.short)}</span>
        <span class="track"><span class="fill" style="display:block;width:${b.n ? Math.max(1, (b[key] / max) * 100) : 0}%"></span></span>
        <span class="val">${b.n ? fmt(b[key]) : "–"}</span>
      </div>`).join("");

    const ranges = [["all", "All time"], ["4", "Last 4 weeks"], ["8", "Last 8 weeks"]]
      .map(([v, l]) => `<button class="pill-btn ${ui.perfRange === v ? "active" : ""}" data-range="${v}">${l}</button>`).join("");

    const log = state.followerLog.slice().sort((a, b) => a.date.localeCompare(b.date));
    const logRows = log.map((e, i) => {
      const prev = i > 0 ? log[i - 1].count : null;
      const delta = prev == null ? "" : (e.count - prev >= 0 ? "+" : "") + fmtNum(e.count - prev);
      return `<tr><td>${fmtDate(e.date, { month: "short", day: "numeric", year: "numeric" })}</td><td class="num">${fmtNum(e.count)}</td><td class="num">${delta}</td><td class="num"><button class="btn small ghost" data-dellog="${e.date}" aria-label="Remove entry">✕</button></td></tr>`;
    }).reverse().join("");

    $("#view-performance").innerHTML = `
      <div class="section-head row spread">
        <div><h2>Performance</h2><p>Log results for posts marked ${POSTED} (open a post and fill in Results). Review by pillar after four to six weeks: are the right people engaging, not just the most people?</p></div>
        <div class="filters" style="margin:0">${ranges}</div>
      </div>
      <div class="kpis">
        <div class="card kpi"><div class="label">Posts published</div><div class="value">${list.length}</div><div class="note">${withData.length} with results logged</div></div>
        <div class="card kpi"><div class="label">Impressions</div><div class="value">${fmtNum(totImp)}</div><div class="note">${withData.length ? fmtNum(totImpData / withData.length) + " per post" : "No results yet"}</div></div>
        <div class="card kpi"><div class="label">Engagement rate</div><div class="value">${totImpData ? fmtPct(totEng / totImpData) : "–"}</div><div class="note">(reactions + comments + reposts + clicks) / impressions</div></div>
        <div class="card kpi"><div class="label">Followers from posts</div><div class="value">${fmtNum(totFol)}</div><div class="note">From the per-post field</div></div>
      </div>
      <div class="charts">
        <div class="card chart"><h3>Average impressions per post, by pillar</h3><p class="faint">Reach: who is seeing each pillar</p>${byPillar.length ? bars("avgImp", maxImp, fmtNum) : `<div class="empty">No results logged yet</div>`}</div>
        <div class="card chart"><h3>Engagement rate, by pillar</h3><p class="faint">Resonance: how much each pillar gets people to act</p>${byPillar.length ? bars("rate", maxRate, fmtPct) : `<div class="empty">No results logged yet</div>`}</div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="row spread" style="margin-bottom:8px"><h3 style="font-size:15px">Posted content</h3><button class="btn small" id="export-csv">Export CSV</button></div>
          ${list.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Post</th><th class="num">Impr.</th><th class="num">Eng. rate</th><th class="num">Clicks</th></tr></thead>
            <tbody>${list.map((p) => {
              const imp = num(p.metrics.impressions);
              return `<tr class="clickable" data-edit="${p.id}"><td>${fmtDate(p.date)}</td><td class="title-cell">${pillarChip(p.pillar)}<br>${esc(p.title)}</td><td class="num">${imp ? fmtNum(imp) : "–"}</td><td class="num">${imp ? fmtPct(engagements(p.metrics) / imp) : "–"}</td><td class="num">${p.metrics.clicks !== undefined && p.metrics.clicks !== "" ? fmtNum(num(p.metrics.clicks)) : "–"}</td></tr>`;
            }).join("")}</tbody></table></div>` : `<div class="empty">Nothing marked ${POSTED} in this range yet. Open a post in the calendar and set its status to ${POSTED}.</div>`}
        </div>
        <div class="card">
          <h3 style="font-size:15px;margin-bottom:4px">Page follower log</h3>
          <p class="faint" style="margin-bottom:12px">Once a week, copy the total follower count from LinkedIn page analytics.</p>
          <form id="log-form" class="row" style="margin-bottom:10px">
            <input type="date" name="date" value="${todayKey()}" required style="flex:1 1 140px;width:auto" aria-label="Date">
            <input type="number" name="count" min="0" placeholder="Total followers" required style="flex:1 1 140px;width:auto" aria-label="Total followers">
            <button class="btn primary" type="submit">Add</button>
          </form>
          ${log.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Followers</th><th class="num">Change</th><th></th></tr></thead><tbody>${logRows}</tbody></table></div>` : `<div class="empty">No entries yet.</div>`}
        </div>
      </div>`;
  }

  function exportCsv() {
    const head = ["Date", "Pillar", "Stage", "Title", "Format", "Status", ...METRICS.map((m) => m[1]), "Engagement rate", "Asset link"];
    const rows = scheduled().sort((a, b) => a.date.localeCompare(b.date)).map((p) => {
      const imp = num(p.metrics.impressions);
      return [p.date, pillar(p.pillar).short, p.stage, p.title, p.format, p.status, ...METRICS.map((m) => p.metrics[m[0]] ?? ""), imp ? (engagements(p.metrics) / imp).toFixed(4) : "", p.asset];
    });
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`townsteel-linkedin-posts-${todayKey()}.csv`, csv, "text/csv");
  }

  // ---------- View: Strategy & settings ----------
  function listEditor(kind, items, placeholder, locked) {
    return `<div class="chip-list">${items.map((it, i) => locked && locked.includes(it)
      ? `<span class="chip-edit locked" title="Always kept">${esc(it)}</span>`
      : `<span class="chip-edit">${esc(it)}<button type="button" data-listdel="${kind}:${i}" aria-label="Remove ${esc(it)}">✕</button></span>`).join("")}</div>
      <form class="add-row" data-listadd="${kind}"><input type="text" name="value" placeholder="${esc(placeholder)}" required aria-label="${esc(placeholder)}"><button class="btn" type="submit">Add</button></form>`;
  }

  function renderStrategy() {
    const optsFor = (selected, allowNone) => (allowNone ? `<option value="" ${!selected ? "selected" : ""}>${allowNone}</option>` : "") + pillarOptions(selected);
    const themeRows = [1, 2, 3, 4, 5].map((wd) => {
      const t = state.themes[wd];
      return `<div class="theme-row"><strong>${DAY_NAMES[wd]}</strong>
        <input type="text" data-themename="${wd}" value="${esc(t.name)}" placeholder="Theme name" aria-label="${DAY_NAMES[wd]} theme name">
        <select data-themepillar="${wd}" aria-label="${DAY_NAMES[wd]} pillar">${optsFor(t.pillar, "Any pillar")}</select>
        <select data-themealt="${wd}" aria-label="${DAY_NAMES[wd]} alternate pillar">${optsFor(t.alt, "No alternating")}</select></div>`;
    }).join("");

    const pillarCards = state.pillars.map((p, i) => {
      const used = state.posts.filter((x) => x.pillar === p.id).length;
      return `<div class="card pillar-card ${p.archived ? "archived" : ""}" style="${pc(p.id)}">
        <div class="row spread"><h3>${esc(p.name)}</h3>${p.archived ? `<span class="tag">Archived</span>` : ""}</div>
        ${pillarChip(p.id)} ${p.job ? `<span class="faint">· ${esc(p.job)}</span>` : ""}
        <dl>
          ${p.audience ? `<dt>Audience</dt><dd>${esc(p.audience)}</dd>` : ""}
          ${p.goal ? `<dt>Job</dt><dd>${esc(p.goal)}</dd>` : ""}
          ${hasStages(p) ? `<dt>Stages</dt><dd>${p.stages.map(esc).join(" → ")}</dd>` : ""}
          <dt>Posts and ideas</dt><dd>${used}</dd>
        </dl>
        <div class="card-actions">
          <button class="btn small" data-editpillar="${p.id}">Edit</button>
          <button class="btn small" data-movepillar="${p.id}:-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button class="btn small" data-movepillar="${p.id}:1" ${i === state.pillars.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button class="btn small" data-archivepillar="${p.id}">${p.archived ? "Restore" : "Archive"}</button>
        </div>
      </div>`;
    }).join("");

    $("#view-strategy").innerHTML = `
      <div class="section-head"><h2>Strategy</h2></div>
      <label class="field" style="margin-bottom:20px">The story every post supports
        <input type="text" id="story" value="${esc(state.story)}" placeholder="One sentence your whole page should add up to">
      </label>

      <div class="section-head row spread"><div><h3 style="font-size:18px">Content pillars</h3><p>Add, rename, recolor, or reorder pillars. Archiving a pillar hides it from new posts but keeps its history and results.</p></div>
        <button class="btn primary" data-editpillar="">+ Add pillar</button></div>
      <div class="pillar-cards">${pillarCards}</div>

      <div class="grid-2" style="margin-bottom:16px">
        <div class="card"><h3 style="font-size:16px;margin-bottom:6px">Weekly rhythm</h3>
          <p class="faint" style="margin-bottom:8px">Each day has a purpose, not a fixed product. New posts default to that day's pillar. Pick a second pillar to switch between the two every other week.</p>
          <div class="theme-row faint" style="padding-top:0"><span></span><span>Theme</span><span>Pillar</span><span>Every other week</span></div>
          ${themeRows}</div>
        <div class="card"><h3 style="font-size:16px;margin-bottom:8px">Working rules</h3>
          <div class="checklist">${state.rules.map((r, i) => `<div class="check-item"><span style="flex:1;color:var(--text-2)">${esc(r)}</span><button class="x" data-listdel="rules:${i}" aria-label="Remove rule">✕</button></div>`).join("")}</div>
          <form class="add-row" data-listadd="rules" style="margin-top:12px"><input type="text" name="value" placeholder="Add a rule" required aria-label="Add a rule"><button class="btn" type="submit">Add</button></form>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:16px">
        <div class="card"><h3 style="font-size:16px;margin-bottom:4px">Formats</h3>
          <p class="faint" style="margin-bottom:10px">Suggested in the post editor. You can still type anything.</p>
          ${listEditor("formats", state.formats, "Add a format")}</div>
        <div class="card"><h3 style="font-size:16px;margin-bottom:4px">Statuses</h3>
          <p class="faint" style="margin-bottom:10px">Your workflow steps, in order. "${POSTED}" is always kept because Performance counts it.</p>
          ${listEditor("statuses", state.statuses, "Add a status", [POSTED])}</div>
      </div>

      <div class="section-head" style="margin-top:28px"><h2>Your data</h2><p>${window.Cloud && Cloud.configured
        ? "Changes save to this browser instantly and to your account in the cloud a second later, so the planner is the same on every browser you sign in to."
        : "Everything saves automatically in this browser on this computer. Set up cloud sync (see SETUP-CLOUD-SYNC.md) to use it on any browser."}</p></div>
      <div class="card" style="margin-bottom:12px"><h3 style="font-size:15px;margin-bottom:6px">Cloud sync</h3>
        <p class="faint" id="sync-info" style="margin-bottom:10px">${window.Cloud ? esc(Cloud.describe()) : ""}</p>
        ${window.Cloud && Cloud.configured && Cloud.signedIn ? `<div class="row"><button class="btn" id="sync-now">Sync now</button><button class="btn" id="sign-out">Sign out</button></div>` : ""}
      </div>
      <div class="grid-2">
        <div class="card"><h3 style="font-size:15px;margin-bottom:10px">Backup</h3>
          <div class="row">
            <button class="btn primary" id="export-json">Export backup (.json)</button>
            <label class="btn" for="import-file" style="cursor:pointer">Import backup</label>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
          </div>
          <p class="faint" style="margin-top:10px">${state.posts.length} posts and ideas, ${state.pillars.length} pillars saved.</p>
        </div>
        <div class="card"><h3 style="font-size:15px;margin-bottom:10px">Starter plan</h3>
          <p class="faint" style="margin-bottom:10px">Add the 20 starter post concepts again as a four-week block beginning on the Monday you pick. Existing posts stay.</p>
          <div class="row">
            <input type="date" id="starter-date" value="${nextMonday()}" style="width:auto" aria-label="Start date">
            <button class="btn" id="add-starter">Add starter weeks</button>
            <button class="btn danger" id="reset-all">Reset everything</button>
          </div>
        </div>
      </div>`;
  }

  // ---------- Dialog helpers ----------
  const dlg = () => $("#editor");
  function openDialog() { const d = dlg(); if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", ""); }
  function closeEditor() { const d = dlg(); if (d.open) d.close(); }
  function confirmAction(msg) { try { return window.confirm(msg); } catch (e) { return true; } }

  // ---------- Post editor ----------
  function stageOptions(pillarId, selected) {
    const pl = pillar(pillarId);
    const list = hasStages(pl) ? pl.stages : [];
    return [`<option value="">Not set</option>`].concat(list.map((s) => `<option ${s === selected ? "selected" : ""}>${esc(s)}</option>`)).join("");
  }

  function openPostEditor(post, isNew) {
    const p = Object.assign({}, post, { metrics: Object.assign({}, post.metrics) });
    if (!p.pillar) p.pillar = (activePillars()[0] || {}).id || "";
    const form = $("#editor-form");
    const statuses = state.statuses.includes(p.status) ? state.statuses : state.statuses.concat(p.status);
    const statusOpts = statuses.map((s) => `<option ${p.status === s ? "selected" : ""}>${esc(s)}</option>`).join("");
    const heading = isNew ? (p.date ? "New post" : "New idea") : (p.date ? "Edit post" : "Edit idea");

    form.innerHTML = `
      <div class="dlg-head"><h2 id="editor-title">${heading}</h2><button type="button" class="btn ghost" data-close aria-label="Close">✕</button></div>
      <div class="dlg-body">
        <label class="field">Title<input type="text" name="title" value="${esc(p.title)}" required placeholder="Working headline or hook"></label>
        <div class="form-3">
          <label class="field">Date<input type="date" name="date" value="${esc(p.date)}"><span class="faint">Leave empty to keep it in the idea bank</span></label>
          <label class="field">Pillar<select name="pillar">${pillarOptions(p.pillar)}</select></label>
          <label class="field">Status<select name="status">${statusOpts}</select></label>
        </div>
        <div class="form-2">
          <label class="field">Format<input type="text" name="format" list="format-list" value="${esc(p.format)}" placeholder="Pick or type a format"></label>
          <label class="field" id="stage-field" ${hasStages(pillar(p.pillar)) ? "" : "hidden"}>Stage<select name="stage">${stageOptions(p.pillar, p.stage)}</select></label>
        </div>
        <datalist id="format-list">${state.formats.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
        <label class="field">Goal<input type="text" name="goal" value="${esc(p.goal)}" placeholder="What should this post do?"></label>
        <label class="field">Caption<textarea name="caption" rows="6" placeholder="Draft your LinkedIn caption here">${esc(p.caption)}</textarea><span class="counter" id="cap-count"></span></label>
        <div class="form-2">
          <label class="field">Asset link<input type="url" name="asset" value="${esc(p.asset)}" placeholder="Canva, Drive, or Dropbox link"></label>
          <label class="field">Notes<input type="text" name="notes" value="${esc(p.notes)}" placeholder="Approvals, tags, reminders"></label>
        </div>
        <fieldset><legend>Results (fill in after posting)</legend>
          <div class="form-3">${METRICS.map(([k, l]) => `<label class="field">${l}<input type="number" min="0" name="m_${k}" value="${esc(p.metrics[k] ?? "")}"></label>`).join("")}</div>
        </fieldset>
      </div>
      <div class="dlg-foot">
        <div class="row">${isNew ? "" : `<button type="button" class="btn danger" data-delete>Delete</button><button type="button" class="btn" data-duplicate>Duplicate</button>`}</div>
        <div class="row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div>
      </div>`;

    const cap = form.elements.caption, counter = $("#cap-count");
    const updateCount = () => {
      const n = cap.value.length;
      counter.textContent = `${n.toLocaleString("en-US")} / 3,000 characters${n > 210 ? " · roughly the first 210 show before \"see more\"" : ""}`;
      counter.classList.toggle("warn", n > 3000);
    };
    cap.addEventListener("input", updateCount); updateCount();
    form.elements.pillar.addEventListener("change", (e) => {
      $("#stage-field").hidden = !hasStages(pillar(e.target.value));
      form.elements.stage.innerHTML = stageOptions(e.target.value, "");
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const f = form.elements;
      const metrics = {};
      METRICS.forEach(([k]) => { const v = f["m_" + k].value; if (v !== "") metrics[k] = Number(v); });
      const updated = Object.assign(p, {
        title: f.title.value.trim(), date: f.date.value, pillar: f.pillar.value, status: f.status.value,
        format: f.format.value.trim(), stage: hasStages(pillar(f.pillar.value)) ? f.stage.value : "",
        goal: f.goal.value.trim(), caption: f.caption.value, asset: f.asset.value.trim(), notes: f.notes.value.trim(), metrics
      });
      const i = state.posts.findIndex((x) => x.id === updated.id);
      if (i >= 0) state.posts[i] = updated; else state.posts.push(updated);
      save(); closeEditor(); render();
      toast(isNew ? "Added" : "Saved");
    };
    form.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeEditor));
    const del = form.querySelector("[data-delete]");
    if (del) del.addEventListener("click", () => {
      if (!confirmAction("Delete this post? This cannot be undone.")) return;
      state.posts = state.posts.filter((x) => x.id !== p.id);
      save(); closeEditor(); render(); toast("Deleted");
    });
    const dup = form.querySelector("[data-duplicate]");
    if (dup) dup.addEventListener("click", () => {
      const copy = Object.assign(clone(post), { id: uid(), title: post.title + " (copy)", status: state.statuses[0] || "Idea", metrics: {} });
      state.posts.push(copy); save(); render(); openPostEditor(copy, false); toast("Duplicated");
    });

    openDialog();
    form.elements.title.focus();
  }

  function newPost(date) {
    const wk = date ? mondayOf(date) : ui.week;
    const pid = date ? defaultPillarForDay(weekdayOf(date), wk) : (ui.ideaFilter !== "all" ? ui.ideaFilter : (activePillars()[0] || {}).id);
    return blankPost({ date: date || "", pillar: pid || "", status: state.statuses[0] || "Idea" });
  }

  // ---------- Pillar editor ----------
  function openPillarEditor(id) {
    const isNew = !id;
    const used = new Set(state.pillars.filter((p) => p.id !== id && !p.archived).map((p) => p.color));
    const firstFree = [...Array(COLOR_COUNT).keys()].find((c) => !used.has(c));
    const p = isNew ? normalizePillar({ id: uid(), name: "", short: "", color: firstFree ?? 0, checklistTitle: "Checklist" }, 0) : clone(pillar(id));
    const postCount = state.posts.filter((x) => x.pillar === p.id).length;
    const stagesText = p.stages.map((s) => (p.stageNotes[s] ? `${s}: ${p.stageNotes[s]}` : s)).join("\n");
    const form = $("#editor-form");

    form.innerHTML = `
      <div class="dlg-head"><h2 id="editor-title">${isNew ? "New pillar" : "Edit pillar"}</h2><button type="button" class="btn ghost" data-close aria-label="Close">✕</button></div>
      <div class="dlg-body">
        <div class="form-2">
          <label class="field">Pillar name<input type="text" name="name" value="${esc(p.name)}" required placeholder="e.g. School Security"></label>
          <label class="field">Short label<input type="text" name="short" value="${esc(p.short)}" placeholder="Shown on calendar cards" maxlength="24"></label>
        </div>
        <label class="field">Job<input type="text" name="job" value="${esc(p.job)}" placeholder="e.g. Product growth, Business development"></label>
        <label class="field">Audience<input type="text" name="audience" value="${esc(p.audience)}" placeholder="Who this pillar is talking to"></label>
        <label class="field">What this pillar should do<input type="text" name="goal" value="${esc(p.goal)}" placeholder="The outcome you want from these posts"></label>
        <div class="field">Color
          <div class="swatches" role="radiogroup" aria-label="Pillar color">${[...Array(COLOR_COUNT).keys()].map((c) => `
            <label class="swatch ${used.has(c) ? "used" : ""}" style="--pc:${colorVar(c)}" title="${COLOR_NAMES[c]}${used.has(c) ? " (used by another pillar)" : ""}">
              <input type="radio" name="color" value="${c}" ${p.color === c ? "checked" : ""} aria-label="${COLOR_NAMES[c]}"><span></span></label>`).join("")}
          </div>
          <span class="faint">A gray dot means another active pillar already uses that color.</span>
        </div>
        <fieldset><legend>Journey</legend>
          <label class="row" style="margin-bottom:10px;cursor:pointer"><input type="checkbox" name="stagesEnabled" ${p.stagesEnabled ? "checked" : ""}> Track this pillar in stages</label>
          <div id="stage-config" ${p.stagesEnabled ? "" : "hidden"} style="display:grid;gap:12px">
            <label class="field">Stages, in order, one per line. Add a description after a colon if you like.
              <textarea name="stages" rows="4" placeholder="Awareness: Introduce the idea&#10;Credibility: Show proof&#10;Conversion: Ask for the conversation">${esc(stagesText)}</textarea></label>
            <label class="field">Checklist title<input type="text" name="checklistTitle" value="${esc(p.checklistTitle)}"></label>
            <span class="faint">Add checklist items on the Journeys page.</span>
          </div>
        </fieldset>
      </div>
      <div class="dlg-foot">
        <div class="row">${isNew ? "" : `<button type="button" class="btn danger" data-delpillar ${postCount ? `title="Used by ${postCount} posts. Archive it instead, or move those posts first."` : ""}>Delete</button>`}</div>
        <div class="row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div>
      </div>`;

    form.elements.stagesEnabled.addEventListener("change", (e) => { $("#stage-config").hidden = !e.target.checked; });
    form.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeEditor));

    const delBtn = form.querySelector("[data-delpillar]");
    if (delBtn) delBtn.addEventListener("click", () => {
      if (postCount) { toast(`${postCount} posts use this pillar. Archive it instead to keep their history.`); return; }
      if (!confirmAction(`Delete the "${p.name}" pillar?`)) return;
      state.pillars = state.pillars.filter((x) => x.id !== p.id);
      clearThemeRefs(p.id);
      save(); closeEditor(); render(); toast("Pillar deleted");
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const f = form.elements;
      const parsed = f.stages.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const i = l.indexOf(":");
        return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""];
      });
      const seen = new Set();
      const unique = parsed.filter(([n]) => (seen.has(n.toLowerCase()) ? false : seen.add(n.toLowerCase())));
      const newStages = unique.map(([n]) => n);
      const stageNotes = {};
      unique.forEach(([n, note]) => { if (note) stageNotes[n] = note; });

      // If a stage was renamed in place, carry its posts over to the new name
      p.stages.forEach((old, i) => {
        const replacement = newStages[i];
        if (!newStages.includes(old) && replacement && !p.stages.includes(replacement)) {
          state.posts.forEach((post) => { if (post.pillar === p.id && post.stage === old) post.stage = replacement; });
        }
      });

      const name = f.name.value.trim();
      Object.assign(p, {
        name, short: f.short.value.trim() || name, job: f.job.value.trim(), audience: f.audience.value.trim(), goal: f.goal.value.trim(),
        color: Number(f.color.value), stagesEnabled: f.stagesEnabled.checked, stages: newStages, stageNotes,
        checklistTitle: f.checklistTitle.value.trim() || "Checklist"
      });
      const i = state.pillars.findIndex((x) => x.id === p.id);
      if (i >= 0) state.pillars[i] = p; else state.pillars.push(p);
      save(); closeEditor(); render(); toast(isNew ? "Pillar added" : "Pillar saved");
    };

    openDialog();
    form.elements.name.focus();
  }

  function clearThemeRefs(id) {
    Object.values(state.themes).forEach((t) => {
      if (t.pillar === id) { t.pillar = t.alt || ""; t.alt = ""; }
      if (t.alt === id) t.alt = "";
    });
  }

  // ---------- Import / export ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.posts)) throw new Error("bad file");
        if (!confirmAction("Replace everything in this planner with the backup?")) return;
        state = normalize(data); save(); render(); toast("Backup imported");
      } catch (e) { toast("That file doesn't look like a planner backup"); }
    };
    reader.readAsText(file);
  }

  // ---------- Tooltip ----------
  document.addEventListener("mousemove", (e) => {
    const el = e.target.closest("[data-tip]");
    const t = $("#tip");
    if (!el) { t.classList.remove("show"); return; }
    t.innerHTML = el.getAttribute("data-tip");
    t.classList.add("show");
    const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8);
    t.style.left = x + "px"; t.style.top = e.clientY + 14 + "px";
  });

  // ---------- Events ----------
  function nextOpenDay() {
    let d = todayKey();
    for (let i = 0; i < 60; i++) {
      if (weekdayOf(d) <= 5 && !scheduled().some((p) => p.date === d)) return d;
      d = addDays(d, 1);
    }
    return todayKey();
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-edit]");
    if (!t || t.closest("#editor-form")) return;
    const d = t.dataset;
    if (d.view) { ui.view = d.view; render(); window.scrollTo(0, 0); return; }
    if (d.week) { ui.week = d.week === "today" ? mondayOf(todayKey()) : addDays(ui.week, Number(d.week) * 7); render(); return; }
    if (d.add !== undefined) { openPostEditor(newPost(d.add), true); return; }
    if (d.edit) { const p = state.posts.find((x) => x.id === d.edit); if (p) openPostEditor(p, false); return; }
    if (d.schedule) {
      const p = state.posts.find((x) => x.id === d.schedule);
      if (p) openPostEditor(Object.assign({}, p, { date: p.date || nextOpenDay() }), false);
      return;
    }
    if (d.editpillar !== undefined) { openPillarEditor(d.editpillar); return; }
    if (d.movepillar) {
      const [id, dir] = d.movepillar.split(":");
      const i = state.pillars.findIndex((p) => p.id === id), j = i + Number(dir);
      if (i < 0 || j < 0 || j >= state.pillars.length) return;
      [state.pillars[i], state.pillars[j]] = [state.pillars[j], state.pillars[i]];
      save(); render(); return;
    }
    if (d.archivepillar) {
      const p = state.pillars.find((x) => x.id === d.archivepillar);
      if (!p) return;
      if (!p.archived && activePillars().length === 1) { toast("Keep at least one active pillar"); return; }
      p.archived = !p.archived;
      if (p.archived) clearThemeRefs(p.id);
      save(); render(); toast(p.archived ? `${p.short} archived. Its posts and results are kept.` : `${p.short} restored`);
      return;
    }
    if (d.delcheck) {
      const [pid, cid] = d.delcheck.split(":");
      const p = pillar(pid); p.checklist = p.checklist.filter((c) => c.id !== cid);
      save(); render(); return;
    }
    if (d.listdel) {
      const [kind, idx] = d.listdel.split(":");
      if (kind === "statuses" && state.statuses[idx] === POSTED) return;
      state[kind].splice(Number(idx), 1);
      save(); render(); return;
    }
    if (d.ideafilter) { ui.ideaFilter = d.ideafilter; render(); return; }
    if (d.ideastatus) {
      ui.ideaStatus = d.ideastatus;
      try { localStorage.setItem(STORAGE_KEY + ":ideaStatus", ui.ideaStatus); } catch (err) { /* ignore */ }
      render(); return;
    }
    if (d.range) { ui.perfRange = d.range; render(); return; }
    if (d.dellog) { state.followerLog = state.followerLog.filter((x) => x.date !== d.dellog); save(); render(); return; }

    if (t.id === "copy-week") copyWeek();
    if (t.id === "sync-now") Cloud.syncNow();
    if (t.id === "sign-out") { if (confirmAction("Sign out? Your planner stays saved in your account; this browser's copy is cleared.")) Cloud.signOut(); }
    if (t.id === "export-csv") exportCsv();
    if (t.id === "export-json") { download(`townsteel-planner-backup-${todayKey()}.json`, JSON.stringify(state, null, 2), "application/json"); toast("Backup downloaded"); }
    if (t.id === "add-starter") {
      const date = $("#starter-date").value; if (!date) return;
      const start = mondayOf(date);
      // Bring back any starter pillar that was deleted so the starter posts have a home
      seedPillars().forEach((sp) => { if (!state.pillars.some((p) => p.id === sp.id)) state.pillars.push(sp); });
      const seed = buildSeed(start);
      state.posts = state.posts.concat(seed.posts);
      Object.entries(seed.weekFocus).forEach(([k, v]) => { if (!state.weekFocus[k]) state.weekFocus[k] = v; });
      save(); ui.week = start; ui.view = "calendar"; render(); toast("Starter weeks added");
    }
    if (t.id === "reset-all") {
      if (!confirmAction("Reset the planner to the starter plan? Everything you've added, including pillar changes, will be removed. Export a backup first if you want to keep it.")) return;
      state = freshState(); ui.week = state.starterWeek; save(); render(); toast("Planner reset");
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.closest("#editor-form")) return;
    const d = t.dataset;
    if (t.id === "week-focus") { state.weekFocus[ui.week] = t.value.trim(); save(); }
    if (t.id === "story") { state.story = t.value.trim(); save(); }
    if (d.check) {
      const [pid, cid] = d.check.split(":");
      const c = pillar(pid).checklist.find((x) => x.id === cid);
      if (c) { c.done = t.checked; save(); render(); }
    }
    if (d.themename) { state.themes[d.themename].name = t.value.trim(); save(); }
    if (d.themepillar) { const th = state.themes[d.themepillar]; th.pillar = t.value; if (th.alt === th.pillar || !th.pillar) th.alt = ""; save(); render(); }
    if (d.themealt) { const th = state.themes[d.themealt]; th.alt = t.value === th.pillar ? "" : t.value; if (!th.pillar) { th.pillar = th.alt; th.alt = ""; } save(); render(); }
    if (t.id === "import-file" && t.files[0]) { importFile(t.files[0]); t.value = ""; }
  });

  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (f.id === "editor-form") return; // handled by its own onsubmit
    e.preventDefault();
    if (f.id === "log-form") {
      const date = f.elements.date.value, count = Number(f.elements.count.value);
      if (!date || !Number.isFinite(count)) return;
      state.followerLog = state.followerLog.filter((x) => x.date !== date).concat({ date, count });
      save(); render(); toast("Follower count logged");
      return;
    }
    if (f.dataset.addcheck) {
      const label = f.elements.label.value.trim(); if (!label) return;
      pillar(f.dataset.addcheck).checklist.push({ id: uid(), label, done: false });
      save(); render(); $(`[data-addcheck="${f.dataset.addcheck}"] input`)?.focus();
      return;
    }
    if (f.dataset.listadd) {
      const kind = f.dataset.listadd, value = f.elements.value.value.trim();
      if (!value) return;
      if (state[kind].some((x) => x.toLowerCase() === value.toLowerCase())) { toast("Already on the list"); return; }
      if (kind === "statuses") state.statuses.splice(state.statuses.indexOf(POSTED), 0, value); // keep Posted last
      else state[kind].push(value);
      save(); render(); $(`[data-listadd="${kind}"] input`)?.focus();
    }
  });

  // Close dialog by clicking the backdrop
  $("#editor").addEventListener("click", (e) => { if (e.target.id === "editor") closeEditor(); });

  // ---------- Render ----------
  const VIEWS = { calendar: renderCalendar, ideas: renderIdeas, journeys: renderJourneys, performance: renderPerformance, strategy: renderStrategy };
  function render() {
    if (!VIEWS[ui.view]) ui.view = "calendar";
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === ui.view)));
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + ui.view; });
    VIEWS[ui.view]();
    try { localStorage.setItem(STORAGE_KEY + ":view", ui.view); } catch (e) { /* ignore */ }
  }

  // ---------- Start ----------
  state = load();
  save();
  try { ui.view = localStorage.getItem(STORAGE_KEY + ":view") || "calendar"; } catch (e) { /* ignore */ }
  try { ui.ideaStatus = localStorage.getItem(STORAGE_KEY + ":ideaStatus") || "todo"; } catch (e) { /* ignore */ }
  const thisWeek = mondayOf(todayKey());
  // Open on the starter plan if it hasn't started yet, otherwise on the current week
  ui.week = state.starterWeek && state.starterWeek > thisWeek ? state.starterWeek : thisWeek;
  render();

  // Cloud sync: loads your saved plan from your account and keeps every browser in step
  if (window.Cloud) {
    Cloud.start({
      getState: () => state,
      replaceState: (data) => {
        state = normalize(data);
        writeLocal(); // local copy only, this came from the cloud
        if (!dlg().open) render();
        toast("Loaded your latest plan");
      }
    });
  }
})();
