/* eslint-disable no-unused-vars */
// ══════════════════════════════════════════════════════════════
// Content Dashboard v5
// + Heute Tab
// + 3-stufiger Status (Planned → Filmed → Gepostet)
// + Serien-Planung mit Deadlines & Ampel
// Franz & The Green Collective
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchSeries, fetchReels, fetchStories,
  addReel, addStory, deleteReel, deleteStory,
  updateReelStatus, updateStorySlot, updateStorySlotStatus,
  saveAnalytics, bulkImportReels, bulkImportStories,
} from "./supabaseClient";

// ── Colors ────────────────────────────────────────────────────
const FRANZ  = "#C4527A";
const TGC    = "#2D7D46";
const BUILD  = "#4A6FA5";
const BG     = "#F5F0E8";
const CARD   = "#FFFFFF";
const BORDER = "#E0D8CC";
const TEXT   = "#1A1A1A";
const MUTED  = "#888880";
const SOFT   = "#EDE8DF";
const GREEN  = "#2D7D46";
const AMBER  = "#D97706";
const RED    = "#DC2626";

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getStartDay(y, m)    { return new Date(y, m, 1).getDay(); }

function useIsMobile(bp = 640) {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

// Swipe-right-from-left-edge to close (iOS-style back gesture)
function useSwipeBack(onClose) {
  useEffect(() => {
    let startX = null;
    let startY = null;
    const onStart = (e) => {
      const t = e.touches[0];
      // Only register if swipe starts near left edge
      if (t.clientX < 30) {
        startX = t.clientX;
        startY = t.clientY;
      }
    };
    const onMove = (e) => {
      if (startX === null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // Horizontal swipe > 80px and not too vertical
      if (dx > 80 && dy < 50) {
        startX = null;
        onClose();
      }
    };
    const onEnd = () => { startX = null; startY = null; };
    window.addEventListener("touchstart", onStart, { passive:true });
    window.addEventListener("touchmove",  onMove,  { passive:true });
    window.addEventListener("touchend",   onEnd,   { passive:true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onEnd);
    };
  }, [onClose]);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const formatDate  = (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day:"numeric", month:"short" }) : "—";
const bc  = (b) => b === "franz" ? FRANZ : TGC;
const uid = () => Math.random().toString(36).slice(2, 8);

// ── Status helpers ────────────────────────────────────────────
const STATUS_FLOW   = ["planned", "filmed", "posted"];
const STATUS_LABEL  = { planned:"Planned", filmed:"Filmed", posted:"Posted" };
const STATUS_COLOR  = { planned:MUTED, filmed:AMBER, posted:GREEN };
const STATUS_BG     = { planned:"transparent", filmed:"#FEF3C7", posted:"#F0F7F3" };
const nextStatus    = (s) => { const i = STATUS_FLOW.indexOf(s); return i < 2 ? STATUS_FLOW[i+1] : STATUS_FLOW[i]; };
const prevStatus    = (s) => { const i = STATUS_FLOW.indexOf(s); return i > 0 ? STATUS_FLOW[i-1] : STATUS_FLOW[i]; };

// Days until date
const daysUntil = (dateStr) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// Ampel color based on days
const deadlineColor = (days) => {
  if (days < 0)  return RED;
  if (days <= 2) return RED;
  if (days <= 5) return AMBER;
  return GREEN;
};
const deadlineLabel = (days) => {
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
};

// ══════════════════════════════════════════════════════════════
// SHARED UI
// ══════════════════════════════════════════════════════════════

const Input = ({ value, onChange, placeholder, style = {} }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ padding:"10px 12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:6, color:TEXT, fontSize:14, fontFamily:"monospace", outline:"none", width:"100%", boxSizing:"border-box", minHeight:44, ...style }}/>
);

const Btn = ({ onClick, children, accent, fill, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{ padding:"10px 16px", borderRadius:6, border:`1px solid ${disabled?BORDER:accent||"#999"}`, background:fill?(accent||"#333"):"transparent", color:disabled?MUTED:fill?"#fff":accent||MUTED, fontSize:12, fontFamily:"monospace", cursor:disabled?"default":"pointer", letterSpacing:"1px", transition:"all 0.15s", opacity:disabled?0.5:1, minHeight:44, ...style }}>{children}</button>
);

const BrandToggle = ({ brand, active, onClick, compact }) => (
  <button onClick={onClick} style={{ padding:compact?"8px 14px":"9px 22px", borderRadius:8, border:`1px solid ${active?bc(brand):BORDER}`, background:active?bc(brand):"transparent", color:active?"#fff":MUTED, fontSize:compact?11:12, fontFamily:"monospace", letterSpacing:"1px", cursor:"pointer", transition:"all 0.15s", flex:1, minHeight:44 }}>
    {brand === "franz" ? "FRANZ" : compact ? "TGC" : "THE GREEN COLLECTIVE"}
  </button>
);

const Spinner = ({ color = FRANZ }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
    <div style={{ width:32, height:32, border:`3px solid ${SOFT}`, borderTop:`3px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ErrorBanner = ({ msg, onDismiss }) => (
  <div style={{ background:"#FFF0F0", border:"1px solid #FFCCCC", borderRadius:8, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
    <span style={{ fontSize:13, color:"#CC3333", fontFamily:"monospace" }}>⚠️  {msg}</span>
    <button onClick={onDismiss} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:16 }}>✕</button>
  </div>
);

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status, onClick, disabled }) {
  const color = STATUS_COLOR[status] || MUTED;
  const bg    = STATUS_BG[status]    || "transparent";
  const label = STATUS_LABEL[status] || status;
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:"4px 10px", borderRadius:20, border:`1.5px solid ${color}`, background:bg, color, fontSize:10, fontFamily:"monospace", fontWeight:700, cursor:disabled?"default":"pointer", letterSpacing:"0.5px", transition:"all 0.15s", whiteSpace:"nowrap" }}>
      {status === "planned" && "○ "}
      {status === "filmed"  && "◑ "}
      {status === "posted"  && "● "}
      {label}
    </button>
  );
}

// ── DatePicker ────────────────────────────────────────────────
function DatePicker({ value, onChange, accentColor }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [vY, setVY] = useState(value ? +value.split("-")[0] : today.getFullYear());
  const [vM, setVM] = useState(value ? +value.split("-")[1] - 1 : today.getMonth());
  const ref = useRef(null);
  const accent = accentColor || FRANZ;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const days = getDaysInMonth(vY, vM), sd = getStartDay(vY, vM);
  const pick = (d) => { onChange(`${vY}-${String(vM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`); setOpen(false); };
  const pm   = () => { if(vM===0){setVM(11);setVY(y=>y-1);}else setVM(m=>m-1); };
  const nm   = () => { if(vM===11){setVM(0);setVY(y=>y+1);}else setVM(m=>m+1); };
  const sel  = value && value.startsWith(`${vY}-${String(vM+1).padStart(2,"0")}`) ? +value.split("-")[2] : null;

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div onClick={() => setOpen(o=>!o)} style={{ padding:"10px 12px", background:SOFT, border:`1px solid ${open?accent:BORDER}`, borderRadius:6, color:value?TEXT:MUTED, fontSize:14, fontFamily:"monospace", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", minHeight:44 }}>
        <span>{value ? formatDate(value) : "Pick a date"}</span><span>📅</span>
      </div>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:2000, background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:14, boxShadow:"0 8px 32px rgba(0,0,0,0.18)", minWidth:260, width:"100%" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <button onClick={pm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:6, width:32, height:32, cursor:"pointer", color:MUTED, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:TEXT, fontFamily:"monospace" }}>{MONTH_NAMES[vM].slice(0,3)} {vY}</span>
            <button onClick={nm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:6, width:32, height:32, cursor:"pointer", color:MUTED, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{ textAlign:"center", fontSize:9, color:MUTED, fontFamily:"monospace", padding:"2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {Array.from({length:sd}).map((_,i) => <div key={`e${i}`}/>)}
            {Array.from({length:days}).map((_,i) => {
              const d=i+1, s=d===sel;
              return <div key={d} onClick={() => pick(d)} style={{ textAlign:"center", padding:"6px 2px", borderRadius:6, cursor:"pointer", fontSize:12, fontFamily:"monospace", fontWeight:s?700:400, background:s?accent:"transparent", color:s?"#fff":TEXT, transition:"all 0.1s" }} onMouseEnter={e=>!s&&(e.currentTarget.style.background=`${accent}22`)} onMouseLeave={e=>!s&&(e.currentTarget.style.background="transparent")}>{d}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ title, onClose, onSave, saving, children, wide }) {
  const m = useIsMobile();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:m?"flex-end":"center", justifyContent:"center", padding:m?0:20 }}>
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:m?"16px 16px 0 0":"16px", padding:m?"20px 16px 36px":"32px", width:m?"100%":wide?680:520, maxWidth:"100%", maxHeight:m?"92vh":"90vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.18)" }}>
        {m && <div style={{ width:40, height:4, background:BORDER, borderRadius:2, margin:"0 auto 16px" }}/>}
        <div style={{ fontSize:16, fontWeight:700, color:TEXT, marginBottom:18 }}>{title}</div>
        {children}
        {onSave && <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}><Btn onClick={onClose} disabled={saving}>CANCEL</Btn><Btn onClick={onSave} accent={FRANZ} fill disabled={saving}>{saving?"SAVING...":"SAVE"}</Btn></div>}
        {!onSave && <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}><Btn onClick={onClose} accent={MUTED}>CLOSE</Btn></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HEUTE TAB
// ══════════════════════════════════════════════════════════════
function TodayTab({ reels, stories, series, onToggleStatus, onOpenReel, saving }) {
  const m = useIsMobile();
  const todayStr = new Date().toISOString().split("T")[0];

  const todayReels   = reels.filter(r => r.date === todayStr);
  const todayStories = stories.filter(s => s.date === todayStr);
  const tomorrow     = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr  = tomorrow.toISOString().split("T")[0];
  const tomorrowReels = reels.filter(r => r.date === tomorrowStr);

  const allDone = todayReels.length > 0 && todayReels.every(r => r.status === "posted");

  return (
    <div>
      {/* Header */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:m?14:20, marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:4 }}>TODAY</div>
        <div style={{ fontSize:m?20:26, fontWeight:700, color:TEXT }}>
          {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
        </div>
        {allDone && (
          <div style={{ marginTop:10, padding:"8px 14px", background:`${GREEN}11`, border:`1px solid ${GREEN}33`, borderRadius:8, display:"inline-flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>✅</span>
            <span style={{ fontSize:12, color:GREEN, fontFamily:"monospace", fontWeight:700 }}>Everything posted today!</span>
          </div>
        )}
        {todayReels.length === 0 && (
          <div style={{ marginTop:10, fontSize:13, color:MUTED, fontFamily:"monospace" }}>No content planned for today.</div>
        )}
      </div>

      {/* Heute Reels */}
      {todayReels.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:8 }}>TO POST TODAY</div>
          {todayReels.map(reel => {
            const color = bc(reel.brand);
            const sObj  = reel.type==="SERIES" ? series.find(s=>s.id===reel.series_id) : null;
            return (
              <div key={reel.id} onClick={() => onOpenReel(reel, reel.brand)} style={{ background:CARD, border:`1px solid ${reel.status==="posted"?color+"44":BORDER}`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:m?14:18, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", cursor:"pointer" }}>
                {/* Brand + Series */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <div style={{ padding:"3px 10px", borderRadius:4, background:`${color}18`, border:`1px solid ${color}44`, fontSize:10, fontFamily:"monospace", color, fontWeight:700 }}>
                    {reel.brand==="franz"?"FRANZ":"TGC"}
                  </div>
                  {sObj && <div style={{ padding:"3px 10px", borderRadius:4, background:`${sObj.color}11`, border:`1px solid ${sObj.color}33`, fontSize:10, fontFamily:"monospace", color:sObj.color }}>{sObj.name} · Pt {reel.part}</div>}
                  <div onClick={e => e.stopPropagation()}><StatusBadge status={reel.status} onClick={() => onToggleStatus(reel.id, reel.status)} disabled={saving}/></div>
                </div>

                {/* Title */}
                <div style={{ fontSize:m?16:18, fontWeight:700, color:TEXT, marginBottom:6 }}>{reel.title}</div>

                {/* Hook — prominent */}
                {reel.hook && (
                  <div style={{ padding:"10px 14px", background:`${color}08`, border:`1px solid ${color}22`, borderRadius:8, marginBottom:8 }}>
                    <div style={{ fontSize:9, color, fontFamily:"monospace", letterSpacing:"1.5px", marginBottom:3 }}>HOOK — FIRST 2 SECONDS</div>
                    <div style={{ fontSize:14, color:TEXT, fontStyle:"italic" }}>"{reel.hook}"</div>
                  </div>
                )}

                {/* Caption */}
                {reel.caption && (
                  <div style={{ fontSize:12, color:MUTED, fontStyle:"italic", marginBottom:8 }}>Caption: "{reel.caption}"</div>
                )}

                {/* Tap hint */}
                <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace", letterSpacing:"1px", marginTop:8 }}>TAP CARD FOR DETAILS →</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Heute Stories */}
      {todayStories.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:8 }}>STORIES TODAY</div>
          {todayStories.map(story => {
            const color = bc(story.brand);
            const slots = [
              { key:"morning", label:"Morning", value:story.morning, status:story.morning_status },
              { key:"midday",  label:"Midday", value:story.midday,  status:story.midday_status  },
              { key:"evening", label:"Evening",  value:story.evening, status:story.evening_status },
            ];
            return (
              <div key={story.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:m?12:16, marginBottom:10 }}>
                <div style={{ fontSize:10, color, fontFamily:"monospace", fontWeight:700, marginBottom:10 }}>{story.brand==="franz"?"FRANZ":"TGC"} STORIES</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {slots.map(slot => {
                    const done = slot.status==="posted";
                    return (
                      <div key={slot.key} style={{ background:done?`${color}0F`:SOFT, border:`1px solid ${done?color+"55":BORDER}`, borderRadius:8, padding:"10px 8px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                          <span style={{ fontSize:8, color:done?color:MUTED, fontFamily:"monospace", fontWeight:700 }}>{slot.label.toUpperCase()}</span>
                          <div style={{ width:16, height:16, borderRadius:"50%", background:done?color:"transparent", border:`1.5px solid ${done?color:BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff" }}>{done?"✓":""}</div>
                        </div>
                        <div style={{ fontSize:10, color:TEXT, lineHeight:1.4 }}>{slot.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Morgen Preview */}
      {tomorrowReels.length > 0 && (
        <div>
          <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:8 }}>MORGEN</div>
          {tomorrowReels.map(reel => {
            const color = bc(reel.brand);
            return (
              <div key={reel.id} style={{ background:SOFT, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${color}44`, borderRadius:10, padding:"12px 14px", marginBottom:8, opacity:0.75 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:10, color, fontFamily:"monospace", fontWeight:700 }}>{reel.brand==="franz"?"FRANZ":"TGC"}</span>
                  <StatusBadge status={reel.status}/>
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:TEXT }}>{reel.title}</div>
                {reel.hook && <div style={{ fontSize:11, color:MUTED, fontStyle:"italic", marginTop:2 }}>"{reel.hook}"</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SERIEN PLANUNG TAB
// ══════════════════════════════════════════════════════════════
function SerienTab({ series, reels, onOpenReel, onToggleStatus, saving }) {
  const m = useIsMobile();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {series.map(s => {
        const brands  = s.brand==="Both" ? ["franz","tgc"] : [s.brand.toLowerCase()];
        const episodes = brands
          .flatMap(b => reels.filter(r => r.brand===b && r.type==="SERIES" && r.series_id===s.id).map(r => ({...r,b})))
          .sort((a,b) => a.date.localeCompare(b.date));

        const posted   = episodes.filter(e => e.status==="posted").length;
        const filmed   = episodes.filter(e => e.status==="filmed").length;
        const planned  = episodes.filter(e => e.status==="planned").length;
        const pct      = Math.round((posted / s.parts) * 100);

        // Next unposted episode
        const nextEp   = episodes.find(e => e.status !== "posted");
        const nextDays = nextEp ? daysUntil(nextEp.date) : null;
        const ampel    = nextEp ? deadlineColor(nextDays) : GREEN;

        return (
          <div key={s.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${s.color}`, borderRadius:14, padding:m?14:22, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>

            {/* Series Header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:9, color:s.color, fontFamily:"monospace", letterSpacing:"2px", marginBottom:3, fontWeight:700 }}>{s.brand.toUpperCase()}</div>
                <div style={{ fontSize:m?15:18, fontWeight:700, color:TEXT }}>{s.name}</div>
                <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", marginTop:3 }}>
                  {posted} posted · {filmed} filmed · {planned} planned · {s.parts} total
                </div>
              </div>
              {/* Ampel */}
              {nextEp && (
                <div style={{ textAlign:"center", flexShrink:0, marginLeft:12 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:ampel, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:3 }}>
                    <span style={{ fontSize:18 }}>
                      {ampel===GREEN?"✓":ampel===AMBER?"⚡":"🔴"}
                    </span>
                  </div>
                  <div style={{ fontSize:9, color:ampel, fontFamily:"monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                    {deadlineLabel(nextDays)}
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ height:6, background:SOFT, borderRadius:3, marginBottom:14, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:3, display:"flex" }}>
                <div style={{ width:`${pct}%`, background:s.color, transition:"width 0.3s" }}/>
                <div style={{ width:`${Math.round((filmed/s.parts)*100)}%`, background:`${s.color}55`, transition:"width 0.3s" }}/>
              </div>
            </div>

            {/* Episodes */}
            <div style={{ display:"grid", gridTemplateColumns:m?"1fr":"1fr 1fr", gap:8 }}>
              {episodes.map((ep, i) => {
                const days  = daysUntil(ep.date);
                const dColor = ep.status==="posted" ? GREEN : deadlineColor(days);
                return (
                  <div key={i} onClick={() => onOpenReel(ep, ep.b)}
                    style={{ padding:"12px 14px", background:ep.status==="posted"?`${s.color}08`:SOFT, border:`1px solid ${ep.status==="posted"?s.color+"44":BORDER}`, borderRadius:10, cursor:"pointer", transition:"all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=s.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor=ep.status==="posted"?s.color+"44":BORDER}>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:9, color:s.color, fontFamily:"monospace", fontWeight:700 }}>TEIL {ep.part}</span>
                        <span style={{ fontSize:9, color:bc(ep.b), fontFamily:"monospace" }}>{ep.b==="franz"?"Franz":"TGC"}</span>
                      </div>
                      <StatusBadge status={ep.status} onClick={e => { e.stopPropagation(); onToggleStatus(ep.id, ep.status); }} disabled={saving}/>
                    </div>

                    <div style={{ fontSize:13, fontWeight:600, color:TEXT, marginBottom:4 }}>{ep.title}</div>

                    {/* Deadline */}
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:dColor, flexShrink:0 }}/>
                      <span style={{ fontSize:10, color:dColor, fontFamily:"monospace", fontWeight:700 }}>
                        {formatDate(ep.date)} — {ep.status==="posted" ? "✓ Posted" : deadlineLabel(days)}
                      </span>
                    </div>

                    {/* Days between episodes */}
                    {i < episodes.length - 1 && (
                      <div style={{ marginTop:6, fontSize:9, color:MUTED, fontFamily:"monospace" }}>
                        → Part {ep.part+1} in {daysUntil(episodes[i+1].date) - daysUntil(ep.date)} days
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {episodes.length === 0 && (
              <div style={{ fontSize:12, color:MUTED, fontFamily:"monospace" }}>No episodes planned yet.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REEL DETAIL MODAL
// ══════════════════════════════════════════════════════════════
function ReelDetail({ reel, brand, series, onClose, onToggleStatus, onSetStatus, saving, analytics, onSaveAnalytics }) {
  const m     = useIsMobile();
  useSwipeBack(onClose);
  const color = bc(brand);
  const sObj  = reel.type==="SERIES" ? series.find(s=>s.id===reel.series_id) : null;
  const tc    = sObj?.color || color;
  const [av, setAv] = useState({ views:analytics?.views||"", likes:analytics?.likes||"", shares:analytics?.shares||"", saves:analytics?.saves||"" });

  const IB = ({ label, value }) => value ? (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:14, color:TEXT, lineHeight:1.7 }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:m?"flex-end":"center", justifyContent:"center", padding:m?0:20 }}>
      <div style={{ background:CARD, borderTop:`4px solid ${color}`, borderRadius:m?"16px 16px 0 0":"16px", padding:m?"max(20px, env(safe-area-inset-top)) 16px 36px":"32px", width:m?"100%":640, maxWidth:"100%", maxHeight:m?"94vh":"90vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.2)" }}>
        {m && <div style={{ width:40, height:4, background:BORDER, borderRadius:2, margin:"0 auto 16px" }}/>}

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
              <div style={{ padding:"3px 10px", borderRadius:4, background:`${color}18`, border:`1px solid ${color}55`, fontSize:10, fontFamily:"monospace", color }}>{brand==="franz"?"FRANZ":"TGC"} · {formatDate(reel.date)}</div>
              {reel.type==="SERIES"&&sObj&&<div style={{ padding:"3px 10px", borderRadius:4, background:`${tc}18`, border:`1px solid ${tc}55`, fontSize:10, fontFamily:"monospace", color:tc }}>{sObj.name} · Pt {reel.part}</div>}
              <StatusBadge status={reel.status} onClick={() => onToggleStatus(reel.id, reel.status)} disabled={saving}/>
            </div>
            <div style={{ fontSize:m?20:24, fontWeight:700, color:TEXT }}>{reel.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:MUTED, fontSize:22, cursor:"pointer", padding:"12px", lineHeight:1, flexShrink:0, minWidth:48, minHeight:48, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8 }}>✕</button>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:20 }}/>
        <IB label="Hook – erste 2 Sekunden" value={reel.hook}/>
        <IB label="What to film" value={reel.description}/>
        <IB label="Format & Style" value={reel.format}/>

        {reel.notes && (
          <div style={{ marginBottom:16, padding:"14px 16px", background:`${color}0F`, border:`1px solid ${color}33`, borderRadius:10 }}>
            <div style={{ fontSize:10, color, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>Director's Note</div>
            <div style={{ fontSize:13, color:TEXT, lineHeight:1.7, fontStyle:"italic" }}>{reel.notes}</div>
          </div>
        )}

        <div style={{ marginBottom:16, padding:"12px 16px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10 }}>
          <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>Caption</div>
          <div style={{ fontSize:14, color:TEXT, fontStyle:"italic" }}>"{reel.caption}"</div>
        </div>

        {/* Status — any of the 3 stages can be clicked to set directly */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>STATUS — TAP TO CHANGE</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {STATUS_FLOW.map((s, i) => {
              const isActive = reel.status === s;
              const sColor   = STATUS_COLOR[s];
              return (
                <button key={s} disabled={saving}
                  onClick={() => !saving && onSetStatus && onSetStatus(reel.id, s)}
                  style={{ padding:"10px 18px", borderRadius:24, border:`2px solid ${isActive?sColor:BORDER}`, background:isActive?sColor:"transparent", color:isActive?"#fff":sColor, fontSize:12, fontFamily:"monospace", fontWeight:isActive?700:600, cursor:saving?"default":"pointer", transition:"all 0.15s", minHeight:44, letterSpacing:"0.5px" }}>
                  {s === "planned" && "○ "}{s === "filmed" && "◑ "}{s === "posted" && "● "}
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Analytics */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>Analytics</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {["views","likes","shares","saves"].map(metric => (
              <div key={metric}>
                <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace", textTransform:"uppercase", marginBottom:4 }}>{metric}</div>
                <input type="number" placeholder="—" value={av[metric]} onChange={e => setAv(p=>({...p,[metric]:e.target.value}))}
                  style={{ width:"100%", padding:"10px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:6, color:TEXT, fontSize:14, fontFamily:"monospace", boxSizing:"border-box", minHeight:44 }}/>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:m?"column":"row", gap:10, justifyContent:"flex-end" }}>
          {!m && <Btn onClick={onClose} accent={MUTED}>CLOSE</Btn>}
          <Btn onClick={() => onSaveAnalytics(reel.id, av)} accent={MUTED} disabled={saving}>{saving?"SAVING...":"SAVE ANALYTICS"}</Btn>
          {m && <Btn onClick={onClose} accent={MUTED}>CLOSE</Btn>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CALENDAR GRID
// ══════════════════════════════════════════════════════════════
function CalendarGrid({ reels, stories, onDayClick }) {
  const m = useIsMobile(), now = new Date();
  const [vY, setVY] = useState(2026), [vM, setVM] = useState(3);
  const days = getDaysInMonth(vY, vM), sd = getStartDay(vY, vM);
  const tod  = now.getFullYear()===vY && now.getMonth()===vM ? now.getDate() : null;
  const pm   = () => { if(vM===0){setVM(11);setVY(y=>y-1);}else setVM(v=>v-1); };
  const nm   = () => { if(vM===11){setVM(0);setVY(y=>y+1);}else setVM(v=>v+1); };
  const ds   = (d) => `${vY}-${String(vM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={pm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:40, height:40, cursor:"pointer", color:MUTED, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#999"} onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>‹</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:m?16:18, fontWeight:700, color:TEXT }}>{MONTH_NAMES[vM]} {vY}</div>
          {!m && <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace" }}>Click any day to see details</div>}
        </div>
        <button onClick={nm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:40, height:40, cursor:"pointer", color:MUTED, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#999"} onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:m?2:4, marginBottom:m?2:4 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={{ textAlign:"center", fontSize:m?8:10, color:MUTED, fontFamily:"monospace", padding:"3px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:m?2:4 }}>
        {Array.from({length:sd}).map((_,i) => <div key={`e${i}`}/>)}
        {Array.from({length:days}).map((_,i) => {
          const day  = i+1, date = ds(day);
          const fR   = reels.filter(r => r.brand==="franz" && r.date===date);
          const tR   = reels.filter(r => r.brand==="tgc"   && r.date===date);
          const fS   = stories.filter(s => s.brand==="franz" && s.date===date);
          const tS   = stories.filter(s => s.brand==="tgc"   && s.date===date);
          const fRd  = fR.some(r => r.status==="posted");
          const tRd  = tR.some(r => r.status==="posted");
          const fRf  = fR.some(r => r.status==="filmed");
          const tRf  = tR.some(r => r.status==="filmed");
          const fSd  = fS.reduce((n,s) => n+["morning","midday","evening"].filter(sl=>s[`${sl}_status`]==="posted").length, 0);
          const tSd  = tS.reduce((n,s) => n+["morning","midday","evening"].filter(sl=>s[`${sl}_status`]==="posted").length, 0);
          const isT  = day===tod;

          // Dot color based on status
          const fDot = fRd ? FRANZ : fRf ? AMBER : fR.length>0 ? `${FRANZ}44` : null;
          const tDot = tRd ? TGC   : tRf ? AMBER : tR.length>0 ? `${TGC}44`   : null;

          return (
            <div key={day} onClick={() => onDayClick(day, vY, vM)}
              style={{ minHeight:m?52:72, borderRadius:m?6:8, padding:m?"4px":"6px 7px", background:isT?`${FRANZ}11`:CARD, border:`1px solid ${isT?FRANZ:BORDER}`, cursor:"pointer", transition:"all 0.15s", boxShadow:(fR.length>0||tR.length>0)?"0 1px 3px rgba(0,0,0,0.05)":"none" }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#999"}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isT?FRANZ:BORDER; }}>
              <div style={{ fontSize:m?11:12, fontWeight:isT?700:500, color:isT?FRANZ:TEXT, marginBottom:m?3:4, fontFamily:"monospace" }}>{day}</div>
              {/* Franz indicator — pill with reel + stories count */}
              {(fR.length>0 || fS.length>0) && (
                <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:m?3:4, padding:m?"2px 4px":"3px 5px", background:`${FRANZ}15`, borderRadius:m?4:6, border:`1px solid ${fRd?FRANZ:FRANZ+"44"}` }}>
                  {fR.length>0 && <div style={{ width:m?6:7, height:m?6:7, borderRadius:"50%", background:fDot, flexShrink:0 }}/>}
                  {!m && fR[0] && <div style={{ fontSize:9, color:fRd?FRANZ:MUTED, fontFamily:"monospace", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>F · {fR[0]?.title.slice(0,12)}</div>}
                  {m && fR.length>0 && <span style={{ fontSize:7, color:fRd?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700 }}>F</span>}
                  {fS.length>0 && <span style={{ fontSize:m?7:8, color:fSd>0?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700, marginLeft:"auto" }}>{fSd}/3</span>}
                </div>
              )}
              {/* TGC indicator — pill with reel + stories count */}
              {(tR.length>0 || tS.length>0) && (
                <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:m?2:3, padding:m?"2px 4px":"3px 5px", background:`${TGC}15`, borderRadius:m?4:6, border:`1px solid ${tRd?TGC:TGC+"44"}` }}>
                  {tR.length>0 && <div style={{ width:m?6:7, height:m?6:7, borderRadius:"50%", background:tDot, flexShrink:0 }}/>}
                  {!m && tR[0] && <div style={{ fontSize:9, color:tRd?TGC:MUTED, fontFamily:"monospace", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>T · {tR[0]?.title.slice(0,12)}</div>}
                  {m && tR.length>0 && <span style={{ fontSize:7, color:tRd?TGC:MUTED, fontFamily:"monospace", fontWeight:700 }}>T</span>}
                  {tS.length>0 && <span style={{ fontSize:m?7:8, color:tSd>0?TGC:MUTED, fontFamily:"monospace", fontWeight:700, marginLeft:"auto" }}>{tSd}/3</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:m?10:16, marginTop:12, flexWrap:"wrap" }}>
        {[{color:FRANZ,label:"Franz posted"},{color:AMBER,label:"Filmed"},{color:MUTED,label:"Planned"},{color:TGC,label:"TGC posted"}].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:l.color }}/><span style={{ fontSize:9, color:MUTED, fontFamily:"monospace" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DAY MODAL
// ══════════════════════════════════════════════════════════════
function DayModal({ day, year, month, reels, stories, series, onClose, onOpenReel, onToggleReel, onToggleStory, saving }) {
  const m   = useIsMobile();
  useSwipeBack(onClose);
  const ds  = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const fR  = reels.filter(r => r.brand==="franz" && r.date===ds);
  const tR  = reels.filter(r => r.brand==="tgc"   && r.date===ds);
  const fS  = stories.filter(s => s.brand==="franz" && s.date===ds);
  const tS  = stories.filter(s => s.brand==="tgc"   && s.date===ds);

  const RR = ({ reel, brand }) => {
    const color = bc(brand);
    const sObj  = reel.type==="SERIES" ? series.find(s=>s.id===reel.series_id) : null;
    return (
      <div onClick={() => onOpenReel(reel, brand)} style={{ padding:"12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10, marginBottom:10, cursor:"pointer", transition:"all 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor=color}
        onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:6 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:color }}/>
            <span style={{ fontSize:11, color, fontFamily:"monospace", fontWeight:700 }}>{brand==="franz"?"FRANZ":"TGC"}</span>
            {sObj && <span style={{ fontSize:10, color:sObj.color, fontFamily:"monospace" }}>{sObj.name} · Pt {reel.part}</span>}
          </div>
          <div onClick={e => e.stopPropagation()}>
            <StatusBadge status={reel.status} onClick={() => onToggleReel(reel.id, reel.status)} disabled={saving}/>
          </div>
        </div>
        <div style={{ fontSize:15, fontWeight:600, color:TEXT }}>{reel.title}</div>
        {reel.hook && <div style={{ fontSize:12, color:MUTED, fontStyle:"italic", marginTop:2 }}>"{reel.hook}"</div>}
        <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace", marginTop:6, letterSpacing:"1px" }}>TAP FOR DETAILS →</div>
      </div>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:m?"flex-end":"center", justifyContent:"center", padding:m?0:20 }}>
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:m?"16px 16px 0 0":"16px", padding:m?"max(16px, env(safe-area-inset-top)) 12px 36px":"28px", width:m?"100%":640, maxWidth:"100%", maxHeight:m?"94vh":"90vh", overflowY:"auto" }}>
        {m && <div style={{ width:40, height:4, background:BORDER, borderRadius:2, margin:"0 auto 14px" }}/>}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:3 }}>{MONTH_NAMES[month].toUpperCase()} {year}</div>
            <div style={{ fontSize:m?17:22, fontWeight:700, color:TEXT }}>{new Date(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}T00:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:MUTED, fontSize:22, cursor:"pointer", padding:12, minWidth:48, minHeight:48, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8 }}>✕</button>
        </div>
        <div style={{ height:1, background:BORDER, marginBottom:14 }}/>
        {fR.map(r => <RR key={r.id} reel={r} brand="franz"/>)}
        {tR.map(r => <RR key={r.id} reel={r} brand="tgc"/>)}
        {fS.map(s => <div key={s.id} style={{ padding:12, background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10, marginBottom:10 }}>
          <div style={{ fontSize:11, color:FRANZ, fontFamily:"monospace", fontWeight:700, marginBottom:6 }}>FRANZ STORIES</div>
          {["morning","midday","evening"].map(slot => <div key={slot} style={{ fontSize:11, color:TEXT, marginBottom:3 }}><b>{slot}:</b> {s[slot]}</div>)}
        </div>)}
        {tS.map(s => <div key={s.id} style={{ padding:12, background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10, marginBottom:10 }}>
          <div style={{ fontSize:11, color:TGC, fontFamily:"monospace", fontWeight:700, marginBottom:6 }}>TGC STORIES</div>
          {["morning","midday","evening"].map(slot => <div key={slot} style={{ fontSize:11, color:TEXT, marginBottom:3 }}><b>{slot}:</b> {s[slot]}</div>)}
        </div>)}
        {fR.length===0&&tR.length===0&&fS.length===0&&tS.length===0&&<div style={{ textAlign:"center", padding:40, color:MUTED, fontFamily:"monospace" }}>No content for this day.</div>}
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}><Btn onClick={onClose} accent={MUTED}>CLOSE</Btn></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const m = useIsMobile();

  const [reels,   setReels]   = useState([]);
  const [stories, setStories] = useState([]);
  const [series,  setSeries]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const [tab,   setTab]   = useState("today");
  const [brand, setBrand] = useState("franz");

  const [showAddReel,  setShowAddReel]  = useState(false);
  const [newReel,      setNewReel]      = useState({ brand:"franz", date:"", title:"", caption:"", hook:"", description:"", format:"", notes:"", type:"REEL", series:"", part:"" });
  const [showAddStory, setShowAddStory] = useState(false);
  const [newStory,     setNewStory]     = useState({ brand:"franz", date:"", morning:"", midday:"", evening:"" });
  const [editSlot,     setEditSlot]     = useState(null);
  const [editVal,      setEditVal]      = useState("");
  const [detailReel,   setDetailReel]   = useState(null);
  const [calendarDay,  setCalendarDay]  = useState(null);
  const [showBulk,     setShowBulk]     = useState(false);
  const [bulkFile,     setBulkFile]     = useState(null);
  const [bulkPreview,  setBulkPreview]  = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, r, st] = await Promise.all([fetchSeries(), fetchReels(), fetchStories()]);
      setSeries(s||[]); setReels(r||[]); setStories(st||[]);
    } catch (e) { setError("Connection failed: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Status toggle — cycles forward planned→filmed→posted→planned ──
  const handleToggleStatus = async (id, currentStatus) => {
    const ns = currentStatus === "posted" ? "planned" : nextStatus(currentStatus);
    setReels(prev => prev.map(r => r.id===id ? {...r, status:ns} : r));
    try {
      await updateReelStatus(id, ns);
    } catch (e) {
      setReels(prev => prev.map(r => r.id===id ? {...r, status:currentStatus} : r));
      setError("Status update failed: " + e.message);
    }
  };
  // ── Set status directly to a specific value ──
  const handleSetStatus = async (id, newStatus) => {
    const prev = reels.find(r => r.id === id)?.status;
    setReels(prev => prev.map(r => r.id===id ? {...r, status:newStatus} : r));
    try {
      await updateReelStatus(id, newStatus);
    } catch (e) {
      setReels(prevReels => prevReels.map(r => r.id===id ? {...r, status:prev} : r));
      setError("Status update failed: " + e.message);
    }
  };

  const handleAddReel = async () => {
    if (!newReel.title||!newReel.date) return;
    setSaving(true); setError(null);
    try {
      const created = await addReel(newReel);
      setReels(prev => [...prev, created].sort((a,b)=>a.date.localeCompare(b.date)));
      setNewReel({ brand:"franz", date:"", title:"", caption:"", hook:"", description:"", format:"", notes:"", type:"REEL", series:"", part:"" });
      setShowAddReel(false);
    } catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleAddStory = async () => {
    if (!newStory.date) return;
    setSaving(true); setError(null);
    try {
      const created = await addStory(newStory);
      setStories(prev => [...prev, created].sort((a,b)=>a.date.localeCompare(b.date)));
      setNewStory({ brand:"franz", date:"", morning:"", midday:"", evening:"" });
      setShowAddStory(false);
    } catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleDeleteReel = async (id) => {
    setSaving(true);
    try { await deleteReel(id); setReels(prev=>prev.filter(r=>r.id!==id)); }
    catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleToggleStory = async (id, slot, currentStatus) => {
    // Optimistic update — flip checkbox immediately
    const newStatus = currentStatus === "posted" ? "planned" : "posted";
    setStories(prev=>prev.map(s=>s.id===id?{...s,[`${slot}_status`]:newStatus}:s));
    try {
      await updateStorySlotStatus(id, slot, currentStatus!=="posted");
    } catch(e){
      // Revert on error
      setStories(prev=>prev.map(s=>s.id===id?{...s,[`${slot}_status`]:currentStatus}:s));
      setError(e.message);
    }
  };

  const handleDeleteStory = async (id) => {
    setSaving(true);
    try { await deleteStory(id); setStories(prev=>prev.filter(s=>s.id!==id)); }
    catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleSaveEditSlot = async () => {
    if (!editSlot) return;
    setSaving(true);
    try {
      const updated = await updateStorySlot(editSlot.id, editSlot.slot, editVal);
      setStories(prev=>prev.map(s=>s.id===editSlot.id?{...s,[editSlot.slot]:updated[editSlot.slot]}:s));
      setEditSlot(null); setEditVal("");
    } catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleSaveAnalytics = async (reelId, vals) => {
    setSaving(true);
    try { await saveAnalytics(reelId, vals); setDetailReel(null); }
    catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const handleBulkFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h=>h.trim().replace(/"/g,""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v=>v.trim().replace(/"/g,""));
        return headers.reduce((obj,h,i)=>{obj[h]=vals[i]||"";return obj;},{});
      });
      setBulkPreview(rows.slice(0,5));
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!bulkFile) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map(h=>h.trim().replace(/"/g,""));
        const rows = lines.slice(1).map(line=>{
          const vals=line.split(",").map(v=>v.trim().replace(/"/g,""));
          return headers.reduce((obj,h,i)=>{obj[h]=vals[i]||"";return obj;},{});
        });
        const reelRows  = rows.filter(r=>r.type==="REEL"||r.type==="SERIES");
        const storyRows = rows.filter(r=>r.type==="STORY");
        if (reelRows.length>0)  await bulkImportReels(reelRows);
        if (storyRows.length>0) await bulkImportStories(storyRows);
        await loadAll();
        setShowBulk(false); setBulkFile(null); setBulkPreview(null);
      } catch(e){setError(e.message);}finally{setSaving(false);}
    };
    reader.readAsText(bulkFile);
  };

  // Stats
  const totalPosted = reels.filter(r=>r.status==="posted").length;
  const totalFilmed = reels.filter(r=>r.status==="filmed").length;
  const totalPlanned= reels.filter(r=>r.status==="planned").length;

  const seriesPct = (sid) => {
    const s=series.find(x=>x.id===sid); if(!s) return 0;
    const bs=s.brand==="Both"?["franz","tgc"]:[s.brand.toLowerCase()];
    let done=0;
    bs.forEach(b=>reels.filter(r=>r.brand===b&&r.type==="SERIES"&&r.series_id===sid&&r.status==="posted").forEach(()=>done++));
    return Math.round((done/s.parts)*100);
  };

  const TABS = [
    ["today", "📅", "Today"],
    ["calendar", "🗓", "Kalender"],
    ["reels",    "🎬", "Reels"],
    ["stories",  "📸", "Stories"],
    ["series", "🎞", "Series"],
  ];

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Georgia',serif", color:TEXT, paddingBottom:m?72:0 }}>

      {/* ── Modals ── */}
      {detailReel && (
        <ReelDetail reel={detailReel.reel} brand={detailReel.brand} series={series}
          onClose={()=>setDetailReel(null)}
          onToggleStatus={handleToggleStatus}
          onSetStatus={handleSetStatus}
          saving={saving}
          analytics={detailReel.reel.analytics?.[0]}
          onSaveAnalytics={handleSaveAnalytics}/>
      )}
      {calendarDay && (
        <DayModal day={calendarDay.day} year={calendarDay.year} month={calendarDay.month}
          reels={reels} stories={stories} series={series}
          onClose={()=>setCalendarDay(null)}
          onOpenReel={(reel,brand)=>{setCalendarDay(null);setDetailReel({reel,brand});}}
          onToggleReel={handleToggleStatus}
          onToggleStory={handleToggleStory}
          saving={saving}/>
      )}
      {showAddReel && (
        <Modal title="Add New Reel" onClose={()=>setShowAddReel(false)} onSave={handleAddReel} saving={saving} wide>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:8 }}>{["franz","tgc"].map(b=><BrandToggle key={b} brand={b} active={newReel.brand===b} onClick={()=>setNewReel(p=>({...p,brand:b}))} compact={m}/>)}</div>
            <div style={{ display:"flex", flexDirection:m?"column":"row", gap:8 }}>
              <div style={{ flex:1 }}><DatePicker value={newReel.date} onChange={v=>setNewReel(p=>({...p,date:v}))} accentColor={bc(newReel.brand)}/></div>
              <select value={newReel.type} onChange={e=>setNewReel(p=>({...p,type:e.target.value}))} style={{ flex:1, padding:"10px 12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:6, color:TEXT, fontSize:14, fontFamily:"monospace", minHeight:44 }}>
                <option value="REEL">Standalone Reel</option><option value="SERIES">Part of a Series</option>
              </select>
            </div>
            {newReel.type==="SERIES" && (
              <div style={{ display:"flex", flexDirection:m?"column":"row", gap:8 }}>
                <select value={newReel.series} onChange={e=>setNewReel(p=>({...p,series:e.target.value}))} style={{ flex:1, padding:"10px 12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:6, color:TEXT, fontSize:14, fontFamily:"monospace", minHeight:44 }}>
                  <option value="">Select series...</option>
                  {series.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Input value={newReel.part} onChange={v=>setNewReel(p=>({...p,part:v}))} placeholder="Part #" style={{ width:m?"100%":80 }}/>
              </div>
            )}
            <Input value={newReel.title}       onChange={v=>setNewReel(p=>({...p,title:v}))}       placeholder="Title *"/>
            <Input value={newReel.caption}     onChange={v=>setNewReel(p=>({...p,caption:v}))}     placeholder="Caption"/>
            <Input value={newReel.hook}        onChange={v=>setNewReel(p=>({...p,hook:v}))}        placeholder="Hook — First 2 Seconds"/>
            <textarea value={newReel.description} onChange={e=>setNewReel(p=>({...p,description:e.target.value}))} placeholder="What to film"
              style={{ padding:"10px 12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:6, color:TEXT, fontSize:14, fontFamily:"monospace", minHeight:80, resize:"vertical" }}/>
            <Input value={newReel.format} onChange={v=>setNewReel(p=>({...p,format:v}))} placeholder="Format & Style"/>
            <Input value={newReel.notes}  onChange={v=>setNewReel(p=>({...p,notes:v}))}  placeholder="Director's Note (optional)"/>
          </div>
        </Modal>
      )}
      {showAddStory && (
        <Modal title="Add Story Day" onClose={()=>setShowAddStory(false)} onSave={handleAddStory} saving={saving}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:8 }}>{["franz","tgc"].map(b=><BrandToggle key={b} brand={b} active={newStory.brand===b} onClick={()=>setNewStory(p=>({...p,brand:b}))} compact={m}/>)}</div>
            <DatePicker value={newStory.date} onChange={v=>setNewStory(p=>({...p,date:v}))} accentColor={bc(newStory.brand)}/>
            <Input value={newStory.morning} onChange={v=>setNewStory(p=>({...p,morning:v}))} placeholder="Morning story"/>
            <Input value={newStory.midday}  onChange={v=>setNewStory(p=>({...p,midday:v}))}  placeholder="Midday story"/>
            <Input value={newStory.evening} onChange={v=>setNewStory(p=>({...p,evening:v}))} placeholder="Evening story"/>
          </div>
        </Modal>
      )}
      {editSlot && (
        <Modal title={`${editSlot.slot} Story edit`} onClose={()=>setEditSlot(null)} onSave={handleSaveEditSlot} saving={saving}>
          <textarea value={editVal} onChange={e=>setEditVal(e.target.value)} style={{ width:"100%", minHeight:120, padding:"10px 12px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:8, color:TEXT, fontSize:14, fontFamily:"monospace", resize:"vertical", boxSizing:"border-box" }}/>
        </Modal>
      )}
      {showBulk && (
        <Modal title="Bulk Import — CSV" onClose={()=>{setShowBulk(false);setBulkFile(null);setBulkPreview(null);}} onSave={bulkFile?handleBulkImport:null} saving={saving} wide>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ padding:"12px 16px", background:`${FRANZ}0F`, border:`1px solid ${FRANZ}33`, borderRadius:10 }}>
              <div style={{ fontSize:11, color:FRANZ, fontFamily:"monospace", fontWeight:700, marginBottom:6 }}>CSV FORMAT</div>
              <div style={{ fontSize:12, color:TEXT, fontFamily:"monospace", lineHeight:1.8 }}>Spalten: <b>type, brand, date, title, caption, hook, description, format, notes, series, part</b><br/>type = REEL | SERIES | STORY · brand = franz | tgc · date = YYYY-MM-DD</div>
            </div>
            <div style={{ border:`2px dashed ${BORDER}`, borderRadius:10, padding:24, textAlign:"center" }}>
              <input type="file" accept=".csv" onChange={handleBulkFile} style={{ display:"none" }} id="csvInput"/>
              <label htmlFor="csvInput" style={{ cursor:"pointer", color:FRANZ, fontFamily:"monospace", fontSize:13, fontWeight:700 }}>{bulkFile?`✓ ${bulkFile.name}`:"Select CSV file"}</label>
            </div>
            {bulkPreview && bulkPreview.map((row,i)=>(
              <div key={i} style={{ padding:"8px 10px", background:i%2===0?SOFT:CARD, borderRadius:4, fontSize:11, fontFamily:"monospace" }}>
                <span style={{ color:bc(row.brand||"franz"), fontWeight:700 }}>{row.brand?.toUpperCase()}</span> · {row.date} · <b>{row.title}</b>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Header ── */}
      <div style={{ borderBottom:`1px solid ${BORDER}`, padding:m?"max(12px, env(safe-area-inset-top)) 12px 12px":"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50, background:BG }}>
        <div style={{ display:"flex", alignItems:"center", gap:m?8:16 }}>
          {saving && <div style={{ width:6, height:6, borderRadius:"50%", background:FRANZ, animation:"pulse 1s infinite" }}/>}
          <div>
            <div style={{ fontSize:m?14:18, fontWeight:700, color:TEXT }}>Content Dashboard</div>
            {!m && <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace" }}>Franz & The Green Collective</div>}
          </div>
        </div>
        {!m ? (
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {TABS.map(([id,,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{ padding:"7px 15px", borderRadius:6, border:`1px solid ${tab===id?TEXT:BORDER}`, cursor:"pointer", fontSize:11, fontFamily:"monospace", letterSpacing:"1px", background:tab===id?TEXT:"transparent", color:tab===id?BG:MUTED, transition:"all 0.15s" }}>{label.toUpperCase()}</button>
            ))}
            <button onClick={()=>setShowBulk(true)} style={{ padding:"7px 14px", borderRadius:6, border:`1px solid ${BUILD}`, background:`${BUILD}11`, color:BUILD, fontSize:11, fontFamily:"monospace", cursor:"pointer", marginLeft:8 }}>⬆ BULK</button>
          </div>
        ):(
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>setShowAddReel(true)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${FRANZ}`, background:`${FRANZ}11`, color:FRANZ, fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>+ Reel</button>
            <button onClick={()=>setShowAddStory(true)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${TGC}`, background:`${TGC}11`, color:TGC, fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>+ Story</button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding:m?"12px 10px":"24px 28px", maxWidth:1200, margin:"0 auto" }}>
        {error && <ErrorBanner msg={error} onDismiss={()=>setError(null)}/>}
        {loading ? <Spinner/> : (
          <>
            {/* HEUTE */}
            {tab==="today" && (
              <TodayTab reels={reels} stories={stories} series={series}
                onToggleStatus={handleToggleStatus}
                onOpenReel={(reel,brand)=>setDetailReel({reel,brand})}
                saving={saving}/>
            )}

            {/* KALENDER */}
            {tab==="calendar" && (
              <div>
                {/* Stats */}
                <div style={{ display:"grid", gridTemplateColumns:m?"1fr 1fr 1fr":"1fr 1fr 1fr 1fr 1fr", gap:m?8:12, marginBottom:m?14:24 }}>
                  {[
                    { label:"Posted",   val:totalPosted,  color:GREEN },
                    { label:"Filmed",   val:totalFilmed,  color:AMBER },
                    { label:"Planned",   val:totalPlanned, color:MUTED },
                    { label:"Franz ✓",   val:reels.filter(r=>r.brand==="franz"&&r.status==="posted").length, total:reels.filter(r=>r.brand==="franz").length, color:FRANZ },
                    { label:"TGC ✓",     val:reels.filter(r=>r.brand==="tgc"&&r.status==="posted").length,   total:reels.filter(r=>r.brand==="tgc").length,   color:TGC   },
                  ].map((s,i)=>(
                    <div key={i} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:m?10:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontSize:9, color:MUTED, letterSpacing:"1.5px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:5 }}>{s.label}</div>
                      <div style={{ fontSize:m?22:32, fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}{s.total!==undefined&&<span style={{ fontSize:m?11:14, color:MUTED }}>/{s.total}</span>}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:m?12:24, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", marginBottom:m?12:16 }}>
                  {!m && <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8, gap:8 }}>
                    <button onClick={()=>setShowAddReel(true)} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${FRANZ}`, background:`${FRANZ}11`, color:FRANZ, fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>+ REEL</button>
                    <button onClick={()=>setShowAddStory(true)} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${TGC}`, background:`${TGC}11`, color:TGC, fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>+ STORY</button>
                  </div>}
                  <CalendarGrid reels={reels} stories={stories} onDayClick={(day,year,month)=>setCalendarDay({day,year,month})}/>
                </div>
              </div>
            )}

            {/* REELS */}
            {tab==="reels" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, gap:8 }}>
                  <div style={{ display:"flex", gap:6, flex:1 }}>
                    <BrandToggle brand="franz" active={brand==="franz"} onClick={()=>setBrand("franz")} compact={m}/>
                    <BrandToggle brand="tgc"   active={brand==="tgc"}   onClick={()=>setBrand("tgc")}   compact={m}/>
                  </div>
                  {!m && <button onClick={()=>setShowAddReel(true)} style={{ padding:"9px 18px", borderRadius:8, border:`1px solid ${bc(brand)}`, background:`${bc(brand)}11`, color:bc(brand), fontSize:12, fontFamily:"monospace", letterSpacing:"1px", cursor:"pointer", whiteSpace:"nowrap" }}>+ REEL</button>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {reels.filter(r=>r.brand===brand).map(reel=>{
                    const color=bc(brand);
                    const sObj=reel.type==="SERIES"?series.find(s=>s.id===reel.series_id):null;
                    const tc=sObj?.color||color;
                    return (
                      <div key={reel.id} onClick={()=>setDetailReel({reel,brand})}
                        style={{ background:reel.status==="posted"?`${color}08`:CARD, border:`1px solid ${reel.status==="posted"?color+"44":BORDER}`, borderLeft:`4px solid ${reel.status==="posted"?color:reel.status==="filmed"?AMBER:BORDER}`, borderRadius:10, padding:m?"10px":"14px 18px", transition:"all 0.15s", cursor:"pointer" }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                          <div style={{ flexShrink:0, minWidth:42 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:TEXT }}>{formatDate(reel.date)}</div>
                            <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace" }}>{new Date(reel.date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short"}).toUpperCase()}</div>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ padding:"2px 7px", borderRadius:4, background:`${tc}15`, border:`1px solid ${tc}44`, fontSize:8, fontFamily:"monospace", color:tc, display:"inline-block", marginBottom:4, whiteSpace:"nowrap" }}>
                              {reel.type==="SERIES"?`${sObj?.name||reel.series_id} · Pt ${reel.part}`:"STANDALONE"}
                            </div>
                            <div style={{ fontSize:m?13:14, fontWeight:600, color:TEXT, marginBottom:2 }}>{reel.title}</div>
                            {reel.hook && <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>"{reel.hook}"</div>}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0, alignItems:"flex-end" }} onClick={e=>e.stopPropagation()}>
                            <StatusBadge status={reel.status} onClick={()=>handleToggleStatus(reel.id,reel.status)} disabled={saving}/>
                            <button onClick={()=>handleDeleteReel(reel.id)} disabled={saving} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:11, padding:2 }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {reels.filter(r=>r.brand===brand).length===0&&<div style={{ textAlign:"center", padding:60, color:MUTED, fontFamily:"monospace" }}>No reels yet.</div>}
                </div>
              </div>
            )}

            {/* STORIES */}
            {tab==="stories" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, gap:8 }}>
                  <div style={{ display:"flex", gap:6, flex:1 }}>
                    <BrandToggle brand="franz" active={brand==="franz"} onClick={()=>setBrand("franz")} compact={m}/>
                    <BrandToggle brand="tgc"   active={brand==="tgc"}   onClick={()=>setBrand("tgc")}   compact={m}/>
                  </div>
                  {!m && <button onClick={()=>setShowAddStory(true)} style={{ padding:"9px 18px", borderRadius:8, border:`1px solid ${bc(brand)}`, background:`${bc(brand)}11`, color:bc(brand), fontSize:12, fontFamily:"monospace", letterSpacing:"1px", cursor:"pointer", whiteSpace:"nowrap" }}>+ STORY DAY</button>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {stories.filter(s=>s.brand===brand).map(story=>{
                    const color=bc(brand);
                    const slots=[{key:"morning",label:"Morning",value:story.morning},{key:"midday",label:"Midday",value:story.midday},{key:"evening",label:"Evening",value:story.evening}];
                    const doneCount=slots.filter(s=>story[`${s.key}_status`]==="posted").length;
                    return (
                      <div key={story.id} style={{ background:doneCount===3?`${color}08`:CARD, border:`1px solid ${doneCount>0?color+"44":BORDER}`, borderLeft:`4px solid ${doneCount===3?color:doneCount>0?color+"88":BORDER}`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <div style={{ flexShrink:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:doneCount>0?color:TEXT }}>{formatDate(story.date)}</div>
                            <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace" }}>{new Date(story.date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short"}).toUpperCase()}</div>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", gap:3 }}>{slots.map(s=><div key={s.key} style={{ width:8, height:8, borderRadius:"50%", background:story[`${s.key}_status`]==="posted"?color:BORDER }}/>)}</div>
                            <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", marginTop:2 }}>{doneCount}/3 posted</div>
                          </div>
                          <button onClick={()=>handleDeleteStory(story.id)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:11, padding:4 }}>✕</button>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                          {slots.map(s=>{
                            const done=story[`${s.key}_status`]==="posted";
                            return (
                              <div key={s.key}
                                onClick={()=>{setEditSlot({id:story.id,slot:s.key});setEditVal(s.value);}}
                                style={{ background:done?`${color}0F`:SOFT, border:`1px solid ${done?color+"55":BORDER}`, borderRadius:8, padding:"8px", cursor:"pointer" }}
                                onMouseEnter={e=>e.currentTarget.style.borderColor=bc(brand)}
                                onMouseLeave={e=>e.currentTarget.style.borderColor=done?bc(brand)+"55":BORDER}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                                  <span style={{ fontSize:8, color:done?color:MUTED, fontFamily:"monospace", fontWeight:700 }}>{s.label.toUpperCase()}</span>
                                  <div onClick={e=>{e.stopPropagation();handleToggleStory(story.id,s.key,story[`${s.key}_status`]);}}
                                    style={{ width:18, height:18, borderRadius:"50%", background:done?color:"transparent", border:`1.5px solid ${done?color:BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", cursor:"pointer" }}>
                                    {done?"✓":""}
                                  </div>
                                </div>
                                <div style={{ fontSize:m?10:11, color:TEXT, lineHeight:1.4 }}>{s.value}</div>
                                <div style={{ marginTop:3, fontSize:8, color:done?color:MUTED, fontFamily:"monospace" }}>{done?"✓ posted":"tap to edit"}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {stories.filter(s=>s.brand===brand).length===0&&<div style={{ textAlign:"center", padding:60, color:MUTED, fontFamily:"monospace" }}>No stories yet.</div>}
                </div>
              </div>
            )}

            {/* SERIEN */}
            {tab==="series" && (
              <SerienTab series={series} reels={reels}
                onOpenReel={(reel,brand)=>setDetailReel({reel,brand})}
                onToggleStatus={handleToggleStatus}
                saving={saving}/>
            )}
          </>
        )}
      </div>

      {/* ── Mobile Bottom Nav ── */}
      {m && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CARD, borderTop:`1px solid ${BORDER}`, display:"flex", zIndex:60, boxShadow:"0 -4px 20px rgba(0,0,0,0.08)" }}>
          {TABS.map(([id,icon,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"12px 4px 18px", background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:22 }}>{icon}</span>
              <span style={{ fontSize:10, fontFamily:"monospace", color:tab===id?TEXT:MUTED, fontWeight:tab===id?700:400, letterSpacing:"0.5px" }}>{label.toUpperCase()}</span>
              {tab===id && <div style={{ width:24, height:2, background:TEXT, borderRadius:1, marginTop:2 }}/>}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}