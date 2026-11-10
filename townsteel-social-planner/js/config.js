// Cloud sync settings (Supabase).
// Paste your two values from Supabase > Project Settings > API Keys / Data API.
// Leave them empty to keep the planner saving only in this browser.
//
// These two values are safe to publish: the "anon" / "publishable" key only allows
// what the database rules allow, and those rules only let a signed-in user
// read and write their own planner.
window.PLANNER_CONFIG = {
  supabaseUrl: "",   // looks like https://abcdefghijklm.supabase.co
  supabaseKey: ""    // the anon (or "publishable") key, a long string
};
