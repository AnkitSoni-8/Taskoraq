import { FaSearch } from "react-icons/fa";
import { useApp, TYPES } from "../store.jsx";
import { Avatar } from "../ui.jsx";

export const emptyFilters = { q: "", assignees: [], type: "", mine: false };

export function applyFilters(issues, f, keyOf, meId) {
  const q = f.q.trim().toLowerCase();
  return issues.filter((i) => {
    if (q && !i.summary.toLowerCase().includes(q) && !keyOf(i).toLowerCase().includes(q)) return false;
    if (f.assignees.length && !f.assignees.includes(i.assigneeId || "none")) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.mine && i.assigneeId !== meId) return false;
    return true;
  });
}

export default function FilterBar({ filters, setFilters }) {
  const { state, project } = useApp();
  const members = state.users.filter((u) => project.members.includes(u.id));
  const active = filters.q || filters.assignees.length || filters.type || filters.mine;
  const toggle = (id) =>
    setFilters({ ...filters, assignees: filters.assignees.includes(id) ? filters.assignees.filter((x) => x !== id) : [...filters.assignees, id] });
  return (
    <div className="filter-bar">
      <div className="input-icon">
        <FaSearch size={12} />
        <input placeholder="Search this board" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
      </div>
      <div className="avatar-stack">
        {members.map((u) => (
          <button key={u.id} className={`avatar-btn ${filters.assignees.includes(u.id) ? "on" : ""}`} onClick={() => toggle(u.id)} title={u.name}>
            <Avatar user={u} size={28} />
          </button>
        ))}
        <button className={`avatar-btn ${filters.assignees.includes("none") ? "on" : ""}`} onClick={() => toggle("none")} title="Unassigned">
          <Avatar user={null} size={28} />
        </button>
      </div>
      <button className={`chip ${filters.mine ? "on" : ""}`} onClick={() => setFilters({ ...filters, mine: !filters.mine })}>Only my issues</button>
      <select className="chip-select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
        <option value="">Type: All</option>
        {TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      {active && <button className="link" onClick={() => setFilters(emptyFilters)}>Clear filters</button>}
    </div>
  );
}
