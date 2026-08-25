// ══════════════════════════════════════════════════════════════
// Overview.js — dashboard home: today, month stats, creator split,
// recently posted. "Who does what" at a glance.
// ══════════════════════════════════════════════════════════════
import {
  CARD, BORDER, TEXT, MUTED, SOFT, GREEN, AMBER,
  F_BODY, F_DISPLAY, LBL, Chip, Stat, aColor, bc, formatDate,
  STATUS_COLOR, STATUS_LABEL, MONTH_NAMES,
} from "./theme";

const pad = (n) => String(n).padStart(2, "0");

export default function Overview({ reels, stories, onOpenReel, m }) {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const monthPrefix = todayISO.slice(0, 7);
  const monthName = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const monthReels = reels.filter(r => (r.date || "").startsWith(monthPrefix));
  const count = (list, s) => list.filter(r => r.status === s).length;
  const approvedCount = monthReels.filter(r => r.approved).length;

  // Creator split — Ando / Yugo / others / unassigned.
  // Grouped case-insensitively — assignee is free text (form, edit, CSV),
  // so "ando" and "Ando" must not become two creators.
  const byCreator = {};
  monthReels.forEach(r => {
    const raw = (r.assignee || "").trim();
    const key = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "Unassigned";
    (byCreator[key] = byCreator[key] || []).push(r);
  });
  const creatorOrder = Object.keys(byCreator).sort((a, b) => {
    const rank = (n) => n === "Unassigned" ? 2 : (["ando", "yugo"].includes(n.toLowerCase()) ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  const todays = reels.filter(r => r.date === todayISO);
  const todayStories = stories.filter(s => s.date === todayISO);

  const posted = [...reels.filter(r => r.status === "posted")]
    .sort((a, b) => String(b.posted_at || b.date).localeCompare(String(a.posted_at || a.date)))
    .slice(0, 6);

  const upcoming = [...reels.filter(r => r.status !== "posted" && r.date > todayISO)]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const Section = ({ label, children, style }) => (
    <div style={{ marginBottom: m ? 18 : 26, ...style }}>
      <div style={{ ...LBL, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );

  const ReelRow = ({ r, right }) => (
    <div onClick={() => onOpenReel(r, r.brand)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, cursor: "pointer", minWidth: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: bc(r.brand), flexShrink: 0 }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, flexShrink: 0, width: 46 }}>{formatDate(r.date)}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
      {r.assignee && !m && <Chip text={r.assignee} color={aColor(r.assignee)} />}
      {right}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: m ? 16 : 24 }}>
        <div style={{ ...LBL, marginBottom: 4 }}>Today</div>
        <div style={{ fontFamily: F_DISPLAY, fontSize: m ? 26 : 34, fontWeight: 600, color: TEXT, lineHeight: 1.15 }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Today's content */}
      <Section label={`On the plan today (${todays.length} reel${todays.length === 1 ? "" : "s"}${todayStories.length ? ` · ${todayStories.length} story day${todayStories.length === 1 ? "" : "s"}` : ""})`}>
        {todays.length === 0
          ? <div style={{ padding: "14px 16px", background: SOFT, border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13.5 }}>No content planned for today.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todays.map(r => <ReelRow key={r.id} r={r} right={<Chip text={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />} />)}
            </div>}
      </Section>

      {/* Month stats */}
      <Section label={`This month · ${monthName}`}>
        <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 1fr" : "repeat(4, 1fr)", gap: m ? 8 : 12 }}>
          <Stat m={m} label="Reels planned" value={monthReels.length} sub={`${approvedCount} approved`} />
          <Stat m={m} label="Posted" value={count(monthReels, "posted")} color={GREEN} />
          <Stat m={m} label="Filmed" value={count(monthReels, "filmed")} color={AMBER} />
          <Stat m={m} label="Still open" value={count(monthReels, "planned")} color={MUTED} />
        </div>
      </Section>

      {/* Creator split */}
      {creatorOrder.length > 0 && (
        <Section label="Creators — this month">
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : `repeat(${Math.min(creatorOrder.length, 3)}, 1fr)`, gap: m ? 8 : 12 }}>
            {creatorOrder.map(name => {
              const list = byCreator[name];
              const done = count(list, "posted");
              const color = name === "Unassigned" ? MUTED : aColor(name);
              const pct = list.length ? Math.round((done / list.length) * 100) : 0;
              return (
                <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: m ? 14 : 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, fontFamily: F_BODY }}>{name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{done}/{list.length} posted</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 10 }}>
                    {count(list, "planned")} planned · {count(list, "filmed")} filmed · {done} posted
                  </div>
                  <div style={{ height: 6, background: SOFT, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Two columns: recently posted + coming up */}
      <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: m ? 0 : 20 }}>
        <Section label="Recently posted">
          {posted.length === 0
            ? <div style={{ padding: "14px 16px", background: SOFT, border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13.5 }}>Nothing posted yet.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {posted.map(r => <ReelRow key={r.id} r={r} right={m && r.assignee ? <Chip text={r.assignee} color={aColor(r.assignee)} /> : null} />)}
              </div>}
        </Section>
        <Section label="Coming up next">
          {upcoming.length === 0
            ? <div style={{ padding: "14px 16px", background: SOFT, border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13.5 }}>Nothing scheduled.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.map(r => <ReelRow key={r.id} r={r} right={<Chip text={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />} />)}
              </div>}
        </Section>
      </div>
    </div>
  );
}
