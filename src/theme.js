// ══════════════════════════════════════════════════════════════
// theme.js — shared design system.
// Tokens are aligned with the Society dashboard (dashboard.fr-anz.com)
// so both tools look like one product: same paper, ink, brand colors,
// DM Sans + IBM Plex Mono, same card/label/pill language.
// ══════════════════════════════════════════════════════════════

// ── Brand colors (Society tokens) ─────────────────────────────
export const FRANZ      = "#BA7B7E";
export const FRANZ_SOFT = "#F5E7E5";
export const TGC        = "#4F6B4A";
export const TGC_SOFT   = "#E7EDE1";
export const BUILD      = "#4A6FA5";

// ── Surfaces / text ───────────────────────────────────────────
export const BG     = "#FAF6EF";   // paper
export const CARD   = "#FFFFFF";
export const BORDER = "#E7DECF";   // line
export const TEXT   = "#241C15";   // ink
export const MUTED  = "#8A7E70";
export const SOFT   = "#F3EDE3";

// ── Signals ───────────────────────────────────────────────────
export const GREEN  = "#1FA855";   // wa
export const GREEN_SOFT = "#E4F5EB";
export const AMBER  = "#C9862B";
export const AMBER_SOFT = "#F7ECDA";
export const RED    = "#B4453F";

// ── Fonts ─────────────────────────────────────────────────────
export const F_BODY    = "'DM Sans', ui-sans-serif, system-ui, sans-serif";
export const F_DISPLAY = "'DM Sans', ui-sans-serif, system-ui, sans-serif";
export const F_MONO    = "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace";

// Section label — same spec as the Society dashboard's <Label>.
export const LBL = {
  fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.12em",
  textTransform: "uppercase", color: MUTED, fontWeight: 600,
};

// ── Brands ────────────────────────────────────────────────────
export const bc        = (b) => (b === "franz" ? FRANZ : TGC);
export const brandSoft = (b) => (b === "franz" ? FRANZ_SOFT : TGC_SOFT);
export const brandName = (b) => (b === "franz" ? "fr-anz" : b === "tgc" ? "TGC" : "all brands");

// ── Creators / assignees ──────────────────────────────────────
export const ASSIGNEE_COLORS = { ando: "#8A6A4B", yugo: "#5A6B7D" };
export const aColor = (name) => ASSIGNEE_COLORS[(name || "").trim().toLowerCase()] || MUTED;

// ── Status ────────────────────────────────────────────────────
export const STATUS_FLOW  = ["planned", "filmed", "posted"];
export const STATUS_LABEL = { planned: "Planned", filmed: "Filmed", posted: "Posted" };
export const STATUS_COLOR = { planned: MUTED, filmed: AMBER, posted: GREEN };
export const STATUS_BG    = { planned: "transparent", filmed: AMBER_SOFT, posted: GREEN_SOFT };

// ── Dates ─────────────────────────────────────────────────────
export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const formatDate = (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

// ── Social accounts (fill in the profile URLs once known) ─────
export const SOCIALS = { instagram: "", tiktok: "" };

// ── Atoms (mirror the Society dashboard's Card / Pill / BrandDot) ──
export function Chip({ text, color = MUTED, filled = false, size = 11.5 }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 99,
      background: filled ? color : "transparent",
      border: `1px solid ${filled ? color : color + "3D"}`,
      color: filled ? "#fff" : color,
      fontSize: size, fontWeight: 600, fontFamily: F_BODY, lineHeight: 1.45, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

export function BrandDot({ b, size = 9 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 99, background: bc(b), flexShrink: 0 }} />;
}

export function Stat({ label, value, sub, color = TEXT, m }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: m ? "14px 16px" : 20, minWidth: 0 }}>
      <div style={{ ...LBL, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: m ? 22 : 26, fontWeight: 700, color, lineHeight: 1, fontFamily: F_BODY }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export const fmtNum = (n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};

// ── Hashtag suggestions ───────────────────────────────────────
// Base set for fr-anz (cinnamon rolls, specialty coffee & matcha in
// Pererenan, Bali) plus pillar-specific additions. Copyable in the reel view.
const HT_BASE = ["#franz", "#cinnamonroll", "#pererenan", "#canggu", "#bali", "#balicafe", "#balifood"];
const HT_PILLAR = {
  process:      ["#behindthescenes", "#baking", "#asmr", "#howitsmade"],
  bts:          ["#behindthescenes", "#dayinthelife", "#smallbusiness"],
  usp:          ["#specialtycoffee", "#matcha", "#matchalatte", "#coffeelover"],
  photobooth:   ["#photobooth", "#photostrip", "#balithingstodo"],
  storytelling: ["#buildinpublic", "#smallbusinessstory", "#foundersjourney"],
  episode:      ["#buildinpublic", "#openingacafe", "#entrepreneur"],
  filler:       ["#trending", "#foryou", "#baliviral"],
};
const HT_TGC = ["#thegreencollective", "#healthyfood", "#grabandgo", "#balihealthy", "#cleaneating"];

export function hashtagsFor(reel) {
  const brandTags = reel?.brand === "tgc" ? HT_TGC : HT_BASE;
  const pillar = (reel?.pillar || "").trim().toLowerCase();
  const extra = HT_PILLAR[pillar] || [];
  const text = `${reel?.title || ""} ${reel?.description || ""} ${reel?.format || ""}`.toLowerCase();
  const topical = [];
  if (/matcha/.test(text)) topical.push("#matcha", "#matchalatte");
  if (/coffee|espresso|latte|brew/.test(text)) topical.push("#specialtycoffee", "#coffeetime");
  if (/roll|dough|bake|cinnamon/.test(text)) topical.push("#cinnamonrolls", "#freshlybaked");
  return [...new Set([...brandTags, ...extra, ...topical])].slice(0, 14);
}
