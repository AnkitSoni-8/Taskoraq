import { useApp, fmtDate, isoDay, timeAgo } from "../store.jsx";
import Analytics from "./Analytics.jsx";
import { Avatar, Lozenge, TypeIcon, PriorityIcon } from "../ui.jsx";

export default function Dashboard() {
  const { state, dispatch, me, keyOf, projectsById, setView, setOpenIssueId, setCreateDraft, project } = useApp();
  const real = state.issues.filter((i) => i.type !== "Epic");
  const mine = real.filter((i) => i.assigneeId === me.id && i.status !== "Done");
  const overdue = real.filter((i) => i.dueDate && i.dueDate < isoDay() && i.status !== "Done");
  const done = real.filter((i) => i.status === "Done").length;
  const recent = [...state.issues].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const comments = state.issues.flatMap((i) => i.comments.map((c) => ({ ...c, issue: i }))).sort((a, b) => b.at - a.at).slice(0, 4);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{greet}, {me.name.split(" ")[0]}</h1>
          <p className="muted">Here's what's happening across your projects.</p>
        </div>
        {project && <button className="btn primary" onClick={() => setCreateDraft({})}>Create issue</button>}
      </div>
      <Analytics />

      <div className="stats">
        {[
          ["Total projects", state.projects.length],
          ["Assigned to me", mine.length],
          ["Overdue", overdue.length],
          ["Completed", done],
        ].map(([l, v]) => (
          <div key={l} className="stat hoverable"><span>{l}</span><b>{v}</b></div>
        ))}
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Assigned to me</h3>
          {mine.length === 0 && <p className="muted">Nothing assigned. Enjoy the quiet.</p>}
          {mine.map((i) => (
            <button key={i.id} className="list-row" onClick={() => setOpenIssueId(i.id)}>
              <TypeIcon type={i.type} /> <span className="mono">{keyOf(i)}</span> <span className="grow ellipsis">{i.summary}</span>
              <PriorityIcon priority={i.priority} /> <Lozenge status={i.status} />
            </button>
          ))}
        </section>

        <section className="panel">
          <h3>Your projects</h3>
          {state.projects.map((p) => {
            const iss = state.issues.filter((i) => i.projectId === p.id);
            const d = iss.filter((i) => i.status === "Done").length;
            const pct = iss.length ? Math.round((d / iss.length) * 100) : 0;
            return (
              <button key={p.id} className="list-row" onClick={() => { dispatch({ type: "setProject", id: p.id }); setView("board"); }}>
                <span className="proj-badge">{p.key[0]}</span>
                <span className="grow"><b>{p.name}</b><span className="progress thin"><div style={{ width: pct + "%" }} /></span></span>
                <span className="muted small">{pct}%</span>
              </button>
            );
          })}
        </section>

        <section className="panel">
          <h3>Recently created</h3>
          {recent.map((i) => (
            <button key={i.id} className="list-row" onClick={() => setOpenIssueId(i.id)}>
              <TypeIcon type={i.type} /> <span className="mono">{keyOf(i)}</span> <span className="grow ellipsis">{i.summary}</span>
              <span className="muted small">{timeAgo(i.createdAt)}</span>
            </button>
          ))}
        </section>

        <section className="panel">
          <h3>Latest comments</h3>
          {comments.length === 0 && <p className="muted">No comments yet.</p>}
          {comments.map((c) => (
            <button key={c.id} className="list-row" onClick={() => setOpenIssueId(c.issue.id)}>
              <Avatar user={state.users.find((u) => u.id === c.userId)} size={26} />
              <span className="grow ellipsis"><b>{keyOf(c.issue)}</b> {c.text}</span>
              <span className="muted small">{timeAgo(c.at)}</span>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}
