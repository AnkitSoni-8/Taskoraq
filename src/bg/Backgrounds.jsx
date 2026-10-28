import { useEffect, useMemo, useRef, useState } from "react";
import { FaPalette } from "react-icons/fa";
import { setBg, useBg } from "./state.js";

/* ---------- generic canvas runner (one rAF loop per background) ---------- */
function Canvas({ init, frame, blur }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf, w = 0, h = 0, st = {};
    const fit = () => {
      const r = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight; c.width = w * r; c.height = h * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
      st = init ? init(w, h) : {};
    };
    const loop = (t) => { frame(ctx, w, h, t / 1000, st); if (!reduce) raf = requestAnimationFrame(loop); };
    fit(); addEventListener("resize", fit); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", fit); };
  }, []); // eslint-disable-line
  return <canvas ref={ref} className="bgc" style={blur ? { filter: `blur(${blur}px)` } : undefined} />;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const isDark = () => document.documentElement.dataset.theme === "dark";

/* ---------- canvas backgrounds ---------- */
const Stars = () => (
  <Canvas
    init={(w, h) => ({ s: Array.from({ length: Math.round((w * h) / 6500) }, () => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.3, 1.5), p: rnd(0, 6) })), m: [] })}
    frame={(ctx, w, h, t, st) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      for (const s of st.s) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.015) st.m.push({ x: rnd(0, w), y: rnd(0, h * 0.5), v: rnd(9, 15), l: 1 });
      st.m = st.m.filter((m) => m.l > 0 && m.x < w + 200);
      for (const m of st.m) {
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.v * 12, m.y - m.v * 7);
        g.addColorStop(0, `rgba(190,215,255,${m.l})`); g.addColorStop(1, "rgba(190,215,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.v * 12, m.y - m.v * 7); ctx.stroke();
        m.x += m.v; m.y += m.v * 0.58; m.l -= 0.018;
      }
    }}
  />
);

const Sparkles = () => (
  <Canvas
    init={(w, h) => ({ p: Array.from({ length: 110 }, () => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.6, 2.4), vx: rnd(-0.15, 0.15), vy: rnd(-0.35, -0.05), ph: rnd(0, 6) })) })}
    frame={(ctx, w, h, t, st) => {
      ctx.clearRect(0, 0, w, h);
      const col = isDark() ? "255,255,255" : "12,102,228";
      for (const p of st.p) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -5) { p.y = h + 5; p.x = rnd(0, w); }
        ctx.fillStyle = `rgba(${col},${0.15 + 0.85 * Math.abs(Math.sin(t * 1.4 + p.ph))})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
      }
    }}
  />
);

const Vortex = () => (
  <Canvas
    init={(w, h) => ({ p: Array.from({ length: 420 }, () => ({ a: rnd(0, 6.3), r: rnd(10, Math.max(w, h) * 0.6), s: rnd(0.4, 1.4), hue: rnd(210, 290) })) })}
    frame={(ctx, w, h, t, st) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(7,11,18,0.14)"; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const cx = w / 2, cy = h / 2;
      for (const p of st.p) {
        const x0 = cx + Math.cos(p.a) * p.r, y0 = cy + Math.sin(p.a) * p.r * 0.7;
        p.a += (p.s * 0.9) / (p.r * 0.06 + 6); p.r -= 0.25 + p.s * 0.2;
        if (p.r < 6) { p.r = Math.max(w, h) * 0.6; p.a = rnd(0, 6.3); }
        ctx.strokeStyle = `hsla(${p.hue},90%,65%,.55)`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx + Math.cos(p.a) * p.r, cy + Math.sin(p.a) * p.r * 0.7); ctx.stroke();
      }
    }}
  />
);

const WAVES = ["#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"];
const Wavy = () => (
  <Canvas
    blur={6}
    frame={(ctx, w, h, t) => {
      ctx.clearRect(0, 0, w, h);
      WAVES.forEach((c, i) => {
        ctx.beginPath(); ctx.lineWidth = 46; ctx.strokeStyle = c; ctx.globalAlpha = isDark() ? 0.45 : 0.5;
        for (let x = 0; x <= w; x += 8) {
          const y = h * 0.5 + Math.sin(x / 140 + t * 0.7 + i * 0.9) * 70 + Math.sin(x / 70 - t * 0.5 + i) * 28 + (i - 2) * 38;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }}
  />
);

const DotGlow = () => (
  <Canvas
    init={(w, h) => ({ d: Array.from({ length: Math.ceil(w / 24) * Math.ceil(h / 24) }, (_, i) => { const cols = Math.ceil(w / 24); return { x: (i % cols) * 24 + 12, y: Math.floor(i / cols) * 24 + 12, ph: rnd(0, 6), hot: Math.random() < 0.12 }; }) })}
    frame={(ctx, w, h, t, st) => {
      ctx.clearRect(0, 0, w, h);
      const base = isDark() ? "255,255,255" : "70,90,130";
      for (const d of st.d) {
        const k = Math.abs(Math.sin(t * 0.9 + d.ph));
        if (d.hot) { ctx.shadowBlur = 12 * k; ctx.shadowColor = "#6ea8ff"; ctx.fillStyle = `rgba(110,168,255,${0.4 + 0.6 * k})`; }
        else { ctx.shadowBlur = 0; ctx.fillStyle = `rgba(${base},${0.12 + 0.1 * k})`; }
        ctx.beginPath(); ctx.arc(d.x, d.y, d.hot ? 2.2 : 1.4, 0, 6.3); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }}
  />
);

/* ---------- DOM / SVG / CSS backgrounds ---------- */
const Aurora = () => <div className="aurora"><i /><i /><i /></div>;
const Noise = () => <div className="noise-bg"><i /></div>;
const Grid = () => <div className="grid-bg" />;
const Dots = () => <div className="dots-bg" />;
const Lamp = () => <div className="lamp"><i className="l1" /><i className="l2" /><i className="l3" /></div>;
const Spotlight = () => <div className="spotl"><i className="s1" /><i className="s2" /></div>;

function Meteors() {
  const list = useMemo(() => Array.from({ length: 26 }, () => ({ left: rnd(-10, 100), delay: rnd(0, 8), dur: rnd(2.5, 7) })), []);
  return <div className="meteors">{list.map((m, i) => <span key={i} style={{ left: m.left + "%", animationDelay: m.delay + "s", animationDuration: m.dur + "s" }} />)}</div>;
}

function Beams() {
  const paths = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ d: `M${-120 + i * 62} -30C${180 + i * 24} 140 ${640 - i * 18} 330 ${1120 - i * 34} 640`, dur: rnd(7, 14), delay: rnd(-10, 0) })), []);
  return (
    <svg className="beams" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
      <defs>
        {paths.map((p, i) => (
          <linearGradient key={i} id={`bm${i}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="0">
            <stop offset="0" stopColor="#18ccfc" stopOpacity="0" /><stop offset=".4" stopColor="#18ccfc" /><stop offset=".6" stopColor="#6344f5" /><stop offset="1" stopColor="#ae48ff" stopOpacity="0" />
            <animate attributeName="x1" values="0;1000" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
            <animate attributeName="x2" values="-180;820" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
            <animate attributeName="y1" values="0;600" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
            <animate attributeName="y2" values="-120;480" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
          </linearGradient>
        ))}
      </defs>
      {paths.map((p, i) => <g key={i}><path d={p.d} stroke="rgba(130,150,200,.18)" fill="none" /><path d={p.d} stroke={`url(#bm${i})`} strokeWidth="1.6" fill="none" /></g>)}
    </svg>
  );
}

function Lines() {
  const l = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ d: `M${i * 48 - 20} -10C${i * 48 + 60} 150 ${i * 48 - 80} 300 ${i * 48 + 30} 420S${i * 48 - 40} 560 ${i * 48 + 10} 620`, delay: rnd(0, 6), dur: rnd(5, 9) })), []);
  return (
    <svg className="lines-bg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
      {l.map((p, i) => <path key={i} d={p.d} fill="none" style={{ animationDelay: p.delay + "s", animationDuration: p.dur + "s" }} />)}
    </svg>
  );
}

function Ripple() {
  const [n, setN] = useState({ c: 0, r: 0 });
  const [o, setO] = useState({ x: 0, y: 0, k: 0 });
  useEffect(() => {
    const fit = () => setN({ c: Math.ceil(innerWidth / 52), r: Math.ceil(innerHeight / 52) });
    fit(); addEventListener("resize", fit);
    const click = (e) => setO((p) => ({ x: Math.floor(e.clientX / 52), y: Math.floor(e.clientY / 52), k: p.k + 1 }));
    addEventListener("pointerdown", click);
    const auto = setInterval(() => setO((p) => ({ x: Math.floor(innerWidth / 104), y: Math.floor(innerHeight / 104), k: p.k + 1 })), 5000);
    setO({ x: Math.floor(innerWidth / 104), y: Math.floor(innerHeight / 104), k: 1 });
    return () => { removeEventListener("resize", fit); removeEventListener("pointerdown", click); clearInterval(auto); };
  }, []);
  return (
    <div className="ripple" style={{ gridTemplateColumns: `repeat(${n.c}, 52px)`, gridTemplateRows: `repeat(${n.r}, 52px)` }}>
      {Array.from({ length: n.c * n.r }, (_, i) => {
        const x = i % n.c, y = Math.floor(i / n.c), d = Math.hypot(x - o.x, y - o.y);
        return <i key={i + "-" + o.k} style={{ animationDelay: d * 70 + "ms", animationName: o.k ? "rip" : "none" }} />;
      })}
    </div>
  );
}

function Boxes() {
  const ref = useRef(null);
  useEffect(() => {
    const cols = ["#38bdf8", "#818cf8", "#c084fc", "#34d399", "#fb7185", "#fbbf24"];
    const id = setInterval(() => {
      const cells = ref.current?.children; if (!cells) return;
      const c = cells[Math.floor(Math.random() * cells.length)];
      c.style.background = cols[Math.floor(Math.random() * cols.length)]; c.style.opacity = ".85";
      setTimeout(() => { c.style.background = ""; c.style.opacity = ""; }, 900);
    }, 140);
    return () => clearInterval(id);
  }, []);
  return <div className="boxes"><div ref={ref}>{Array.from({ length: 22 * 22 }, (_, i) => <i key={i} />)}</div></div>;
}

function Gradient() { // soft blobs, one of them chases the pointer
  const ref = useRef(null);
  useEffect(() => {
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf;
    const mv = (e) => { tx = e.clientX; ty = e.clientY; };
    const loop = () => { x += (tx - x) * 0.06; y += (ty - y) * 0.06; if (ref.current) ref.current.style.transform = `translate(${x - 220}px,${y - 220}px)`; raf = requestAnimationFrame(loop); };
    addEventListener("pointermove", mv); raf = requestAnimationFrame(loop);
    return () => { removeEventListener("pointermove", mv); cancelAnimationFrame(raf); };
  }, []);
  return <div className="gradanim"><i className="g1" /><i className="g2" /><i className="g3" /><i className="gp" ref={ref} /></div>;
}

/* ---------- registry + layer + picker ---------- */
export const BG = [
  { id: "classic", label: "Classic gradient" },
  { id: "aurora", label: "Aurora", C: Aurora },
  { id: "gradient", label: "Gradient (follows mouse)", C: Gradient },
  { id: "beams", label: "Background Beams", C: Beams, dark: true },
  { id: "lines", label: "Background Lines", C: Lines },
  { id: "ripple", label: "Ripple (click it)", C: Ripple },
  { id: "boxes", label: "Background Boxes", C: Boxes, dark: true },
  { id: "grid", label: "Grid", C: Grid },
  { id: "dots", label: "Dots", C: Dots },
  { id: "dotglow", label: "Dotted Glow", C: DotGlow },
  { id: "noise", label: "Noise", C: Noise },
  { id: "stars", label: "Stars + Shooting stars", C: Stars, dark: true },
  { id: "sparkles", label: "Sparkles", C: Sparkles },
  { id: "meteors", label: "Meteors", C: Meteors, dark: true },
  { id: "spotlight", label: "Spotlight", C: Spotlight, dark: true },
  { id: "vortex", label: "Vortex", C: Vortex, dark: true },
  { id: "wavy", label: "Wavy", C: Wavy },
  { id: "lamp", label: "Lamp", C: Lamp, dark: true },
];

export function BackgroundLayer() {
  const id = useBg();
  const item = BG.find((b) => b.id === id) || BG[0];
  if (!item.C) return null;
  const C = item.C;
  return <div className={`bgx ${item.dark ? "dk" : ""}`} aria-hidden="true"><C key={item.id} /></div>;
}

export function BgPicker({ up = false }) {
  const [open, setOpen] = useState(false);
  const cur = useBg();
  return (
    <div className="menu-wrap">
      <button type="button" className="icon-btn" title="Change background" onClick={() => setOpen(!open)}><FaPalette /></button>
      {open && (
        <div className={`dropdown right bgpick ${up ? "up" : ""}`} onMouseLeave={() => setOpen(false)}>
          <div className="dropdown-label">Background</div>
          {BG.map((b) => (
            <button type="button" key={b.id} className={`dropdown-item ${cur === b.id ? "on" : ""}`} onClick={() => { setBg(b.id); setOpen(false); }}>
              {b.label} {cur === b.id && "✓"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
