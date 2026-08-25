// ══════════════════════════════════════════════════════════════
// ContentPlan.js — the monthly plan as a day-by-day list.
// This is what the creators work from: which day, which reel, who
// films it, what's behind it, and what has already gone out.
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import {
  CARD, BORDER, TEXT, MUTED, SOFT, GREEN, AMBER, BUILD,
  F_MONO, LBL, Chip, BrandDot, aColor, bc, brandName,
  STATUS_FLOW, STATUS_LABEL, STATUS_COLOR, MONTH_NAMES,
} from "./theme";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ContentPlan({
  reels, brand, role, m,
  onSetStatus, onOpenReel, onAdd, saving,
}) {
  const now = new Date();
  const [monthOff, setMonthOff] = useState(0);
  const [owner, setOwner] = useState("all");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  const view = new Date(now.getFullYear(), now.getMonth() + monthOff, 1);
  const prefix = `${view.getFullYear()}-${pad(view.getMonth() + 1)}`;
  const todayISO = iso(now);

  const inBrand = brand === "all" ? reels : reels.filter(r => r.brand === brand);
  const monthReels = inBrand.filter(r => (r.date || "").startsWith(prefix));

  const owners = [...new Set(monthReels.map(r => (r.assignee || "").trim()).filter(Boolean)
    .map(o => o[0].toUpperCase() + o.slice(1).toLowerCase()))].sort();

  const visible = monthReels
    .filter(r => owner === "all" || (r.assignee || "").trim().toLowerCase() === owner.toLowerCase())
    .filter(r => !onlyOpen || r.status !== "posted")
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.title).localeCompare(String(b.title)));

  // Group by day so the plan reads like a schedule, not a flat table.
  const days = [];
  visible.forEach(r => {
    const last = days[days.length - 1];
    if (last && last.date === r.date) last.items.push(r);
    else days.push({ date: r.date, items: [r] });
  });

  const done = monthReels.filter(r => r.status === "posted").length;
  const pct = monthReels.length ? Math.round((done / monthReels.length) * 100) : 0;

  const btn = (active, color = TEXT) => ({
    padding: "7px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${active ? color : BORDER}`,
    background: active ? color : "transparent", color: active ? "#fff" : MUTED,
  });

  return (
    <div>
      {/* Month header + progress */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setMonthOff(o => o - 1)} style={{ ...btn(false), width: 36, height: 36, padding: 0, fontSize: 18, lineHeight: 1 }}>‹</button>
          <div>
            <div style={LBL}>Content plan · {brandName(brand)}</div>
            <div style={{ fontSize: m ? 19 : 23, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
              {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
            </div>
          </div>
          <button onClick={() => setMonthOff(o => o + 1)} style={{ ...btn(false), width: 36, height: 36, padding: 0, fontSize: 18, lineHeight: 1 }}>›</button>
          {monthOff !== 0 && <button onClick={() => setMonthOff(0)} style={btn(false)}>Today</button>}
        </div>
        {onAdd && <button onClick={onAdd} style={btn(true)}>+ Add reel</button>}
      </div>

      {/* Progress bar */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: m ? 14 : 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>
            {done} of {monthReels.length} posted
          </div>
          <div style={{ fontSize: 12.5, color: MUTED }}>
            {monthReels.filter(r => r.status === "filmed").length} filmed · {monthReels.filter(r => r.status === "planned").length} still to film
          </div>
        </div>
        <div style={{ height: 8, background: SOFT, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: GREEN, transition: "width .3s" }} />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...LBL, marginRight: 2 }}>Owner</span>
        <button onClick={() => setOwner("all")} style={btn(owner === "all")}>Everyone</button>
        {owners.map(o => (
          <button key={o} onClick={() => setOwner(o)} style={btn(owner === o, aColor(o))}>{o}</button>
        ))}
        <span style={{ width: 10 }} />
        <button onClick={() => setOnlyOpen(v => !v)} style={btn(onlyOpen, AMBER)}>
          {onlyOpen ? "✓ " : ""}Only open
        </button>
      </div>

      {/* Day-by-day plan */}
      {days.length === 0 ? (
        <div style={{ padding: "24px 18px", background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 14, color: MUTED, fontSize: 14, textAlign: "center" }}>
          Nothing planned for {MONTH_NAMES[view.getMonth()]}{owner !== "all" ? ` · ${owner}` : ""}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {days.map(day => {
            const dt = new Date(day.date + "T00:00:00");
            const isToday = day.date === todayISO;
            const isPast = day.date < todayISO;
            return (
              <div key={day.date} style={{ display: "flex", gap: m ? 10 : 16, alignItems: "flex-start" }}>
                {/* Date rail */}
                <div style={{ width: m ? 44 : 58, flexShrink: 0, textAlign: "center", paddingTop: 12 }}>
                  <div style={{ fontSize: 10.5, color: isToday ? TEXT : MUTED, fontFamily: F_MONO, fontWeight: 600, textTransform: "uppercase" }}>
                    {dt.toLocaleDateString("en-GB", { weekday: "short" })}
                  </div>
                  <div style={{
                    fontSize: m ? 18 : 21, fontWeight: 700, lineHeight: 1.25,
                    color: isToday ? "#fff" : isPast ? MUTED : TEXT,
                    background: isToday ? TEXT : "transparent",
                    borderRadius: 10, padding: isToday ? "1px 0" : 0,
                  }}>{dt.getDate()}</div>
                </div>

                {/* Reels of that day */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {day.items.map(r => {
                    const open = openId === r.id;
                    const sColor = STATUS_COLOR[r.status];
                    return (
                      <div key={r.id} style={{
                        background: CARD, border: `1px solid ${BORDER}`,
                        borderLeft: `4px solid ${r.status === "posted" ? GREEN : r.status === "filmed" ? AMBER : bc(r.brand)}`,
                        borderRadius: 14, padding: m ? "12px 13px" : "14px 18px",
                      }}>
                        {/* Row head */}
                        <div onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                              {brand === "all" && <BrandDot b={r.brand} />}
                              {r.assignee && <Chip text={r.assignee} color={aColor(r.assignee)} size={11.5} />}
                              {r.pillar && <Chip text={r.pillar} size={11.5} />}
                              {r.est_length && <Chip text={r.est_length} size={11.5} />}
                              {r.approved && <Chip text="✓ Approved" color={GREEN} size={11.5} />}
                            </div>
                            <div style={{ fontSize: m ? 15 : 16, fontWeight: 700, color: TEXT, lineHeight: 1.35 }}>{r.title}</div>
                            {r.hook && (
                              <div style={{ fontSize: 13, color: MUTED, fontStyle: "italic", marginTop: 3, ...(open ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>
                                “{r.hook}”
                              </div>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            <Chip text={STATUS_LABEL[r.status]} color={sColor} filled={r.status === "posted"} size={11.5} />
                            <span style={{ color: MUTED, fontSize: 13 }}>{open ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Expanded: what's behind the reel */}
                        {open && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
                            {r.description && (
                              <div>
                                <div style={{ ...LBL, marginBottom: 5 }}>What to film</div>
                                <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.65 }}>{r.description}</div>
                              </div>
                            )}
                            {(r.format || r.caption) && (
                              <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 12 }}>
                                {r.format && <div><div style={{ ...LBL, marginBottom: 5 }}>Format &amp; style</div><div style={{ fontSize: 13.5, color: TEXT }}>{r.format}</div></div>}
                                {r.caption && <div><div style={{ ...LBL, marginBottom: 5 }}>Caption</div><div style={{ fontSize: 13.5, color: TEXT, fontStyle: "italic" }}>“{r.caption}”</div></div>}
                              </div>
                            )}
                            {r.notes && (
                              <div style={{ background: SOFT, borderRadius: 10, padding: "11px 13px" }}>
                                <div style={{ ...LBL, marginBottom: 5 }}>Director's note</div>
                                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{r.notes}</div>
                              </div>
                            )}
                            {r.reference_link && (
                              <div>
                                <div style={{ ...LBL, marginBottom: 5 }}>Reference</div>
                                <a href={r.reference_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: BUILD, wordBreak: "break-all" }}>{r.reference_link}</a>
                              </div>
                            )}

                            {/* Status — the creator's own tracking */}
                            <div>
                              <div style={{ ...LBL, marginBottom: 7 }}>Mark your progress</div>
                              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                                {STATUS_FLOW.map(st => (
                                  <button key={st} disabled={saving} onClick={() => onSetStatus && onSetStatus(r.id, st)}
                                    style={{ ...btn(r.status === st, STATUS_COLOR[st]), minHeight: 40 }}>
                                    {st === "planned" ? "○ " : st === "filmed" ? "◑ " : "● "}{STATUS_LABEL[st]}
                                  </button>
                                ))}
                                <button onClick={() => onOpenReel && onOpenReel(r, r.brand)} style={{ ...btn(false), minHeight: 40 }}>
                                  Open details →
                                </button>
                              </div>
                              {r.status === "posted" && r.posted_at && (
                                <div style={{ fontSize: 12, color: GREEN, marginTop: 8, fontWeight: 600 }}>
                                  ✓ Posted {new Date(r.posted_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
