import { useApp, STATUSES, TYPES, PRIORITIES, fmtDate } from "../store.jsx";
import { Empty } from "../ui.jsx";

const DAY = 86400000;

function Bars({ data, colorOf }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.label} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: (d.value / max) * 100 + "%", background: colorOf(d) }} /></div>
          <span className="bar-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function Burndown({ sprint, issues }) {
  const start = new Date(sprint.start + "T00:00:00").getTime();
  const end = new Date(sprint.end + "T00:00:00").getTime();
  const days = Math.max(1, Math.round((end - start) / DAY));
  const total = issues.reduce((a, i) => a + (i.points || 0), 0);
  const today = Math.min(days, Math.max(0, Math.floor((Date.now() - start) / DAY)));
  const remainingAt = (d) => {
    const cutoff = start + (d + 1) * DAY;
    return total - issues.filter((i) => i.doneAt && i.doneAt < cutoff).reduce((a, i) => a + (i.points || 0), 0);
  };
  const W = 640, H = 240, P = 36;
  const x = (d) => P + (d / days) * (W - P * 2);
  const y = (v) => H - P - (total ? (v / total) * (H - P * 2) : 0);
  const actual = Array.from({ length: today + 1 }, (_, d) => `${x(d)},${y(remainingAt(d))}`).join(" ");
  const nowX = x(today), nowY = y(remainingAt(today));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Burndown chart">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={P} x2={W - P} y1={y(total * t)} y2={y(total * t)} className="grid-line" />
          <text x={P - 6} y={y(total * t) + 4} textAnchor="end" className="axis">{Math.round(total * t)}</text>
        </g>
      ))}
      <line x1={x(0)} y1={y(total)} x2={x(days)} y2={y(0)} className="ideal" />
      <polyline points={actual} className="actual" />
      <circle cx={nowX} cy={nowY} r="4" fill="#1D7AFC" />
      <text x={P} y={H - 8} className="axis">{fmtDate(sprint.start)}</text>
      <text x={W - P} y={H - 8} textAnchor="end" className="axis">{fmtDate(sprint.end)}</text>
    </svg>
  );
}

export default function Reports() {
  const { project, projectIssues, projectSprints, state } = useApp();
  const issues = projectIssues.filter((i) => i.type !== "Epic");
  const sprint = projectSprints.find((s) => s.state === "active");
  const sprintIssues = sprint ? issues.filter((i) => i.sprintId === sprint.id) : [];
  const closed = projectSprints.filter((s) => s.state === "closed");

  const statusColors = { "To Do": "#8590A2", "In Progress": "#1D7AFC", "In Review": "#8270DB", Done: "#22A06B" };
  const prColors = { Highest: "#C9372C", High: "#E2483D", Medium: "#E56910", Low: "#1D7AFC", Lowest: "#579DFF" };
  const typeColors = { Story: "#22A06B", Task: "#1D7AFC", Bug: "#E2483D", Epic: "#8270DB" };

  const byAssignee = [
    ...state.users.filter((u) => project.members.includes(u.id)).map((u) => ({ label: u.name, value: issues.filter((i) => i.assigneeId === u.id).length })),
    { label: "Unassigned", value: issues.filter((i) => !i.assigneeId).length },
  ];

  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head"><h1 className="page-title">Reports</h1></div>
      <div className="report-grid">
        <section className="panel wide">
          <h3>Burndown chart {sprint && <span className="muted">· {sprint.name}</span>}</h3>
          {sprint && sprint.start && sprint.end ? (
            <>
              <Burndown sprint={sprint} issues={sprintIssues} />
              <div className="legend"><span><i className="ideal-key" /> Guideline</span><span><i className="actual-key" /> Remaining story points</span></div>
            </>
          ) : (
            <Empty title="No active sprint">Start a sprint to see its burndown.</Empty>
          )}
        </section>
        <section className="panel">
          <h3>Issues by status</h3>
          <Bars data={STATUSES.map((s) => ({ label: s, value: issues.filter((i) => i.status === s).length }))} colorOf={(d) => statusColors[d.label]} />
        </section>
        <section className="panel">
          <h3>Issues by priority</h3>
          <Bars data={PRIORITIES.map((s) => ({ label: s, value: issues.filter((i) => i.priority === s).length }))} colorOf={(d) => prColors[d.label]} />
        </section>
        <section className="panel">
          <h3>Issues by type</h3>
          <Bars data={TYPES.map((s) => ({ label: s, value: projectIssues.filter((i) => i.type === s).length }))} colorOf={(d) => typeColors[d.label]} />
        </section>
        <section className="panel">
          <h3>Workload by assignee</h3>
          <Bars data={byAssignee} colorOf={() => "#1D7AFC"} />
        </section>
        <section className="panel wide">
          <h3>Completed sprints</h3>
          {closed.length === 0 ? <p className="muted">No completed sprints yet.</p> : (
            <table className="table"><thead><tr><th>Sprint</th><th>Dates</th><th>Completed issues</th><th>Points done</th></tr></thead>
              <tbody>
                {closed.map((s) => {
                  const done = issues.filter((i) => i.sprintId === s.id && i.status === "Done");
                  return <tr key={s.id}><td>{s.name}</td><td>{fmtDate(s.start)} – {fmtDate(s.end)}</td><td>{done.length}</td><td>{done.reduce((a, i) => a + (i.points || 0), 0)}</td></tr>;
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
