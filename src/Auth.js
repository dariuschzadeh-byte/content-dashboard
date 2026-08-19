// ══════════════════════════════════════════════════════════════
// Auth.js — Login / Signup gate
// Shown when nobody is logged in. Email + password via Supabase Auth.
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { signIn, signUp } from "./supabaseClient";

const FRANZ = "#C4527A";
const BG = "#F5F0E8";
const CARD = "#FFFFFF";
const BORDER = "#E0D8CC";
const TEXT = "#1A1A1A";
const MUTED = "#888880";

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
        // onAuthChange in App re-renders into the dashboard automatically.
      } else {
        const res = await signUp(email.trim(), password, name.trim());
        if (!res.session) {
          setInfo("Account created. If email confirmation is on, check your inbox, then log in.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${BORDER}`,
    fontSize: 14, marginBottom: 12, boxSizing: "border-box", background: "#FCFAF6", color: TEXT,
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <div style={{ width: 380, maxWidth: "100%", background: CARD, borderTop: `4px solid ${FRANZ}`, borderRadius: 16, padding: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Content Dashboard</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 24, fontFamily: "monospace", letterSpacing: "1px" }}>
          FRANZ · THE GREEN COLLECTIVE
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <input style={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input style={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />

          {error && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {info && <div style={{ color: "#2D7D46", fontSize: 12, marginBottom: 12 }}>{info}</div>}

          <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: TEXT, color: BG, fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: MUTED }}>
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }} style={{ color: FRANZ, cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </div>
      </div>
    </div>
  );
}
