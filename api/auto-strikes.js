// ═══════════════════════════════════════════════════════════
// Auto-Strike Cron — Runs daily at 8:00 PM Perth (AWST)
// Marks all unscanned registrations as no-shows and adds strikes
// ═══════════════════════════════════════════════════════════
// Vercel Cron triggers this at 0 12 * * * (12:00 UTC = 8:00 PM AWST)
//
// Required Vercel Environment Variables:
//   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
//   CRON_SECRET (set any random string, must match vercel.json)
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

function getApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  });
}

const STRIKE_BLOCK_DAYS = { 1: 0, 2: 3, 3: 7 }; // 4+ = 14

function getBlockDays(count) {
  return STRIKE_BLOCK_DAYS[count] ?? 14;
}

export default async function handler(req, res) {
  // Security: only allow Vercel Cron or matching secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const app = getApp();
    const db = getFirestore(app);

    // Get today's date key in Perth timezone (AWST = UTC+8)
    const now = new Date();
    const perthTime = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Perth" }));
    const todayKey = perthTime.toISOString().split("T")[0];

    // Load registrations
    const regSnap = await getDoc(doc(db, "mumsa", "registrations"));
    if (!regSnap.exists()) return res.status(200).json({ msg: "No registrations doc", todayKey });
    const regs = regSnap.data().list || [];

    // Find today's unscanned registrations
    const noShows = regs.filter(r => r.iftarDateKey === todayKey && !r.used && !r.noShow);
    if (noShows.length === 0) {
      return res.status(200).json({ msg: "No unscanned registrations for today", todayKey, total: regs.length });
    }

    // Load current strikes
    const strikeSnap = await getDoc(doc(db, "mumsa", "strikes"));
    const strikes = strikeSnap.exists() ? (strikeSnap.data().data || {}) : {};

    // Process no-shows
    const emailsSent = [];
    for (const r of noShows) {
      const key = r.type === "guest" && r.phone
        ? `phone:${r.phone}`
        : r.email
          ? `email:${r.email.toLowerCase()}`
          : `id:${r.studentId}`;

      const prev = strikes[key] || { count: 0, dates: [], name: r.name };
      const newCount = prev.count + 1;
      const blockDays = getBlockDays(newCount);
      const blockedUntil = blockDays > 0
        ? new Date(Date.now() + blockDays * 86400000).toISOString().split("T")[0]
        : null;

      strikes[key] = {
        count: newCount,
        dates: [...(prev.dates || []), todayKey],
        name: r.name,
        email: r.email || prev.email,
        blockedUntil,
      };

      // Send strike email
      if (r.email) {
        try {
          const baseUrl = `https://${req.headers.host}`;
          await fetch(`${baseUrl}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "strike",
              to_email: r.email,
              to_name: r.name,
              strike_count: newCount,
              blocked_until: blockedUntil,
            }),
          });
          emailsSent.push(r.email);
        } catch (e) {
          console.error("Strike email failed:", r.email, e.message);
        }
      }
    }

    // Save updated strikes
    await setDoc(doc(db, "mumsa", "strikes"), { data: strikes, updatedAt: new Date().toISOString() });

    // Mark no-shows in registrations
    const updatedRegs = regs.map(r =>
      r.iftarDateKey === todayKey && !r.used ? { ...r, noShow: true } : r
    );
    await setDoc(doc(db, "mumsa", "registrations"), { list: updatedRegs, updatedAt: new Date().toISOString() });

    return res.status(200).json({
      msg: `Auto-strike complete`,
      todayKey,
      noShows: noShows.length,
      strikesUpdated: Object.keys(strikes).length,
      emailsSent: emailsSent.length,
    });

  } catch (err) {
    console.error("Auto-strike error:", err);
    return res.status(500).json({ error: err.message });
  }
}
