import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { FaBell } from "react-icons/fa";
import { api, auth } from "./api.js";
import { useApp } from "./store.jsx";
import { timeAgo } from "./store.jsx";

const Ctx = createContext({ items: [], unread: 0, markAll: () => {}, markOne: () => {} });
export const useNotifs = () => useContext(Ctx);

// Socket.IO connection: pushes notifications to this user and tells every open tab to re-sync when someone else changes data.
export function NotifProvider({ children }) {
  const { refresh, notify, me } = useApp();
  const [items, setItems] = useState([]);
  const timer = useRef();

  useEffect(() => {
    api.notifications().then(setItems).catch(() => {});
    const origin = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL, location.href).origin : undefined;
    const socket = io(origin, { auth: { token: auth.get() } });
    socket.on("notification", (n) => { setItems((x) => [n, ...x].slice(0, 50)); notify("🔔 " + n.text); });
    socket.on("sync", ({ by }) => {
      if (by === me.id) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => refresh().catch(() => {}), 300);
    });
    return () => { clearTimeout(timer.current); socket.close(); };
  }, [me.id]); // eslint-disable-line

  const markAll = useCallback(() => { setItems((x) => x.map((n) => ({ ...n, read: true }))); api.readAllNotifications().catch(() => {}); }, []);
  const markOne = useCallback((id) => { setItems((x) => x.map((n) => (n.id === id ? { ...n, read: true } : n))); api.readNotification(id).catch(() => {}); }, []);
  const unread = items.filter((n) => !n.read).length;
  return <Ctx.Provider value={{ items, unread, markAll, markOne }}>{children}</Ctx.Provider>;
}

export function Bell() {
  const { items, unread, markAll, markOne } = useNotifs();
  const { setOpenIssueId } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="menu-wrap">
      <button className={`icon-btn bell ${unread ? "ring" : ""}`} title="Notifications" onClick={() => setOpen(!open)}>
        <FaBell />
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="dropdown right notif-list" onMouseLeave={() => setOpen(false)}>
          <div className="dropdown-label row" style={{ justifyContent: "space-between" }}>
            Notifications {unread > 0 && <button className="link small" onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <div className="dropdown-label">You're all caught up</div>}
          {items.map((n) => (
            <button key={n.id} className={`dropdown-item notif ${n.read ? "" : "unread"}`}
              onClick={() => { markOne(n.id); if (n.issueId) setOpenIssueId(n.issueId); setOpen(false); }}>
              <span className="grow">{n.text}<br /><small className="muted">{timeAgo(n.at)}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
