// ══════════════════════════════════════════════════════════════
// supabaseClient.js
// Verbindung zu Supabase + alle Datenbank-Funktionen
// ══════════════════════════════════════════════════════════════
// SETUP:
// 1. Erstelle eine .env Datei im Projektordner
// 2. Trage dort ein:
//    REACT_APP_SUPABASE_URL=https://vpkibepbbaemrjbacimq.supabase.co
//    REACT_APP_SUPABASE_ANON_KEY=dein-anon-key-hier
// ══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY  = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("⚠️  Supabase Keys fehlen! Bitte .env Datei anlegen.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


// ── AUTH ──────────────────────────────────────────────────────
// Login/Signup with email + password. Roles live in the `profiles`
// table (admin | creator), created automatically on signup by a DB trigger.

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Change the logged-in user's own password.
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// Current user's profile (role/name). Falls back to a creator profile.
export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", u.user.id).single();
  if (error && error.code !== "PGRST116") throw error;
  return data || { id: u.user.id, role: "creator", name: u.user.email };
}

// Map of userId -> {name, role} to show "who created what".
export async function fetchProfiles() {
  const { data, error } = await supabase.from("profiles").select("id, name, role");
  if (error) throw error;
  return Object.fromEntries((data || []).map(p => [p.id, p]));
}


// ── SERIES ────────────────────────────────────────────────────

export async function fetchSeries() {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

// Admin only (RLS enforces it): add / remove a series.
export async function addSeries(s) {
  const { data, error } = await supabase
    .from("series")
    .insert([{ id: s.id, name: s.name, brand: s.brand, color: s.color, parts: parseInt(s.parts) || 1 }])
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteSeries(id) {
  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) throw error;
}


// ── REELS ─────────────────────────────────────────────────────

// NOTE: analytics is intentionally NOT joined here — that join made the main
// load heavier on every visit. Analytics is fetched lazily per reel only when
// the detail/analytics view opens (see fetchAnalyticsForReel below).
export async function fetchReels(brand = null) {
  let query = supabase
    .from("reels")
    .select("*")
    .order("date");
  if (brand) query = query.eq("brand", brand);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Lazy analytics — only when a reel's detail view is opened.
export async function fetchAnalyticsForReel(reelId) {
  const { data, error } = await supabase
    .from("analytics").select("*").eq("reel_id", reelId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchReelsByMonth(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to   = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  const { data, error } = await supabase
    .from("reels")
    .select("*, analytics(*)")
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw error;
  return data;
}

export async function addReel(reel) {
  const { data, error } = await supabase
    .from("reels")
    .insert([{
      brand:          reel.brand,
      date:           reel.date,
      type:           reel.type,
      title:          reel.title,
      caption:        reel.caption        || null,
      hook:           reel.hook           || null,
      description:    reel.description    || null,
      format:         reel.format         || null,
      notes:          reel.notes          || null,
      series_id:      reel.series         || null,
      part:           reel.part           ? parseInt(reel.part) : null,
      assignee:       reel.assignee       || null,
      pillar:         reel.pillar         || null,
      est_length:     reel.est_length     || null,
      reference_link: reel.reference_link || null,
      status:         "planned",
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReelStatus(id, status) {
  const update = { status };
  if (status === "posted") update.posted_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("reels")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReelDriveLink(id, link) {
  const { data, error } = await supabase
    .from("reels")
    .update({ drive_link: link || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReelPostedAt(id, postedAt) {
  const { data, error } = await supabase
    .from("reels")
    .update({ posted_at: postedAt })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// General reel edit (title, caption, hook, description, format, notes, date, …).
// Every logged-in user may edit (RLS: "auth update reels").
export async function updateReel(id, fields) {
  const allowed = ["title", "caption", "hook", "description", "format", "notes", "date", "type", "series_id", "part",
                   "assignee", "pillar", "est_length", "reference_link", "approved"];
  const patch = {};
  for (const k of allowed) {
    if (k in fields) patch[k] = (fields[k] === "" && k !== "title") ? null : fields[k];
  }
  if ("part" in patch) patch.part = patch.part ? parseInt(patch.part) : null;
  const { data, error } = await supabase.from("reels").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReel(id) {
  const { error } = await supabase
    .from("reels")
    .delete()
    .eq("id", id);
  if (error) throw error;
}


// ── STORIES ───────────────────────────────────────────────────

export async function fetchStories(brand = null) {
  let query = supabase
    .from("stories")
    .select("*")
    .order("date");
  if (brand) query = query.eq("brand", brand);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addStory(story) {
  const { data, error } = await supabase
    .from("stories")
    .insert([{
      brand: story.brand,
      date:  story.date,
      // Six slots are what the UI collects; the legacy 3 stay in sync for
      // older rows/imports that still speak morning/midday/evening.
      slot1: story.slot1 || story.morning || null,
      slot2: story.slot2 || story.midday  || null,
      slot3: story.slot3 || story.evening || null,
      slot4: story.slot4 || null,
      slot5: story.slot5 || null,
      slot6: story.slot6 || null,
      morning: story.slot1 || story.morning || "—",
      midday:  story.slot2 || story.midday  || "—",
      evening: story.slot3 || story.evening || "—",
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStorySlot(id, slot, value) {
  const { data, error } = await supabase
    .from("stories")
    .update({ [slot]: value })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStorySlotStatus(id, slot, posted) {
  const field = `${slot}_status`;
  const { data, error } = await supabase
    .from("stories")
    .update({ [field]: posted ? "posted" : "planned" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStory(id) {
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}


// ── ANALYTICS ─────────────────────────────────────────────────

export async function saveAnalytics(reelId, vals) {
  // Prüfen ob schon ein Eintrag existiert
  const { data: existing } = await supabase
    .from("analytics")
    .select("id")
    .eq("reel_id", reelId)
    .single();

  const metrics = {
    views:    parseInt(vals.views)    || 0,
    likes:    parseInt(vals.likes)    || 0,
    comments: parseInt(vals.comments) || 0,
    shares:   parseInt(vals.shares)   || 0,
    saves:    parseInt(vals.saves)    || 0,
  };
  if (existing) {
    const { data, error } = await supabase
      .from("analytics").update(metrics).eq("reel_id", reelId).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("analytics").insert([{ reel_id: reelId, ...metrics }]).select().single();
    if (error) throw error;
    return data;
  }
}

// All analytics rows at once — for the Analytics page (joined client-side
// with the reels already in memory; the table is small).
export async function fetchAllAnalytics() {
  const { data, error } = await supabase.from("analytics").select("*");
  if (error) throw error;
  return data || [];
}


// ── BULK IMPORT (für CSV/Sheet Upload) ────────────────────────

export async function bulkImportReels(reelsArray) {
  // reelsArray = Array von Reel-Objekten aus dem CSV/Sheet
  const rows = reelsArray.map(r => ({
    brand:          r.brand?.toLowerCase() || "franz",
    date:           r.date,
    type:           r.type           || "REEL",
    title:          r.title,
    caption:        r.caption        || null,
    hook:           r.hook           || null,
    description:    r.description    || null,
    format:         r.format         || null,
    notes:          r.notes          || null,
    series_id:      r.series         || null,
    part:           r.part           ? parseInt(r.part) : null,
    assignee:       r.assignee       || null,
    pillar:         r.pillar         || null,
    est_length:     r.est_length     || null,
    reference_link: r.reference_link || null,
    approved:       !!r.approved,
    status:         "planned",
  }));

  const { data, error } = await supabase
    .from("reels")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

export async function bulkImportStories(storiesArray) {
  const rows = storiesArray.map(s => ({
    brand:   s.brand?.toLowerCase() || "franz",
    date:    s.date,
    slot1:   s.slot1 || s.morning || null,
    slot2:   s.slot2 || s.midday  || null,
    slot3:   s.slot3 || s.evening || null,
    morning: s.slot1 || s.morning || "—",
    midday:  s.slot2 || s.midday  || "—",
    evening: s.slot3 || s.evening || "—",
  }));

  const { data, error } = await supabase
    .from("stories")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}