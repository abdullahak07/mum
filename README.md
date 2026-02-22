# MUMSA Web App — Deployment Guide

## Quick Deploy
```bash
npm install
npm run dev     # local dev
```
Push to GitHub → Connect to Vercel → Auto-deploys.

## Firebase Setup
1. https://console.firebase.google.com → Create project
2. Project Settings → Add Web App → Copy config to `src/firebase.js`
3. Firestore Database → Create → Start in TEST mode

## Email Setup (Brevo — FREE: 300 emails/day)
QR codes are emailed to students on registration. Strike notifications also sent via email.

### Step 1: Create Brevo Account
1. Go to https://app.brevo.com → Sign up (free, no credit card)
2. Verify your email

### Step 2: Get API Key
1. In Brevo dashboard → SMTP & API → API Keys
2. Click "Generate a new API key"
3. Copy the key

### Step 3: Verify Sender Email
1. In Brevo → Senders & IP → Senders
2. Add your sender email (e.g. mumsa@murdoch.edu.au)
3. Verify it by clicking the link Brevo sends

### Step 4: Set Vercel Environment Variables
In your Vercel dashboard → Project → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `BREVO_API_KEY` | Your Brevo API key |
| `SENDER_EMAIL` | Your verified sender email |
| `SENDER_NAME` | `MUMSA Murdoch` |

### Step 5: Redeploy
Push to GitHub or redeploy from Vercel. Emails will start working.

## Registration Flow
- **Students**: Name + Email → QR emailed + shown on screen
- **Guests**: Name + Phone → QR shown on screen only
- **Duplicates**: One registration per email/phone per day
- **Strikes**: No-shows tracked, repeat offenders blocked

## Admin Access
Navigate to `/#admin` → Enter PIN 
