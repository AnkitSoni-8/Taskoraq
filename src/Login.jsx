import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { FaBug, FaBolt, FaBookmark, FaCheckSquare, FaColumns, FaListUl, FaEnvelope, FaLock, FaUser, FaExclamationCircle } from "react-icons/fa";
import { api, auth } from "./api.js";
import { BackgroundLayer, BgPicker } from "./bg/Backgrounds.jsx";

// Quick-login demo buttons exist only in development (`npm run dev`) or when the build sets VITE_DEMO_LOGIN=true.
// A normal production build (`npm run build`) shows just the real login / sign-up form.
const DEMO_LOGIN = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === "true";

const ROLES = [
  { key: "admin", label: "Admin", email: "ankit@example.com", desc: "Full control: users & roles, delete projects, everything" },
  { key: "coadmin", label: "Co-admin", email: "riya@example.com", desc: "Create, edit & delete issues, sprints, epics, settings" },
  { key: "viewer", label: "Viewer", email: "karan@example.com", desc: "Read-only access" },
];

// floating background objects: [icon, left%, top%, size, depth(parallax strength), duration]
const FLOATERS = [
  [FaBug, 8, 16, 54, 40, 7], [FaCheckSquare, 86, 12, 62, 55, 9], [FaBolt, 14, 74, 66, 60, 8],
  [FaBookmark, 80, 70, 50, 35, 10], [FaColumns, 48, 6, 44, 25, 11], [FaListUl, 62, 86, 48, 45, 8.5],
];

function Floater({ icon: Icon, x, y, size, depth, dur, i, mx, my, still }) {
  const tx = useTransform(mx, [-0.5, 0.5], [depth, -depth]);
  const ty = useTransform(my, [-0.5, 0.5], [depth, -depth]);
  return (
    <motion.div className="lg-float" style={{ left: x + "%", top: y + "%", x: tx, y: ty }}>
      <motion.span
        style={{ width: size, height: size }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={still ? { opacity: 0.8, scale: 1 } : { opacity: 0.8, scale: 1, y: [0, -24, 0], rotate: [-8, 8, -8] }}
        transition={{ opacity: { delay: 0.4 + i * 0.12 }, scale: { delay: 0.4 + i * 0.12, type: "spring" }, y: { duration: dur, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: dur * 1.3, repeat: Infinity, ease: "easeInOut" } }}
      >
        <Icon size={size * 0.42} />
      </motion.span>
    </motion.div>
  );
}

function Field({ icon: Icon, label, delay = 0, ...props }) {
  return (
    <motion.label className="lg-field" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: -8 }} transition={{ delay, duration: 0.4 }}>
      <input placeholder=" " {...props} />
      <Icon className="lg-ico" size={14} />
      <span className="lg-label">{label}</span>
      <i className="lg-line" />
    </motion.label>
  );
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [invite, setInvite] = useState(null); // opened from an emailed invite link (?invite=TOKEN)
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const still = useReducedMotion();
  const shake = useAnimationControls();
  const wrap = useRef(null);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("invite");
    if (!t) return;
    api.inviteInfo(t).then((i) => { setInvite({ ...i, token: t }); setMode("register"); setF((x) => ({ ...x, email: i.email })); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { if (err) shake.start({ x: [0, -12, 12, -9, 9, -4, 0], transition: { duration: 0.5 } }); }, [err]); // eslint-disable-line

  // mouse parallax (-0.5..0.5), smoothed with springs
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const mx = useSpring(rx, { stiffness: 60, damping: 18 }), my = useSpring(ry, { stiffness: 60, damping: 18 });
  const blobX = useTransform(mx, [-0.5, 0.5], [50, -50]), blobY = useTransform(my, [-0.5, 0.5], [40, -40]);
  const blob2X = useTransform(mx, [-0.5, 0.5], [-70, 70]), blob2Y = useTransform(my, [-0.5, 0.5], [-50, 50]);
  const tiltY = useTransform(mx, [-0.5, 0.5], [-5, 5]), tiltX = useTransform(my, [-0.5, 0.5], [4, -4]);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (!still) { rx.set(px - 0.5); ry.set(py - 0.5); }
    e.currentTarget.style.setProperty("--mx", px * 100 + "%"); // gradient spotlight follows the cursor
    e.currentTarget.style.setProperty("--my", py * 100 + "%");
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = mode === "login" ? await api.login(f.email, f.password) : await api.register(f.name, f.email, f.password, invite?.token);
      auth.set(r.token);
      if (invite) history.replaceState(null, "", location.pathname);
      setDone(true); // success animation, then enter the app
      setTimeout(() => onLogin(r.user), 1100);
    } catch (ex) {
      setErr(ex.message === "Failed to fetch" ? "Backend not reachable - is the server running on :5000?" : ex.message);
      setBusy(false);
    }
  };

  return (
    <motion.div ref={wrap} className="login-wrap lg-wrap" onPointerMove={onMove} onPointerLeave={onLeave} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <BackgroundLayer />
      <div className="lg-bg" aria-hidden="true" />
      <div className="lg-bgpick"><BgPicker up /></div>
      <div className="lg-spot" aria-hidden="true" />
      <motion.div className="lg-blob b1" style={{ x: blobX, y: blobY }} aria-hidden="true" />
      <motion.div className="lg-blob b2" style={{ x: blob2X, y: blob2Y }} aria-hidden="true" />
      {FLOATERS.map(([icon, x, y, size, depth, dur], i) => <Floater key={i} i={i} icon={icon} x={x} y={y} size={size} depth={depth} dur={dur} mx={mx} my={my} still={still} />)}

      <motion.div style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 1000 }} initial={{ opacity: 0, scale: 0.88, y: 50 }}
        animate={done ? { opacity: 0, scale: 1.08, filter: "blur(8px)" } : { opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: done ? 0.55 : 0.15 }}>
        <motion.div animate={shake}>
          <form className="login-card lg-card" onSubmit={submit}>
            <AnimatePresence mode="wait">
              <motion.h2 key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {mode === "login" ? "Log in to continue" : "Create your account"}
              </motion.h2>
            </AnimatePresence>

            {invite && <div className="invite-banner">You were invited as <b>{invite.role}</b> - finish creating your account.</div>}
            <AnimatePresence initial={false}>
              {mode === "register" && <Field key="name" icon={FaUser} label="Full name" value={f.name} onChange={set("name")} required />}
            </AnimatePresence>
            <Field icon={FaEnvelope} label="Email" delay={0.9} type="email" readOnly={!!invite} value={f.email} onChange={set("email")} required />
            <Field icon={FaLock} label="Password" delay={1.0} type="password" value={f.password} onChange={set("password")} required minLength={6} />

            <AnimatePresence>
              {err && (
                <motion.div key={err} className="login-err lg-err" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <FaExclamationCircle /> {err}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button className={`lg-btn ${busy ? "busy" : ""}`} disabled={busy} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
              {busy ? <><span className="lg-spin" /> {done ? "Welcome!" : "Please wait"}</> : mode === "login" ? "Log in" : "Sign up"}
            </motion.button>
            <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
              {mode === "login" ? "New here? Create an account (Viewer access)" : "Already have an account? Log in"}
            </button>

            {DEMO_LOGIN && (
            <div className="login-demo">
              <small className="muted">
                {mode === "login" ? <>Quick login by role (password: <b>password123</b>)</> : "Roles - new sign-ups start as Viewer; an Admin can upgrade you"}
              </small>
              <div className="role-cards">
                {ROLES.map((r, i) => (
                  <motion.button type="button" key={r.key} className={`role-card ${r.key}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.1 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setMode("login"); setErr(""); setF({ ...f, email: r.email, password: "password123" }); }}>
                    <span className={`role-badge ${r.key}`}>{r.label}</span>
                    <small>{r.desc}</small>
                  </motion.button>
                ))}
              </div>
            </div>
            )}
          </form>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {done && (
          <motion.div className="lg-success" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
            <svg viewBox="0 0 52 52" width="84" height="84">
              <motion.circle cx="26" cy="26" r="23" fill="none" stroke="#22a06b" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45 }} />
              <motion.path d="M15 27l8 8 14-16" fill="none" stroke="#22a06b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.35, duration: 0.4 }} />
            </svg>
            <b>Welcome back</b>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
