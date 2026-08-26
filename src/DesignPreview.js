// Design harness — renders the header + Overview on demo data so the
// layout can be checked without a Supabase login. Reachable at #design
// in `npm start` only; index.js drops it from the production build.
import { useState, useEffect } from "react";
import { Header } from "./App";
import Overview from "./Overview";
import { BG, TEXT, F_BODY } from "./theme";

const TABS = [
  ["overview","🏠","Overview","Home"],
  ["plan","🎬","Content plan","Plan"],
  ["calendar","🗓","Calendar","Cal"],
  ["series","🎞","Series","Series"],
  ["analytics","📊","Analytics","Stats"],
  ["briefing","📖","Briefing","Brief"],
];

const OWNERS = ["Ando","Yugo"];
const PILLARS = ["Process","BTS","USP","Episode","Storytelling","Photobooth","Filler"];
const demo = [];
for (let i = 0; i < 22; i++) {
  const day = 2 + i;
  demo.push({
    id: "d" + i,
    date: `2026-08-${String(Math.min(day, 30)).padStart(2, "0")}`,
    title: `Reel ${i + 1} — ${PILLARS[i % PILLARS.length]}`,
    assignee: OWNERS[i % 2],
    pillar: PILLARS[i % PILLARS.length],
    brand: i % 3 === 0 ? "tgc" : "franz",
    status: i < 7 ? "posted" : i < 12 ? "filmed" : "planned",
    hook: "The one thing nobody tells you about matcha",
    est_length: "30s",
  });
}

export default function DesignPreview() {
  const [brand, setBrand] = useState("all");
  const [tab, setTab] = useState("overview");
  const [m, setM] = useState(window.innerWidth < 640);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const shown = brand === "all" ? demo : demo.filter(r => r.brand === brand);
  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: F_BODY, color: TEXT }}>
      <Header m={m} saving={false} todayLong="Tuesday, 25 August 2026 · Bali"
        who="Dari" whoTitle="hello@fr-anz.com" role="admin"
        brand={brand} setBrand={setBrand} tab={tab} setTab={setTab} tabs={TABS}
        onPassword={() => {}} onSignOut={() => {}} />
      <div style={{ padding: m ? "14px 10px" : "22px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <Overview reels={shown} brand={brand} m={m} onOpenReel={() => {}} />
      </div>
    </div>
  );
}
