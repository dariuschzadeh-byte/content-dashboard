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


// ── SERIES ────────────────────────────────────────────────────

export async function fetchSeries() {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}


// ── REELS ─────────────────────────────────────────────────────

export async function fetchReels(brand = null) {
  let query = supabase
    .from("reels")
    .select("*, analytics(*)")
    .order("date");
  if (brand) query = query.eq("brand", brand);
  const { data, error } = await query;
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
      brand:       reel.brand,
      date:        reel.date,
      type:        reel.type,
      title:       reel.title,
      caption:     reel.caption     || null,
      hook:        reel.hook        || null,
      description: reel.description || null,
      format:      reel.format      || null,
      notes:       reel.notes       || null,
      series_id:   reel.series      || null,
      part:        reel.part        ? parseInt(reel.part) : null,
      status:      "planned",
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
      brand:   story.brand,
      date:    story.date,
      morning: story.morning || "—",
      midday:  story.midday  || "—",
      evening: story.evening || "—",
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

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from("analytics")
      .update({
        views:  parseInt(vals.views)  || 0,
        likes:  parseInt(vals.likes)  || 0,
        shares: parseInt(vals.shares) || 0,
        saves:  parseInt(vals.saves)  || 0,
      })
      .eq("reel_id", reelId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Insert
    const { data, error } = await supabase
      .from("analytics")
      .insert([{
        reel_id: reelId,
        views:   parseInt(vals.views)  || 0,
        likes:   parseInt(vals.likes)  || 0,
        shares:  parseInt(vals.shares) || 0,
        saves:   parseInt(vals.saves)  || 0,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}


// ── BULK IMPORT (für CSV/Sheet Upload) ────────────────────────

export async function bulkImportReels(reelsArray) {
  // reelsArray = Array von Reel-Objekten aus dem CSV/Sheet
  const rows = reelsArray.map(r => ({
    brand:       r.brand?.toLowerCase(),
    date:        r.date,
    type:        r.type        || "REEL",
    title:       r.title,
    caption:     r.caption     || null,
    hook:        r.hook        || null,
    description: r.description || null,
    format:      r.format      || null,
    notes:       r.notes       || null,
    series_id:   r.series      || null,
    part:        r.part        ? parseInt(r.part) : null,
    status:      "planned",
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
    brand:   s.brand?.toLowerCase(),
    date:    s.date,
    morning: s.morning || "—",
    midday:  s.midday  || "—",
    evening: s.evening || "—",
  }));

  const { data, error } = await supabase
    .from("stories")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}