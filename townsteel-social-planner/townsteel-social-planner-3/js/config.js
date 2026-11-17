// Cloud sync settings (Supabase).
// Paste your two values from Supabase > Project Settings > API Keys / Data API.
// Leave them empty to keep the planner saving only in this browser.
//
// These two values are safe to publish: the "anon" / "publishable" key only allows
// what the database rules allow, and those rules only let a signed-in user
// read and write their own planner.
window.PLANNER_CONFIG = {
  supabaseUrl: "https://qfcoufkqszqqxjkbtbdd.supabase.co",   // looks like https://abcdefghijklm.supabase.co
  supabaseKey: "sb_publishable_TDAzJMGdSnjHa7WHnxWb1g_ZEzQ--7B"    // the anon (or "publishable") key, a long string
};
