// ═══════════════════════════════════════════════════════════
// Vercel Serverless — Email via Brevo (Sendinblue)
// FREE: 300 emails/day (9000/month)
// ═══════════════════════════════════════════════════════════
// SETUP:
// 1. Go to https://app.brevo.com → Sign up (free)
// 2. SMTP & API → API Keys → Generate new key
// 3. In Vercel dashboard → Settings → Environment Variables
//    Add: BREVO_API_KEY = your-key-here
//    Add: SENDER_EMAIL = mumsa@murdoch.edu.au (or your verified sender)
//    Add: SENDER_NAME = MUMSA Murdoch
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

  const senderEmail = process.env.SENDER_EMAIL || "noreply@mumsa.org";
  const senderName = process.env.SENDER_NAME || "MUMSA Murdoch";

  const { type, to_email, to_name, ...params } = req.body;
  if (!to_email) return res.status(400).json({ error: "to_email required" });

  let subject, html;

  if (type === "qr") {
    // ── QR Code Registration Email ──
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(params.qr_code)}&size=300x300&margin=10`;
    subject = `🍽️ Your Iftar Pass — ${params.iftar_date}`;
    html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #fafaf9; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1a3a2a, #2d5a3d); padding: 32px; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">🌙</div>
          <h1 style="color: #fff; font-size: 22px; margin: 0 0 4px;">Your Iftar Pass</h1>
          <p style="color: #a7c4b5; font-size: 14px; margin: 0;">MUMSA — Murdoch University</p>
        </div>
        <div style="padding: 32px; text-align: center;">
          <p style="font-size: 16px; color: #333; margin: 0 0 4px;">Assalamu Alaikum <strong>${to_name}</strong>,</p>
          <p style="font-size: 14px; color: #666; margin: 0 0 20px;">Your iftar registration is confirmed!</p>
          <div style="background: #fff; border-radius: 16px; padding: 24px; border: 2px solid #e8e8e8; display: inline-block;">
            <img src="${qrUrl}" alt="QR Code" style="width: 250px; height: 250px; display: block;" />
          </div>
          <div style="margin-top: 20px; background: #f0fdf4; border-radius: 12px; padding: 16px; border: 1px solid #bbf7d0;">
            <p style="font-size: 15px; font-weight: 700; color: #166534; margin: 0 0 6px;">📅 ${params.iftar_date}</p>
            <p style="font-size: 13px; color: #4ade80; margin: 0;">Iftar served after Maghrib prayer</p>
          </div>
          <p style="font-size: 11px; color: #999; margin: 20px 0 0; line-height: 1.6;">
            Show this QR code at the venue. Your pass is only valid on the date shown above.<br/>
            <strong style="color: #dc2626;">⚠️ No-shows will receive strikes and may be blocked from future registrations.</strong><br/>
            📌 <em>If this email landed in spam, please mark it as "Not Spam" so future emails arrive in your inbox.</em>
          </p>
          <div style="margin-top: 16px; padding: 10px; background: #f5f5f5; border-radius: 8px; font-family: monospace; font-size: 9px; color: #999; word-break: break-all;">${params.qr_code}</div>
        </div>
      </div>`;
  } else if (type === "strike") {
    // ── Strike Notification Email ──
    subject = `⚠️ MUMSA Iftar No-Show — Strike ${params.strike_count}`;
    html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #fafaf9; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7f1d1d, #b91c1c); padding: 32px; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">⚠️</div>
          <h1 style="color: #fff; font-size: 22px; margin: 0 0 4px;">No-Show Recorded</h1>
          <p style="color: #fca5a5; font-size: 14px; margin: 0;">MUMSA Iftar — Murdoch University</p>
        </div>
        <div style="padding: 32px; text-align: center;">
          <p style="font-size: 16px; color: #333; margin: 0 0 16px;">Assalamu Alaikum <strong>${to_name}</strong>,</p>
          <div style="background: #fef2f2; border-radius: 12px; padding: 20px; border: 1px solid #fecaca; margin-bottom: 16px;">
            <p style="font-size: 32px; font-weight: 800; color: #dc2626; margin: 0;">${params.strike_count}</p>
            <p style="font-size: 14px; color: #991b1b; margin: 4px 0 0;">No-Show Strike${params.strike_count > 1 ? "s" : ""}</p>
          </div>
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 16px;">
            You registered for today's iftar but did not attend. This wastes food and takes a spot from others.
          </p>
          ${params.blocked_until ? `
          <div style="background: #fee2e2; border-radius: 12px; padding: 16px; border: 1px solid #fca5a5;">
            <p style="font-size: 14px; font-weight: 700; color: #991b1b; margin: 0 0 4px;">🚫 Registration Blocked</p>
            <p style="font-size: 13px; color: #b91c1c; margin: 0;">You are blocked from registering until <strong>${params.blocked_until}</strong>.</p>
          </div>` : `
          <div style="background: #fef3c7; border-radius: 12px; padding: 16px; border: 1px solid #fde68a;">
            <p style="font-size: 13px; color: #92400e; margin: 0;">Next no-show will result in a temporary block from registration.</p>
          </div>`}
          <p style="font-size: 11px; color: #999; margin: 20px 0 0;">If this was an error, please contact MUMSA.</p>
        </div>
      </div>`;
  } else {
    return res.status(400).json({ error: "type must be 'qr' or 'strike'" });
  }

  try {
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to_email, name: to_name || to_email }],
        subject,
        htmlContent: html,
      }),
    });
    const data = await brevoRes.json();
    if (brevoRes.ok) return res.status(200).json({ ok: true, messageId: data.messageId });
    return res.status(brevoRes.status).json({ error: data.message || "Brevo error" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
