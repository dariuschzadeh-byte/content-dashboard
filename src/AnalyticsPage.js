// ══════════════════════════════════════════════════════════════
// AnalyticsPage.js — performance across posted reels.
// Metrics live in the analytics table (entered per reel in the
// reel detail → Performance). Live IG/TikTok sync would need the
// official Meta / TikTok APIs — separate setup.
// ══════════════════════════════════════════════════════════════
import {
  CARD, BORDER, TEXT, MUTED, SOFT, GREEN, RED, FRANZ,
  F_BODY, LBL, Chip, Stat, aColor, bc, formatDate, fmtNum, SOCIALS,
} from "./theme";

const sum = (list, k) => list.reduce((acc, x) => acc + (x.an?.[k] || 0), 0);

export default function AnalyticsPage({ reels, anMap, loading, onOpenReel, m }) {
  const posted = reels.filter(r => r.status === "posted");
  // Pair each posted reel with its metrics (if entered).
  const rows = posted.map(r => ({ ...r, an: anMap?.[r.id] || null }));
  const withData = rows.filter(r => r.an);

  const totals = {
    views: sum(withData, "views"), likes: sum(withData, "likes"),
    comments: sum(withData, "comments"), saves: sum(withData, "saves"),
  };

  const ranked = [...withData].sort((a, b) => (b.an.views || 0) - (a.an.views || 0));
  const best = ranked[0] || null;
  const worst = ranked.length >= 2 ? ranked[ranked.length - 1] : null;

  // Per-creator performance.
  const byCreator = {};
  rows.forEach(r => {
    const raw = (r.assignee || "").trim();
    const key = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "Unassigned";
    (byCreator[key] = byCreator[key] || []).push(r);
  });

  // Weekly trend (by posted_at/date, last 8 weeks with any data).
  // Monday of that week. Parsed and formatted in LOCAL time on purpose —
  // mixing UTC parsing with local day math shifted buckets by a day for
  // viewers west of UTC.
  const weekOf = (iso) => {
    const [y, mo, da] = iso.split("-").map(Number);
    const d = new Date(y, mo - 1, da);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const trend = {};
  withData.forEach(r => {
    const w = weekOf((r.posted_at || r.date + "T00:00:00").slice(0, 10));
    trend[w] = (trend[w] || 0) + (r.an.views || 0);
  });
  // Fill the gaps so the chart reads as a timeline, not two lonely bars.
  const seen = Object.keys(trend).sort();
  let trendWeeks = seen;
  if (seen.length >= 2) {
    const mk = (iso) => { const [y, mo, da] = iso.split("-").map(Number); return new Date(y, mo - 1, da); };
    const p2 = (n) => String(n).padStart(2, "0");
    const out = []; const cur = mk(seen[0]); const end = mk(seen[seen.length - 1]);
    while (cur <= end && out.length < 26) {
      out.push(`${cur.getFullYear()}-${p2(cur.getMonth() + 1)}-${p2(cur.getDate())}`);
      cur.setDate(cur.getDate() + 7);
    }
    trendWeeks = out.slice(-8);
  }
  const trendMax = Math.max(1, ...trendWeeks.map(w => trend[w] || 0));

  return (
    <div>
      {/* Account links */}
      <Section m={m} label="Accounts">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SOCIALS.instagram
            ? <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", borderRadius: 10, background: TEXT, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>📷 Instagram</a>
            : null}
          {SOCIALS.tiktok
            ? <a href={SOCIALS.tiktok} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", borderRadius: 10, background: TEXT, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>🎵 TikTok</a>
            : null}
          {!SOCIALS.instagram && !SOCIALS.tiktok && (
            <div style={{ padding: "12px 16px", background: SOFT, border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13 }}>
              Instagram / TikTok profiles not linked yet — send the profile URLs and they'll appear here.
            </div>
          )}
        </div>
      </Section>

      {/* KPI totals */}
      <Section m={m} label={`Performance · ${withData.length} of ${posted.length} posted reels tracked`}>
        <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 1fr" : "repeat(4, 1fr)", gap: m ? 8 : 12 }}>
          <Stat m={m} label="Total views" value={fmtNum(totals.views)} />
          <Stat m={m} label="Likes" value={fmtNum(totals.likes)} />
          <Stat m={m} label="Comments" value={fmtNum(totals.comments)} />
          <Stat m={m} label="Saves" value={fmtNum(totals.saves)} />
        </div>
      </Section>

      {loading && <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Loading metrics…</div>}

      {/* Best / worst */}
      {best && (
        <Section m={m} label="Highlights">
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: m ? 8 : 12 }}>
            <PerfCard m={m} onOpenReel={onOpenReel} label="★ Best performer" r={best} color={GREEN} />
            {worst && worst.id !== best.id && <PerfCard m={m} onOpenReel={onOpenReel} label="Needs a look — lowest views" r={worst} color={RED} />}
          </div>
        </Section>
      )}

      {/* Weekly trend */}
      {trendWeeks.length >= 2 && (
        <Section m={m} label="Views per week (posted content)">
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: m ? 14 : 18 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: m ? 6 : 12, height: 120 }}>
              {trendWeeks.map(w => (
                <div key={w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: MUTED }}>{trend[w] ? fmtNum(trend[w]) : ""}</div>
                  <div style={{ width: "100%", maxWidth: 44, height: Math.max(3, Math.round(((trend[w]||0) / trendMax) * 80)), background: FRANZ, borderRadius: "6px 6px 2px 2px", opacity: 0.85 }} />
                  <div style={{ fontSize: 9.5, color: MUTED, whiteSpace: "nowrap" }}>{formatDate(w)}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Per-creator performance */}
      {Object.keys(byCreator).length > 0 && (
        <Section m={m} label="By creator">
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : `repeat(${Math.min(Object.keys(byCreator).length, 3)}, 1fr)`, gap: m ? 8 : 12 }}>
            {Object.keys(byCreator).sort().map(name => {
              const list = byCreator[name];
              const tracked = list.filter(r => r.an);
              const v = sum(tracked, "views");
              const color = name === "Unassigned" ? MUTED : aColor(name);
              return (
                <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: m ? 14 : 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>{name}</div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{list.length}</div><div style={{ fontSize: 10.5, color: MUTED }}>Posted</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{fmtNum(v)}</div><div style={{ fontSize: 10.5, color: MUTED }}>Views</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{tracked.length ? fmtNum(Math.round(v / tracked.length)) : "—"}</div><div style={{ fontSize: 10.5, color: MUTED }}>Ø / reel</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* All posted reels */}
      <Section m={m} label="All posted reels">
        {rows.length === 0
          ? <div style={{ padding: "14px 16px", background: SOFT, border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13.5 }}>No posted reels yet — metrics appear once content goes live.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...rows].sort((a, b) => (b.an?.views || 0) - (a.an?.views || 0)).map(r => (
                <div key={r.id} onClick={() => onOpenReel(r, r.brand)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, cursor: "pointer", minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: bc(r.brand), flexShrink: 0 }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, width: 46, flexShrink: 0 }}>{formatDate(r.date)}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  {r.assignee && !m && <Chip text={r.assignee} color={aColor(r.assignee)} />}
                  {r.an
                    ? <div style={{ display: "flex", gap: m ? 8 : 14, flexShrink: 0, fontFamily: F_BODY }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{fmtNum(r.an.views || 0)} <span style={{ fontWeight: 400, color: MUTED, fontSize: 11 }}>views</span></span>
                        {!m && <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{fmtNum(r.an.comments || 0)} <span style={{ fontWeight: 400, color: MUTED, fontSize: 11 }}>com.</span></span>}
                      </div>
                    : <span style={{ fontSize: 11.5, color: MUTED, flexShrink: 0 }}>no data — tap to add</span>}
                </div>
              ))}
            </div>}
      </Section>

      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, padding: "12px 14px", background: SOFT, borderRadius: 10 }}>
        Metrics are entered per reel (open a reel → Performance). Automatic Instagram/TikTok sync
        requires their official APIs (Meta business verification + TikTok developer access) — that's
        a separate setup we can do later; the page is already built for it.
      </div>
    </div>
  );
}

// Module-level: keeps component identity stable across renders.
function Section({ label, children, right, m }) {
  return (
    <div style={{ marginBottom: m ? 18 : 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={LBL}>{label}</div>{right}
      </div>
      {children}
    </div>
  );
}

function PerfCard({ label, r, color, m, onOpenReel }) {
  return (
    <div onClick={() => onOpenReel(r, r.brand)}
      style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: m ? 14 : 18, cursor: "pointer", minWidth: 0 }}>
      <div style={{ ...LBL, fontSize: 10, color, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: MUTED }}>{formatDate(r.date)}</span>
        {r.assignee && <Chip text={r.assignee} color={aColor(r.assignee)} />}
      </div>
      <div style={{ display: "flex", gap: m ? 12 : 18, flexWrap: "wrap" }}>
        {[["Views", r.an.views], ["Likes", r.an.likes], ["Comments", r.an.comments], ["Saves", r.an.saves]].map(([l, v]) => (
          <div key={l}><div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{fmtNum(v || 0)}</div><div style={{ fontSize: 10.5, color: MUTED }}>{l}</div></div>
        ))}
      </div>
    </div>
  );
}
