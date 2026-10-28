import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { AppProvider } from "./store.jsx";
import { NotifProvider } from "./realtime.jsx";
import { api, auth } from "./api.js";
import "./styles.css";

function AuthGate() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    auth.clear();
    try { localStorage.removeItem("taskoraq-v1"); localStorage.removeItem("jira-clone-v1"); } catch {}
    setUser(null);
  }, []);

  useEffect(() => {
    if (!auth.get()) { setReady(true); return; }
    api.me().then((r) => setUser(r.user)).catch(() => auth.clear()).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  if (!ready) return null;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <AppProvider key={user.id} authUser={user} onLogout={logout}>
      <NotifProvider>
        <App />
      </NotifProvider>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")).render(<AuthGate />);
