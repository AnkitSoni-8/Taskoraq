import { useEffect } from "react";
import { motion } from "motion/react";
import {
  FaBug, FaBookmark, FaCheckSquare, FaBolt, FaAngleDoubleUp, FaAngleUp, FaEquals, FaAngleDown, FaAngleDoubleDown, FaTimes,
} from "react-icons/fa";

export const TYPE_META = {
  Story: { icon: FaBookmark, color: "#22A06B" },
  Task: { icon: FaCheckSquare, color: "#1D7AFC" },
  Bug: { icon: FaBug, color: "#E2483D" },
  Epic: { icon: FaBolt, color: "#8270DB" },
};
export function TypeIcon({ type, size = 16 }) {
  const M = TYPE_META[type];
  const I = M.icon;
  return (
    <span className="type-icon" style={{ background: M.color, width: size, height: size }} title={type}>
      <I size={size * 0.6} color="#fff" />
    </span>
  );
}

export const PRIORITY_META = {
  Highest: { icon: FaAngleDoubleUp, color: "#C9372C" },
  High: { icon: FaAngleUp, color: "#E2483D" },
  Medium: { icon: FaEquals, color: "#E56910" },
  Low: { icon: FaAngleDown, color: "#1D7AFC" },
  Lowest: { icon: FaAngleDoubleDown, color: "#579DFF" },
};
export function PriorityIcon({ priority, size = 14 }) {
  const M = PRIORITY_META[priority];
  const I = M.icon;
  return (
    <span title={priority} style={{ color: M.color, display: "inline-flex" }}>
      <I size={size} />
    </span>
  );
}

const ROLE_NAMES = { admin: "Admin", coadmin: "Co-admin", viewer: "Viewer" };

// fades/slides its children in the first time they scroll into view
export function Reveal({ children, delay = 0, className }) {
  return (
    <motion.div className="reveal-wrap" initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.5, delay, ease: "easeOut" }}>
      <div className={className}>{children}</div>
    </motion.div>
  );
}

export function Avatar({ user, size = 24 }) {
  if (!user)
    return (
      <span className="avatar unassigned" style={{ width: size, height: size, fontSize: size * 0.45 }} title="Unassigned">
        ?
      </span>
    );
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="hc">
      <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * 0.42 }}>{initials}</span>
      <span className="hc-card">
        <span className="avatar" style={{ width: 36, height: 36, background: user.color, fontSize: 15 }}>{initials}</span>
        <b>{user.name}</b>
        {user.email && <small>{user.email}</small>}
        {user.role && <span className={`role-badge ${user.role}`}>{ROLE_NAMES[user.role]}</span>}
      </span>
    </span>
  );
}

const STATUS_CLASS = { "To Do": "todo", "In Progress": "inprog", "In Review": "review", Done: "done" };
export const statusClass = (s) => STATUS_CLASS[s] || "todo";
export function Lozenge({ status }) {
  return <span className={`lozenge ${statusClass(status)}`}>{status}</span>;
}

export function Modal({ onClose, children, width = 520, title }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ width }} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
        {title && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

// Taskoraq logo: steampunk wordmark image (public/logo.png). It already contains the "TASKORAQ" name.
export function Logo({ height = 40 }) {
  return <img src="/logo.png" alt="Taskoraq" className="taskoraq-logo" style={{ height, width: "auto", display: "block" }} />;
}
export const BRAND = "Taskoraq";
