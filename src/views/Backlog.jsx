import { useState } from "react";
import { FaChevronDown, FaChevronRight, FaPlus, FaTrash } from "react-icons/fa";
import { useApp, STATUSES, fmtDate, isoDay } from "../store.jsx";
import { Avatar, Modal, PriorityIcon, TypeIcon, statusClass } from "../ui.jsx";
import FilterBar, { applyFilters, emptyFilters } from "./FilterBar.jsx";

function StartSprintModal({ sprint, count, onClose }) {
  const { dispatch, notify } = useApp();
  const [f, setF] = useState({ name: sprint.name, goal: sprint.goal, start: isoDay(), end: isoDay(14) });
  const [err, setErr] = useState("");
  return (
    <Modal title={`Start ${sprint.name}`} onClose={onClose} width={480}>
      <div className="form">
        <p className="muted">{count} issues will be included in this sprint.</p>
        <label>Sprint name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="grid2">
          <label>Start date<input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
          <label>End date<input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        </div>
        <label>Sprint goal<textarea rows={2} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></label>
        {err && <p className="error">{err}</p>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!f.name.trim() || !f.start || !f.end) return setErr("Name, start and end date are required.");
          if (f.end < f.start) return setErr("End date must be after the start date.");
          dispatch({ type: "startSprint", id: sprint.id, patch: { name: f.name.trim(), goal: f.goal, start: f.start, end: f.end } });
          notify(`${f.name} started`);
          onClose();
        }}>Start</button>
      </div>
    </Modal>
  );
}

function Row({ issue, dragStart }) {
  const { dispatch, keyOf, usersById, state, setOpenIssueId, can } = useApp();
  const epic = state.issues.find((i) => i.id === issue.epicId);
  return (
    <div className="b-row" draggable={can.edit} onDragStart={(e) => { e.dataTransfer.setData("text/plain", issue.id); dragStart(issue.id); }} onClick={() => setOpenIssueId(issue.id)}>
      <TypeIcon type={issue.type} />
      <span className="mono key">{keyOf(issue)}</span>
      <span className="grow ellipsis">{issue.summary}</span>
      {epic && <span className="epic-tag">{epic.summary}</span>}
      <select
        className={`status-mini ${statusClass(issue.status)}`}
        value={issue.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => dispatch({ type: "updateIssue", id: issue.id, patch: { status: e.target.value } })}
      >
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <span className="points">{issue.points ?? "-"}</span>
      <PriorityIcon priority={issue.priority} />
      <Avatar user={usersById[issue.assigneeId]} size={24} />
    </div>
  );
}

function Section({ title, sprint, issues, dragId, setDragId, onStart, onComplete }) {
  const { dispatch, project, projectSprints, setCreateDraft } = useApp();
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState(false);
  const pts = (st) => issues.filter((i) => st.includes(i.status)).reduce((a, i) => a + (i.points || 0), 0);
  const sprintId = sprint ? sprint.id : null;

  const add = () => {
    const t = text.trim();
    if (t) dispatch({ type: "addIssue", issue: { projectId: project.id, type: "Task", summary: t, sprintId } });
    setText(""); setAdding(false);
  };

  return (
    <section
      className={`b-section ${over ? "over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); if (dragId) dispatch({ type: "updateIssue", id: dragId, patch: { sprintId } }); setDragId(null); }}
    >
      <div className="b-head">
        <button className="icon-btn" onClick={() => setOpen(!open)}>{open ? <FaChevronDown size={11} /> : <FaChevronRight size={11} />}</button>
        <b>{title}</b>
        {sprint && sprint.start && <span className="muted small">{fmtDate(sprint.start)} – {fmtDate(sprint.end)}</span>}
        {sprint?.state === "active" && <span className="pill active">ACTIVE</span>}
        <span className="muted small">({issues.length} issue{issues.length === 1 ? "" : "s"})</span>
        <span className="grow" />
        <span className="pts-badge todo" title="To do">{pts(["To Do"])}</span>
        <span className="pts-badge inprog" title="In progress">{pts(["In Progress", "In Review"])}</span>
        <span className="pts-badge done" title="Done">{pts(["Done"])}</span>
        {sprint?.state === "future" && <button className="btn edit-only" disabled={!issues.length} onClick={onStart} title={issues.length ? "" : "Add issues first"}>Start sprint</button>}
        {sprint?.state === "active" && <button className="btn edit-only" onClick={onComplete}>Complete sprint</button>}
        {sprint && sprint.state === "future" && (
          <button className="icon-btn" title="Delete sprint" onClick={() => dispatch({ type: "deleteSprint", id: sprint.id })}><FaTrash size={12} /></button>
        )}
      </div>
      {open && (
        <div>
          {issues.length === 0 && !adding && (
            <div className="b-empty">{sprint ? "Drag issues here to plan this sprint." : "Your backlog is empty."}</div>
          )}
          {issues.map((i) => <Row key={i.id} issue={i} dragStart={setDragId} />)}
          {adding ? (
            <div className="b-add">
              <input
                autoFocus placeholder="What needs to be done?" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setText(""); setAdding(false); } }}
                onBlur={add}
              />
            </div>
          ) : (
            <button className="add-row" onClick={() => setAdding(true)}><FaPlus size={11} /> Create issue</button>
          )}
        </div>
      )}
    </section>
  );
}

export default function Backlog() {
  const { dispatch, project, projectIssues, projectSprints, keyOf, me } = useApp();
  const [filters, setFilters] = useState(emptyFilters);
  const [dragId, setDragId] = useState(null);
  const [starting, setStarting] = useState(null);
  const [completing, setCompleting] = useState(null);
  const hasActive = projectSprints.some((s) => s.state === "active");
  const base = applyFilters(projectIssues.filter((i) => i.type !== "Epic"), filters, keyOf, me.id);
  const sprints = projectSprints.filter((s) => s.state !== "closed").sort((a, b) => (a.state === "active" ? -1 : b.state === "active" ? 1 : 0));

  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head">
        <h1 className="page-title">Backlog</h1>
        <button className="btn edit-only" onClick={() => dispatch({ type: "addSprint", projectId: project.id })}>Create sprint</button>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} />
      {sprints.map((s) => (
        <Section
          key={s.id} title={s.name} sprint={s} issues={base.filter((i) => i.sprintId === s.id)}
          dragId={dragId} setDragId={setDragId}
          onStart={() => (hasActive ? alert("Complete the active sprint before starting another one.") : setStarting(s))}
          onComplete={() => setCompleting(s)}
        />
      ))}
      <Section title="Backlog" sprint={null} issues={base.filter((i) => !i.sprintId)} dragId={dragId} setDragId={setDragId} />
      {starting && <StartSprintModal sprint={starting} count={projectIssues.filter((i) => i.sprintId === starting.id).length} onClose={() => setStarting(null)} />}
      {completing && (
        <Modal title={`Complete ${completing.name}`} onClose={() => setCompleting(null)} width={440}>
          <div className="form"><p>Open issues will be moved back to the backlog. Done issues stay in the sprint report.</p></div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setCompleting(null)}>Cancel</button>
            <button className="btn primary" onClick={() => { dispatch({ type: "completeSprint", id: completing.id, moveTo: null }); setCompleting(null); }}>Complete sprint</button>
          </div>
        </Modal>
      )}
    </>
  );
}
