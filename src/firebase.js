// ═══════════════════════════════════════════════════════════
// MUMSA Firebase — Manual Save Only (no autosave)
// ═══════════════════════════════════════════════════════════
// SETUP:
// 1. https://console.firebase.google.com → Create project
// 2. Project Settings → Add Web App → Copy config below
// 3. Firestore Database → Create → Start in TEST mode
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, writeBatch,
} from "firebase/firestore";

// ╔═══════════════════════════════════════════╗
// ║  PASTE YOUR FIREBASE CONFIG BELOW         ║
// ╚═══════════════════════════════════════════╝
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
// ╔═══════════════════════════════════════════╗
// ║  DO NOT EDIT BELOW THIS LINE              ║
// ╚═══════════════════════════════════════════╝

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const DOCS = {
  config: doc(db, "mumsa", "config"),
  registrations: doc(db, "mumsa", "registrations"),
  strikes: doc(db, "mumsa", "strikes"),
};

export async function loadConfig() {
  try { const s = await getDoc(DOCS.config); return s.exists() ? s.data() : null; }
  catch (e) { console.error("loadConfig:", e); return null; }
}

export async function loadRegistrations() {
  try { const s = await getDoc(DOCS.registrations); return s.exists() ? (s.data().list || []) : []; }
  catch (e) { console.error("loadRegs:", e); return []; }
}

export async function loadStrikes() {
  try { const s = await getDoc(DOCS.strikes); return s.exists() ? (s.data().data || {}) : {}; }
  catch (e) { console.error("loadStrikes:", e); return {}; }
}

export async function saveConfig(config) {
  try { await setDoc(DOCS.config, config, { merge: false }); return true; }
  catch (e) { console.error("saveConfig:", e); return false; }
}

export async function saveRegistrations(regs) {
  try { await setDoc(DOCS.registrations, { list: regs, updatedAt: new Date().toISOString() }); return true; }
  catch (e) { console.error("saveRegs:", e); return false; }
}

export async function saveStrikes(strikes) {
  try { await setDoc(DOCS.strikes, { data: strikes, updatedAt: new Date().toISOString() }); return true; }
  catch (e) { console.error("saveStrikes:", e); return false; }
}

export function onConfigChange(cb) {
  return onSnapshot(DOCS.config, (s) => { if (s.exists()) cb(s.data()); });
}

export function onRegistrationsChange(cb) {
  return onSnapshot(DOCS.registrations, (s) => { if (s.exists()) cb(s.data().list || []); });
}

export function onStrikesChange(cb) {
  return onSnapshot(DOCS.strikes, (s) => { if (s.exists()) cb(s.data().data || {}); });
}

export async function factoryReset(def) {
  const b = writeBatch(db);
  b.set(DOCS.config, def);
  b.set(DOCS.registrations, { list: [], updatedAt: new Date().toISOString() });
  await b.commit();
}

export { db };
