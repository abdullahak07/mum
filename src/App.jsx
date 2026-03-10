import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadConfig, loadRegistrations, loadStrikes, saveConfig, saveRegistrations, saveStrikes,
  onConfigChange, onRegistrationsChange, onStrikesChange, factoryReset,
} from "./firebase";

/* ═══ LINKS ═══ */
import logo from "./logo.png";
const LOGO = logo;
const WHATSAPP = "https://chat.whatsapp.com/LnsJ6ZJH5AoFCuJV1hbcE8";
const FB = "https://www.facebook.com/MurdochUniMSA/";
const YT = "https://youtube.com/@murdoch-2025";
const IG = "https://www.instagram.com/murdochmsa/";
const EMAIL = "mumsa.pr@gmail.com";

/* ═══ Responsive ═══ */
function useScreen() {
  const [w, s] = useState(window.innerWidth);
  useEffect(() => { const h = () => s(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return { sm: w >= 640, md: w >= 900, lg: w >= 1100, w };
}

/* ═══ Email — via Vercel serverless + Brevo (300/day free) ═══ */
async function sendQREmail(cfg, reg) {
  if (!reg.email) return false;
  try {
    const r = await fetch("/api/send-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "qr", to_email: reg.email, to_name: reg.name, qr_code: reg.id, iftar_date: reg.iftarDate })
    });
    return r.ok;
  } catch (e) { console.error("Email:", e); return false; }
}

async function sendStrikeEmail(cfg, email, name, strikeCount, blockedUntil) {
  if (!email) return false;
  try {
    const r = await fetch("/api/send-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "strike", to_email: email, to_name: name, strike_count: strikeCount, blocked_until: blockedUntil || null })
    });
    return r.ok;
  } catch (e) { console.error("Strike email:", e); return false; }
}

function QRCode({ value, size = 200 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(value)}&size=${size}x${size}&margin=8&format=svg`;
  return (
    <div style={{ width: size, height: size, background: "#fff", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", colorScheme: "light" }}>
      <img src={url} alt="QR Code" width={size} height={size} style={{ display: "block", filter: "none", mixBlendMode: "normal" }} />
    </div>
  );
}

/* ═══ Ramadan Schedule: Feb 20 – Mar 20, 2026 (29 days) — Muslim Pro Perth ═══ */
function genRamadanSchedule() {
  // Sehri ~4:31 AM increasing +1min/day, Iftar ~7:05 PM decreasing -1min/day
  const data = [
    ["Feb 20","4:31 AM","7:05 PM"],["Feb 21","4:32 AM","7:04 PM"],["Feb 22","4:33 AM","7:03 PM"],
    ["Feb 23","4:34 AM","7:02 PM"],["Feb 24","4:35 AM","7:01 PM"],["Feb 25","4:36 AM","7:00 PM"],
    ["Feb 26","4:37 AM","6:59 PM"],["Feb 27","4:38 AM","6:58 PM"],["Feb 28","4:39 AM","6:57 PM"],
    ["Mar 1","4:40 AM","6:56 PM"],["Mar 2","4:41 AM","6:55 PM"],["Mar 3","4:42 AM","6:54 PM"],
    ["Mar 4","4:43 AM","6:53 PM"],["Mar 5","4:44 AM","6:52 PM"],["Mar 6","4:45 AM","6:51 PM"],
    ["Mar 7","4:46 AM","6:50 PM"],["Mar 8","4:47 AM","6:49 PM"],["Mar 9","4:48 AM","6:48 PM"],
    ["Mar 10","4:49 AM","6:47 PM"],["Mar 11","4:50 AM","6:46 PM"],["Mar 12","4:51 AM","6:45 PM"],
    ["Mar 13","4:52 AM","6:44 PM"],["Mar 14","4:53 AM","6:43 PM"],["Mar 15","4:54 AM","6:42 PM"],
    ["Mar 16","4:55 AM","6:41 PM"],["Mar 17","4:56 AM","6:40 PM"],["Mar 18","4:57 AM","6:39 PM"],
    ["Mar 19","4:58 AM","6:38 PM"],["Mar 20","4:59 AM","6:37 PM"],
  ];
  return data.map((d, i) => ({ day: i + 1, date: `${d[0]}, 2026`, sehri: d[1], iftar: d[2] }));
}

/* ═══ Default Config ═══ */
const DEF = {
  prayerTimes: { Fajr: "4:29 AM", Sunrise: "5:49 AM", Dhuhr: "12:31 PM", Asr: "4:10 PM", Maghrib: "7:06 PM", Isha: "8:26 PM" },
  prayerSource: "Auto — AlAdhan API (Perth)",
  prayerMethod: 3, // 3=MWL matches Muslim Pro Australia. Change in admin if needed.
  jumaTime: "1:30 PM",
  jumaLocation: "Murdoch University Prayer Room — EH1.009",
  jamatOffset: 10,
  taraweeh: { time: "8:46 PM", rakats: "20 Rakats + Witr", location: "Murdoch University Prayer Room", note: "Taraweeh prayers commence 10 minutes after Isha Jama'at every night during Ramadan." },
  regStartHour: 10, regEndHour: 14, regForceOpen: false, regForceClosed: false,
  announcements: [
    { id: "a1", title: "Ramadan Mubarak! 🌙", text: "May this blessed month bring peace, mercy, and blessings to everyone. Ramadan: Feb 20 – Mar 20, 2026.", color: "gold" },
    { id: "a2", title: "📋 Iftar Registration Open 10 AM – 2 PM", text: "Register TODAY for TOMORROW's Iftar. Iftar served after Maghrib prayer. Open to all students, staff & guests.", color: "green" },
    { id: "a3", title: "🕌 Taraweeh Every Night", text: "Taraweeh prayers 10 minutes after Isha. 20 Rakats + Witr at Murdoch Prayer Room.", color: "gold" },
  ],
  team: [
    { id: "t1", name: "Abdullah A Khan", role: "President", photo: "" },
    { id: "t2", name: "Awais Ahmad Nizamani", role: "Vice President", photo: "" },
    { id: "t3", name: "Alamin Bin Ilyas", role: "Secretary", photo: "" },
  ],
  sponsors: [
    { id: "s1", name: "Mandi Al Arabia", logo: "", color: "#c0392b" },
    { id: "s2", name: "Bentley Kebab", logo: "", color: "#e67e22" },
    { id: "s3", name: "Tazz Curry House", logo: "", color: "#8e44ad" },
    { id: "s4", name: "Petra Restaurant", logo: "", color: "#2980b9" },
  ],
  donation: {
    enabled: true,
    title: "Support MUMSA",
    description: "Your generous donations help us provide daily Iftars, organise community events, and maintain prayer facilities for Muslim students at Murdoch University. Every contribution makes a difference!",
    bankName: "Commonwealth Bank",
    accountName: "MUMSA — Murdoch Uni MSA",
    bsb: "066-000",
    accountNumber: "1234 5678",
    reference: "MUMSA-Donation",
    extraNote: "Please use your name as the payment reference so we can acknowledge your contribution. JazakAllahu Khairan!",
  },
  contactEmail: EMAIL,
  contactLocation: "Murdoch University, 90 South St, Murdoch WA 6150",
  aboutText: "The Murdoch University Muslim Students Association (MUMSA) is a student-run organisation dedicated to creating an inclusive, supportive community for Muslim students and staff at Murdoch University. We organise daily prayers, community iftars, Islamic lectures, social events, and Ramadan programs.",
  vision: "From the Murdoch Muslim community, for the Murdoch Muslim community.",
  quoteText: "Indeed, with hardship comes ease.",
  quoteSource: "Surah Ash-Sharh (94:6)",
  services: ["Daily Prayers", "Community Iftar", "Islamic Lectures", "Social Events", "Ramadan Programs", "Peer Support"],
  adminPin: "1430",
  iftarSchedule: genRamadanSchedule(),
};

/* ═══ Theme ═══ */
const P = {
  bg: "#faf9f6", card: "#fff", pri: "#1b5e3b", priD: "#0d3320", priL: "#2d8b5a",
  acc: "#d4a843", accL: "#fdf4dc", txt: "#1a1a1a", sub: "#555", mut: "#999",
  bor: "#e8e5de", ok: "#16a34a", err: "#dc2626", hi: "#fffbeb",
  hero: "linear-gradient(135deg,#0d3320 0%,#1b5e3b 40%,#2d8b5a 100%)",
};

/* ═══ Helpers ═══ */
const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
/* Local date key — avoids UTC timezone bug (toISOString returns UTC, not Perth) */
const localDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/* Get iftar date key from registration — handles old data without iftarDateKey */
const MONTHS = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
const getIftarKey = (r) => {
  if (r.iftarDateKey) return r.iftarDateKey;
  // Parse "Sunday, February 22" or "Friday, March 1" manually
  if (r.iftarDate) {
    const m = r.iftarDate.match(/(\w+)\s+(\d+)/);
    if (m) { const mon = MONTHS[m[1].toLowerCase()]; if (mon) return `${new Date().getFullYear()}-${mon}-${m[2].padStart(2, "0")}`; }
  }
  // Last resort: registration date + 1 day
  if (r.date) { const d = new Date(r.date); if (!isNaN(d)) { d.setDate(d.getDate() + 1); return localDateKey(d); } }
  return "";
};
/* Strike system: no-show penalties */
const STRIKE_RULES = [
  { strikes: 1, action: "⚠️ Warning", blockDays: 0 },
  { strikes: 2, action: "🚫 Blocked 3 days", blockDays: 3 },
  { strikes: 3, action: "🚫 Blocked 7 days", blockDays: 7 },
]; // 4+ = blocked 14 days
const getStrikeBlock = (count) => {
  if (count <= 0) return 0;
  const rule = STRIKE_RULES.find(r => r.strikes === count);
  return rule ? rule.blockDays : 14;
};
const addM = (t, m) => { try { const [ti, p] = t.split(" "); let [h, mi] = ti.split(":").map(Number); if (p === "PM" && h !== 12) h += 12; if (p === "AM" && h === 12) h = 0; const d = new Date(2025, 0, 1, h, mi + m); let rh = d.getHours(); const rm = d.getMinutes(); const rp = rh >= 12 ? "PM" : "AM"; if (rh > 12) rh -= 12; if (rh === 0) rh = 12; return `${rh}:${rm.toString().padStart(2, "0")} ${rp}`; } catch { return t; } };
const parseTime = (t) => { try { const [ti, p] = t.split(" "); let [h, m] = ti.split(":").map(Number); if (p === "PM" && h !== 12) h += 12; if (p === "AM" && h === 12) h = 0; return h * 60 + m; } catch { return 0; } };

/* ═══ AlAdhan API — auto-fetch prayer times for Perth ═══ */
const ALADHAN_METHODS = [
  { id: 0, l: "Shia Ithna-Ashari" }, { id: 1, l: "University of Karachi" },
  { id: 2, l: "ISNA" }, { id: 3, l: "Muslim World League (MWL)" },
  { id: 4, l: "Umm Al-Qura" }, { id: 5, l: "Egyptian" },
  { id: 8, l: "Gulf Region" }, { id: 9, l: "Kuwait" },
  { id: 10, l: "Qatar" }, { id: 11, l: "Singapore" },
  { id: 15, l: "Moonsighting Committee" },
];
async function fetchPrayerTimes(method = 3) {
  try {
    const d = new Date();
    const dd = `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getFullYear()}`;
    const r = await fetch(`https://api.aladhan.com/v1/timingsByCity/${dd}?city=Perth&country=Australia&method=${method}&school=0`);
    if (!r.ok) return null;
    const j = await r.json();
    const t = j.data?.timings;
    if (!t) return null;
    const fmt = (v) => {
      const clean = v.replace(/\s*\(.*\)/, "").trim(); // strip "(AWST)" etc
      const [h24, m] = clean.split(":").map(Number);
      const p = h24 >= 12 ? "PM" : "AM";
      const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
      return `${h12}:${m.toString().padStart(2, "0")} ${p}`;
    };
    return { Fajr: fmt(t.Fajr), Sunrise: fmt(t.Sunrise), Dhuhr: fmt(t.Dhuhr), Asr: fmt(t.Asr), Maghrib: fmt(t.Maghrib), Isha: fmt(t.Isha) };
  } catch (e) { console.error("AlAdhan fetch:", e); return null; }
}
const fH = (h) => `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
const deepClone = (o) => JSON.parse(JSON.stringify(o));

function useHash() {
  const [h, s] = useState(window.location.hash.replace("#", ""));
  useEffect(() => { const f = () => s(window.location.hash.replace("#", "")); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return h;
}

/* ═══ Shared ═══ */
const Geo = ({ o = 0.04 }) => (<svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", opacity: o }}><defs><pattern id="gp" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="#fff" strokeWidth=".5" /><circle cx="30" cy="30" r="12" fill="none" stroke="#fff" strokeWidth=".3" /></pattern></defs><rect width="100%" height="100%" fill="url(#gp)" /></svg>);
const LogoImg = ({ size = 40 }) => (<img src={LOGO} alt="MUMSA" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff3" }} onError={(e) => { e.target.style.display = "none"; }} />);
const Avatar = ({ name, photo, size = 52, bg }) => {
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${P.bor}` }} onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg || P.hero, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: Math.floor(size * 0.42), fontWeight: "800", flexShrink: 0, fontFamily: "'Playfair Display',serif" }}>{(name || "?")[0].toUpperCase()}</div>;
};
const SponsorLogo = ({ name, logo, color, size = 64 }) => {
  if (logo) return <img src={logo} alt={name} style={{ width: size, height: size, borderRadius: "14px", objectFit: "cover", border: `1px solid ${P.bor}` }} />;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: "14px", background: `linear-gradient(135deg,${color || "#666"},${color || "#666"}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: Math.floor(size * 0.32), fontWeight: "800", flexShrink: 0, letterSpacing: "1px" }}>{initials}</div>;
};
const SocialIcons = ({ color = "#fff", size = 18 }) => (<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>{[{ h: WHATSAPP, e: "💬" }, { h: FB, e: "📘" }, { h: YT, e: "▶️" }, { h: IG, e: "📸" }, { h: `mailto:${EMAIL}`, e: "✉️" }].map((l, i) => <a key={i} href={l.h} target="_blank" rel="noopener noreferrer" style={{ color, opacity: 0.8, fontSize: size + "px", textDecoration: "none" }}>{l.e}</a>)}</div>);

/* ═══ Style ═══ */
const BDG = (c) => ({ display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "system-ui", background: c === "green" ? "#dcfce7" : c === "gold" ? P.accL : c === "red" ? "#fee2e2" : "#f0ece4", color: c === "green" ? P.ok : c === "gold" ? "#92700c" : c === "red" ? P.err : P.mut });
const BTN = (v, glow) => ({ background: v === "pri" ? P.pri : v === "acc" ? P.acc : v === "err" ? P.err : v === "ok" ? P.ok : v === "wa" ? "#25D366" : "transparent", color: v === "out" ? P.pri : v === "wa" ? "#fff" : "#fff", border: v === "out" ? `2px solid ${P.pri}` : "none", borderRadius: "12px", padding: "14px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "system-ui", letterSpacing: ".5px", width: "100%", textTransform: "uppercase", transition: "all .3s", boxShadow: glow ? `0 0 20px ${P.acc}80, 0 0 40px ${P.acc}40` : "0 2px 8px rgba(0,0,0,.08)" });
const INP = { width: "100%", padding: "14px 16px", border: `1.5px solid ${P.bor}`, borderRadius: "12px", fontSize: "15px", fontFamily: "system-ui", outline: "none", background: P.bg, boxSizing: "border-box" };
const LBL = { fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: P.mut, fontFamily: "system-ui", display: "block", marginBottom: "6px" };
const SEC = (t) => ({ fontSize: "13px", fontWeight: "800", letterSpacing: "3px", textTransform: "uppercase", color: P.pri, marginBottom: "16px", fontFamily: "system-ui", paddingBottom: "8px", borderBottom: `2px solid ${P.acc}`, ...(t || {}) });

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:${P.bg};font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
input:focus,textarea:focus,select:focus{border-color:${P.pri}!important;box-shadow:0 0 0 3px ${P.pri}18}
textarea{resize:vertical}select{appearance:auto}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${P.acc}60;border-radius:4px}
@keyframes glow{0%,100%{box-shadow:0 0 15px ${P.acc}60,0 0 30px ${P.acc}30}50%{box-shadow:0 0 25px ${P.acc}90,0 0 50px ${P.acc}50}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
.glow-btn{animation:glow 2s ease-in-out infinite,pulse 2s ease-in-out infinite}
.card{background:${P.card};border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid ${P.bor};box-shadow:0 1px 8px rgba(0,0,0,.04);transition:transform .15s,box-shadow .15s}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
.g2{display:grid;grid-template-columns:1fr;gap:16px}
.g3{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:640px){.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}}
@keyframes saveFlash{0%{opacity:1}100%{opacity:0}}
`;

/* ═══════════════════════════════════════════ */
/* MAIN APP                                    */
/* ═══════════════════════════════════════════ */
export default function App() {
  const route = useHash();
  const isAdmin = route === "admin";
  const scr = useScreen();
  const [auth, setAuth] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [now, setNow] = useState(new Date());
  const [regs, setRegsState] = useState([]);
  const [cfg, setCfgState] = useState(DEF);
  const [strikes, setStrikesState] = useState({});

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Auto-fetch prayer times from AlAdhan API (doesn't save to Firebase — just live display)
  useEffect(() => {
    (async () => {
      const times = await fetchPrayerTimes(cfg.prayerMethod || 3);
      if (times) setCfgState(prev => ({ ...prev, prayerTimes: times }));
    })();
  }, [cfg.prayerMethod]);

  // Firebase: load in background — app shows immediately with defaults
  useEffect(() => {
    let u1, u2, u3;
    (async () => {
      try {
        const [sc, sr, ss] = await Promise.all([loadConfig(), loadRegistrations(), loadStrikes()]);
        if (sc) setCfgState(prev => ({ ...DEF, ...sc }));
        if (sr) setRegsState(sr);
        if (ss) setStrikesState(ss);
        u1 = onConfigChange((d) => setCfgState(prev => ({ ...DEF, ...d })));
        u2 = onRegistrationsChange((l) => setRegsState(l));
        u3 = onStrikesChange((s) => setStrikesState(s));
      } catch (e) { console.error("Init:", e); }
    })();
    return () => { u1 && u1(); u2 && u2(); u3 && u3(); };
  }, []);

  // Registrations: save immediately (critical for scanner + registration)
  const setRegs = useCallback((updater) => {
    setRegsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRegistrations(next);
      return next;
    });
  }, []);

  // Strikes: save immediately
  const setStrikes = useCallback((updater) => {
    setStrikesState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveStrikes(next);
      return next;
    });
  }, []);


  if (isAdmin && !auth)
    return (<div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}><style>{CSS}</style><div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}><LogoImg size={64} /><div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "12px", marginBottom: "6px", fontFamily: "'Playfair Display'" }}>MUMSA Admin</div><div style={{ fontSize: "14px", color: "#888", marginBottom: "28px" }}>Enter PIN to access dashboard</div><div style={{ background: "#1a1d26", borderRadius: "16px", padding: "28px", border: "1px solid #2a2d36" }}><input type="password" maxLength={8} style={{ width: "100%", padding: "16px", border: "1.5px solid #3a3d46", borderRadius: "12px", fontSize: "32px", outline: "none", background: "#252830", boxSizing: "border-box", textAlign: "center", letterSpacing: "14px", fontWeight: "700", color: "#fff" }} placeholder="••••" value={pin} onChange={(e) => { setPin(e.target.value); setPinErr(false); }} onKeyDown={(e) => e.key === "Enter" && (pin === cfg.adminPin ? (setAuth(true), setPinErr(false)) : (setPinErr(true), setPin("")))} />{pinErr && <div style={{ color: P.err, fontSize: "13px", marginTop: "10px", fontWeight: "600" }}>Incorrect PIN</div>}<button onClick={() => pin === cfg.adminPin ? (setAuth(true), setPinErr(false)) : (setPinErr(true), setPin(""))} style={{ ...BTN("acc"), marginTop: "16px" }}>Unlock</button></div><a href="#" style={{ color: "#666", fontSize: "13px", marginTop: "20px", display: "inline-block", textDecoration: "none" }}>← Main Site</a></div></div>);

  if (isAdmin && auth)
    return <AdminApp now={now} regs={regs} setRegs={setRegs} cfg={cfg} setCfgState={setCfgState} scr={scr} strikes={strikes} setStrikes={setStrikes} onLogout={() => { setAuth(false); setPin(""); }} />;

  return <UserApp now={now} regs={regs} setRegs={setRegs} cfg={cfg} scr={scr} strikes={strikes} />;
}


/* ═══════════════════════════════════════════ */
/* USER PORTAL                                 */
/* ═══════════════════════════════════════════ */
function UserApp({ now, regs, setRegs, cfg, scr, strikes }) {
  const [pg, setPg] = useState("home");
  const [form, setForm] = useState({ name: "", sid: "", type: "student", email: "", phone: "" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(null);
  const [viewQR, setViewQR] = useState(null);
  const [myId, setMyId] = useState("");
  const [myName, setMyName] = useState("");
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const { sm, md, lg } = scr;

  const isOpen = useCallback(() => {
    if (cfg.regForceOpen) return true;
    if (cfg.regForceClosed) return false;
    return now.getHours() >= cfg.regStartHour && now.getHours() < cfg.regEndHour;
  }, [now, cfg]);

  const jamat = {};
  PRAYER_ORDER.forEach(k => { if (k !== "Sunrise" && cfg.prayerTimes[k]) jamat[k] = addM(cfg.prayerTimes[k], cfg.jamatOffset); });

  const getNext = useCallback(() => {
    const nm = now.getHours() * 60 + now.getMinutes();
    for (const n of PRAYER_ORDER) {
      if (n === "Sunrise") continue;
      const t = cfg.prayerTimes[n];
      if (!t) continue;
      const pm = parseTime(t);
      if (pm > nm) return { name: n, time: t };
    }
    return { name: "Fajr", time: cfg.prayerTimes.Fajr };
  }, [now, cfg]);

  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tmrStr = tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const tmrKey = localDateKey(tomorrow); // "2026-02-22" — machine-readable for scanner
  const todayKey = localDateKey(now);

  // Build full email from student ID
  const getStudentEmail = () => `${form.sid}@student.murdoch.edu.au`;

  const validateReg = () => {
    if (!form.name.trim()) return showToast("Please enter your name.", "err");
    if (form.type !== "guest") {
      if (!/^\d{8}$/.test(form.sid)) return showToast("Student ID must be exactly 8 digits.", "err");
    } else {
      if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 8) return showToast("Phone number is required for guest registration.", "err");
    }
    if (!isOpen()) return showToast(`Registration is open ${fH(cfg.regStartHour)} – ${fH(cfg.regEndHour)} daily.`, "err");
    // Strike check
    const cleanPhone = form.phone.replace(/\D/g, "");
    const fullEmail = getStudentEmail();
    const strikeKey = form.type === "guest" ? `phone:${cleanPhone}` : `email:${fullEmail.toLowerCase()}`;
    const strikeData = strikes[strikeKey];
    if (strikeData && strikeData.blockedUntil) {
      const blocked = new Date(strikeData.blockedUntil);
      if (now < blocked) {
        const daysLeft = Math.ceil((blocked - now) / 86400000);
        return showToast(`⛔ You are blocked for ${daysLeft} more day${daysLeft > 1 ? "s" : ""} due to ${strikeData.count} no-show${strikeData.count > 1 ? "s" : ""}. Block ends ${blocked.toLocaleDateString()}.`, "err");
      }
    }
    const today = now.toDateString();
    const existing = regs.find(r => {
      if (form.type === "guest") return r.phone && r.phone === cleanPhone && r.date === today;
      return r.email && r.email.toLowerCase() === fullEmail.toLowerCase() && r.date === today;
    });
    if (existing) return showToast("You've already registered today! Only 1 registration per day allowed.", "err");
    // All good — show confirmation popup
    setShowConfirm(true);
  };

  const completeReg = () => {
    setShowConfirm(false);
    const cleanPhone = form.phone.replace(/\D/g, "");
    const fullEmail = form.type !== "guest" ? getStudentEmail() : "";
    const today = now.toDateString();
    const ts = Date.now().toString(36).toUpperCase();
    const shortId = form.type === "guest" ? `G${Date.now().toString().slice(-8)}` : form.sid;
    const id = `MUMSA-${shortId}-${ts}`;
    const reg = { id, name: form.name, studentId: shortId, type: form.type, email: fullEmail, phone: form.type === "guest" ? cleanPhone : "", date: today, iftarDate: tmrStr, iftarDateKey: tmrKey, time: now.toLocaleTimeString(), used: false };
    setRegs(p => [...p, reg]);
    setSuccess(reg);
    if (fullEmail) {
      sendQREmail(cfg, reg).then(ok => {
        if (ok) showToast("📧 QR code sent to your email!", "ok");
      });
    }
    setForm({ name: "", sid: "", type: "student", email: "", phone: "" });
  };

  const next = getNext();
  // Protected lookup — require name + (student ID or phone)
  const myRegs = (myId.length >= 8 && myName.trim().length >= 2)
    ? regs.filter(r => {
        const nameMatch = r.name.toLowerCase().trim() === myName.toLowerCase().trim();
        const idMatch = r.studentId === myId || (r.phone && r.phone === myId);
        return nameMatch && idMatch;
      })
    : [];
  // Fix #3: Determine QR status based on iftar date
  const getQRStatus = (r) => {
    const key = getIftarKey(r);
    if (r.used) return { label: "Used", color: "red" };
    if (key === todayKey) return { label: "Active Today", color: "green" };
    if (key > todayKey) return { label: "Upcoming", color: "gold" };
    return { label: "Expired", color: "red" };
  };
  const navItems = [
    { id: "home", icon: "🏠", l: "Home" }, { id: "prayer", icon: "🕌", l: "Prayer" },
    { id: "ramadan", icon: "🌙", l: "Ramadan" }, { id: "register", icon: "🍽️", l: "Iftar" },
    { id: "donate", icon: "💝", l: "Donate" }, { id: "about", icon: "ℹ️", l: "About" },
  ];
  const nav = (id) => { setPg(id); setViewQR(null); setSuccess(null); };

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.txt, display: md ? "flex" : "block" }}>
      <style>{CSS}</style>
      {toast && (<div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: toast.type === "err" ? "#fef2f2" : "#f0fdf4", border: `2px solid ${toast.type === "err" ? P.err : P.ok}`, color: toast.type === "err" ? P.err : P.ok, padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: "600", boxShadow: "0 8px 32px rgba(0,0,0,.15)", maxWidth: "90%", textAlign: "center" }}>{toast.msg}</div>)}

      {/* Desktop Sidebar */}
      {md && (
        <div style={{ width: lg ? "240px" : "72px", background: P.priD, minHeight: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: lg ? "24px 20px" : "16px 0", borderBottom: "1px solid #ffffff12", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexDirection: lg ? "row" : "column" }}>
            <LogoImg size={lg ? 42 : 36} />
            {lg && <div style={{ textAlign: "left" }}><div style={{ fontSize: "18px", fontWeight: "800", color: "#fff", letterSpacing: "2px", fontFamily: "'Playfair Display'" }}>MUMSA</div><div style={{ fontSize: "8px", color: "#fff8", letterSpacing: "1px", textTransform: "uppercase", marginTop: "1px" }}>Murdoch Uni MSA</div></div>}
          </div>
          <div style={{ flex: 1, padding: lg ? "16px 12px" : "12px 6px" }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => nav(n.id)} style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: lg ? "flex-start" : "center", padding: lg ? "13px 16px" : "12px", width: "100%", border: "none", borderRadius: "10px", cursor: "pointer", marginBottom: "4px", background: pg === n.id ? "#ffffff18" : "transparent", color: pg === n.id ? "#fff" : "#ffffffa0", fontFamily: "system-ui", fontSize: lg ? "14px" : "18px", fontWeight: pg === n.id ? "700" : "500", textAlign: "left", transition: "all .15s" }}>
                {lg ? <><span style={{ fontSize: "16px" }}>{n.icon}</span><span>{n.l}</span>{pg === n.id && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: P.acc, marginLeft: "auto" }} />}</> : <span title={n.l}>{n.icon}</span>}
              </button>
            ))}
          </div>
          {lg && <div style={{ padding: "16px 20px", borderTop: "1px solid #ffffff12" }}><SocialIcons /><div style={{ fontSize: "10px", color: "#fff5", marginTop: "10px" }}>{now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div></div>}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, paddingBottom: md ? "40px" : "85px" }}>
        {/* Mobile Header */}
        {!md && (<div style={{ background: P.hero, color: "#fff", padding: "20px", position: "relative", overflow: "hidden" }}><Geo o={0.06} /><div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><LogoImg size={38} /><div><div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "2px", fontFamily: "'Playfair Display'" }}>MUMSA</div><div style={{ fontSize: "7px", opacity: 0.6, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "1px" }}>Murdoch University MSA</div></div></div><div style={{ textAlign: "right", fontSize: "11px", opacity: 0.7 }}><div>{now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div><div style={{ fontSize: "14px", fontWeight: "600", marginTop: "2px" }}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></div></div></div>)}

        {/* Desktop Top Bar */}
        {md && (<div style={{ background: P.card, borderBottom: `1px solid ${P.bor}`, padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: "16px" }}><h2 style={{ fontSize: "18px", fontWeight: "800", color: P.pri, margin: 0 }}>{navItems.find(n => n.id === pg)?.l}</h2>{isOpen() && <span style={{ ...BDG("green"), fontSize: "9px" }}>🍽️ Iftar Reg Open</span>}</div><div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: P.sub }}><span>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 14px", borderRadius: "8px", background: "#25D366", color: "#fff", textDecoration: "none", fontSize: "11px", fontWeight: "700" }}>💬 WhatsApp</a></div></div>)}

        <div style={{ padding: md ? "28px 32px" : "20px", maxWidth: "1200px", margin: "0 auto" }}>

          {/* ═══ HOME ═══ */}
          {pg === "home" && (<>
            <div style={{ background: P.hero, borderRadius: "20px", padding: sm ? "40px" : "28px 20px", position: "relative", overflow: "hidden", marginBottom: "20px", color: "#fff" }}><Geo o={0.08} /><div style={{ position: "relative", zIndex: 1, textAlign: "center" }}><div style={{ fontSize: "13px", opacity: 0.7, letterSpacing: "3px", textTransform: "uppercase", fontWeight: "600", marginBottom: "8px" }}>Assalamu Alaikum!</div><h1 style={{ fontSize: sm ? "36px" : "26px", fontWeight: "800", fontFamily: "'Playfair Display'", lineHeight: 1.3, marginBottom: "10px" }}>Welcome to MUMSA</h1><p style={{ fontSize: sm ? "15px" : "13px", opacity: 0.8, maxWidth: "500px", margin: "0 auto 20px", lineHeight: 1.6 }}>Murdoch University Muslim Students Association — Prayers, Community, Brotherhood & Sisterhood</p><div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}><button onClick={() => nav("register")} className={isOpen() ? "glow-btn" : ""} style={{ ...BTN(isOpen() ? "acc" : "pri", isOpen()), width: "auto", padding: "14px 28px" }}>{isOpen() ? "🍽️ Register for Tomorrow's Iftar" : "🍽️ Iftar Registration"}</button><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ ...BTN("wa"), width: "auto", padding: "14px 28px", textDecoration: "none", display: "inline-block", textAlign: "center" }}>💬 Join WhatsApp</a></div></div></div>
            <div className="g2">
              <div className="card" style={{ border: `1px solid ${P.acc}40`, position: "relative", overflow: "hidden" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={LBL}>Next Prayer</div><div style={{ fontSize: sm ? "32px" : "26px", fontWeight: "800", color: P.pri, fontFamily: "'Playfair Display'" }}>{next.name}</div><div style={{ fontSize: sm ? "20px" : "17px", color: P.acc, fontWeight: "700", marginTop: "4px" }}>{next.time}</div><div style={{ fontSize: "12px", color: P.sub, marginTop: "4px" }}>Jama'at: {jamat[next.name] || "—"}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: "12px", color: P.mut }}>Live Clock</div><div style={{ fontSize: "20px", fontWeight: "700", color: P.pri, fontFamily: "'Inter',monospace", marginTop: "4px" }}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</div><a href="https://app.muslimpro.com/prayer-times/australia/prayer-times-perth/2063523" target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: P.acc, textDecoration: "none", display: "inline-block", marginTop: "8px" }}>via Muslim Pro ↗</a></div></div></div>
              <div className="card" style={{ background: isOpen() ? `${P.ok}08` : P.bg, border: `1px solid ${isOpen() ? P.ok + "40" : P.bor}` }}><div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}><div style={{ width: "10px", height: "10px", borderRadius: "50%", background: isOpen() ? P.ok : P.err, boxShadow: isOpen() ? `0 0 8px ${P.ok}60` : "none" }} /><span style={{ fontSize: "15px", fontWeight: "700", color: isOpen() ? P.ok : P.err }}>Iftar Registration {isOpen() ? "OPEN" : "CLOSED"}</span></div><div style={{ fontSize: "13px", color: P.sub, lineHeight: 1.6, marginBottom: "12px" }}>Register today ({fH(cfg.regStartHour)} – {fH(cfg.regEndHour)}) for <strong>tomorrow's Iftar ({tmrStr})</strong>. Iftar served after Maghrib prayer.</div>{isOpen() && <button onClick={() => nav("register")} className="glow-btn" style={BTN("pri", true)}>🍽️ Register Now</button>}</div>
            </div>
            <div className="g3" style={{ marginTop: "4px" }}>{cfg.announcements.map(a => (<div key={a.id} className="card" style={{ borderLeft: `4px solid ${a.color === "gold" ? P.acc : a.color === "red" ? P.err : P.pri}`, marginBottom: 0 }}><div style={{ fontSize: "15px", fontWeight: "700", color: P.pri, marginBottom: "6px" }}>{a.title}</div><div style={{ fontSize: "13px", color: P.sub, lineHeight: 1.6 }}>{a.text}</div></div>))}</div>
            <div className="g2" style={{ marginTop: "16px" }}>
              <div className="card" style={{ background: `linear-gradient(135deg,${P.pri}08,${P.acc}12)`, textAlign: "center", padding: sm ? "28px" : "20px" }}><div style={{ fontSize: "11px", color: P.acc, fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "6px" }}>Every Friday</div><div style={{ fontSize: sm ? "24px" : "20px", fontWeight: "800", color: P.pri, fontFamily: "'Playfair Display'" }}>Jumu'ah — {cfg.jumaTime}</div><div style={{ fontSize: "12px", color: P.sub, marginTop: "6px" }}>{cfg.jumaLocation}</div></div>
              <div className="card" style={{ background: "#25D36608", border: "1px solid #25D36630", textAlign: "center", padding: sm ? "28px" : "20px" }}><div style={{ fontSize: "28px", marginBottom: "6px" }}>💬</div><div style={{ fontSize: "16px", fontWeight: "700", color: P.pri, marginBottom: "4px" }}>Join Our WhatsApp</div><div style={{ fontSize: "12px", color: P.sub, marginBottom: "14px" }}>Stay updated on iftar registrations, prayer times & events</div><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ ...BTN("wa"), textDecoration: "none", display: "block", padding: "12px", fontSize: "13px" }}>Join Group Chat</a></div>
            </div>
            {/* Committee */}
            {cfg.team?.length > 0 && (<div style={{ marginTop: "20px" }}><div style={SEC()}>Executive Committee</div><div style={{ display: "grid", gridTemplateColumns: sm ? `repeat(${Math.min(cfg.team.length, 3)},1fr)` : "1fr", gap: "12px" }}>{cfg.team.map(m => (<div key={m.id} className="card" style={{ textAlign: "center", padding: "24px 16px", marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}><Avatar name={m.name} photo={m.photo} size={68} /></div><div style={{ fontSize: "15px", fontWeight: "700", color: P.pri, marginBottom: "4px" }}>{m.name}</div><span style={BDG("gold")}>{m.role}</span></div>))}</div></div>)}
          </>)}

          {/* ═══ PRAYER ═══ */}
          {pg === "prayer" && (<>
            <div style={SEC()}>Daily Prayer Times — Perth</div>
            <div style={{ fontSize: "12px", color: P.mut, marginBottom: "16px", marginTop: "-10px" }}>Source: <a href="https://aladhan.com/prayer-times-api" target="_blank" rel="noopener noreferrer" style={{ color: P.acc }}>AlAdhan API</a> · Auto-updated daily · Jama'at +{cfg.jamatOffset} min</div>
            {sm ? (<div style={{ display: "grid", gridTemplateColumns: md ? "repeat(3,1fr)" : "repeat(2,1fr)", gap: "12px" }}>{PRAYER_ORDER.map(n => { const t = cfg.prayerTimes[n]; if (!t) return null; return (<div key={n} className="card" style={{ border: n === next.name ? `2px solid ${P.acc}` : `1px solid ${P.bor}`, background: n === next.name ? `${P.acc}08` : P.card, marginBottom: 0, padding: "20px 22px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: "15px", fontWeight: "700", color: P.pri }}>{n}</div>{n === next.name && <span style={BDG("gold")}>Next</span>}</div><div style={{ fontSize: "28px", fontWeight: "800", color: n === next.name ? P.acc : P.txt, fontFamily: "'Inter',monospace", marginTop: "10px" }}>{t}</div>{n !== "Sunrise" && jamat[n] && <div style={{ fontSize: "12px", color: P.sub, marginTop: "8px" }}>Jama'at: <strong>{jamat[n]}</strong></div>}</div>); })}</div>) : (<div className="card" style={{ padding: 0, overflow: "hidden" }}>{PRAYER_ORDER.map((n, i) => { const t = cfg.prayerTimes[n]; if (!t) return null; return (<div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < 5 ? `1px solid ${P.bor}` : "none", background: n === next.name ? `${P.acc}10` : "transparent" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}>{n === next.name && <div style={{ width: "3px", height: "30px", borderRadius: "2px", background: P.acc }} />}<div><div style={{ fontSize: "15px", fontWeight: "700", color: P.pri }}>{n}</div>{n !== "Sunrise" && jamat[n] && <div style={{ fontSize: "10px", color: P.sub }}>Jama'at: {jamat[n]}</div>}</div></div><div style={{ fontSize: "17px", fontWeight: "700", color: n === next.name ? P.acc : P.txt }}>{t}</div></div>); })}</div>)}
            <div className="g2" style={{ marginTop: "16px" }}>
              <div><div style={SEC()}>Jumu'ah</div><div className="card" style={{ border: `1px solid ${P.acc}40`, textAlign: "center" }}><div style={{ fontSize: "34px", fontWeight: "800", color: P.pri, fontFamily: "'Playfair Display'", margin: "6px 0" }}>{cfg.jumaTime}</div><div style={{ fontSize: "13px", color: P.sub }}>Every Friday · {cfg.jumaLocation}</div></div></div>
              <div><div style={SEC()}>Taraweeh</div><div className="card" style={{ background: `${P.pri}05` }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><div style={{ fontSize: "16px", fontWeight: "700", color: P.pri }}>Taraweeh</div><span style={BDG("gold")}>{cfg.taraweeh.rakats}</span></div><div style={{ fontSize: "28px", fontWeight: "800", color: P.acc, fontFamily: "'Playfair Display'", marginBottom: "8px" }}>{cfg.taraweeh.time}</div><div style={{ fontSize: "13px", color: P.sub, lineHeight: 1.6 }}>{cfg.taraweeh.note}</div><div style={{ marginTop: "10px", fontSize: "12px", fontWeight: "600", color: P.pri }}>📍 {cfg.taraweeh.location}</div></div></div>
            </div>
          </>)}

          {/* ═══ RAMADAN ═══ */}
          {pg === "ramadan" && (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div><div style={SEC({ marginBottom: "4px", paddingBottom: 0, border: "none" })}>Ramadan 2026</div><div style={{ fontSize: "12px", color: P.mut }}>Feb 20 – Mar 20</div></div>
              <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 20px", marginBottom: 0 }}><div><div style={{ fontSize: "13px", fontWeight: "700", color: P.pri }}>Taraweeh</div><div style={{ fontSize: "11px", color: P.sub }}>{cfg.taraweeh.rakats}</div></div><div style={{ fontSize: "22px", fontWeight: "800", color: P.acc, fontFamily: "'Playfair Display'" }}>{cfg.taraweeh.time}</div></div>
            </div>
            <div className="card" style={{ padding: sm ? "16px" : "10px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: sm ? "60px 1fr 1fr 1fr" : "44px 1fr 1fr 1fr", fontSize: sm ? "11px" : "10px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: P.mut, padding: sm ? "12px 16px" : "8px 10px", borderBottom: `2px solid ${P.bor}` }}><div>Day</div><div>Date</div><div>Sehri</div><div>Iftar</div></div>
              <div style={{ maxHeight: sm ? "600px" : "400px", overflowY: "auto" }}>{cfg.iftarSchedule.map(d => (<div key={d.day} style={{ display: "grid", gridTemplateColumns: sm ? "60px 1fr 1fr 1fr" : "44px 1fr 1fr 1fr", padding: sm ? "13px 16px" : "10px", borderBottom: `1px solid ${P.bor}20`, background: d.day % 2 === 0 ? `${P.bg}80` : "transparent", fontSize: sm ? "14px" : "13px", alignItems: "center" }}><div style={{ fontWeight: "800", color: P.pri }}>{d.day}</div><div style={{ color: P.sub, fontSize: sm ? "13px" : "11px" }}>{d.date}</div><div style={{ fontWeight: "600", color: P.priL }}>{d.sehri}</div><div style={{ fontWeight: "800", color: P.acc }}>{d.iftar}</div></div>))}</div>
            </div>
          </>)}

          {/* ═══ REGISTER ═══ */}
          {pg === "register" && (<>
            {viewQR ? (
              (() => {
                try {
                const qs = getQRStatus(viewQR);
                const isActiveToday = getIftarKey(viewQR) === todayKey && !viewQR.used;
                return (
              <div style={{ maxWidth: "520px", margin: "0 auto" }}><button onClick={() => setViewQR(null)} style={{ ...BTN("out"), marginBottom: "14px", padding: "10px", fontSize: "12px" }}>← Back</button><div className="card" style={{ border: `1px solid ${qs.color === "green" ? P.ok + "40" : qs.color === "red" ? P.err + "40" : P.acc + "40"}`, textAlign: "center", padding: "32px" }}><div style={LBL}>Your Iftar Pass</div><div style={{ fontSize: "20px", fontWeight: "800", color: P.pri, margin: "8px 0 4px", fontFamily: "'Playfair Display'" }}>{viewQR.name}</div><div style={{ fontSize: "12px", color: P.acc, fontWeight: "600", marginBottom: "16px" }}>For: {viewQR.iftarDate || viewQR.date}</div>
                {isActiveToday ? (<><div style={{ display: "inline-block", padding: "16px", background: "#fff", borderRadius: "16px", border: `2px solid ${P.ok}40` }}><QRCode value={viewQR.id || "MUMSA"} size={sm ? 240 : 200} fgColor="#000000" bgColor="#FFFFFF" /></div><div style={{ marginTop: "14px", fontSize: "13px", color: P.ok, background: "#dcfce7", padding: "14px", borderRadius: "10px", lineHeight: 1.5, fontWeight: "600" }}>✅ Active — Show this QR at the Iftar venue today</div></>) : (<><div style={{ padding: "40px 20px", background: P.bg, borderRadius: "16px", border: `2px dashed ${P.bor}` }}><div style={{ fontSize: "48px", marginBottom: "8px", opacity: 0.4 }}>{qs.color === "red" ? "❌" : "⏳"}</div><div style={{ fontSize: "16px", fontWeight: "700", color: P.sub }}>{viewQR.used ? "Already Used" : qs.label === "Upcoming" ? "Not Active Yet" : "Expired"}</div><div style={{ fontSize: "12px", color: P.mut, marginTop: "6px" }}>{viewQR.used ? "This pass was already scanned." : qs.label === "Upcoming" ? `This pass activates on ${viewQR.iftarDate}.` : "This pass has expired."}</div></div></>)}
                <div style={{ marginTop: "12px", display: "flex", justifyContent: "center", gap: "8px" }}><span style={BDG(qs.color)}>{qs.label}</span><span style={BDG("gold")}>{viewQR.type || "student"}</span></div></div></div>
                );
                } catch (err) {
                  console.error("ViewQR Error:", err, viewQR);
                  return (<div style={{ maxWidth: "520px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}><button onClick={() => setViewQR(null)} style={{ ...BTN("out"), marginBottom: "14px", padding: "10px", fontSize: "12px" }}>← Back</button><div className="card" style={{ padding: "32px" }}><div style={{ fontSize: "48px", marginBottom: "12px" }}>⚠️</div><div style={{ fontSize: "16px", fontWeight: "700", color: P.pri, marginBottom: "8px" }}>Error Loading Pass</div><div style={{ fontSize: "13px", color: P.sub }}>{err.message}</div><div style={{ fontSize: "11px", color: P.mut, marginTop: "12px", fontFamily: "monospace", background: P.bg, padding: "10px", borderRadius: "8px", wordBreak: "break-all", textAlign: "left" }}>{JSON.stringify(viewQR, null, 2)}</div></div></div>);
                }
              })()
            ) : success ? (
              <div style={{ maxWidth: "520px", margin: "0 auto" }}><div className="card" style={{ border: `1px solid ${P.acc}40`, textAlign: "center", padding: "32px" }}><div style={{ fontSize: "48px", marginBottom: "8px" }}>✅</div><div style={{ fontSize: "24px", fontWeight: "800", color: P.pri, fontFamily: "'Playfair Display'", marginBottom: "4px" }}>You're Registered!</div><div style={{ fontSize: "14px", color: P.acc, fontWeight: "600", marginBottom: "4px" }}>For tomorrow's Iftar — {tmrStr}</div><div style={{ fontSize: "13px", color: P.sub, marginBottom: "18px" }}>{success.type === "guest" ? "Show QR at venue" : "Check your email for QR code"}</div>
                {success.type === "guest" ? (<div style={{ display: "inline-block", padding: "16px", background: "#fff", borderRadius: "16px", border: `2px solid ${P.bor}` }}><QRCode value={success.id} size={sm ? 230 : 190} fgColor="#000000" bgColor="#FFFFFF" /></div>) : (<div style={{ padding: "24px", background: "#dcfce7", borderRadius: "16px", border: "2px solid #bbf7d0" }}><div style={{ fontSize: "32px", marginBottom: "8px" }}>📧</div><div style={{ fontSize: "15px", fontWeight: "700", color: "#166534" }}>QR Code Sent!</div><div style={{ fontSize: "13px", color: "#15803d", marginTop: "6px" }}>Check your inbox at</div><div style={{ fontSize: "14px", fontWeight: "700", color: "#166534", marginTop: "4px" }}>{success.email}</div><div style={{ fontSize: "11px", color: "#4ade80", marginTop: "8px" }}>Show the QR from your email at the venue</div><div style={{ fontSize: "11px", color: "#999", marginTop: "6px" }}>📌 Not in inbox? Check your spam/junk folder</div></div>)}
                <div style={{ marginTop: "14px" }}><div style={{ fontSize: "16px", fontWeight: "700", color: P.pri }}>{success.name}</div><div style={{ fontSize: "12px", color: P.sub }}>{success.type === "guest" ? `Guest · 📱 ${success.phone}` : `🎓 ${success.studentId}@student.murdoch.edu.au`} · {success.date}</div></div></div><div className="g2" style={{ marginTop: "12px" }}><button onClick={() => setSuccess(null)} style={BTN("pri")}>Done</button><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ ...BTN("wa"), textDecoration: "none", display: "block", textAlign: "center" }}>💬 Get Reminder on WhatsApp</a></div></div>
            ) : (
              <div className="g2" style={{ alignItems: "start" }}>
                <div>
                  <div style={SEC()}>Iftar Registration</div>
                  <div className="card" style={{ background: P.hi, border: `1px solid ${P.acc}40`, padding: "16px 20px", marginBottom: "14px" }}><div style={{ fontSize: "14px", fontWeight: "700", color: P.pri, marginBottom: "6px" }}>📋 Registering for TOMORROW's Iftar</div><div style={{ fontSize: "13px", color: P.sub, lineHeight: 1.6 }}><strong style={{ color: P.acc }}>{tmrStr}</strong> — Iftar served after Maghrib prayer.</div></div>
                  <div className="card" style={{ padding: "14px 20px", background: isOpen() ? "#dcfce720" : "#fee2e220", display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "10px", height: "10px", borderRadius: "50%", background: isOpen() ? P.ok : P.err, boxShadow: isOpen() ? `0 0 8px ${P.ok}60` : "none" }} /><div><div style={{ fontSize: "15px", fontWeight: "700", color: isOpen() ? P.ok : P.err }}>{isOpen() ? "Registration OPEN" : "Registration CLOSED"}</div><div style={{ fontSize: "12px", color: P.sub }}>Daily: {fH(cfg.regStartHour)} – {fH(cfg.regEndHour)}</div></div></div>
                  <div className="card">
                    <div style={{ marginBottom: "16px" }}><label style={LBL}>Full Name *</label><input style={INP} placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div style={{ marginBottom: "16px" }}><label style={LBL}>I am a:</label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><button onClick={() => setForm({ ...form, type: "student" })} style={{ padding: "14px", borderRadius: "12px", border: `2px solid ${form.type === "student" ? P.pri : P.bor}`, background: form.type === "student" ? `${P.pri}10` : "transparent", color: form.type === "student" ? P.pri : P.mut, fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🎓 Student / Staff</button><button onClick={() => setForm({ ...form, type: "guest" })} style={{ padding: "14px", borderRadius: "12px", border: `2px solid ${form.type === "guest" ? P.acc : P.bor}`, background: form.type === "guest" ? `${P.acc}10` : "transparent", color: form.type === "guest" ? P.acc : P.mut, fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>👤 Guest</button></div></div>
                    {form.type !== "guest" ? (
                      <div style={{ marginBottom: "16px" }}><label style={LBL}>Student ID (8 digits) *</label><div style={{ display: "flex", alignItems: "center", gap: "0" }}><input style={{ ...INP, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none", flex: "0 0 120px" }} placeholder="12345678" maxLength={8} value={form.sid} onChange={e => setForm({ ...form, sid: e.target.value.replace(/\D/g, "").slice(0, 8) })} /><div style={{ padding: "12px 14px", background: P.bg, border: `1.5px solid ${P.bor}`, borderTopRightRadius: "12px", borderBottomRightRadius: "12px", fontSize: "13px", color: P.sub, whiteSpace: "nowrap", fontWeight: "500" }}>@student.murdoch.edu.au</div></div>{form.sid && form.sid.length < 8 && <div style={{ fontSize: "11px", color: P.err, marginTop: "6px" }}>{8 - form.sid.length} more digits needed</div>}{form.sid.length === 8 && <div style={{ fontSize: "10px", color: P.ok, marginTop: "6px" }}>📧 QR will be sent to {form.sid}@student.murdoch.edu.au</div>}</div>
                    ) : (
                      <div style={{ marginBottom: "16px" }}><label style={LBL}>Phone Number *</label><input type="tel" style={INP} placeholder="e.g. 0412 345 678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><div style={{ fontSize: "10px", color: P.mut, marginTop: "6px" }}>Used as your unique ID. One phone number = one registration per day.</div></div>
                    )}
                    {/* Strike warning */}
                    {(() => { const sk = form.type === "guest" ? `phone:${form.phone.replace(/\D/g, "")}` : `email:${form.sid}@student.murdoch.edu.au`; const sd = strikes[sk]; if (sd && sd.count > 0 && (form.type === "guest" ? form.phone.replace(/\D/g, "").length >= 8 : form.sid.length === 8)) { const blocked = sd.blockedUntil && new Date(sd.blockedUntil) > now; return (<div style={{ padding: "14px", borderRadius: "12px", background: blocked ? "#fee2e2" : "#fef3c7", border: `1px solid ${blocked ? P.err + "40" : "#f59e0b40"}`, marginBottom: "16px" }}><div style={{ fontSize: "14px", fontWeight: "700", color: blocked ? P.err : "#92400e" }}>{blocked ? "⛔ Registration Blocked" : `⚠️ Warning: ${sd.count} No-Show${sd.count > 1 ? "s" : ""}`}</div><div style={{ fontSize: "12px", color: blocked ? "#991b1b" : "#92400e", marginTop: "4px" }}>{blocked ? `You are blocked until ${new Date(sd.blockedUntil).toLocaleDateString()}. Please contact MUMSA if this is an error.` : "Next no-show will result in a temporary block from registration."}</div></div>); } return null; })()}
                    {/* No-show policy */}
                    <div style={{ padding: "12px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "16px" }}><div style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b", marginBottom: "4px" }}>⚠️ No-Show Policy</div><div style={{ fontSize: "11px", color: "#7f1d1d", lineHeight: 1.5 }}>By registering, you commit to attending. No-shows waste food and deny spots to others. <strong>Penalty: 1st warning, 2nd blocked 3 days, 3rd blocked 7 days.</strong></div></div>
                    <button onClick={validateReg} disabled={!isOpen()} className={isOpen() ? "glow-btn" : ""} style={{ ...BTN("pri", isOpen()), opacity: isOpen() ? 1 : 0.4, cursor: isOpen() ? "pointer" : "not-allowed" }}>{isOpen() ? "Register for Tomorrow's Iftar 🍽️" : `Opens ${fH(cfg.regStartHour)}`}</button>
                    {/* Confirmation Modal */}
                    {showConfirm && (<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(false)}><div style={{ background: "#fff", borderRadius: "20px", maxWidth: "440px", width: "100%", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
                      <div style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)", padding: "28px 24px", textAlign: "center" }}><div style={{ fontSize: "40px", marginBottom: "8px" }}>⚠️</div><div style={{ fontSize: "20px", fontWeight: "800", color: "#fff" }}>Confirm Your Commitment</div></div>
                      <div style={{ padding: "24px" }}>
                        <div style={{ fontSize: "14px", color: "#333", lineHeight: 1.7, marginBottom: "16px" }}>You are registering for <strong style={{ color: P.acc }}>{tmrStr}</strong> Iftar.</div>
                        <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "16px", border: "1px solid #fecaca", marginBottom: "16px" }}>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: "#991b1b", marginBottom: "8px" }}>By clicking "Yes, I Will Attend" you agree to:</div>
                          <div style={{ fontSize: "12px", color: "#7f1d1d", lineHeight: 1.8 }}>
                            🍽️ I <strong>WILL</strong> attend tomorrow's Iftar after Maghrib<br/>
                            📍 I understand food is prepared based on my registration<br/>
                            ⚠️ <strong>1st no-show</strong> → Warning<br/>
                            🚫 <strong>2nd no-show</strong> → Blocked 3 days<br/>
                            🚫 <strong>3rd no-show</strong> → Blocked 7 days<br/>
                            ❌ <strong>4+ no-shows</strong> → Blocked 14 days
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "#999", marginBottom: "20px", textAlign: "center" }}>Not sure? Please cancel — you can always register later when you're certain.</div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: `2px solid ${P.bor}`, background: "transparent", color: P.sub, fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
                          <button onClick={completeReg} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #15803d, #166534)", color: "#fff", fontWeight: "700", fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 12px rgba(21,128,61,0.3)" }}>✅ Yes, I Will Attend</button>
                        </div>
                      </div>
                    </div></div>)}
                  </div>
                  <div className="card" style={{ background: "#25D36608", border: "1px solid #25D36630", textAlign: "center", padding: "18px" }}><div style={{ fontSize: "14px", fontWeight: "700", color: P.pri, marginBottom: "6px" }}>📱 Get Reminders</div><div style={{ fontSize: "12px", color: P.sub, marginBottom: "12px" }}>Join our WhatsApp group for daily Iftar registration reminders & updates</div><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ ...BTN("wa"), textDecoration: "none", display: "block", padding: "12px", fontSize: "13px" }}>💬 Join WhatsApp Group</a></div>
                </div>
                <div>
                  <div style={SEC()}>My Registrations</div>
                  <div className="card"><label style={LBL}>Your Full Name *</label><input style={{ ...INP, marginBottom: "12px" }} placeholder="Exactly as registered" value={myName} onChange={e => setMyName(e.target.value)} /><label style={LBL}>Student ID or Phone Number *</label><input style={INP} placeholder="8-digit student ID or phone number" value={myId} onChange={e => setMyId(e.target.value.replace(/[^0-9]/g, ""))} /><div style={{ fontSize: "10px", color: P.mut, marginTop: "6px" }}>Students: your 8-digit ID. Guests: your phone number.</div></div>
                  {myId.length >= 8 && myName.trim().length >= 2 && myRegs.length > 0 && myRegs.map(r => { const qs = getQRStatus(r); return (<div key={r.id} onClick={() => setViewQR(r)} className="card" style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderLeft: `4px solid ${qs.color === "green" ? P.ok : qs.color === "gold" ? P.acc : P.err}` }}><div><div style={{ fontSize: "14px", fontWeight: "700", color: P.pri }}>{r.name}</div><div style={{ fontSize: "12px", color: P.sub }}>{r.iftarDate || r.date}</div></div><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={BDG(qs.color)}>{qs.label}</span><span style={{ color: P.mut }}>›</span></div></div>); })}
                  {myId.length >= 8 && myName.trim().length >= 2 && myRegs.length === 0 && <div className="card" style={{ textAlign: "center", color: P.mut, fontSize: "13px" }}>No registrations found. Make sure name and ID/phone match exactly.</div>}
                </div>
              </div>
            )}
          </>)}

          {/* ═══ DONATE ═══ */}
          {pg === "donate" && cfg.donation?.enabled && (<>
            <div className="card" style={{ border: `1px solid ${P.acc}40`, textAlign: "center", padding: sm ? "44px" : "28px 20px", position: "relative", overflow: "hidden" }}><Geo o={0.03} /><div style={{ position: "relative", zIndex: 1 }}><div style={{ fontSize: "48px", marginBottom: "12px" }}>💝</div><h1 style={{ fontSize: sm ? "32px" : "24px", fontWeight: "800", color: P.pri, fontFamily: "'Playfair Display'", marginBottom: "12px" }}>{cfg.donation.title}</h1><p style={{ fontSize: "15px", color: P.sub, maxWidth: "600px", margin: "0 auto", lineHeight: 1.8 }}>{cfg.donation.description}</p></div></div>
            <div className="g2">
              <div className="card" style={{ border: `2px solid ${P.acc}40` }}>
                <div style={SEC()}>Bank Transfer Details</div>
                {[["Bank", cfg.donation.bankName], ["Account Name", cfg.donation.accountName], ["BSB", cfg.donation.bsb], ["Account Number", cfg.donation.accountNumber], ["Reference", cfg.donation.reference]].map(([l, v]) => (<div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${P.bor}` }}><span style={{ fontSize: "13px", color: P.sub, fontWeight: "600" }}>{l}</span><span style={{ fontSize: "16px", fontWeight: "700", color: P.pri, fontFamily: "monospace", letterSpacing: "1px" }}>{v}</span></div>))}
              </div>
              <div>
                {cfg.donation.extraNote && (<div className="card" style={{ background: P.hi, border: `1px solid ${P.acc}40` }}><div style={{ fontSize: "14px", fontWeight: "700", color: P.pri, marginBottom: "8px" }}>📝 Note</div><div style={{ fontSize: "13px", color: P.sub, lineHeight: 1.7 }}>{cfg.donation.extraNote}</div></div>)}
                <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "15px", color: P.acc, fontStyle: "italic", marginBottom: "8px" }}>"Whoever feeds a fasting person will have a reward like that of the fasting person."</div><div style={{ fontSize: "11px", color: P.mut }}>— Prophet Muhammad ﷺ (Tirmidhi)</div></div>
                {cfg.sponsors?.length > 0 && (<><div style={SEC({ marginTop: "16px" })}>Our Sponsors</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>{cfg.sponsors.map(s => (<div key={s.id} className="card" style={{ textAlign: "center", padding: "14px 8px", marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}><SponsorLogo name={s.name} logo={s.logo} color={s.color} size={48} /></div><div style={{ fontSize: "12px", fontWeight: "700", color: P.pri }}>{s.name}</div></div>))}</div></>)}
              </div>
            </div>
          </>)}

          {/* ═══ ABOUT ═══ */}
          {pg === "about" && (<>
            <div className="card" style={{ border: `1px solid ${P.acc}40`, textAlign: "center", padding: sm ? "44px" : "28px 20px", position: "relative", overflow: "hidden" }}><Geo o={0.03} /><div style={{ position: "relative", zIndex: 1 }}><LogoImg size={sm ? 80 : 60} /><div style={{ fontSize: sm ? "32px" : "24px", fontWeight: "800", letterSpacing: "3px", color: P.pri, fontFamily: "'Playfair Display'", marginTop: "12px" }}>MUMSA</div><div style={{ fontSize: sm ? "12px" : "10px", color: P.sub, letterSpacing: "2px", marginTop: "6px", textTransform: "uppercase" }}>Murdoch University Muslim Students Association</div>{cfg.vision && <div style={{ fontSize: "14px", color: P.acc, fontStyle: "italic", marginTop: "10px" }}>"{cfg.vision}"</div>}</div></div>
            <div className="g2">
              <div><div style={SEC()}>About Us</div><div className="card"><div style={{ fontSize: "15px", lineHeight: 1.8, color: P.sub }}>{cfg.aboutText}</div></div></div>
              <div><div style={SEC()}>Executive Committee</div>{cfg.team.map(m => (<div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}><Avatar name={m.name} photo={m.photo} size={56} /><div><div style={{ fontSize: "16px", fontWeight: "700", color: P.pri }}>{m.name}</div><span style={BDG("gold")}>{m.role}</span></div></div>))}</div>
            </div>
            {cfg.sponsors?.length > 0 && (<div style={{ marginTop: "8px" }}><div style={SEC()}>Our Sponsors</div><div style={{ display: "grid", gridTemplateColumns: sm ? `repeat(${Math.min(cfg.sponsors.length, 4)},1fr)` : "repeat(2,1fr)", gap: "12px" }}>{cfg.sponsors.map(s => (<div key={s.id} className="card" style={{ textAlign: "center", padding: "20px 12px", marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}><SponsorLogo name={s.name} logo={s.logo} color={s.color} size={60} /></div><div style={{ fontSize: "14px", fontWeight: "700", color: P.pri }}>{s.name}</div></div>))}</div></div>)}
            <div style={SEC({ marginTop: "16px" })}>Get in Touch</div>
            <div className="g2">{[{ i: "📧", l: "Email", v: cfg.contactEmail, href: `mailto:${cfg.contactEmail}` }, { i: "📍", l: "Location", v: cfg.contactLocation }, { i: "💬", l: "WhatsApp Group", v: "Join our community chat", href: WHATSAPP }, { i: "📘", l: "Facebook", v: "MurdochUniMSA", href: FB }].map(c => (<div key={c.l} className="card" style={{ marginBottom: 0 }}><a href={c.href || "#"} target={c.href ? "_blank" : ""} rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "14px", textDecoration: "none", color: "inherit" }}><div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${P.pri}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{c.i}</div><div><div style={LBL}>{c.l}</div><div style={{ fontSize: "14px", fontWeight: "600", color: P.pri }}>{c.v}</div></div></a></div>))}</div>
            <div style={{ display: "grid", gridTemplateColumns: sm ? "repeat(6,1fr)" : "repeat(3,1fr)", gap: "8px", marginTop: "16px" }}>{cfg.services.map((s, i) => <div key={i} className="card" style={{ textAlign: "center", padding: "16px 8px" }}><div style={{ fontSize: "11px", fontWeight: "700", color: P.pri }}>{s}</div></div>)}</div>
            <div style={{ textAlign: "center", marginTop: "24px", padding: "24px" }}><SocialIcons color={P.pri} size={20} /><div style={{ fontSize: "15px", color: P.acc, fontStyle: "italic", marginTop: "16px" }}>"{cfg.quoteText}"</div><div style={{ fontSize: "11px", color: P.mut, marginTop: "6px" }}>— {cfg.quoteSource}</div></div>
          </>)}
        </div>
        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px", borderTop: `1px solid ${P.bor}`, marginTop: "20px" }}>
          <div style={{ fontSize: "12px", color: P.mut }}>Made with <span style={{ color: "#e25555" }}>❤️</span> by <a href="mailto:aahmad607@gmail.com" style={{ color: P.acc, textDecoration: "none", fontWeight: "600" }}>Drhorseman</a></div>
          <div style={{ fontSize: "10px", color: P.mut, marginTop: "4px", letterSpacing: "1px" }}>© 2026 MUMSA · Murdoch University</div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {!md && (<div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${P.bor}`, display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom,10px)", zIndex: 100, boxShadow: "0 -2px 16px rgba(0,0,0,.06)" }}>{navItems.map(n => (<button key={n.id} onClick={() => nav(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "6px 8px", cursor: "pointer", color: pg === n.id ? P.pri : P.mut, fontSize: "9px", fontWeight: pg === n.id ? "700" : "500", border: "none", background: "none" }}><span style={{ fontSize: "17px" }}>{n.icon}</span><span>{n.l}</span>{pg === n.id && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: P.acc }} />}</button>))}</div>)}
    </div>
  );
}


/* ═══ Camera QR Scanner ═══ */
function CameraScanner({ onScan, active }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [camErr, setCamErr] = useState(null);
  const [ready, setReady] = useState(false);
  const lastScan = useRef("");

  useEffect(() => {
    if (!active) { stopCam(); return; }
    startCam();
    return () => stopCam();
  }, [active]);

  const stopCam = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setReady(false);
  };

  const startCam = async () => {
    setCamErr(null); setReady(false); lastScan.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setReady(true);
      // Load jsQR if needed
      if (typeof BarcodeDetector === "undefined" && !window.jsQR) {
        try {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
          document.head.appendChild(s);
          await new Promise((res, rej) => { s.onload = res; s.onerror = rej; setTimeout(rej, 5000); });
        } catch { /* jsQR failed to load, BarcodeDetector will be tried */ }
      }
      // Start scanning every 300ms
      intervalRef.current = setInterval(() => scanFrame(), 300);
    } catch (e) {
      setCamErr(e.name === "NotAllowedError" ? "Camera blocked — tap the lock icon in your browser's address bar to allow camera access." : "Camera error: " + e.message);
    }
  };

  const scanFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    let result = null;
    try {
      // Try BarcodeDetector first (Chrome 83+, Safari 15.4+)
      if (typeof BarcodeDetector !== "undefined") {
        const det = new BarcodeDetector({ formats: ["qr_code"] });
        const codes = await det.detect(canvas);
        if (codes.length > 0) result = codes[0].rawValue;
      }
    } catch { /* BarcodeDetector failed */ }

    // Fallback to jsQR
    if (!result && window.jsQR) {
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
        if (code) result = code.data;
      } catch { /* jsQR failed */ }
    }

    if (result && result.trim().startsWith("MUMSA-") && result.trim() !== lastScan.current) {
      lastScan.current = result.trim();
      stopCam();
      onScan(result.trim());
    }
  };

  if (camErr) return (<div style={{ padding: "20px", background: "#450a0a", borderRadius: "12px", color: "#f87171", fontSize: "13px", textAlign: "center", lineHeight: 1.6 }}>{camErr}</div>);

  return (
    <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block", minHeight: "240px", objectFit: "cover" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "180px", height: "180px", border: "3px solid #d4a84380", borderRadius: "16px", boxShadow: "0 0 0 9999px rgba(0,0,0,.4)" }} />
      </div>
      <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
        <span style={{ background: "#000a", color: "#fff", fontSize: "11px", padding: "4px 12px", borderRadius: "8px" }}>{ready ? "📷 Scanning... point at QR" : "Starting camera..."}</span>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════ */
/* ADMIN PANEL — Manual Save (no autosave)                */
/* ═══════════════════════════════════════════════════════ */
function AdminApp({ now, regs, setRegs, cfg, setCfgState, scr, strikes, setStrikes, onLogout }) {
  const [tab, setTab] = useState("scan");
  const [scanIn, setScanIn] = useState("");
  const [scanRes, setScanRes] = useState(null);
  const [scanMode, setScanMode] = useState("manual"); // "manual" or "camera"
  const [filter, setFilter] = useState("all");
  const [mf, setMf] = useState({ name: "", email: "", phone: "", type: "student" });
  const { sm, md, lg } = scr;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // Two-click confirm button (replaces blocked confirm() dialogs)
  const ConfirmBtn = ({ id, label, confirmLabel, onConfirm, style: btnStyle }) => {
    const active = confirmId === id;
    return active ? (
      <span style={{ display: "inline-flex", gap: "4px" }}>
        <button onClick={() => { onConfirm(); setConfirmId(null); }} style={{ ...btnStyle, background: "#dc2626", color: "#fff", fontWeight: "700" }}>{confirmLabel || "Yes!"}</button>
        <button onClick={() => setConfirmId(null)} style={{ ...btnStyle, background: "#333", color: "#aaa" }}>✕</button>
      </span>
    ) : (
      <button onClick={() => setConfirmId(id)} style={btnStyle}>{label}</button>
    );
  };

  // DRAFT: local working copy of config — only saved to Firebase on "Save"
  const [draft, setDraft] = useState(() => deepClone(cfg));
  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg);

  // Sync draft when Firebase config updates (e.g. from another admin)
  useEffect(() => { if (!dirty) setDraft(deepClone(cfg)); }, [cfg]);

  const doSave = async () => {
    setSaving(true);
    const ok = await saveConfig(draft);
    setSaving(false);
    if (ok) {
      setCfgState(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else { showToast("Save failed! Check Firebase.", "err"); }
  };

  const dk = { cd: "#1a1d26", br: "#2a2d36" };
  const DI = { ...INP, background: "#252830", border: "1.5px solid #3a3d46", color: "#fff" };
  const DL = { ...LBL, color: "#888" };
  const DC = { background: dk.cd, borderRadius: "12px", padding: md ? "22px" : "18px", marginBottom: "12px", border: `1px solid ${dk.br}` };
  const DS = { fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: "#888", marginBottom: "10px", marginTop: "20px" };
  const DB = (c, s) => ({ background: c, border: "none", color: c === P.acc ? "#000" : "#fff", borderRadius: "8px", padding: s ? "8px 14px" : "12px 20px", fontSize: s ? "11px" : "13px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui", width: s ? "auto" : "100%" });

  const today = now.toDateString();
  const todayR = regs.filter(r => r.date === today);
  const totS = regs.filter(r => r.used).length;
  const filtered = regs.filter(r => filter === "today" ? r.date === today : filter === "pending" ? !r.used : filter === "scanned" ? r.used : true);
  const scanTodayKey = localDateKey(now); // "2026-02-22"

  // Fix #3: Scanner validates QR is for TODAY's iftar
  const validateScan = (reg) => {
    if (!reg) return { ok: false, msg: "QR code not found in system.", icon: "❌" };
    if (reg.used) return { ok: false, msg: `Already scanned! ${reg.name}`, icon: "⚠️" };
    const regKey = getIftarKey(reg);
    if (regKey && regKey !== scanTodayKey) return { ok: false, msg: `Wrong date! This pass is for ${reg.iftarDate || regKey}, not today.`, sub: reg.name, icon: "📅" };
    return { ok: true };
  };

  const normalizeCode = (c) => { try { c = decodeURIComponent(c); } catch(e) {} return c.trim().replace(/\s+/g, ""); };

  const doScan = () => {
    if (!scanIn.trim()) return;
    const code = normalizeCode(scanIn);
    const reg = regs.find(r => r.id === code) || regs.find(r => normalizeCode(r.id) === code) || regs.find(r => code.includes(r.id) || r.id.includes(code));
    const v = validateScan(reg);
    if (!v.ok) { setScanRes(v); }
    else { setRegs(regs.map(r => r.id === reg.id ? { ...r, used: true, scannedAt: now.toLocaleTimeString() } : r)); setScanRes({ ok: true, msg: `Welcome ${reg.name}!`, sub: `${reg.studentId} · ${reg.type}`, icon: "✅" }); }
    setScanIn("");
    setTimeout(() => setScanRes(null), 5000);
  };

  const handleCamScan = (code) => {
    const clean = normalizeCode(code);
    const reg = regs.find(r => r.id === clean) || regs.find(r => normalizeCode(r.id) === clean) || regs.find(r => clean.includes(r.id) || r.id.includes(clean));
    const v = validateScan(reg);
    if (!v.ok) { setScanRes(v); }
    else { setRegs(regs.map(r => r.id === reg.id ? { ...r, used: true, scannedAt: now.toLocaleTimeString() } : r)); setScanRes({ ok: true, msg: `Welcome ${reg.name}!`, sub: `${reg.studentId} · ${reg.type}`, icon: "✅" }); }
    setScanMode("manual");
    setTimeout(() => setScanRes(null), 5000);
  };

  const addReg = () => {
    if (!mf.name.trim()) return showToast("Name required.", "err");
    const ts = Date.now().toString(36).toUpperCase();
    let shortId, email = "", phone = "";
    if (mf.type === "guest") {
      if (!mf.phone.trim() || mf.phone.replace(/\D/g, "").length < 8) return showToast("Phone required for guests.", "err");
      phone = mf.phone.replace(/\D/g, "");
      shortId = `G${Date.now().toString().slice(-8)}`;
    } else {
      if (!/^\d{8}$/.test(mf.email)) return showToast("Student ID must be 8 digits.", "err");
      shortId = mf.email;
      email = `${mf.email}@student.murdoch.edu.au`;
    }
    const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1);
    const tmrKey = localDateKey(tmr);
    setRegs(p => [...p, { id: `MUMSA-${shortId}-${ts}`, name: mf.name, studentId: shortId, type: mf.type, email, phone, date: now.toDateString(), iftarDate: tmr.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), iftarDateKey: tmrKey, time: now.toLocaleTimeString(), used: false }]);
    setMf({ name: "", email: "", phone: "", type: "student" }); showToast("Registration added!", "ok");
  };

  // Draft update helpers
  const u = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  const uP = (k, v) => setDraft(p => ({ ...p, prayerTimes: { ...p.prayerTimes, [k]: v } }));
  const uT = (k, v) => setDraft(p => ({ ...p, taraweeh: { ...p.taraweeh, [k]: v } }));
  const uD = (k, v) => setDraft(p => ({ ...p, donation: { ...p.donation, [k]: v } }));

  const tabs = [
    { id: "scan", l: "🔍 Scanner" }, { id: "regs", l: "📋 Regs" }, { id: "stats", l: "📊 Stats" }, { id: "add", l: "➕ Add" },
    { id: "strikes", l: "🚫 Strikes" },
    { id: "prayer", l: "🕌 Prayer" }, { id: "content", l: "📝 Content" },
    { id: "sponsors", l: "🏪 Sponsors" }, { id: "donate", l: "💝 Donate" },
    { id: "settings", l: "⚙️ Settings" },
  ];

  // Save bar component
  const SaveBar = () => dirty ? (
    <div style={{ position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#1a1d26", borderTop: `2px solid ${P.acc}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: P.acc, animation: "pulse 1.5s infinite" }} />
        <span style={{ color: P.acc, fontSize: "13px", fontWeight: "600" }}>Unsaved changes</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => setDraft(deepClone(cfg))} style={{ padding: "10px 20px", borderRadius: "8px", border: `1px solid ${dk.br}`, background: "transparent", color: "#888", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Discard</button>
        <button onClick={doSave} disabled={saving} style={{ padding: "10px 28px", borderRadius: "8px", border: "none", background: P.acc, color: "#000", fontSize: "13px", fontWeight: "700", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "💾 Save Changes"}</button>
      </div>
    </div>
  ) : saved ? (
    <div style={{ position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#052e16", borderTop: `2px solid ${P.ok}`, padding: "12px 20px", textAlign: "center" }}>
      <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: "600" }}>✓ Saved successfully!</span>
    </div>
  ) : null;

  return (
    <div style={{ background: "#111318", minHeight: "100vh", color: "#e8e8e8", fontFamily: "system-ui", display: md ? "flex" : "block" }}>
      <style>{CSS}{` body{background:#0a0b0f!important}`}</style>
      {toast && (<div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: toast.type === "ok" ? "#052e16" : toast.type === "err" ? "#450a0a" : "#1a1d26", border: `2px solid ${toast.type === "ok" ? P.ok : toast.type === "err" ? P.err : P.acc}`, color: toast.type === "ok" ? "#4ade80" : toast.type === "err" ? "#f87171" : P.acc, padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: "600", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>{toast.msg}</div>)}

      {/* Sidebar */}
      {md && (<div style={{ width: lg ? "210px" : "68px", background: "#0d0f14", minHeight: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${dk.br}`, flexShrink: 0 }}>
        <div style={{ padding: lg ? "22px 18px" : "14px 0", borderBottom: `1px solid ${dk.br}`, textAlign: lg ? "left" : "center" }}>{lg ? <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><LogoImg size={32} /><div><div style={{ fontSize: "15px", fontWeight: "700", color: "#fff", letterSpacing: "1px" }}>MUMSA</div><div style={{ fontSize: "9px", color: "#666", marginTop: "2px" }}>Admin Panel</div></div></div> : <LogoImg size={28} />}</div>
        <div style={{ flex: 1, padding: lg ? "12px 8px" : "10px 4px", overflowY: "auto" }}>{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: lg ? "flex-start" : "center", width: "100%", padding: lg ? "11px 14px" : "11px 8px", borderRadius: "8px", border: "none", cursor: "pointer", marginBottom: "3px", background: tab === t.id ? `${P.acc}15` : "transparent", color: tab === t.id ? P.acc : "#888", fontSize: lg ? "13px" : "17px", fontWeight: tab === t.id ? "700" : "500", textAlign: "left" }}>{lg ? t.l : t.l.split(" ")[0]}</button>))}</div>
        <div style={{ padding: lg ? "14px 16px" : "10px 4px", borderTop: `1px solid ${dk.br}`, display: "flex", flexDirection: lg ? "row" : "column", gap: "6px" }}><a href="#" style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "#ffffff08", border: "1px solid #ffffff10", color: "#888", fontSize: "10px", textAlign: "center", textDecoration: "none", fontWeight: "600" }}>Site</a><button onClick={onLogout} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "#ffffff08", border: "1px solid #ffffff10", color: "#888", fontSize: "10px", cursor: "pointer", fontWeight: "600" }}>Lock</button></div>
      </div>)}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile Header */}
        {!md && (<div style={{ background: "linear-gradient(135deg,#1a1d26,#252830)", padding: "18px 20px", borderBottom: `1px solid ${dk.br}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><LogoImg size={28} /><h1 style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "2px", color: "#fff" }}>ADMIN</h1>{dirty && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: P.acc }} />}</div><div style={{ display: "flex", gap: "6px" }}><a href="#" style={{ background: "#fff1", border: "1px solid #fff2", color: "#aaa", padding: "6px 10px", borderRadius: "6px", fontSize: "10px", textDecoration: "none", fontWeight: "600" }}>Site</a><button onClick={onLogout} style={{ background: "#fff1", border: "1px solid #fff2", color: "#aaa", padding: "6px 10px", borderRadius: "6px", fontSize: "10px", cursor: "pointer", fontWeight: "600" }}>Lock</button></div></div></div>)}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: md ? "12px" : "6px", padding: md ? "24px 28px" : "14px 16px" }}>{[{ l: "Today", v: todayR.length, c: "#60a5fa" }, { l: "Scanned", v: todayR.filter(r => r.used).length, c: "#34d399" }, { l: "Total", v: regs.length, c: P.acc }, { l: "Used", v: totS, c: "#a78bfa" }].map(s => (<div key={s.l} style={{ background: dk.cd, borderRadius: "12px", padding: md ? "18px" : "10px 8px", textAlign: "center", border: `1px solid ${dk.br}` }}><div style={{ fontSize: md ? "28px" : "20px", fontWeight: "700", color: s.c }}>{s.v}</div><div style={{ fontSize: md ? "10px" : "8px", color: "#888", letterSpacing: "1px", textTransform: "uppercase", marginTop: "4px" }}>{s.l}</div></div>))}</div>

        {/* Mobile Tab Bar */}
        {!md && (<div style={{ display: "flex", padding: "0 16px", gap: "4px", marginBottom: "14px", overflowX: "auto" }}>{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 12px", borderRadius: "8px", border: tab === t.id ? `2px solid ${P.acc}` : `1px solid ${dk.br}`, background: tab === t.id ? `${P.acc}15` : dk.cd, color: tab === t.id ? P.acc : "#888", fontWeight: "700", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t.l}</button>))}</div>)}

        {md && <div style={{ padding: "0 28px 8px", fontSize: "18px", fontWeight: "700", color: "#fff" }}>{tabs.find(t => t.id === tab)?.l}</div>}

        <div style={{ flex: 1, padding: md ? "0 28px 32px" : "0 16px 20px", maxWidth: "1100px", paddingBottom: dirty || saved ? "80px" : md ? "32px" : "20px" }}>

          {/* ── SCANNER ── */}
          {tab === "scan" && (<div className="g2" style={{ alignItems: "start" }}><div>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              <button onClick={() => setScanMode("manual")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `2px solid ${scanMode === "manual" ? P.acc : dk.br}`, background: scanMode === "manual" ? `${P.acc}15` : dk.cd, color: scanMode === "manual" ? P.acc : "#888", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>⌨️ Manual</button>
              <button onClick={() => setScanMode("camera")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `2px solid ${scanMode === "camera" ? "#60a5fa" : dk.br}`, background: scanMode === "camera" ? "#60a5fa15" : dk.cd, color: scanMode === "camera" ? "#60a5fa" : "#888", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>📷 Camera</button>
            </div>
            {scanMode === "camera" ? (
              <div style={DC}><div style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>Scan QR code with camera</div><CameraScanner onScan={handleCamScan} active={scanMode === "camera"} /></div>
            ) : (
              <div style={DC}><div style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>Enter QR code to verify</div><input style={{ ...DI, fontSize: md ? "16px" : "14px" }} placeholder="MUMSA-XXXXXXXX-XXXXX" value={scanIn} onChange={e => setScanIn(e.target.value)} onKeyDown={e => e.key === "Enter" && doScan()} /><button onClick={doScan} style={{ ...DB(P.acc), marginTop: "10px" }}>Verify & Mark</button></div>
            )}{scanRes && (<div style={{ ...DC, background: scanRes.ok ? "#052e16" : "#450a0a", border: `2px solid ${scanRes.ok ? P.ok : P.err}`, textAlign: "center" }}><div style={{ fontSize: "40px" }}>{scanRes.icon}</div><div style={{ fontSize: "18px", fontWeight: "700", color: scanRes.ok ? "#4ade80" : "#f87171", marginTop: "8px" }}>{scanRes.ok ? "VERIFIED" : "REJECTED"}</div><div style={{ fontSize: "14px", color: "#ccc", marginTop: "6px" }}>{scanRes.msg}</div>{scanRes.sub && <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{scanRes.sub}</div>}<button onClick={() => { setScanRes(null); setScanMode("camera"); }} style={{ ...DB("#60a5fa"), marginTop: "12px", fontSize: "12px" }}>📷 Scan Next</button></div>)}</div><div><div style={DS}>Today ({todayR.length})</div>{todayR.length === 0 ? <div style={{ ...DC, textAlign: "center", color: "#555" }}>No registrations today.</div> : todayR.map(r => (<div key={r.id} style={{ ...DC, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}><div><div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>{r.name}</div><div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{r.studentId} · {r.type}</div></div><span style={{ ...BDG(r.used ? "green" : "gold"), fontSize: "9px" }}>{r.used ? "✓" : "Pending"}</span></div>))}</div></div>)}

          {/* ── REGISTRATIONS ── */}
          {tab === "regs" && (<>
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>{[{ id: "all", l: `All (${regs.length})` }, { id: "today", l: `Today (${todayR.length})` }, { id: "pending", l: `Pending (${regs.length - totS})` }, { id: "scanned", l: `Scanned (${totS})` }].map(f => (<button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "8px 14px", borderRadius: "8px", border: filter === f.id ? `1px solid ${P.acc}` : `1px solid ${dk.br}`, background: filter === f.id ? `${P.acc}15` : dk.cd, color: filter === f.id ? P.acc : "#888", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>{f.l}</button>))}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}><div style={{ fontSize: "12px", color: "#666" }}>{filtered.length} shown</div>{regs.length > 0 && <ConfirmBtn id="clearAll" label="🗑 Clear All" confirmLabel="🗑 Yes, Delete All!" onConfirm={() => setRegs([])} style={{ ...DB("#450a0a", true), color: "#f87171" }} />}</div>
            {filtered.length === 0 ? (<div style={{ ...DC, textAlign: "center", color: "#555", padding: "28px" }}>Empty.</div>) : sm ? (
              <div style={{ ...DC, padding: 0, overflow: "hidden" }}><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 1fr 90px 90px", padding: "12px 18px", borderBottom: `1px solid ${dk.br}`, fontSize: "10px", fontWeight: "700", color: "#666", letterSpacing: "1px", textTransform: "uppercase" }}><div>Name</div><div>ID</div><div>Type</div><div>Date</div><div>Status</div><div>Actions</div></div><div style={{ maxHeight: "500px", overflowY: "auto" }}>{filtered.map(r => (<div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 1fr 90px 90px", padding: "12px 18px", borderBottom: `1px solid ${dk.br}20`, alignItems: "center" }}><div style={{ fontWeight: "600", color: "#fff" }}>{r.name}{r.email && <div style={{ fontSize: "10px", color: "#666", fontWeight: "400" }}>{r.email}</div>}{r.phone && <div style={{ fontSize: "10px", color: "#666", fontWeight: "400" }}>📱 {r.phone}</div>}</div><div style={{ color: "#888", fontSize: "13px" }}>{r.studentId}</div><div style={{ color: "#888", fontSize: "13px", textTransform: "capitalize" }}>{r.type}</div><div style={{ color: "#888", fontSize: "12px" }}>{r.date}</div><div><span style={{ ...BDG(r.used ? "green" : "gold"), fontSize: "9px" }}>{r.used ? "✓" : "Pending"}</span></div><div style={{ display: "flex", gap: "6px" }}>{!r.used && <button onClick={() => setRegs(regs.map(x => x.id === r.id ? { ...x, used: true } : x))} style={{ ...DB("#15803d", true), fontSize: "10px", padding: "5px 10px" }}>✓</button>}<ConfirmBtn id={`del-${r.id}`} label="🗑" confirmLabel="Sure?" onConfirm={() => setRegs(regs.filter(x => x.id !== r.id))} style={{ ...DB("#450a0a", true), fontSize: "10px", padding: "5px 10px", color: "#f87171" }} /></div></div>))}</div></div>
            ) : (<div style={{ maxHeight: "450px", overflowY: "auto" }}>{filtered.map(r => (<div key={r.id} style={{ ...DC, borderLeft: `3px solid ${r.used ? P.ok : P.acc}`, padding: "12px 16px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontWeight: "700", color: "#fff" }}>{r.name}</div><div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{r.studentId} · {r.type} · {r.date}</div></div><div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}><span style={{ ...BDG(r.used ? "green" : "gold"), fontSize: "9px" }}>{r.used ? "✓" : "Pending"}</span><div style={{ display: "flex", gap: "4px" }}>{!r.used && <button onClick={() => setRegs(regs.map(x => x.id === r.id ? { ...x, used: true } : x))} style={{ ...DB("#15803d", true), fontSize: "9px", padding: "4px 8px" }}>✓</button>}<ConfirmBtn id={`delm-${r.id}`} label="🗑" confirmLabel="Sure?" onConfirm={() => setRegs(regs.filter(x => x.id !== r.id))} style={{ ...DB("#450a0a", true), fontSize: "9px", padding: "4px 8px", color: "#f87171" }} /></div></div></div></div>))}</div>)}
          </>)}

          {/* ── MANUAL ADD ── */}
          {tab === "stats" && (() => {
            // Group registrations by iftar date
            const byDate = {};
            regs.forEach(r => {
              const key = getIftarKey(r) || r.date || "unknown";
              if (!byDate[key]) byDate[key] = { date: key, display: r.iftarDate || key, total: 0, scanned: 0, noshow: 0, students: 0, guests: 0 };
              byDate[key].total++;
              if (r.used) byDate[key].scanned++;
              else byDate[key].noshow++;
              if (r.type === "guest") byDate[key].guests++; else byDate[key].students++;
            });
            const dates = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
            // Repeat offenders — people who registered 2+ times but never showed
            const personMap = {};
            regs.forEach(r => {
              const key = r.email ? r.email.toLowerCase() : r.phone ? `phone:${r.phone}` : r.name.toLowerCase();
              if (!personMap[key]) personMap[key] = { name: r.name, email: r.email, phone: r.phone, type: r.type, total: 0, attended: 0, noshows: 0, dates: [] };
              personMap[key].total++;
              if (r.used) personMap[key].attended++;
              else { personMap[key].noshows++; personMap[key].dates.push(r.iftarDate || getIftarKey(r) || r.date); }
            });
            const offenders = Object.values(personMap).filter(p => p.noshows >= 2).sort((a, b) => b.noshows - a.noshows);
            const totalAll = regs.length; const totalScanned = regs.filter(r => r.used).length; const rate = totalAll > 0 ? Math.round((totalScanned / totalAll) * 100) : 0;
            return (<div>
              <div style={DS}>Overall Stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div style={{ ...DC, textAlign: "center", padding: "16px" }}><div style={{ fontSize: "28px", fontWeight: "800", color: P.acc }}>{totalAll}</div><div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>Total Regs</div></div>
                <div style={{ ...DC, textAlign: "center", padding: "16px" }}><div style={{ fontSize: "28px", fontWeight: "800", color: "#4ade80" }}>{totalScanned}</div><div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>Attended</div></div>
                <div style={{ ...DC, textAlign: "center", padding: "16px" }}><div style={{ fontSize: "28px", fontWeight: "800", color: rate >= 70 ? "#4ade80" : rate >= 50 ? "#f59e0b" : "#ef4444" }}>{rate}%</div><div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>Show-up Rate</div></div>
              </div>
              <div style={DS}>Daily Breakdown</div>
              <div style={{ ...DC, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 70px 70px 60px 60px", padding: "10px 14px", borderBottom: `1px solid ${dk.br}`, fontSize: "9px", fontWeight: "700", color: "#666", letterSpacing: "1px", textTransform: "uppercase" }}><div>Date</div><div style={{ textAlign: "center" }}>Total</div><div style={{ textAlign: "center" }}>Scanned</div><div style={{ textAlign: "center" }}>No-Show</div><div style={{ textAlign: "center" }}>Stud.</div><div style={{ textAlign: "center" }}>Guest</div></div>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>{dates.map(d => {
                  const showRate = d.total > 0 ? Math.round((d.scanned / d.total) * 100) : 0;
                  return (<div key={d.date} style={{ display: "grid", gridTemplateColumns: "2fr 60px 70px 70px 60px 60px", padding: "10px 14px", borderBottom: `1px solid ${dk.br}20`, alignItems: "center" }}>
                    <div><div style={{ fontWeight: "600", color: "#fff", fontSize: "13px" }}>{d.display}</div><div style={{ fontSize: "10px", color: "#666" }}>{d.date}</div></div>
                    <div style={{ textAlign: "center", fontWeight: "700", color: "#ccc" }}>{d.total}</div>
                    <div style={{ textAlign: "center" }}><span style={{ ...BDG("green"), fontSize: "10px" }}>{d.scanned}</span></div>
                    <div style={{ textAlign: "center" }}><span style={{ ...BDG(d.noshow > 0 ? "red" : "green"), fontSize: "10px" }}>{d.noshow}</span></div>
                    <div style={{ textAlign: "center", fontSize: "12px", color: "#888" }}>{d.students}</div>
                    <div style={{ textAlign: "center", fontSize: "12px", color: "#888" }}>{d.guests}</div>
                  </div>);
                })}</div>
              </div>
              <div style={{ ...DS, marginTop: "20px" }}>🚨 Repeat No-Show Offenders ({offenders.length})</div>
              {offenders.length === 0 ? <div style={{ ...DC, textAlign: "center", color: "#888", padding: "20px", fontSize: "13px" }}>No repeat offenders yet — great!</div> :
              <div style={{ ...DC, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 60px 60px 60px", padding: "10px 14px", borderBottom: `1px solid ${dk.br}`, fontSize: "9px", fontWeight: "700", color: "#666", letterSpacing: "1px", textTransform: "uppercase" }}><div>Name</div><div>Contact</div><div style={{ textAlign: "center" }}>Regs</div><div style={{ textAlign: "center" }}>Came</div><div style={{ textAlign: "center" }}>Missed</div></div>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>{offenders.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 60px 60px 60px", padding: "10px 14px", borderBottom: `1px solid ${dk.br}20`, alignItems: "center", background: p.noshows >= 3 ? "#450a0a20" : "transparent" }}>
                    <div style={{ fontWeight: "600", color: "#fff", fontSize: "13px" }}>{p.name}</div>
                    <div style={{ fontSize: "11px", color: "#888", wordBreak: "break-all" }}>{p.email || (p.phone ? `📱 ${p.phone}` : p.type)}</div>
                    <div style={{ textAlign: "center", fontSize: "12px", color: "#ccc" }}>{p.total}</div>
                    <div style={{ textAlign: "center" }}><span style={{ ...BDG("green"), fontSize: "10px" }}>{p.attended}</span></div>
                    <div style={{ textAlign: "center" }}><span style={{ ...BDG("red"), fontSize: "10px" }}>{p.noshows}</span></div>
                  </div>
                ))}</div>
              </div>}
            </div>);
          })()}
          {tab === "add" && (<div className="g2" style={{ alignItems: "start" }}><div><div style={DS}>Manual Add (No Time Limit)</div><div style={DC}><div style={{ marginBottom: "12px" }}><label style={DL}>Name *</label><input style={DI} value={mf.name} onChange={e => setMf({ ...mf, name: e.target.value })} /></div><div style={{ marginBottom: "12px" }}><label style={DL}>Type</label><div style={{ display: "flex", gap: "8px" }}>{["student", "guest"].map(t => (<button key={t} onClick={() => setMf({ ...mf, type: t })} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `2px solid ${mf.type === t ? P.acc : dk.br}`, background: mf.type === t ? `${P.acc}15` : "transparent", color: mf.type === t ? P.acc : "#888", fontWeight: "700", fontSize: "12px", cursor: "pointer", textTransform: "capitalize" }}>{t === "student" ? "Student/Staff" : "Guest"}</button>))}</div></div>{mf.type !== "guest" ? <div style={{ marginBottom: "12px" }}><label style={DL}>Student ID (8 digits) *</label><div style={{ display: "flex", alignItems: "center", gap: "0" }}><input style={{ ...DI, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none", flex: "0 0 100px" }} maxLength={8} value={mf.email} onChange={e => setMf({ ...mf, email: e.target.value.replace(/\D/g, "").slice(0, 8) })} /><div style={{ padding: "10px 8px", background: "#252830", border: `1px solid ${dk.br}`, borderTopRightRadius: "8px", borderBottomRightRadius: "8px", fontSize: "10px", color: "#666", whiteSpace: "nowrap" }}>@student.murdoch.edu.au</div></div></div> : <div style={{ marginBottom: "12px" }}><label style={DL}>Phone *</label><input type="tel" style={DI} value={mf.phone} onChange={e => setMf({ ...mf, phone: e.target.value })} /></div>}<button onClick={addReg} style={DB(P.acc)}>Add Registration</button></div></div><div><div style={DS}>Bulk Actions</div><div style={DC}><ConfirmBtn id="markAllToday" label="✓ Mark All Today Scanned" confirmLabel="✓ Yes, Mark All!" onConfirm={() => setRegs(regs.map(r => r.date === today && !r.used ? { ...r, used: true } : r))} style={{ ...DB("#15803d"), marginBottom: "8px" }} /><ConfirmBtn id="resetAllPending" label="↻ Reset All Pending" confirmLabel="↻ Yes, Reset!" onConfirm={() => setRegs(regs.map(r => ({ ...r, used: false })))} style={DB("#6b21a8")} /><button onClick={() => { let fixed = 0; const patched = regs.map(r => { if (r.iftarDateKey) return r; let key = ""; if (r.iftarDate) { const d = new Date(r.iftarDate + ", " + new Date().getFullYear()); if (!isNaN(d)) key = localDateKey(d); } if (!key && r.date) { const d = new Date(r.date); d.setDate(d.getDate() + 1); key = localDateKey(d); } if (key) { fixed++; return { ...r, iftarDateKey: key }; } return r; }); setRegs(patched); showToast(`🔧 Repaired ${fixed} registrations!`, "ok"); }} style={{ ...DB("#0ea5e9"), marginTop: "8px" }}>🔧 Repair Old Registrations (add missing dates)</button></div></div></div>)}

          {/* ── STRIKES ── */}
          {tab === "strikes" && (() => {
            const noShows = regs.filter(r => getIftarKey(r) === scanTodayKey && !r.used);
            const strikeList = Object.entries(strikes).filter(([, v]) => v.count > 0).sort((a, b) => b[1].count - a[1].count);
            const markNoShows = () => {
              if (noShows.length === 0) return showToast("No unscanned registrations for today.", "info");
              const updated = { ...strikes };
              noShows.forEach(r => {
                const key = r.type === "guest" && r.phone ? `phone:${r.phone}` : r.email ? `email:${r.email.toLowerCase()}` : `id:${r.studentId}`;
                const prev = updated[key] || { count: 0, dates: [], name: r.name };
                const newCount = prev.count + 1;
                const blockDays = getStrikeBlock(newCount);
                const blockedUntil = blockDays > 0 ? localDateKey(new Date(Date.now() + blockDays * 86400000)) : null;
                updated[key] = { count: newCount, dates: [...(prev.dates || []), scanTodayKey], name: r.name, email: r.email || prev.email, blockedUntil };
                // Send strike email to students
                if (r.email) sendStrikeEmail(cfg, r.email, r.name, newCount, blockedUntil);
              });
              setStrikes(updated);
              // Mark them as no-show in regs for tracking
              setRegs(regs.map(r => getIftarKey(r) === scanTodayKey && !r.used ? { ...r, noShow: true } : r));
              showToast(`${noShows.length} no-show${noShows.length > 1 ? "s" : ""} recorded with strikes!`, "ok");
            };
            return (<div className="g2" style={{ alignItems: "start" }}>
              <div>
                <div style={DS}>Mark No-Shows</div>
                <div style={DC}>
                  <div style={{ fontSize: "13px", color: "#888", marginBottom: "12px", lineHeight: 1.5 }}>After iftar is served, mark unscanned registrations as no-shows. This adds a strike to each person who registered but didn't show up.</div>
                  <div style={{ ...DC, background: "#1a1d26", padding: "16px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "28px", fontWeight: "800", color: noShows.length > 0 ? "#f87171" : "#4ade80", textAlign: "center" }}>{noShows.length}</div>
                    <div style={{ fontSize: "12px", color: "#888", textAlign: "center" }}>unscanned for today ({scanTodayKey})</div>
                  </div>
                  {noShows.length > 0 && (<div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "12px" }}>{noShows.map(r => (<div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${dk.br}20`, fontSize: "13px" }}><span style={{ color: "#ccc" }}>{r.name}</span><span style={{ color: "#888" }}>{r.studentId}</span></div>))}</div>)}
                  <ConfirmBtn id="markNoShows" label={`🚫 Mark ${noShows.length} No-Show${noShows.length !== 1 ? "s" : ""}`} confirmLabel="🚫 Yes, Add Strikes!" onConfirm={markNoShows} style={{ ...DB("#dc2626"), opacity: noShows.length > 0 ? 1 : 0.4 }} />
                </div>
                <div style={{ ...DC, background: "#0c1a14", border: "1px solid #15803d40", marginTop: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: "600", marginBottom: "6px" }}>Strike Rules</div>
                  <div style={{ fontSize: "11px", color: "#888", lineHeight: 1.8 }}>
                    1st no-show → ⚠️ Warning<br/>
                    2nd no-show → 🚫 Blocked 3 days<br/>
                    3rd no-show → 🚫 Blocked 7 days<br/>
                    4+ no-shows → 🚫 Blocked 14 days
                  </div>
                </div>
              </div>
              <div>
                <div style={DS}>Strike Records ({strikeList.length})</div>
                {strikeList.length === 0 ? <div style={{ ...DC, textAlign: "center", color: "#555" }}>No strikes recorded yet.</div> : (
                  <div style={{ maxHeight: "500px", overflowY: "auto" }}>{strikeList.map(([key, v]) => {
                    const isBlocked = v.blockedUntil && new Date(v.blockedUntil) > now;
                    return (<div key={key} style={{ ...DC, borderLeft: `3px solid ${isBlocked ? P.err : "#f59e0b"}`, padding: "12px 16px", marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontWeight: "700", color: "#fff", fontSize: "14px" }}>{v.name || key}</div><div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{key} · {v.count} strike{v.count > 1 ? "s" : ""}</div>{isBlocked && <div style={{ fontSize: "10px", color: "#f87171", marginTop: "2px" }}>Blocked until {v.blockedUntil}</div>}</div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button onClick={() => { const u = { ...strikes }; if (u[key].count > 1) { u[key] = { ...u[key], count: u[key].count - 1, blockedUntil: null }; } else { delete u[key]; } setStrikes(u); showToast("Strike reduced.", "ok"); }} style={{ ...DB("#15803d", true), fontSize: "9px", padding: "4px 8px" }}>-1</button>
                          <button onClick={() => { const u = { ...strikes }; delete u[key]; setStrikes(u); showToast("Strikes cleared.", "ok"); }} style={{ ...DB("#450a0a", true), fontSize: "9px", padding: "4px 8px", color: "#f87171" }}>Clear</button>
                        </div>
                      </div>
                      {v.dates && <div style={{ fontSize: "9px", color: "#555", marginTop: "6px" }}>Dates: {v.dates.join(", ")}</div>}
                    </div>);
                  })}</div>
                )}
                {strikeList.length > 0 && <ConfirmBtn id="clearAllStrikes" label="🗑 Clear All Strikes" confirmLabel="🗑 Yes, Clear All!" onConfirm={() => { setStrikes({}); showToast("All strikes cleared.", "ok"); }} style={{ ...DB("#450a0a"), marginTop: "8px", color: "#f87171" }} />}
              </div>
            </div>);
          })()}

          {/* ── PRAYER SETTINGS (uses draft) ── */}
          {tab === "prayer" && (<div className="g2" style={{ alignItems: "start" }}><div><div style={DS}>Prayer Times (Auto-Fetched)</div><div style={DC}><div style={{ marginBottom: "14px" }}><label style={DL}>Calculation Method</label><select style={{ ...DI, cursor: "pointer" }} value={draft.prayerMethod || 3} onChange={e => u("prayerMethod", parseInt(e.target.value))}>{ALADHAN_METHODS.map(m => <option key={m.id} value={m.id}>{m.id} — {m.l}</option>)}</select><div style={{ fontSize: "10px", color: "#666", marginTop: "6px" }}>Method 3 (MWL) is closest to Muslim Pro for Australia. Try method 2 (ISNA) if times don't match.</div></div><button onClick={async () => { showToast("Fetching...", "info"); const t = await fetchPrayerTimes(draft.prayerMethod || 3); if (t) { Object.entries(t).forEach(([k, v]) => uP(k, v)); showToast("Prayer times updated! Hit Save.", "ok"); } else showToast("Fetch failed — check internet.", "err"); }} style={{ ...DB(P.acc), marginBottom: "14px" }}>🔄 Fetch Latest from AlAdhan API</button>{Object.entries(draft.prayerTimes).map(([k, v]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${dk.br}30` }}><label style={{ color: "#ccc", fontSize: "14px", fontWeight: "600" }}>{k}</label><input style={{ ...DI, width: "140px", textAlign: "center" }} value={v} onChange={e => uP(k, e.target.value)} /></div>))}</div><div style={DS}>Jama'at Offset (minutes)</div><div style={DC}><input type="number" style={DI} value={draft.jamatOffset} onChange={e => u("jamatOffset", parseInt(e.target.value) || 0)} /></div></div><div><div style={DS}>Jumu'ah</div><div style={DC}><div style={{ marginBottom: "10px" }}><label style={DL}>Time</label><input style={DI} value={draft.jumaTime} onChange={e => u("jumaTime", e.target.value)} /></div><label style={DL}>Location</label><input style={DI} value={draft.jumaLocation} onChange={e => u("jumaLocation", e.target.value)} /></div><div style={DS}>Taraweeh</div><div style={DC}>{[["time", "Time"], ["rakats", "Rakats"], ["location", "Location"]].map(([k, l]) => (<div key={k} style={{ marginBottom: "10px" }}><label style={DL}>{l}</label><input style={DI} value={draft.taraweeh[k]} onChange={e => uT(k, e.target.value)} /></div>))}<label style={DL}>Note</label><textarea style={{ ...DI, minHeight: "60px" }} value={draft.taraweeh.note} onChange={e => uT("note", e.target.value)} /></div></div></div>)}

          {/* ── CONTENT (uses draft) ── */}
          {tab === "content" && (<>
            <div style={DS}>Announcements</div>
            <div className="g2">{draft.announcements.map((a, i) => (<div key={a.id} style={DC}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><input style={{ ...DI, fontWeight: "700" }} value={a.title} onChange={e => { const n = [...draft.announcements]; n[i] = { ...a, title: e.target.value }; u("announcements", n); }} /><button onClick={() => u("announcements", draft.announcements.filter((_, j) => j !== i))} style={{ ...DB("#450a0a", true), marginLeft: "8px", color: "#f87171", flexShrink: 0 }}>✕</button></div><textarea style={{ ...DI, minHeight: "50px" }} value={a.text} onChange={e => { const n = [...draft.announcements]; n[i] = { ...a, text: e.target.value }; u("announcements", n); }} /><div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>{["gold", "green", "red"].map(c => (<button key={c} onClick={() => { const n = [...draft.announcements]; n[i] = { ...a, color: c }; u("announcements", n); }} style={{ width: "28px", height: "28px", borderRadius: "6px", border: a.color === c ? "2px solid #fff" : `1px solid ${dk.br}`, background: c === "gold" ? P.acc : c === "green" ? P.ok : P.err, cursor: "pointer" }} />))}</div></div>))}</div>
            <button onClick={() => u("announcements", [...draft.announcements, { id: `a${Date.now()}`, title: "New", text: "...", color: "green" }])} style={{ ...DB(P.acc), marginTop: "8px", marginBottom: "16px" }}>+ Announcement</button>

            <div style={DS}>Team (Name, Role, Photo URL)</div>
            <div className="g2">{draft.team.map((m, i) => (<div key={m.id} style={{ ...DC, display: "flex", gap: "12px", alignItems: "flex-start" }}><Avatar name={m.name || "?"} photo={m.photo} size={48} /><div style={{ flex: 1 }}><input style={{ ...DI, marginBottom: "6px", fontWeight: "700" }} placeholder="Name" value={m.name} onChange={e => { const n = [...draft.team]; n[i] = { ...m, name: e.target.value }; u("team", n); }} /><input style={{ ...DI, marginBottom: "6px" }} placeholder="Role" value={m.role} onChange={e => { const n = [...draft.team]; n[i] = { ...m, role: e.target.value }; u("team", n); }} /><input style={DI} placeholder="Photo URL (optional)" value={m.photo || ""} onChange={e => { const n = [...draft.team]; n[i] = { ...m, photo: e.target.value }; u("team", n); }} /></div><button onClick={() => u("team", draft.team.filter((_, j) => j !== i))} style={{ ...DB("#450a0a", true), color: "#f87171" }}>✕</button></div>))}</div>
            <button onClick={() => u("team", [...draft.team, { id: `t${Date.now()}`, name: "", role: "", photo: "" }])} style={{ ...DB(P.acc), marginTop: "8px", marginBottom: "16px" }}>+ Member</button>

            <div style={DS}>About & Misc</div>
            <div className="g2">
              <div style={DC}><label style={DL}>About</label><textarea style={{ ...DI, minHeight: "80px" }} value={draft.aboutText} onChange={e => u("aboutText", e.target.value)} /><label style={{ ...DL, marginTop: "10px" }}>Vision</label><input style={DI} value={draft.vision} onChange={e => u("vision", e.target.value)} /></div>
              <div><div style={DC}><label style={DL}>Quote</label><input style={{ ...DI, marginBottom: "8px" }} value={draft.quoteText} onChange={e => u("quoteText", e.target.value)} /><label style={DL}>Source</label><input style={DI} value={draft.quoteSource} onChange={e => u("quoteSource", e.target.value)} /></div><div style={DC}><label style={DL}>Email</label><input style={{ ...DI, marginBottom: "8px" }} value={draft.contactEmail} onChange={e => u("contactEmail", e.target.value)} /><label style={DL}>Location</label><input style={DI} value={draft.contactLocation} onChange={e => u("contactLocation", e.target.value)} /></div></div>
            </div>
            <div style={DS}>Services (comma-separated)</div>
            <div style={DC}><input style={DI} value={draft.services.join(", ")} onChange={e => u("services", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} /></div>
          </>)}

          {/* ── SPONSORS (uses draft) ── */}
          {tab === "sponsors" && (<>
            <div style={DS}>Sponsors</div>
            {draft.sponsors.map((s, i) => (<div key={s.id} style={{ ...DC, display: "flex", gap: "12px", alignItems: "flex-start" }}><SponsorLogo name={s.name || "?"} logo={s.logo} color={s.color} size={52} /><div style={{ flex: 1 }}><input style={{ ...DI, marginBottom: "6px", fontWeight: "700" }} placeholder="Name" value={s.name} onChange={e => { const n = [...draft.sponsors]; n[i] = { ...s, name: e.target.value }; u("sponsors", n); }} /><input style={{ ...DI, marginBottom: "6px" }} placeholder="Logo URL (optional)" value={s.logo || ""} onChange={e => { const n = [...draft.sponsors]; n[i] = { ...s, logo: e.target.value }; u("sponsors", n); }} /><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><label style={{ ...DL, marginBottom: 0, marginRight: "8px" }}>Color:</label>{["#c0392b", "#e67e22", "#8e44ad", "#2980b9", "#27ae60", "#f39c12", "#2c3e50"].map(c => (<button key={c} onClick={() => { const n = [...draft.sponsors]; n[i] = { ...s, color: c }; u("sponsors", n); }} style={{ width: "24px", height: "24px", borderRadius: "6px", border: s.color === c ? "2px solid #fff" : `1px solid ${dk.br}`, background: c, cursor: "pointer" }} />))}</div></div><button onClick={() => u("sponsors", draft.sponsors.filter((_, j) => j !== i))} style={{ ...DB("#450a0a", true), color: "#f87171" }}>✕</button></div>))}
            <button onClick={() => u("sponsors", [...draft.sponsors, { id: `s${Date.now()}`, name: "", logo: "", color: "#27ae60" }])} style={{ ...DB(P.acc), marginTop: "8px" }}>+ Sponsor</button>
          </>)}

          {/* ── DONATION (uses draft) ── */}
          {tab === "donate" && (<>
            <div style={DS}>Donation Page Settings</div>
            <div style={DC}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <label style={{ ...DL, marginBottom: 0 }}>Enabled</label>
                <button onClick={() => uD("enabled", !draft.donation.enabled)} style={{ padding: "8px 18px", borderRadius: "8px", border: `1px solid ${draft.donation.enabled ? P.ok : dk.br}`, background: draft.donation.enabled ? "#15803d20" : dk.cd, color: draft.donation.enabled ? "#4ade80" : "#888", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>{draft.donation.enabled ? "✓ ON" : "OFF"}</button>
              </div>
              <div style={{ marginBottom: "10px" }}><label style={DL}>Title</label><input style={DI} value={draft.donation.title} onChange={e => uD("title", e.target.value)} /></div>
              <div style={{ marginBottom: "10px" }}><label style={DL}>Description</label><textarea style={{ ...DI, minHeight: "70px" }} value={draft.donation.description} onChange={e => uD("description", e.target.value)} /></div>
            </div>
            <div style={DS}>Bank Details</div>
            <div style={DC}>
              {[["bankName", "Bank Name"], ["accountName", "Account Name"], ["bsb", "BSB"], ["accountNumber", "Account Number"], ["reference", "Reference"]].map(([k, l]) => (
                <div key={k} style={{ marginBottom: "10px" }}><label style={DL}>{l}</label><input style={DI} value={draft.donation[k]} onChange={e => uD(k, e.target.value)} /></div>
              ))}
              <div style={{ marginBottom: "0" }}><label style={DL}>Extra Note</label><textarea style={{ ...DI, minHeight: "60px" }} value={draft.donation.extraNote} onChange={e => uD("extraNote", e.target.value)} /></div>
            </div>
          </>)}

          {/* ── SETTINGS (uses draft) ── */}
          {tab === "settings" && (<div className="g2" style={{ alignItems: "start" }}><div><div style={DS}>Registration Window</div><div style={DC}><div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}><div style={{ flex: 1 }}><label style={DL}>Opens (0-23)</label><input type="number" min="0" max="23" style={DI} value={draft.regStartHour} onChange={e => u("regStartHour", parseInt(e.target.value) || 0)} /></div><div style={{ flex: 1 }}><label style={DL}>Closes (0-23)</label><input type="number" min="0" max="23" style={DI} value={draft.regEndHour} onChange={e => u("regEndHour", parseInt(e.target.value) || 0)} /></div></div><div style={{ fontSize: "12px", color: "#888", marginBottom: "14px" }}>{fH(draft.regStartHour)} – {fH(draft.regEndHour)}</div><div style={{ display: "flex", gap: "8px" }}><button onClick={() => u("regForceOpen", !draft.regForceOpen)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${draft.regForceOpen ? P.ok : dk.br}`, background: draft.regForceOpen ? "#15803d20" : dk.cd, color: draft.regForceOpen ? "#4ade80" : "#888", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}>{draft.regForceOpen ? "✓ FORCED OPEN" : "Force Open"}</button><button onClick={() => u("regForceClosed", !draft.regForceClosed)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${draft.regForceClosed ? P.err : dk.br}`, background: draft.regForceClosed ? "#b91c1c20" : dk.cd, color: draft.regForceClosed ? "#f87171" : "#888", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}>{draft.regForceClosed ? "✓ CLOSED" : "Force Close"}</button></div></div><div style={DS}>Admin PIN</div><div style={DC}><label style={DL}>Current: {draft.adminPin}</label><input style={DI} placeholder="New PIN (min 4)" maxLength={8} onChange={e => { if (e.target.value.length >= 4) u("adminPin", e.target.value); }} /></div>
            <div style={DS}>📧 EmailJS (QR & Strike Emails)</div><div style={DC}><div style={{ fontSize: "11px", color: "#888", marginBottom: "12px", lineHeight: 1.5 }}>Free: 200 emails/month. <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color: P.acc }}>Setup guide →</a></div><div style={{ marginBottom: "10px" }}><label style={DL}>Service ID</label><input style={DI} placeholder="service_xxxxxxx" value={draft.emailjs?.serviceId || ""} onChange={e => u("emailjs", { ...draft.emailjs, serviceId: e.target.value })} /></div><div style={{ marginBottom: "10px" }}><label style={DL}>QR Template ID</label><input style={DI} placeholder="template_xxxxxxx" value={draft.emailjs?.templateId || ""} onChange={e => u("emailjs", { ...draft.emailjs, templateId: e.target.value })} /></div><div style={{ marginBottom: "10px" }}><label style={DL}>Strike Template ID (optional)</label><input style={DI} placeholder="template_xxxxxxx (uses QR template if empty)" value={draft.emailjs?.strikeTemplateId || ""} onChange={e => u("emailjs", { ...draft.emailjs, strikeTemplateId: e.target.value })} /></div><div style={{ marginBottom: "10px" }}><label style={DL}>Public Key</label><input style={DI} placeholder="xxxxxxxxxxxxxx" value={draft.emailjs?.publicKey || ""} onChange={e => u("emailjs", { ...draft.emailjs, publicKey: e.target.value })} /></div></div>
            <div style={DS}>Danger Zone</div><div style={{ ...DC, border: `1px solid ${P.err}30` }}><ConfirmBtn id="resetSettings" label="↻ Reset Settings (to draft)" confirmLabel="↻ Yes, Reset!" onConfirm={() => setDraft(deepClone(DEF))} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#450a0a", border: `1px solid ${P.err}30`, color: "#f87171", fontWeight: "600", cursor: "pointer", marginBottom: "8px" }} /><ConfirmBtn id="factoryReset" label="☠ Factory Reset" confirmLabel="☠ YES, DELETE EVERYTHING!" onConfirm={async () => { await factoryReset(DEF); setCfgState(DEF); setDraft(deepClone(DEF)); setRegs([]); }} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#450a0a", border: `1px solid ${P.err}30`, color: "#f87171", fontWeight: "600", cursor: "pointer" }} /></div></div>
            <div><div style={DS}>Iftar Schedule (Feb 20 – Mar 20)</div><div style={DC}><div style={{ maxHeight: md ? "500px" : "300px", overflowY: "auto" }}><div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", fontSize: "10px", fontWeight: "700", color: "#666", padding: "8px 6px", borderBottom: `1px solid ${dk.br}`, position: "sticky", top: 0, background: dk.cd }}><div>Day</div><div>Date</div><div>Sehri</div><div>Iftar</div></div>{draft.iftarSchedule.map((d, i) => (<div key={d.day} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "4px 3px", borderBottom: `1px solid ${dk.br}20`, gap: "4px" }}><div style={{ fontSize: "12px", fontWeight: "700", color: P.acc, padding: "8px 4px" }}>{d.day}</div><input style={{ ...DI, padding: "6px", fontSize: "11px" }} value={d.date} onChange={e => { const n = [...draft.iftarSchedule]; n[i] = { ...d, date: e.target.value }; u("iftarSchedule", n); }} /><input style={{ ...DI, padding: "6px", fontSize: "11px" }} value={d.sehri} onChange={e => { const n = [...draft.iftarSchedule]; n[i] = { ...d, sehri: e.target.value }; u("iftarSchedule", n); }} /><input style={{ ...DI, padding: "6px", fontSize: "11px" }} value={d.iftar} onChange={e => { const n = [...draft.iftarSchedule]; n[i] = { ...d, iftar: e.target.value }; u("iftarSchedule", n); }} /></div>))}</div></div></div>
          </div>)}

        </div>

        {/* STICKY SAVE BAR */}
        <SaveBar />
      </div>
    </div>
  );
}
