import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useApp, fmtDate } from "../store.jsx";
import { Empty, TypeIcon } from "../ui.jsx";

const MONTHS = 6;

export default function Epics() {
  const { project, projectIssues, keyOf, setOpenIssueId, dispatch } = useApp();
  const [text, setText] = useState("");
  const epics = projectIssues.filter((i) => i.type === "Epic");
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setMonth(end.getMonth() + MONTHS);
  const span = end - start;
  const pos = (d) => Math.min(100, Math.max(0, ((new Date(d + "T00:00:00") - start) / span) * 100));
  const months = Array.from({ length: MONTHS }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));
  const todayPos = ((Date.now() - start) / span) * 100;

  const add = () => {
    if (!text.trim()) return;
    dispatch({ type: "addIssue", issue: { projectId: project.id, type: "Epic", summary: text.trim() } });
    setText("");
  };

  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head"><h1 className="page-title">Roadmap</h1></div>

      <div className="roadmap">
        <div className="rm-head">
          <div className="rm-label">Epic</div>
          <div className="rm-grid head">
            {months.map((m) => <div key={+m}>{m.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</div>)}
          </div>
        </div>
        {epics.length === 0 && <Empty title="No epics yet">Create an epic below to plan large pieces of work.</Empty>}
        {epics.map((e) => {
          const kids = projectIssues.filter((i) => i.epicId === e.id);
          const done = kids.filter((k) => k.status === "Done").length;
          const pct = kids.length ? Math.round((done / kids.length) * 100) : 0;
          const hasDates = e.startDate && e.dueDate;
          return (
            <div key={e.id} className="rm-row">
              <div className="rm-label" onClick={() => setOpenIssueId(e.id)}>
                <TypeIcon type="Epic" /> <span className="mono">{keyOf(e)}</span> <span className="ellipsis">{e.summary}</span>
                <span className="muted small">{pct}%</span>
              </div>
              <div className="rm-grid">
                {months.map((m) => <div key={+m} />)}
                <div className="today" style={{ left: todayPos + "%" }} />
                {hasDates ? (
                  <div className="rm-bar" style={{ left: pos(e.startDate) + "%", width: Math.max(2, pos(e.dueDate) - pos(e.startDate)) + "%" }} onClick={() => setOpenIssueId(e.id)} title={`${fmtDate(e.startDate)} – ${fmtDate(e.dueDate)}`}>
                    <div className="rm-fill" style={{ width: pct + "%" }} />
                    <span>{e.summary}</span>
                  </div>
                ) : (
                  <span className="rm-nodate">Add start and due dates to schedule</span>
                )}
              </div>
            </div>
          );
        })}
        <div className="rm-row add">
          <div className="rm-label"><FaPlus size={11} />
            <input placeholder="Create epic" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          </div>
        </div>
      </div>
    </>
  );
}
