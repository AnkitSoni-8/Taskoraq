import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";
import { downloadCSV } from "../export.js";

export default function Audit() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const load = () => api.audit("?limit=300").then(setRows).catch((e) => notify(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (!entity || r.entity === entity) && (!t || `${r.userName} ${r.summary}`.toLowerCase().includes(t)));
  }, [rows, q, entity]);
  const entities = [...new Set(rows.map((r) => r.entity))];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Audit log</h1>
        <div className="row gap">
          <button className="btn" onClick={load}>Refresh</button>
          <button className="btn" onClick={() => downloadCSV("audit-log", ["Time", "User", "Role", "Action"], shown.map((r) => [new Date(r.at).toLocaleString(), r.userName, r.role, r.summary]))}>Export CSV</button>
        </div>
      </div>
      <div className="filter-bar">
        <input className="search-box" placeholder="Search user or action" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="chip-select" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All areas</option>
          {entities.map((e) => <option key={e}>{e}</option>)}
        </select>
        <span className="muted small">{shown.length} entries</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="muted">{new Date(r.at).toLocaleString()}</td>
                <td>{r.userName}</td>
                <td><span className={`role-badge ${r.role}`}>{r.role}</span></td>
                <td>{r.summary}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="muted">No activity recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
