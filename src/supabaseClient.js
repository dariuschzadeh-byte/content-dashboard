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
  updateReelDriveLink, updateReelPostedAt,
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
function TodayTab({ reels, stories, series, onToggleStatus, onOpenReel, onEditStorySlot, onToggleStorySlot, saving }) {
  const m = useIsMobile();
  const todayStr = new Date().toISOString().split("T")[0];
  const [expanded, setExpanded] = useState(null); // "franz-reel" | "tgc-reel" | "franz-stories" | "tgc-stories" | null

  const franzReels = reels.filter(r => r.date === todayStr && r.brand === "franz");
  const tgcReels   = reels.filter(r => r.date === todayStr && r.brand === "tgc");
  const franzStories = stories.filter(s => s.date === todayStr && s.brand === "franz");
  const tgcStories   = stories.filter(s => s.date === todayStr && s.brand === "tgc");

  // KPIs per brand
  const franzReelsPosted = franzReels.filter(r => r.status === "posted").length;
  const franzReelsTotal  = franzReels.length;
  const tgcReelsPosted   = tgcReels.filter(r => r.status === "posted").length;
  const tgcReelsTotal    = tgcReels.length;

  const STORY_SLOTS = ["slot1","slot2","slot3","slot4","slot5","slot6"];
  const LEGACY_SLOTS = ["morning","midday","evening"];
  const countStoriesPosted = (storiesArr) =>
    storiesArr.reduce((n,s) => {
      const newSlots = STORY_SLOTS.filter(sl => s[`${sl}_status`] === "posted").length;
      const legacySlots = LEGACY_SLOTS.filter(sl => s[`${sl}_status`] === "posted").length;
      return n + Math.max(newSlots, legacySlots);
    }, 0);
  const countStoriesTotal = (storiesArr) =>
    storiesArr.reduce((n,s) => {
      const newSlots = STORY_SLOTS.filter(sl => s[sl]).length;
      const legacySlots = LEGACY_SLOTS.filter(sl => s[sl]).length;
      return n + Math.max(newSlots, legacySlots);
    }, 0);

  const franzStoriesPosted = countStoriesPosted(franzStories);
  const franzStoriesTotal  = countStoriesTotal(franzStories) || (franzStories.length * 6);
  const tgcStoriesPosted   = countStoriesPosted(tgcStories);
  const tgcStoriesTotal    = countStoriesTotal(tgcStories) || (tgcStories.length * 6);

  const totalPosted = franzReelsPosted + tgcReelsPosted + franzStoriesPosted + tgcStoriesPosted;
  const totalToPost = franzReelsTotal + tgcReelsTotal + franzStoriesTotal + tgcStoriesTotal;
  const allDone = totalToPost > 0 && totalPosted === totalToPost;

  // KPI Card component
  const KpiCard = ({ id, brand, type, label, posted, total, color, hasContent }) => {
    const isExpanded = expanded === id;
    const isComplete = total > 0 && posted === total;
    const hasNothing = total === 0;
    return (
      <div style={{ marginBottom:10 }}>
        <div onClick={() => !hasNothing && setExpanded(isExpanded ? null : id)}
          style={{ 
            background: isComplete ? `${color}0F` : CARD, 
            border:`1px solid ${isComplete ? color+"66" : isExpanded ? color : BORDER}`, 
            borderLeft:`4px solid ${isComplete ? color : posted > 0 ? color+"AA" : color+"55"}`, 
            borderRadius:12, 
            padding:m?"14px 14px":"16px 18px", 
            cursor: hasNothing ? "default" : "pointer", 
            transition:"all 0.2s",
            opacity: hasNothing ? 0.5 : 1,
            boxShadow: isExpanded ? `0 4px 16px ${color}22` : "0 1px 4px rgba(0,0,0,0.04)"
          }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color, fontFamily:"monospace", letterSpacing:"2px", fontWeight:700, marginBottom:3 }}>
                {brand.toUpperCase()} {type.toUpperCase()}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:m?20:24, fontWeight:700, color:isComplete ? color : TEXT, lineHeight:1 }}>
                  {posted}<span style={{ fontSize:m?13:15, color:MUTED, fontWeight:400 }}>/{total}</span>
                </div>
                <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace" }}>{type === "reel" ? "reel" : "stories"} posted</div>
              </div>
            </div>
            {!hasNothing && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {isComplete && <span style={{ fontSize:18 }}>✓</span>}
                <span style={{ fontSize:18, color, transform: isExpanded ? "rotate(90deg)" : "none", transition:"transform 0.2s" }}>›</span>
              </div>
            )}
          </div>
        </div>
        {isExpanded && (
          <div style={{ marginTop:6 }}>{renderExpandedContent(id)}</div>
        )}
      </div>
    );
  };

  const renderExpandedContent = (id) => {
    if (id === "franz-reel" || id === "tgc-reel") {
      const reelsToShow = id === "franz-reel" ? franzReels : tgcReels;
      const color = id === "franz-reel" ? FRANZ : TGC;
      return reelsToShow.map(reel => {
        const sObj = reel.type === "SERIES" ? series.find(s => s.id === reel.series_id) : null;
        return (
          <div key={reel.id} onClick={() => onOpenReel(reel, reel.brand)}
            style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:m?14:18, marginBottom:8, cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
              {sObj && <div style={{ padding:"3px 10px", borderRadius:4, background:`${sObj.color}11`, border:`1px solid ${sObj.color}33`, fontSize:10, fontFamily:"monospace", color:sObj.color }}>{sObj.name} · Pt {reel.part}</div>}
              <div onClick={e => e.stopPropagation()}>
                <StatusBadge status={reel.status} onClick={() => onToggleStatus(reel.id, reel.status)} disabled={saving}/>
              </div>
            </div>
            <div style={{ fontSize:m?16:18, fontWeight:700, color:TEXT, marginBottom:6 }}>{reel.title}</div>
            {reel.hook && (
              <div style={{ padding:"10px 14px", background:`${color}08`, border:`1px solid ${color}22`, borderRadius:8, marginBottom:8 }}>
                <div style={{ fontSize:9, color, fontFamily:"monospace", letterSpacing:"1.5px", marginBottom:3 }}>HOOK — FIRST 2 SECONDS</div>
                <div style={{ fontSize:14, color:TEXT, fontStyle:"italic" }}>"{reel.hook}"</div>
              </div>
            )}
            {reel.caption && <div style={{ fontSize:12, color:MUTED, fontStyle:"italic", marginBottom:8 }}>Caption: "{reel.caption}"</div>}
            <div style={{ fontSize:9, color:MUTED, fontFamily:"monospace", letterSpacing:"1px" }}>TAP CARD FOR FULL DETAILS →</div>
          </div>
        );
      });
    }
    if (id === "franz-stories" || id === "tgc-stories") {
      const storiesToShow = id === "franz-stories" ? franzStories : tgcStories;
      const color = id === "franz-stories" ? FRANZ : TGC;
      return storiesToShow.map(story => {
        const slots = [
          { key:"slot1", label:"Slot 1", value:story.slot1 || story.morning, status:story.slot1_status || story.morning_status },
          { key:"slot2", label:"Slot 2", value:story.slot2 || story.midday,  status:story.slot2_status || story.midday_status  },
          { key:"slot3", label:"Slot 3", value:story.slot3 || story.evening, status:story.slot3_status || story.evening_status },
          { key:"slot4", label:"Slot 4", value:story.slot4, status:story.slot4_status },
          { key:"slot5", label:"Slot 5", value:story.slot5, status:story.slot5_status },
          { key:"slot6", label:"Slot 6", value:story.slot6, status:story.slot6_status },
        ];
        return (
          <div key={story.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:m?12:14, marginBottom:8 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {slots.map(slot => {
                const done = slot.status==="posted";
                return (
                  <div key={slot.key}
                    onClick={() => onEditStorySlot && onEditStorySlot(story.id, slot.key, slot.value)}
                    style={{ background:done?`${color}0F`:SOFT, border:`1px solid ${done?color+"55":BORDER}`, borderRadius:8, padding:"10px 8px", cursor:"pointer", minHeight:90 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                      <span style={{ fontSize:8, color:done?color:MUTED, fontFamily:"monospace", fontWeight:700 }}>{slot.label.toUpperCase()}</span>
                      <div onClick={e => { e.stopPropagation(); onToggleStorySlot && onToggleStorySlot(story.id, slot.key, slot.status); }}
                        style={{ width:20, height:20, borderRadius:"50%", background:done?color:"transparent", border:`1.5px solid ${done?color:BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", cursor:"pointer", flexShrink:0 }}>
                        {done?"✓":""}
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:TEXT, lineHeight:1.4 }}>{slot.value || "—"}</div>
                    <div style={{ marginTop:5, fontSize:8, color:done?color:MUTED, fontFamily:"monospace" }}>{done?"✓ posted":"tap to edit"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
    }
    return null;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:m?14:20, marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:4 }}>TODAY</div>
        <div style={{ fontSize:m?20:26, fontWeight:700, color:TEXT }}>
          {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
        </div>
        {totalToPost > 0 && (
          <div style={{ marginTop:10, fontSize:13, color:MUTED, fontFamily:"monospace" }}>
            <span style={{ color:allDone?GREEN:TEXT, fontWeight:700 }}>{totalPosted}</span>/{totalToPost} done
          </div>
        )}
        {allDone && (
          <div style={{ marginTop:10, padding:"8px 14px", background:`${GREEN}11`, border:`1px solid ${GREEN}33`, borderRadius:8, display:"inline-flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>✅</span>
            <span style={{ fontSize:12, color:GREEN, fontFamily:"monospace", fontWeight:700 }}>Everything posted today!</span>
          </div>
        )}
        {totalToPost === 0 && (
          <div style={{ marginTop:10, fontSize:13, color:MUTED, fontFamily:"monospace" }}>No content planned for today.</div>
        )}
      </div>

      {/* KPI Cards */}
      {totalToPost > 0 && (
        <div>
          <KpiCard id="franz-reel"     brand="franz" type="reel"    posted={franzReelsPosted}   total={franzReelsTotal}   color={FRANZ} hasContent={franzReelsTotal>0}/>
          <KpiCard id="tgc-reel"       brand="tgc"   type="reel"    posted={tgcReelsPosted}     total={tgcReelsTotal}     color={TGC}   hasContent={tgcReelsTotal>0}/>
          <KpiCard id="franz-stories"  brand="franz" type="stories" posted={franzStoriesPosted} total={franzStoriesTotal} color={FRANZ} hasContent={franzStoriesTotal>0}/>
          <KpiCard id="tgc-stories"    brand="tgc"   type="stories" posted={tgcStoriesPosted}   total={tgcStoriesTotal}   color={TGC}   hasContent={tgcStoriesTotal>0}/>
        </div>
      )}

    </div>
  );
}

function SerienTab({ series, reels, onOpenReel, onToggleStatus, saving }) {
  const m = useIsMobile();
  const [expandedSeries, setExpandedSeries] = useState(null);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {series.map(s => {
        const brands  = s.brand==="Both" ? ["franz","tgc"] : [s.brand.toLowerCase()];
        // Show ALL reels matching this series (with or without date)
        const episodes = brands
          .flatMap(b => reels.filter(r => r.brand===b && (r.type==="SERIES" || r.series_id===s.id)).filter(r => r.series_id===s.id).map(r => ({...r,b})))
          .sort((a,b) => (a.part||0) - (b.part||0));
        const isExpanded = expandedSeries === s.id;

        const posted   = episodes.filter(e => e.status==="posted").length;
        const filmed   = episodes.filter(e => e.status==="filmed").length;
        const planned  = episodes.filter(e => e.status==="planned").length;
        const pct      = Math.round((posted / s.parts) * 100);

        // Next unposted episode
        const nextEp   = episodes.find(e => e.status !== "posted");
        const nextDays = nextEp ? daysUntil(nextEp.date) : null;
        const ampel    = nextEp ? deadlineColor(nextDays) : GREEN;

        return (
          <div key={s.id} 
            onClick={() => setExpandedSeries(isExpanded ? null : s.id)}
            style={{ background:CARD, border:`1px solid ${isExpanded?s.color:BORDER}`, borderLeft:`4px solid ${s.color}`, borderRadius:14, padding:m?14:22, boxShadow:isExpanded?`0 4px 16px ${s.color}22`:"0 1px 4px rgba(0,0,0,0.06)", cursor:"pointer", transition:"all 0.2s" }}>

            {/* Series Header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <div style={{ fontSize:9, color:s.color, fontFamily:"monospace", letterSpacing:"2px", fontWeight:700 }}>{s.brand.toUpperCase()}</div>
                  <span style={{ fontSize:14, color:s.color }}>{isExpanded ? "▼" : "▶"}</span>
                </div>
                <div style={{ fontSize:m?15:18, fontWeight:700, color:TEXT }}>{s.name}</div>
                <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", marginTop:3 }}>
                  {posted} posted · {filmed} filmed · {planned} planned · {s.parts} total
                </div>
                {!isExpanded && episodes.length > 0 && <div style={{ fontSize:9, color:s.color, fontFamily:"monospace", marginTop:6, letterSpacing:"1px" }}>TAP TO VIEW ALL {episodes.length} EPISODES →</div>}
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

            {/* Episodes — only shown when expanded */}
            {isExpanded && <div style={{ display:"grid", gridTemplateColumns:m?"1fr":"1fr 1fr", gap:8 }}>
              {episodes.map((ep, i) => {
                const days  = daysUntil(ep.date);
                const dColor = ep.status==="posted" ? GREEN : deadlineColor(days);
                return (
                  <div key={i} onClick={(e) => { e.stopPropagation(); onOpenReel(ep, ep.b); }}
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
            </div>}

            {isExpanded && episodes.length === 0 && (
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
function ReelDetail({ reel, brand, series, onClose, onToggleStatus, onSetStatus, onUpdateDriveLink, saving, analytics, onSaveAnalytics }) {
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
      <div style={{ background:CARD, borderTop:`4px solid ${color}`, borderRadius:m?"16px 16px 0 0":"16px", padding:m?"calc(env(safe-area-inset-top) + 28px) 16px 36px":"32px", width:m?"100%":640, maxWidth:"100%", maxHeight:m?"94vh":"90vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.2)" }}>
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
          {reel.posted_at && (
            <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", marginTop:8 }}>
              ✓ Posted: {new Date(reel.posted_at).toLocaleString("en-GB", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
            </div>
          )}
        </div>

        {/* File Name — Naming Convention Display */}
        {reel.file_name && (
          <div style={{ marginBottom:16, padding:"12px 14px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10 }}>
            <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>FILE NAME (TAP TO COPY)</div>
            <div onClick={() => {
              navigator.clipboard.writeText(reel.file_name);
              window.alert("Copied: " + reel.file_name);
            }} style={{ fontSize:12, color:TEXT, fontFamily:"monospace", padding:"8px 10px", background:CARD, border:`1px solid ${BORDER}`, borderRadius:6, cursor:"pointer", wordBreak:"break-all" }}>
              {reel.file_name} 📋
            </div>
          </div>
        )}

        {/* Drive Link Section */}
        <div style={{ marginBottom:20, padding:m?"14px":"16px 18px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:12 }}>
          <div style={{ fontSize:10, color:MUTED, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>📁 DRIVE LINK</div>
          {reel.drive_link ? (
            <div>
              <a href={reel.drive_link} target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-block", padding:"10px 16px", background:BUILD, color:"#fff", borderRadius:8, textDecoration:"none", fontSize:12, fontFamily:"monospace", fontWeight:600, marginBottom:8, marginRight:8 }}>
                ▶ OPEN IN DRIVE
              </a>
              <button onClick={async () => {
                if (window.confirm("Remove drive link?")) {
                  await onUpdateDriveLink && onUpdateDriveLink(reel.id, "");
                }
              }} style={{ padding:"10px 14px", background:"transparent", border:`1px solid ${BORDER}`, color:MUTED, fontSize:11, fontFamily:"monospace", cursor:"pointer", borderRadius:8 }}>
                ✕ Remove
              </button>
              <div style={{ fontSize:10, color:MUTED, marginTop:8, fontFamily:"monospace", wordBreak:"break-all" }}>{reel.drive_link}</div>
            </div>
          ) : (
            <div>
              <input type="text" placeholder="Paste Google Drive link here..."
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    await onUpdateDriveLink && onUpdateDriveLink(reel.id, e.target.value.trim());
                    e.target.value = "";
                  }
                }}
                onBlur={async (e) => {
                  if (e.target.value.trim()) {
                    await onUpdateDriveLink && onUpdateDriveLink(reel.id, e.target.value.trim());
                    e.target.value = "";
                  }
                }}
                style={{ width:"100%", padding:"10px 12px", border:`1px solid ${BORDER}`, borderRadius:8, fontSize:12, fontFamily:"monospace", background:CARD, color:TEXT, boxSizing:"border-box" }}/>
              <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", marginTop:6 }}>
                Press Enter or click outside to save · Auto-sets status to "Filmed"
              </div>
            </div>
          )}
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
  const [vY, setVY] = useState(now.getFullYear()), [vM, setVM] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState("week"); // "week" or "month"
  const [weekStart, setWeekStart] = useState(() => {
    // Start of current week (Monday)
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  });

  const days = getDaysInMonth(vY, vM), sd = getStartDay(vY, vM);
  const tod  = now.getFullYear()===vY && now.getMonth()===vM ? now.getDate() : null;
  const pm   = () => { if(vM===0){setVM(11);setVY(y=>y-1);}else setVM(v=>v-1); };
  const nm   = () => { if(vM===11){setVM(0);setVY(y=>y+1);}else setVM(v=>v+1); };
  const ds   = (d) => `${vY}-${String(vM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Week navigation
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); };
  const formatDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // Get 7 days starting from weekStart
  const weekDays = Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d; });
  const weekRange = `${weekDays[0].getDate()} ${MONTH_NAMES[weekDays[0].getMonth()].slice(0,3)} – ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()].slice(0,3)}`;
  const weekHeaderMonth = `${MONTH_NAMES[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`;

  // Helper to get day data
  const dayData = (date) => {
    const dStr = typeof date === "string" ? date : formatDateStr(date);
    const fR = reels.filter(r => r.brand==="franz" && r.date===dStr);
    const tR = reels.filter(r => r.brand==="tgc"   && r.date===dStr);
    const fS = stories.filter(s => s.brand==="franz" && s.date===dStr);
    const tS = stories.filter(s => s.brand==="tgc"   && s.date===dStr);
    const fRd = fR.some(r => r.status==="posted");
    const tRd = tR.some(r => r.status==="posted");
    const fRf = fR.some(r => r.status==="filmed");
    const tRf = tR.some(r => r.status==="filmed");
    const fSd = fS.reduce((n,s) => n+["morning","midday","evening"].filter(sl=>s[`${sl}_status`]==="posted").length, 0);
    const tSd = tS.reduce((n,s) => n+["morning","midday","evening"].filter(sl=>s[`${sl}_status`]==="posted").length, 0);
    return { fR, tR, fS, tS, fRd, tRd, fRf, tRf, fSd, tSd };
  };

  return (
    <div>
      {/* View Mode Toggle */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:14, gap:4 }}>
        <button onClick={()=>setViewMode("week")} style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${viewMode==="week"?TEXT:BORDER}`, background:viewMode==="week"?TEXT:"transparent", color:viewMode==="week"?BG:MUTED, fontSize:11, fontFamily:"monospace", letterSpacing:"1px", cursor:"pointer", fontWeight:viewMode==="week"?700:400, minHeight:40 }}>WEEK</button>
        <button onClick={()=>setViewMode("month")} style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${viewMode==="month"?TEXT:BORDER}`, background:viewMode==="month"?TEXT:"transparent", color:viewMode==="month"?BG:MUTED, fontSize:11, fontFamily:"monospace", letterSpacing:"1px", cursor:"pointer", fontWeight:viewMode==="month"?700:400, minHeight:40 }}>MONTH</button>
      </div>

      {viewMode === "week" ? (
        <>
          {/* Week View Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <button onClick={prevWeek} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:44, height:44, cursor:"pointer", color:MUTED, fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:m?11:13, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:2 }}>{weekHeaderMonth.toUpperCase()}</div>
              <div style={{ fontSize:m?16:18, fontWeight:700, color:TEXT }}>{weekRange}</div>
            </div>
            <button onClick={nextWeek} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:44, height:44, cursor:"pointer", color:MUTED, fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>

          {/* Week Day Cards — vertical list */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {weekDays.map((d) => {
              const dStr = formatDateStr(d);
              const data = dayData(dStr);
              const isToday = formatDateStr(now) === dStr;
              const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
              const totalReels = data.fR.length + data.tR.length;
              const totalStoriesPosted = data.fSd + data.tSd;
              const totalStoriesPlanned = (data.fS.length>0?3:0) + (data.tS.length>0?3:0);

              return (
                <div key={dStr} onClick={() => onDayClick(d.getDate(), d.getFullYear(), d.getMonth())}
                  style={{ background:isToday?`${FRANZ}08`:CARD, border:`1px solid ${isToday?FRANZ:BORDER}`, borderRadius:12, padding:m?12:14, cursor:"pointer", transition:"all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#999"}
                  onMouseLeave={e => e.currentTarget.style.borderColor=isToday?FRANZ:BORDER}>
                  {/* Day Header */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:totalReels>0||totalStoriesPlanned>0?10:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:m?40:48, textAlign:"center" }}>
                        <div style={{ fontSize:9, color:isToday?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700, marginBottom:2 }}>{dayName.toUpperCase()}</div>
                        <div style={{ fontSize:m?20:24, fontWeight:700, color:isToday?FRANZ:TEXT, lineHeight:1 }}>{d.getDate()}</div>
                      </div>
                      {isToday && <div style={{ padding:"3px 8px", borderRadius:4, background:FRANZ, fontSize:9, color:"#fff", fontFamily:"monospace", fontWeight:700, letterSpacing:"1px" }}>TODAY</div>}
                    </div>
                    {totalReels===0 && totalStoriesPlanned===0 && (
                      <span style={{ fontSize:10, color:MUTED, fontFamily:"monospace", fontStyle:"italic" }}>No content planned</span>
                    )}
                  </div>

                  {/* Franz Row */}
                  {(data.fR.length>0 || data.fS.length>0) && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:`${FRANZ}0A`, border:`1px solid ${FRANZ}33`, borderRadius:8, marginBottom:6 }}>
                      <div style={{ fontSize:9, color:FRANZ, fontFamily:"monospace", fontWeight:700, width:m?42:50, flexShrink:0 }}>FRANZ</div>
                      {data.fR.length>0 ? (
                        <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:data.fRd?FRANZ:data.fRf?AMBER:`${FRANZ}55`, flexShrink:0 }}/>
                          <span style={{ fontSize:m?11:12, color:data.fRd?FRANZ:TEXT, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{data.fR[0]?.title}</span>
                          <span style={{ fontSize:9, color:data.fRd?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700, flexShrink:0 }}>{data.fRd?"✓":data.fRf?"FILMED":"PLANNED"}</span>
                        </div>
                      ) : <div style={{ flex:1, fontSize:10, color:MUTED, fontStyle:"italic" }}>No reel</div>}
                      {data.fS.length>0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                          <span style={{ fontSize:10, color:data.fSd>0?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700 }}>{data.fSd}/3</span>
                          <div style={{ display:"flex", gap:2 }}>
                            {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:i<data.fSd?FRANZ:`${FRANZ}33` }}/>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TGC Row */}
                  {(data.tR.length>0 || data.tS.length>0) && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:`${TGC}0A`, border:`1px solid ${TGC}33`, borderRadius:8 }}>
                      <div style={{ fontSize:9, color:TGC, fontFamily:"monospace", fontWeight:700, width:m?42:50, flexShrink:0 }}>TGC</div>
                      {data.tR.length>0 ? (
                        <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:data.tRd?TGC:data.tRf?AMBER:`${TGC}55`, flexShrink:0 }}/>
                          <span style={{ fontSize:m?11:12, color:data.tRd?TGC:TEXT, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{data.tR[0]?.title}</span>
                          <span style={{ fontSize:9, color:data.tRd?TGC:MUTED, fontFamily:"monospace", fontWeight:700, flexShrink:0 }}>{data.tRd?"✓":data.tRf?"FILMED":"PLANNED"}</span>
                        </div>
                      ) : <div style={{ flex:1, fontSize:10, color:MUTED, fontStyle:"italic" }}>No reel</div>}
                      {data.tS.length>0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                          <span style={{ fontSize:10, color:data.tSd>0?TGC:MUTED, fontFamily:"monospace", fontWeight:700 }}>{data.tSd}/3</span>
                          <div style={{ display:"flex", gap:2 }}>
                            {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:i<data.tSd?TGC:`${TGC}33` }}/>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Month View Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <button onClick={pm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:44, height:44, cursor:"pointer", color:MUTED, fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:m?16:18, fontWeight:700, color:TEXT }}>{MONTH_NAMES[vM]} {vY}</div>
              {!m && <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace" }}>Click any day to see details</div>}
            </div>
            <button onClick={nm} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:8, width:44, height:44, cursor:"pointer", color:MUTED, fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>

          {/* Month grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:m?2:4, marginBottom:m?2:4 }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={{ textAlign:"center", fontSize:m?8:10, color:MUTED, fontFamily:"monospace", padding:"3px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:m?2:4 }}>
            {Array.from({length:sd}).map((_,i) => <div key={`e${i}`}/>)}
            {Array.from({length:days}).map((_,i) => {
              const day  = i+1, date = ds(day);
              const data = dayData(date);
              const isT  = day===tod;
              const fDot = data.fRd ? FRANZ : data.fRf ? AMBER : data.fR.length>0 ? `${FRANZ}44` : null;
              const tDot = data.tRd ? TGC   : data.tRf ? AMBER : data.tR.length>0 ? `${TGC}44`   : null;

              return (
                <div key={day} onClick={() => onDayClick(day, vY, vM)}
                  style={{ minHeight:m?60:78, borderRadius:m?6:8, padding:m?"4px":"6px 7px", background:isT?`${FRANZ}11`:CARD, border:`1px solid ${isT?FRANZ:BORDER}`, cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ fontSize:m?11:12, fontWeight:isT?700:500, color:isT?FRANZ:TEXT, marginBottom:m?3:4, fontFamily:"monospace" }}>{day}</div>
                  {(data.fR.length>0 || data.fS.length>0) && (
                    <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:m?3:4, padding:m?"2px 4px":"3px 5px", background:`${FRANZ}15`, borderRadius:m?4:6, border:`1px solid ${data.fRd?FRANZ:FRANZ+"44"}` }}>
                      {data.fR.length>0 && <div style={{ width:m?6:7, height:m?6:7, borderRadius:"50%", background:fDot, flexShrink:0 }}/>}
                      {!m && data.fR[0] && <div style={{ fontSize:9, color:data.fRd?FRANZ:MUTED, fontFamily:"monospace", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>F · {data.fR[0]?.title.slice(0,12)}</div>}
                      {m && data.fR.length>0 && <span style={{ fontSize:7, color:data.fRd?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700 }}>F</span>}
                      {data.fS.length>0 && <span style={{ fontSize:m?7:8, color:data.fSd>0?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700, marginLeft:"auto" }}>{data.fSd}/3</span>}
                    </div>
                  )}
                  {(data.tR.length>0 || data.tS.length>0) && (
                    <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:m?2:3, padding:m?"2px 4px":"3px 5px", background:`${TGC}15`, borderRadius:m?4:6, border:`1px solid ${data.tRd?TGC:TGC+"44"}` }}>
                      {data.tR.length>0 && <div style={{ width:m?6:7, height:m?6:7, borderRadius:"50%", background:tDot, flexShrink:0 }}/>}
                      {!m && data.tR[0] && <div style={{ fontSize:9, color:data.tRd?TGC:MUTED, fontFamily:"monospace", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>T · {data.tR[0]?.title.slice(0,12)}</div>}
                      {m && data.tR.length>0 && <span style={{ fontSize:7, color:data.tRd?TGC:MUTED, fontFamily:"monospace", fontWeight:700 }}>T</span>}
                      {data.tS.length>0 && <span style={{ fontSize:m?7:8, color:data.tSd>0?TGC:MUTED, fontFamily:"monospace", fontWeight:700, marginLeft:"auto" }}>{data.tSd}/3</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Legend */}
      <div style={{ display:"flex", gap:m?10:16, marginTop:14, flexWrap:"wrap", justifyContent:"center" }}>
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
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:m?"16px 16px 0 0":"16px", padding:m?"calc(env(safe-area-inset-top) + 24px) 12px 36px":"28px", width:m?"100%":640, maxWidth:"100%", maxHeight:m?"94vh":"90vh", overflowY:"auto" }}>
        {m && <div style={{ width:40, height:4, background:BORDER, borderRadius:2, margin:"0 auto 14px" }}/>}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:3 }}>{MONTH_NAMES[month].toUpperCase()} {year}</div>
            <div style={{ fontSize:m?17:22, fontWeight:700, color:TEXT }}>{new Date(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}T00:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:MUTED, fontSize:22, cursor:"pointer", padding:12, minWidth:48, minHeight:48, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8 }}>✕</button>
        </div>
        <div style={{ height:1, background:BORDER, marginBottom:18 }}/>

        {/* ═══ REELS SECTION ═══ */}
        {(fR.length > 0 || tR.length > 0) && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ height:2, flex:1, background:BORDER }}/>
              <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", letterSpacing:"3px", fontWeight:700 }}>REELS</div>
              <div style={{ height:2, flex:1, background:BORDER }}/>
            </div>
            {fR.map(r => <RR key={r.id} reel={r} brand="franz"/>)}
            {tR.map(r => <RR key={r.id} reel={r} brand="tgc"/>)}
            {fR.length===0 && <div style={{ padding:"12px", border:`1px dashed ${BORDER}`, borderRadius:10, marginBottom:10, fontSize:11, color:MUTED, fontFamily:"monospace", textAlign:"center" }}>No Franz reel planned</div>}
            {tR.length===0 && <div style={{ padding:"12px", border:`1px dashed ${BORDER}`, borderRadius:10, fontSize:11, color:MUTED, fontFamily:"monospace", textAlign:"center" }}>No TGC reel planned</div>}
          </div>
        )}

        {/* ═══ STORIES SECTION ═══ */}
        {(fS.length > 0 || tS.length > 0) && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ height:2, flex:1, background:BORDER }}/>
              <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", letterSpacing:"3px", fontWeight:700 }}>STORIES</div>
              <div style={{ height:2, flex:1, background:BORDER }}/>
            </div>

            {/* FRANZ Stories */}
            {fS.map(story => {
              const slots = [
                { key:"slot1", label:"Slot 1", value:story.slot1 || story.morning, status:story.slot1_status || story.morning_status },
                { key:"slot2", label:"Slot 2", value:story.slot2 || story.midday,  status:story.slot2_status || story.midday_status  },
                { key:"slot3", label:"Slot 3", value:story.slot3 || story.evening, status:story.slot3_status || story.evening_status },
                { key:"slot4", label:"Slot 4", value:story.slot4, status:story.slot4_status },
                { key:"slot5", label:"Slot 5", value:story.slot5, status:story.slot5_status },
                { key:"slot6", label:"Slot 6", value:story.slot6, status:story.slot6_status },
              ];
              const doneCount = slots.filter(s => s.status === "posted").length;
              return (
                <div key={story.id} style={{ background:doneCount===3?`${FRANZ}08`:CARD, border:`1px solid ${doneCount>0?FRANZ+"44":BORDER}`, borderLeft:`4px solid ${doneCount===3?FRANZ:doneCount>0?FRANZ+"88":BORDER}`, borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ fontSize:11, color:FRANZ, fontFamily:"monospace", fontWeight:700 }}>FRANZ STORIES</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ display:"flex", gap:3 }}>
                        {slots.map(s => <div key={s.key} style={{ width:7, height:7, borderRadius:"50%", background:s.status==="posted"?FRANZ:BORDER }}/>)}
                      </div>
                      <span style={{ fontSize:10, color:MUTED, fontFamily:"monospace", fontWeight:700 }}>{doneCount}/3</span>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                    {slots.map(slot => {
                      const done = slot.status==="posted";
                      return (
                        <div key={slot.key} style={{ background:done?`${FRANZ}0F`:SOFT, border:`1px solid ${done?FRANZ+"55":BORDER}`, borderRadius:8, padding:"8px 7px", minHeight:80 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                            <span style={{ fontSize:8, color:done?FRANZ:MUTED, fontFamily:"monospace", fontWeight:700 }}>{slot.label.toUpperCase()}</span>
                            <div onClick={() => onToggleStory && onToggleStory(story.id, slot.key, slot.status)}
                              style={{ width:18, height:18, borderRadius:"50%", background:done?FRANZ:"transparent", border:`1.5px solid ${done?FRANZ:BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", cursor:"pointer", flexShrink:0 }}>{done?"✓":""}</div>
                          </div>
                          <div style={{ fontSize:10, color:TEXT, lineHeight:1.4 }}>{slot.value || "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* TGC Stories */}
            {tS.map(story => {
              const slots = [
                { key:"slot1", label:"Slot 1", value:story.slot1 || story.morning, status:story.slot1_status || story.morning_status },
                { key:"slot2", label:"Slot 2", value:story.slot2 || story.midday,  status:story.slot2_status || story.midday_status  },
                { key:"slot3", label:"Slot 3", value:story.slot3 || story.evening, status:story.slot3_status || story.evening_status },
                { key:"slot4", label:"Slot 4", value:story.slot4, status:story.slot4_status },
                { key:"slot5", label:"Slot 5", value:story.slot5, status:story.slot5_status },
                { key:"slot6", label:"Slot 6", value:story.slot6, status:story.slot6_status },
              ];
              const doneCount = slots.filter(s => s.status === "posted").length;
              return (
                <div key={story.id} style={{ background:doneCount===3?`${TGC}08`:CARD, border:`1px solid ${doneCount>0?TGC+"44":BORDER}`, borderLeft:`4px solid ${doneCount===3?TGC:doneCount>0?TGC+"88":BORDER}`, borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ fontSize:11, color:TGC, fontFamily:"monospace", fontWeight:700 }}>TGC STORIES</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ display:"flex", gap:3 }}>
                        {slots.map(s => <div key={s.key} style={{ width:7, height:7, borderRadius:"50%", background:s.status==="posted"?TGC:BORDER }}/>)}
                      </div>
                      <span style={{ fontSize:10, color:MUTED, fontFamily:"monospace", fontWeight:700 }}>{doneCount}/3</span>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                    {slots.map(slot => {
                      const done = slot.status==="posted";
                      return (
                        <div key={slot.key} style={{ background:done?`${TGC}0F`:SOFT, border:`1px solid ${done?TGC+"55":BORDER}`, borderRadius:8, padding:"8px 7px", minHeight:80 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                            <span style={{ fontSize:8, color:done?TGC:MUTED, fontFamily:"monospace", fontWeight:700 }}>{slot.label.toUpperCase()}</span>
                            <div onClick={() => onToggleStory && onToggleStory(story.id, slot.key, slot.status)}
                              style={{ width:18, height:18, borderRadius:"50%", background:done?TGC:"transparent", border:`1.5px solid ${done?TGC:BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", cursor:"pointer", flexShrink:0 }}>{done?"✓":""}</div>
                          </div>
                          <div style={{ fontSize:10, color:TEXT, lineHeight:1.4 }}>{slot.value || "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fR.length===0&&tR.length===0&&fS.length===0&&tS.length===0&&<div style={{ textAlign:"center", padding:40, color:MUTED, fontFamily:"monospace" }}>No content for this day.</div>}

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}><Btn onClick={onClose} accent={MUTED}>CLOSE</Btn></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
function BriefingTab() {
  const m = useIsMobile();

  const Section = ({ title, color, children }) => (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`4px solid ${color}`, borderRadius:14, padding:m?"18px 16px":"24px 28px", marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize:11, color, fontFamily:"monospace", letterSpacing:"2px", fontWeight:700, marginBottom:12 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  );

  const P = ({ children, bold }) => (
    <p style={{ fontSize:14, color:TEXT, lineHeight:1.6, marginBottom:10, fontWeight: bold ? 600 : 400 }}>{children}</p>
  );

  const Bullet = ({ children }) => (
    <li style={{ fontSize:14, color:TEXT, lineHeight:1.7, marginBottom:6, paddingLeft:6 }}>{children}</li>
  );

  const Code = ({ children }) => (
    <span style={{ background:SOFT, padding:"2px 7px", borderRadius:4, fontFamily:"monospace", fontSize:12, color:TEXT }}>{children}</span>
  );

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>

      {/* Welcome Header */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:m?"20px 16px":"32px", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", letterSpacing:"3px", marginBottom:6 }}>VIDEOGRAPHER ONBOARDING</div>
        <div style={{ fontSize:m?22:30, fontWeight:700, color:TEXT, marginBottom:8 }}>Welcome to the Team</div>
        <p style={{ fontSize:14, color:MUTED, lineHeight:1.6, marginBottom:0 }}>
          This is your everything-you-need-to-know guide. Read it once, then come back whenever you need a refresher.
          The dashboard is your daily source of truth — what to film, when to film, and where it lives.
        </p>
      </div>

      {/* Brands */}
      <Section title="The Two Brands" color={FRANZ}>
        <div style={{ display:"grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap:12 }}>
          <div style={{ padding:"14px 16px", background:`${FRANZ}0A`, border:`1px solid ${FRANZ}33`, borderRadius:10 }}>
            <div style={{ fontSize:11, color:FRANZ, fontFamily:"monospace", fontWeight:700, letterSpacing:"2px", marginBottom:6 }}>FRANZ</div>
            <P><b>Cinnamon roll &amp; specialty coffee/matcha shop.</b></P>
            <P><b>USP:</b> free oat milk (rare in Bali).</P>
            <P><b>Vibe:</b> girly, aesthetic, premium, feminine. Soft pinks, creams, light wood.</P>
            <P><b>Hero products:</b> 6 iced matchas, 6 Fine Selection iced coffees, cinnamon rolls.</P>
          </div>
          <div style={{ padding:"14px 16px", background:`${TGC}0A`, border:`1px solid ${TGC}33`, borderRadius:10 }}>
            <div style={{ fontSize:11, color:TGC, fontFamily:"monospace", fontWeight:700, letterSpacing:"2px", marginBottom:6 }}>THE GREEN COLLECTIVE</div>
            <P><b>Premium health takeaway store.</b></P>
            <P><b>USP:</b> clean, transparent, California-grade wellness.</P>
            <P><b>Vibe:</b> clean, organic, premium. Raw concrete, kraft, glass, palm leaves.</P>
            <P><b>Hero products:</b> 9 infused waters, 8 whey protein bars, juices, electrolytes.</P>
          </div>
        </div>
      </Section>

      {/* Target Audience */}
      <Section title="Target Audience" color={BUILD}>
        <P>Age 20–35. Expats, digital nomads, surfer-influencer-adjacent crowd in Pererenan and Canggu.</P>
        <P>International — mostly Australia, USA, Europe, Russia.</P>
        <P>They live on TikTok and Reels, scroll muted, decide in 1.5 seconds.</P>
        <P bold>What they want:</P>
        <ul style={{ marginTop:0, marginBottom:12, paddingLeft:24 }}>
          <Bullet>Anti-aspirational cool — real ingredients, lived-in spaces, confident understatement</Bullet>
          <Bullet>Aesthetic close-ups, hands-only POV, ASMR product moments</Bullet>
          <Bullet>Stories where they can see who's behind the brand, not just polished marketing</Bullet>
        </ul>
        <P bold>What they scroll past:</P>
        <ul style={{ marginTop:0, paddingLeft:24 }}>
          <Bullet>Corporate language, forced smiles, posed customer shots</Bullet>
          <Bullet>Generic Bali tourism cues (beach sunsets, scooters in traffic)</Bullet>
          <Bullet>Over-saturated green grading, tropical filters</Bullet>
        </ul>
      </Section>

      {/* How We Shoot */}
      <Section title="How We Shoot — Core Rules" color={FRANZ}>
        <ul style={{ marginTop:0, paddingLeft:24 }}>
          <Bullet><b>You stay behind the camera.</b> No selfie content. No talking-head videos. Story is told through hands, products, spaces.</Bullet>
          <Bullet><b>POV and ASMR are the spine.</b> Phone-in-hand POV walking shots. Macro close-ups of pours, drips, glaze, condensation. ASMR mic on for every product moment.</Bullet>
          <Bullet><b>Hands only.</b> When people appear, only hands are visible. Faces only in planned Day-In-The-Life episodes.</Bullet>
          <Bullet><b>Vertical 9:16 or 4:5.</b> Shot on iPhone 15 Pro or newer. Always vertical.</Bullet>
          <Bullet><b>Light = morning + golden hour.</b> Best windows: 7–9am and 5–7pm Bali time. Avoid harsh midday.</Bullet>
          <Bullet><b>Hooks in 1.5 seconds.</b> Every reel must grab in the first beat — strong visual or text overlay.</Bullet>
          <Bullet><b>Trust the visuals.</b> Captions are short, lowercase, often a single line. Never explain what's already shown.</Bullet>
        </ul>
      </Section>

      {/* Posting Frequency */}
      <Section title="Posting Frequency" color={TGC}>
        <P bold>Daily output (per brand):</P>
        <ul style={{ marginTop:0, marginBottom:12, paddingLeft:24 }}>
          <Bullet><b>1 Reel per day</b> — planned in advance via this dashboard, with hook + shot list + caption + audio direction</Bullet>
          <Bullet><b>6 Stories per day</b> — looser, batch-shot from daily footage, follow the slot blueprint</Bullet>
        </ul>
        <P bold>Total monthly: 62 Reels (31 Franz + 31 TGC) + 372 Stories</P>
        <P bold>Best posting windows:</P>
        <ul style={{ marginTop:0, paddingLeft:24 }}>
          <Bullet><b>11:00–13:00 Bali time</b> — peak afternoon for AU/EU lunch overlap</Bullet>
          <Bullet><b>17:00–18:00 Bali time</b> — golden hour drop, peak USA evening</Bullet>
        </ul>
      </Section>

      {/* Daily Rhythm */}
      <Section title="Daily Rhythm — Three Shoot Windows" color={BUILD}>
        <div style={{ marginBottom:12, padding:"12px 14px", background:SOFT, borderRadius:8 }}>
          <div style={{ fontSize:12, color:TEXT, fontWeight:700, marginBottom:4 }}>🌅 Morning Batch — 7–9am</div>
          <P>Opening shots, bakery prep, fresh roll trays, espresso machine warm-up, morning light through rice field windows. Cover stories slot 1–2 and any morning-light reel.</P>
        </div>
        <div style={{ marginBottom:12, padding:"12px 14px", background:SOFT, borderRadius:8 }}>
          <div style={{ fontSize:12, color:TEXT, fontWeight:700, marginBottom:4 }}>☀️ Midday Batch — 11:30am–12:30pm</div>
          <P>Drink hero shots, cinnamon roll pulls, fridge restocks, customer hand moments. Cover the day's main reel and stories slot 3–4.</P>
        </div>
        <div style={{ padding:"12px 14px", background:SOFT, borderRadius:8 }}>
          <div style={{ fontSize:12, color:TEXT, fontWeight:700, marginBottom:4 }}>🌇 Golden Hour Batch — 5–7pm</div>
          <P>Atmosphere, rice fields, bench oasis, customer back-of-head moments, sunset reels. Cover stories slot 5–6 and any golden-hour reel.</P>
        </div>
      </Section>

      {/* File Naming Convention */}
      <Section title="File Naming Convention" color={AMBER}>
        <P>Every file follows this format:</P>
        <div style={{ padding:"14px 16px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:8, marginBottom:12 }}>
          <div style={{ fontSize:13, fontFamily:"monospace", color:TEXT, fontWeight:700 }}>YYYY-MM-DD_BRAND_TYPE_Title-With-Dashes</div>
        </div>
        <P bold>Examples:</P>
        <ul style={{ marginTop:0, marginBottom:12, paddingLeft:24, listStyleType:"none" }}>
          <Bullet><Code>2026-05-04_FRANZ_REEL_Mango-Matcha-Appreciation</Code></Bullet>
          <Bullet><Code>2026-05-08_FRANZ_STREET_Bauarbeiter-Cinnamon-Rolls</Code></Bullet>
          <Bullet><Code>2026-05-14_FRANZ_DITL_The-Baker</Code></Bullet>
          <Bullet><Code>2026-05-23_TGC_SERIES_The-NMAX-Build-Reveal</Code></Bullet>
        </ul>
        <P bold>Type codes:</P>
        <ul style={{ marginTop:0, marginBottom:12, paddingLeft:24 }}>
          <Bullet><Code>REEL</Code> — Standalone Reels</Bullet>
          <Bullet><Code>SERIES</Code> — Series Episodes (Perfect Roll, NMAX Build, etc.)</Bullet>
          <Bullet><Code>STREET</Code> — Street Reactions (Tukang, Surfer, Pilates Girls, etc.)</Bullet>
          <Bullet><Code>DITL</Code> — Day In The Life Episodes</Bullet>
        </ul>
        <div style={{ padding:"12px 14px", background:`${AMBER}15`, border:`1px solid ${AMBER}33`, borderRadius:8, marginTop:8 }}>
          <P bold>💡 Pro Tip</P>
          <P>Every reel in the dashboard already has its file name pre-generated. Open the reel detail and tap the file name to copy it. Then rename your file before uploading to Drive.</P>
        </div>
      </Section>

      {/* Drive Folder Structure */}
      <Section title="Google Drive Folder Structure" color={TGC}>
        <P>All videos go into Google Drive. Folder structure is set up by the team.</P>
        <div style={{ padding:"16px 18px", background:SOFT, border:`1px solid ${BORDER}`, borderRadius:10, fontFamily:"monospace", fontSize:13, color:TEXT, lineHeight:1.7 }}>
          📁 Content Archive<br/>
          &nbsp;&nbsp;└── 📁 2026-05-May<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 Franz<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── 📁 RAW<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── 📁 FINAL<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📁 TGC<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 RAW<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📁 FINAL
        </div>
        <ul style={{ marginTop:14, paddingLeft:24 }}>
          <Bullet><b>RAW folder:</b> All original/unedited footage. Backup material for later compilations.</Bullet>
          <Bullet><b>FINAL folder:</b> The final exported reel ready to post. This is what goes live on Instagram/TikTok.</Bullet>
        </ul>
      </Section>

      {/* Workflow */}
      <Section title="Workflow — From Idea to Posted" color={FRANZ}>
        <ol style={{ marginTop:0, paddingLeft:24, fontSize:14, color:TEXT, lineHeight:1.7 }}>
          <li style={{ marginBottom:8 }}><b>Open the Dashboard daily</b> — check what's planned for today</li>
          <li style={{ marginBottom:8 }}><b>Read the reel brief</b> — hook, what to film, vibe, audio direction, text overlays</li>
          <li style={{ marginBottom:8 }}><b>Copy the file name</b> from the reel detail (tap to copy)</li>
          <li style={{ marginBottom:8 }}><b>Shoot the footage</b> following the brief — bias toward shooting more than needed</li>
          <li style={{ marginBottom:8 }}><b>Upload to RAW folder</b> in the right brand folder</li>
          <li style={{ marginBottom:8 }}><b>Edit the reel</b> — add text overlays, audio, color grading</li>
          <li style={{ marginBottom:8 }}><b>Export and rename</b> with the dashboard file name</li>
          <li style={{ marginBottom:8 }}><b>Upload final to FINAL folder</b> in the right brand folder</li>
          <li style={{ marginBottom:8 }}><b>Copy the Drive link</b> of the final video</li>
          <li style={{ marginBottom:8 }}><b>Paste link in Dashboard</b> — open the reel detail, paste in "Drive Link" field. Status auto-updates to "Filmed"</li>
          <li><b>After posting on Instagram/TikTok</b> — set status to "Posted" in the dashboard</li>
        </ol>
      </Section>

      {/* Series Overview */}
      <Section title="Active Series" color={BUILD}>
        <P>Series episodes post when real progress happens — not on fixed dates. Between episodes, standalone reels fill the schedule.</P>
        <ul style={{ marginTop:0, paddingLeft:24 }}>
          <Bullet><b>The Perfect Roll</b> (Franz, 4 parts) — cinnamon roll story arc</Bullet>
          <Bullet><b>What's In Your Drink</b> (Both, 4 parts) — origin/transparency for matcha, oat milk, coffee, infused water</Bullet>
          <Bullet><b>DITL · The Baker</b> (Franz, 1) — day in the life of the baker</Bullet>
          <Bullet><b>DITL · Cory the Barista</b> (Franz, 1) — day in the life of the barista</Bullet>
          <Bullet><b>DITL · Faiz</b> (TGC, 1) — day in the life of operations manager</Bullet>
          <Bullet><b>The TGC Sign</b> (TGC, 2) — sign build retrospective + reveal</Bullet>
          <Bullet><b>The NMAX Build</b> (TGC, 3) — delivery scooter custom build</Bullet>
          <Bullet><b>Building TGC From Zero</b> (TGC, 3) — pre-launch BTS, launch day, one week in</Bullet>
          <Bullet><b>Find The Billboard</b> (TGC, 2) — quest to install billboard</Bullet>
          <Bullet><b>Photo Booth Hunt</b> (TGC, 1+) — photo booth restoration</Bullet>
          <Bullet><b>Street Reactions</b> (Both, 5+) — give products to Tukang, Surfer, Banjar Neighbours, Pilates Girls, Gym Crowd. Film reactions.</Bullet>
        </ul>
      </Section>

      {/* What to Film vs Avoid */}
      <Section title="Film vs Don't Film" color={AMBER}>
        <div style={{ display:"grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap:12 }}>
          <div style={{ padding:"14px 16px", background:`${TGC}0A`, border:`1px solid ${TGC}33`, borderRadius:10 }}>
            <div style={{ fontSize:13, color:TGC, fontWeight:700, marginBottom:8 }}>✓ FILM</div>
            <ul style={{ margin:0, paddingLeft:20, fontSize:13, color:TEXT, lineHeight:1.7 }}>
              <li>Drink pours, layered builds, condensation, ice cracks</li>
              <li>Cinnamon roll pulls, glaze drips, bake textures</li>
              <li>Fridge restocks, ingredient flat lays</li>
              <li>Hands placing, pouring, opening, closing</li>
              <li>Rice fields through windows, palm leaf shadows</li>
              <li>POV walks at golden hour</li>
              <li>Bench oasis at sunset</li>
              <li>NMAX scooter, key turns</li>
              <li>Production kitchen process</li>
            </ul>
          </div>
          <div style={{ padding:"14px 16px", background:`${FRANZ}0A`, border:`1px solid ${FRANZ}33`, borderRadius:10 }}>
            <div style={{ fontSize:13, color:FRANZ, fontWeight:700, marginBottom:8 }}>✗ AVOID</div>
            <ul style={{ margin:0, paddingLeft:20, fontSize:13, color:TEXT, lineHeight:1.7 }}>
              <li>Full faces (except planned DITL)</li>
              <li>Selfie-style talking videos</li>
              <li>Forced smiles, posed shots</li>
              <li>Generic Bali tourism cues</li>
              <li>Over-saturated tropical filters</li>
              <li>Loud transitions, gimmicky effects</li>
              <li>Long-form explanation videos</li>
              <li>Hashtag-spam content</li>
              <li>Anything that looks like a corporate ad</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Voice & Tone */}
      <Section title="Voice & Tone Cheat-Sheet" color={FRANZ}>
        <P>Lowercase. One line. Trust the visual. Confident understatement.</P>
        <div style={{ display:"grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap:12, marginTop:8 }}>
          <div style={{ padding:"12px 14px", background:`${TGC}0A`, border:`1px solid ${TGC}33`, borderRadius:10 }}>
            <div style={{ fontSize:11, color:TGC, fontWeight:700, marginBottom:6, fontFamily:"monospace", letterSpacing:"1px" }}>DO</div>
            <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:TEXT, lineHeight:1.6 }}>
              <li>"oat milk is on us, always"</li>
              <li>"less sweet. more grown-up."</li>
              <li>"she opens monday. quietly."</li>
              <li>"infused water but the kind your skin notices"</li>
            </ul>
          </div>
          <div style={{ padding:"12px 14px", background:`${FRANZ}0A`, border:`1px solid ${FRANZ}33`, borderRadius:10 }}>
            <div style={{ fontSize:11, color:FRANZ, fontWeight:700, marginBottom:6, fontFamily:"monospace", letterSpacing:"1px" }}>DON'T</div>
            <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:TEXT, lineHeight:1.6 }}>
              <li>"We're proud to offer complimentary plant-based milk alternatives"</li>
              <li>"A balanced, sophisticated flavour profile"</li>
              <li>"Grand opening this Monday — visit us!"</li>
              <li>"Hydration with benefits!"</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Locations */}
      <Section title="Best Filming Locations" color={TGC}>
        <ul style={{ marginTop:0, paddingLeft:24 }}>
          <Bullet><b>Floor-to-ceiling windows</b> — rice fields visible, perfect for morning light reels</Bullet>
          <Bullet><b>Green Oasis bench</b> outside, surrounded by palm trees — golden hour gold</Bullet>
          <Bullet><b>Production Kitchen</b> — for BTS, juice production, baking, bottling</Bullet>
          <Bullet><b>Front entrance</b> with palm shadows — for door/open sign reels</Bullet>
          <Bullet><b>Rice fields front and back of stores</b> — atmospheric establishing shots</Bullet>
        </ul>
      </Section>

      {/* Final Note */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:m?"18px 16px":"24px 28px", marginBottom:24, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:11, color:MUTED, fontFamily:"monospace", letterSpacing:"2px", marginBottom:8 }}>FIRST WEEK NOTE</div>
        <P>First week is observation and shooting alongside Cory. By week two you'll be running shoots solo. Don't worry about getting everything right immediately. Bias toward shooting more than we need. The dashboard is the source of truth — when in doubt, check it.</P>
        <P bold>We meet weekly to review what worked and adjust. Welcome to the team.</P>
      </div>

    </div>
  );
}

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
  const [newStory,     setNewStory]     = useState({ brand:"franz", date:"", slot1:"", slot2:"", slot3:"", slot4:"", slot5:"", slot6:"" });
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
  // ── Set status directly to a specific value (auto-stamps posted_at) ──
  const handleSetStatus = async (id, newStatus) => {
    const oldStatus = reels.find(r => r.id === id)?.status;
    if (oldStatus === newStatus) return;
    const postedAt = newStatus === "posted" ? new Date().toISOString() : null;
    // Optimistic UI update
    setReels(prevList => prevList.map(r => r.id===id ? {...r, status:newStatus, posted_at:postedAt || r.posted_at} : r));
    try {
      await updateReelStatus(id, newStatus);
      if (newStatus === "posted" && postedAt) {
        await updateReelPostedAt(id, postedAt);
      }
    } catch (e) {
      // Revert on error
      setReels(prevList => prevList.map(r => r.id===id ? {...r, status:oldStatus} : r));
      setError("Status update failed: " + e.message);
    }
  };

  // ── Update Drive Link (auto-sets status to filmed if planned) ──
  const handleUpdateDriveLink = async (id, link) => {
    const reel = reels.find(r => r.id === id);
    const wasJustPlanned = reel?.status === "planned" && link;
    setReels(prevList => prevList.map(r => r.id===id ? {...r, drive_link:link, status: wasJustPlanned ? "filmed" : r.status} : r));
    try {
      await updateReelDriveLink(id, link);
      if (wasJustPlanned) {
        await updateReelStatus(id, "filmed");
      }
    } catch (e) {
      setReels(prevList => prevList.map(r => r.id===id ? {...r, drive_link:reel?.drive_link} : r));
      setError("Drive link update failed: " + e.message);
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
      setNewStory({ brand:"franz", date:"", slot1:"", slot2:"", slot3:"", slot4:"", slot5:"", slot6:"" });
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
    ["calendar", "🗓", "Calendar"],
    ["reels",    "🎬", "Reels"],
    ["stories",  "📸", "Stories"],
    ["series", "🎞", "Series"],
    ["briefing", "📖", "Briefing"],
  ];

  return (
    <div style={{ minHeight:"100dvh", background:BG, fontFamily:"'Georgia',serif", color:TEXT, paddingBottom:m?72:0 }}>

      {/* ── Modals ── */}
      {detailReel && (
        <ReelDetail 
          reel={reels.find(r => r.id === detailReel.reel.id) || detailReel.reel} 
          brand={detailReel.brand} series={series}
          onClose={()=>setDetailReel(null)}
          onToggleStatus={handleToggleStatus}
          onSetStatus={handleSetStatus}
          onUpdateDriveLink={handleUpdateDriveLink}
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
            <Input value={newStory.slot1} onChange={v=>setNewStory(p=>({...p,slot1:v}))} placeholder="Story slot 1"/>
            <Input value={newStory.slot2} onChange={v=>setNewStory(p=>({...p,slot2:v}))} placeholder="Story slot 2"/>
            <Input value={newStory.slot3} onChange={v=>setNewStory(p=>({...p,slot3:v}))} placeholder="Story slot 3"/>
            <Input value={newStory.slot4} onChange={v=>setNewStory(p=>({...p,slot4:v}))} placeholder="Story slot 4"/>
            <Input value={newStory.slot5} onChange={v=>setNewStory(p=>({...p,slot5:v}))} placeholder="Story slot 5"/>
            <Input value={newStory.slot6} onChange={v=>setNewStory(p=>({...p,slot6:v}))} placeholder="Story slot 6"/>
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
                onEditStorySlot={(id, slot, value)=>{ setEditSlot({id,slot}); setEditVal(value); }}
                onToggleStorySlot={handleToggleStory}
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
                    const slots=[
                      {key:"slot1",label:"Slot 1",value:story.slot1||story.morning},
                      {key:"slot2",label:"Slot 2",value:story.slot2||story.midday},
                      {key:"slot3",label:"Slot 3",value:story.slot3||story.evening},
                      {key:"slot4",label:"Slot 4",value:story.slot4},
                      {key:"slot5",label:"Slot 5",value:story.slot5},
                      {key:"slot6",label:"Slot 6",value:story.slot6}];
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
                            <div style={{ fontSize:10, color:MUTED, fontFamily:"monospace", marginTop:2 }}>{doneCount}/6 posted</div>
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
            {tab==="briefing" && (
              <BriefingTab/>
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