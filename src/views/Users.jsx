import { useState } from "react";
import { FaTrash, FaUserPlus } from "react-icons/fa";
import { useApp, ROLE_LABEL } from "../store.jsx";
import { Avatar } from "../ui.jsx";
import { api } from "../api.js";
import Invites from "./Invites.jsx";

const ROLES = ["admin", "coadmin", "viewer"];

export default function Users() {
  const { state, me, can, refresh, notify } = useApp();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "viewer" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (fn, ok) => {
    try { await fn(); await refresh(); if (ok) notify(ok); }
    catch (e) { notify(e.message); refresh().catch(() => {}); }
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => { await api.addUser(f); setF({ name: "", email: "", password: "", role: "viewer" }); }, "User added");
  };

  return (
    <div>
      <div className="page-head"><h1>Users &amp; roles</h1></div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        <b>Admin</b>: everything (users, delete projects, reset). <b>Co-admin</b>: create/edit/delete issues, sprints, epics and project settings.
        {" "}<b>Viewer</b>: read-only.
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id}>
                <td><span className="row gap"><Avatar user={u} size={24} /> {u.name} {u.id === me.id && <small className="muted">(you)</small>}</span></td>
                <td>{u.email}</td>
                <td>
                  <select disabled={!can.manageUsers} value={u.role || "viewer"} onChange={(e) => run(() => api.updateUser(u.id, { role: e.target.value }), "Role updated")}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td>
                  {can.manageUsers && u.id !== me.id && (
                    <button className="icon-btn" title="Remove user" onClick={() => confirm(`Remove ${u.name}?`) && run(() => api.deleteUser(u.id), "User removed")}>
                      <FaTrash size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {can.manageUsers ? (
      <form className="user-form" onSubmit={add}>
        <b><FaUserPlus /> Add user</b>
        <input placeholder="Name" value={f.name} onChange={set("name")} required />
        <input type="email" placeholder="Email" value={f.email} onChange={set("email")} required />
        <input type="password" placeholder="Password (min 6)" value={f.password} onChange={set("password")} required minLength={6} />
        <select value={f.role} onChange={set("role")}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button className="btn primary">Add</button>
      </form>
      ) : <p className="muted small" style={{ marginTop: 12 }}>Only an Admin can change roles or add users.</p>}
      {can.manageUsers && <Invites />}
    </div>
  );
}
