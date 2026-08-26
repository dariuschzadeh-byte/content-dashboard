// Design harness — renders the header + Overview on demo data so the
// layout can be checked without a Supabase login. Reachable at #design
// in `npm start` only; index.js drops it from the production build.
import { useState, useEffect } from "react";
import { Header, CalendarGrid, DayModal } from "./App";
import Overview from "./Overview";
import ContentPlan from "./ContentPlan";
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
// Dates are relative to today so the harness always shows a realistic mix:
// posted in the past, some overdue, and a run of genuinely upcoming reels.
const pad2 = (n) => String(n).padStart(2, "0");
const demo = [];
for (let i = 0; i < 22; i++) {
  const d = new Date();
  d.setDate(d.getDate() - 12 + i);              // 12 days back .. 9 days ahead
  const past = d < new Date(new Date().toDateString());
  demo.push({
    id: "d" + i,
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    title: `Reel ${i + 1} — ${PILLARS[i % PILLARS.length]}`,
    assignee: OWNERS[i % 2],
    pillar: PILLARS[i % PILLARS.length],
    brand: i % 3 === 0 ? "tgc" : "franz",
    status: past && i % 4 !== 3 ? "posted" : i % 3 === 0 ? "filmed" : "planned",
    hook: "The one thing nobody tells you about matcha",
    est_length: "30s",
  });
}

export default function DesignPreview() {
  const [brand, setBrand] = useState("all");
  const [tab, setTab] = useState("overview");
  const [day, setDay] = useState(null);
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
        {tab === "overview" && <Overview reels={shown} brand={brand} m={m} onOpenReel={() => {}} />}
        {tab === "plan" && <ContentPlan reels={shown} brand={brand} m={m} onOpenReel={() => {}} />}
        {tab === "calendar" && (
          <CalendarGrid reels={shown} onDayClick={(day, year, month) => setDay({ day, year, month })} />
        )}
        {day && (
          <DayModal {...day} reels={shown} series={[]} onClose={() => setDay(null)}
            onOpenReel={() => setDay(null)} onToggleReel={() => {}} saving={false} />
        )}
      </div>
    </div>
  );
}
