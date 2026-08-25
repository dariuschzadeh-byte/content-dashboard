// ══════════════════════════════════════════════════════════════
// Overview.js — the month at a glance, broken down per creator.
// Each creator gets their own mini month calendar so they can see
// what's done, what's filmed and what's still open.
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import {
  CARD, BORDER, TEXT, MUTED, SOFT, GREEN, AMBER,
  LBL, aColor, bc, brandName, formatDate,
  STATUS_LABEL, STATUS_COLOR, MONTH_NAMES,
} from "./theme";

const pad = (n) => String(n).padStart(2, "0");
const capital = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;

export default function Overview({ reels, brand, onOpenReel, m }) {
  const now = new Date();
  const [off, setOff] = useState(0);
  const view = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const prefix = `${view.getFullYear()}-${pad(view.getMonth() + 1)}`;
  const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const monthReels = reels.filter(r => (r.date || "").startsWith(prefix));
  const cnt = (list, s) => list.filter(r => r.status === s).length;

  // Group per creator (case-insensitive; assignee is a free-text field).
  const byCreator = {};
  monthReels.forEach(r => {
    const key = capital((r.assignee || "").trim()) || "Unassigned";
    (byCreator[key] = byCreator[key] || []).push(r);
  });
  const creators = Object.keys(byCreator).sort((a, b) =>
    (a === "Unassigned" ? 1 : 0) - (b === "Unassigned" ? 1 : 0) || a.localeCompare(b));

  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7; // Mon = 0

  const navBtn = {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: "transparent", color: MUTED, cursor: "pointer", fontSize: 16, lineHeight: 1,
  };

  const totalPosted = cnt(monthReels, "posted");
  const todays = monthReels.filter(r => r.date === todayISO);

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setOff(o => o - 1)} style={navBtn}>‹</button>
        <div>
          <div style={LBL}>Overview · {brandName(brand)}</div>
          <div style={{ fontSize: m ? 20 : 24, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
            {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
          </div>
        </div>
        <button onClick={() => setOff(o => o + 1)} style={navBtn}>›</button>
        {off !== 0 && (
          <button onClick={() => setOff(0)} style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 12.5, fontWeight: 600 }}>Today</button>
        )}
      </div>

      {/* Month total */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: m ? 16 : 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: m ? 17 : 19, fontWeight: 700, color: TEXT }}>
            {totalPosted} of {monthReels.length} reels posted
          </div>
          <div style={{ fontSize: 12.5, color: MUTED }}>
            {cnt(monthReels, "filmed")} filmed · {cnt(monthReels, "planned")} still open
          </div>
        </div>
        <div style={{ height: 8, background: SOFT, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${monthReels.length ? Math.round((totalPosted / monthReels.length) * 100) : 0}%`, height: "100%", background: GREEN, transition: "width .3s" }} />
        </div>
      </div>

      {/* Per creator */}
      {creators.length === 0 ? (
        <div style={{ padding: "24px 18px", background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 14, color: MUTED, fontSize: 14, textAlign: "center" }}>
          Nothing planned for {MONTH_NAMES[view.getMonth()]}.
        </div>
      ) : (
        <>
          <div style={{ ...LBL, marginBottom: 10 }}>Per creator</div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : `repeat(${Math.min(creators.length, 3)}, 1fr)`, gap: m ? 10 : 14, marginBottom: 20 }}>
            {creators.map(name => (
              <CreatorCard key={name} name={name} list={byCreator[name]} m={m}
                prefix={prefix} todayISO={todayISO} daysInMonth={daysInMonth}
                firstWeekday={firstWeekday} onOpenReel={onOpenReel} />
            ))}
          </div>
        </>
      )}

      {/* Due today */}
      {todays.length > 0 && (
        <>
          <div style={{ ...LBL, marginBottom: 10 }}>Due today</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todays.map(r => (
              <div key={r.id} onClick={() => onOpenReel && onOpenReel(r, r.brand)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: "pointer", minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: bc(r.brand), flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: MUTED, width: 46, flexShrink: 0 }}>{formatDate(r.date)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                {r.assignee && <span style={{ fontSize: 12, color: aColor(r.assignee), fontWeight: 600 }}>{capital(r.assignee)}</span>}
                <span style={{ fontSize: 12, color: STATUS_COLOR[r.status], fontWeight: 600 }}>{STATUS_LABEL[r.status]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// One creator's month: counter, progress, mini calendar, KPIs.
// Module-level so it keeps identity across renders.
function CreatorCard({ name, list, m, prefix, todayISO, daysInMonth, firstWeekday, onOpenReel }) {
  const cnt = (s) => list.filter(r => r.status === s).length;
  const posted = cnt("posted"), filmed = cnt("filmed"), open = cnt("planned");
  const pct = list.length ? Math.round((posted / list.length) * 100) : 0;
  const accent = name === "Unassigned" ? MUTED : aColor(name);

  const byDay = {};
  list.forEach(r => {
    const d = Number((r.date || "").slice(8, 10));
    if (d) (byDay[d] = byDay[d] || []).push(r);
  });

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: m ? 16 : 20, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{name}</span>
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>
          <b style={{ color: TEXT, fontSize: 17 }}>{posted}</b> / {list.length} posted
        </div>
      </div>

      <div style={{ height: 6, background: SOFT, borderRadius: 99, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: GREEN, transition: "width .3s" }} />
      </div>

      {/* Mini month calendar — one tile per day, ✓ when everything that day is out */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 30px))", gap: 4, marginBottom: 14, justifyContent: "center" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5, color: MUTED, fontWeight: 600, paddingBottom: 2 }}>{d}</div>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const items = byDay[day] || [];
          const isToday = `${prefix}-${pad(day)}` === todayISO;
          if (items.length === 0) {
            return (
              <div key={day} style={{
                height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, color: isToday ? TEXT : "#CFC6B8",
                border: isToday ? `1px solid ${BORDER}` : "1px solid transparent", borderRadius: 7,
              }}>{day}</div>
            );
          }
          const allPosted = items.every(r => r.status === "posted");
          const anyFilmed = items.some(r => r.status === "filmed");
          const fill = allPosted ? GREEN : anyFilmed ? AMBER : SOFT;
          const fg = allPosted || anyFilmed ? "#fff" : TEXT;
          return (
            <div key={day}
              title={items.map(r => `${r.title} — ${STATUS_LABEL[r.status]}`).join("\n")}
              onClick={() => onOpenReel && onOpenReel(items[0], items[0].brand)}
              style={{
                height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, fontWeight: 700, cursor: "pointer", borderRadius: 7,
                background: fill, color: fg,
                border: isToday ? `1.5px solid ${TEXT}` : `1px solid ${allPosted || anyFilmed ? "transparent" : BORDER}`,
              }}>
              {allPosted ? "✓" : day}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
        {[["Posted", posted, GREEN], ["Filmed", filmed, AMBER], ["Open", open, MUTED]].map(([l, v, c], i) => (
          <div key={l} style={{ flex: 1, textAlign: "center", borderLeft: i ? `1px solid ${BORDER}` : "none" }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
