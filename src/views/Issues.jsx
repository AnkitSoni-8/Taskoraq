import { useMemo, useState } from "react";
import { useApp, STATUSES, TYPES, PRIORITIES, fmtDate } from "../store.jsx";
import { downloadCSV, printPDF } from "../export.js";
import { Avatar, Empty, Lozenge, PriorityIcon, TypeIcon } from "../ui.jsx";

const PR = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]));
const ST = Object.fromEntries(STATUSES.map((p, i) => [p, i]));

export default function Issues() {
  const { state, project, projectIssues, keyOf, usersById, setOpenIssueId, setCreateDraft, notify } = useApp();
  const [f, setF] = useState({ q: "", status: "", type: "", priority: "", assignee: "" });
  const [sort, setSort] = useState({ by: "key", dir: 1 });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const list = projectIssues.filter((i) =>
      (!q || i.summary.toLowerCase().includes(q) || keyOf(i).toLowerCase().includes(q) || i.labels.some((l) => l.toLowerCase().includes(q))) &&
      (!f.status || i.status === f.status) && (!f.type || i.type === f.type) && (!f.priority || i.priority === f.priority) &&
      (!f.assignee || (f.assignee === "none" ? !i.assigneeId : i.assigneeId === f.assignee))
    );
    const val = {
      key: (i) => i.num, type: (i) => i.type, summary: (i) => i.summary.toLowerCase(), status: (i) => ST[i.status],
      priority: (i) => PR[i.priority], assignee: (i) => usersById[i.assigneeId]?.name || "~", due: (i) => i.dueDate || "9999",
      points: (i) => i.points ?? -1,
    }[sort.by];
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [projectIssues, f, sort]); // eslint-disable-line

  const EXPORT_HEAD = ["Key", "Type", "Summary", "Status", "Priority", "Assignee", "Points", "Due", "Labels"];
  const exportRows = () => rows.map((i) => [keyOf(i), i.type, i.summary, i.status, i.priority, usersById[i.assigneeId]?.name || "Unassigned", i.points ?? "", i.dueDate || "", i.labels.join("; ")]);

  const Th = ({ id, children }) => (
    <th onClick={() => setSort(sort.by === id ? { by: id, dir: -sort.dir } : { by: id, dir: 1 })} className="sortable">
      {children} {sort.by === id && (sort.dir === 1 ? "▲" : "▼")}
    </th>
  );

  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head">
        <h1 className="page-title">Issues</h1>
        <div className="row gap">
          <button className="btn" onClick={() => downloadCSV(`${project.key}-issues`, EXPORT_HEAD, exportRows())}>Export CSV</button>
          <button className="btn" onClick={() => printPDF(`${project.name} - issues`, EXPORT_HEAD, exportRows()) || notify("Allow pop-ups to export PDF")}>Export PDF</button>
          <button className="btn primary" onClick={() => setCreateDraft({})}>Create issue</button>
        </div>
      </div>
      <div className="filter-bar">
        <input className="search-box" placeholder="Search summary, key or label" value={f.q} onChange={(e) => set("q", e.target.value)} />
        <select className="chip-select" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">Status: All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="chip-select" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="">Type: All</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="chip-select" value={f.priority} onChange={(e) => set("priority", e.target.value)}><option value="">Priority: All</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="chip-select" value={f.assignee} onChange={(e) => set("assignee", e.target.value)}>
          <option value="">Assignee: All</option><option value="none">Unassigned</option>
          {state.users.filter((u) => project.members.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="muted small">{rows.length} issue{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        <Empty title="No issues found">Try changing your filters.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><Th id="type">Type</Th><Th id="key">Key</Th><Th id="summary">Summary</Th><Th id="status">Status</Th><Th id="priority">Priority</Th><Th id="assignee">Assignee</Th><Th id="points">Pts</Th><Th id="due">Due</Th></tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} onClick={() => setOpenIssueId(i.id)}>
                  <td><TypeIcon type={i.type} /></td>
                  <td className="mono">{keyOf(i)}</td>
                  <td>{i.summary}</td>
                  <td><Lozenge status={i.status} /></td>
                  <td><span className="row gap"><PriorityIcon priority={i.priority} /> {i.priority}</span></td>
                  <td><span className="row gap"><Avatar user={usersById[i.assigneeId]} size={22} /> {usersById[i.assigneeId]?.name || "Unassigned"}</span></td>
                  <td>{i.points ?? "-"}</td>
                  <td>{i.dueDate ? fmtDate(i.dueDate) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
