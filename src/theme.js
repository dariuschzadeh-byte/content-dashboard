// ══════════════════════════════════════════════════════════════
// theme.js — shared design system (colors, fonts, small atoms)
// v18 "Clarity" redesign: DM Sans body, Fraunces display accents.
// ══════════════════════════════════════════════════════════════

// ── Brand colors ──────────────────────────────────────────────
export const FRANZ  = "#C4527A";
export const TGC    = "#2D7D46";
export const BUILD  = "#4A6FA5";

// ── Surfaces / text ───────────────────────────────────────────
export const BG     = "#F5F0E8";
export const CARD   = "#FFFFFF";
export const BORDER = "#E0D8CC";
export const TEXT   = "#1A1A1A";
export const MUTED  = "#8A8578";
export const SOFT   = "#EDE8DF";

// ── Signals ───────────────────────────────────────────────────
export const GREEN  = "#2D7D46";
export const AMBER  = "#D97706";
export const RED    = "#DC2626";

// ── Fonts ─────────────────────────────────────────────────────
export const F_BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
export const F_DISPLAY = "'Fraunces', Georgia, serif";
export const F_MONO    = "'DM Mono', 'SF Mono', Menlo, monospace";

// Small uppercase section label (readable, replaces the tiny mono labels).
export const LBL = { fontSize: 11, color: MUTED, letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: F_BODY, fontWeight: 700 };

// ── Creators / assignees ──────────────────────────────────────
export const ASSIGNEE_COLORS = { ando: "#B4682B", yugo: "#3E6B9E" };
export const aColor = (name) => ASSIGNEE_COLORS[(name || "").trim().toLowerCase()] || "#8A8578";

// ── Brand helper ──────────────────────────────────────────────
export const bc = (b) => (b === "franz" ? FRANZ : TGC);

// ── Status ────────────────────────────────────────────────────
export const STATUS_FLOW  = ["planned", "filmed", "posted"];
export const STATUS_LABEL = { planned: "Planned", filmed: "Filmed", posted: "Posted" };
export const STATUS_COLOR = { planned: MUTED, filmed: AMBER, posted: GREEN };
export const STATUS_BG    = { planned: "transparent", filmed: "#FEF3C7", posted: "#F0F7F3" };

// ── Dates ─────────────────────────────────────────────────────
export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const formatDate = (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

// ── Social accounts (fill in the profile URLs once known) ─────
export const SOCIALS = {
  instagram: "",   // e.g. "https://www.instagram.com/..."
  tiktok:    "",   // e.g. "https://www.tiktok.com/@..."
};

// ── Atoms ─────────────────────────────────────────────────────
export function Chip({ text, color = "#8A8578", filled = false, size = 11 }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20,
      background: filled ? color : `${color}14`,
      border: `1px solid ${filled ? color : color + "44"}`,
      color: filled ? "#fff" : color,
      fontSize: size, fontWeight: 600, fontFamily: F_BODY, lineHeight: 1.4, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

// KPI stat card used on Overview + Analytics.
export function Stat({ label, value, sub, color = TEXT, m }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: m ? "12px 14px" : "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0 }}>
      <div style={{ ...LBL, fontSize: 10, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: m ? 22 : 28, fontWeight: 700, color, lineHeight: 1, fontFamily: F_BODY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export const fmtNum = (n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};
