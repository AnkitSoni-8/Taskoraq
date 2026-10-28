import { useEffect, useState } from "react";

// Chosen background is remembered in localStorage and shared by the login page and the app.
const KEY = "taskoraq-bg";
let cur = "classic";
try { cur = localStorage.getItem(KEY) || localStorage.getItem("jira-bg") || "classic"; } catch {} // old key still read
const subs = new Set();
if (typeof document !== "undefined") document.documentElement.dataset.bg = cur;

export function setBg(id) {
  cur = id;
  try { localStorage.setItem(KEY, id); } catch {}
  document.documentElement.dataset.bg = id;
  subs.forEach((f) => f(id));
}
export function useBg() {
  const [v, setV] = useState(cur);
  useEffect(() => { subs.add(setV); return () => subs.delete(setV); }, []);
  return v;
}
