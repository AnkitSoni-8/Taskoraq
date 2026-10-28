import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useApp, STATUSES, fmtDate, isoDay } from "../store.jsx";
import { Avatar, Empty, Modal, PriorityIcon, TypeIcon, statusClass } from "../ui.jsx";
import FilterBar, { applyFilters, emptyFilters } from "./FilterBar.jsx";

function Card({ issue, onDragStartCard, onDropOnCard }) {
  const { keyOf, usersById, state, setOpenIssueId, can, dispatch } = useApp();
  const epic = state.issues.find((i) => i.id === issue.epicId);
  const overdue = issue.dueDate && issue.status !== "Done" && issue.dueDate < isoDay();
  return (
    <div
      className="card"
      tabIndex={0}
      role="button"
      aria-label={`${keyOf(issue)} ${issue.summary}, status ${issue.status}. Press Enter to open.`}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpenIssueId(issue.id); } }}
      draggable={can.edit}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", issue.id); e.dataTransfer.effectAllowed = "move"; onDragStartCard(issue.id); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); onDropOnCard(issue.id); }}
      onClick={() => setOpenIssueId(issue.id)}
    >
      <p className="card-title">{issue.summary}</p>
      {epic && <span className="epic-tag">{epic.summary}</span>}
      {issue.labels.length > 0 && (
        <div className="label-row">{issue.labels.map((l) => <span key={l} className="label">{l}</span>)}</div>
      )}
      {issue.dueDate && <div className={`due ${overdue ? "overdue" : ""}`}>{fmtDate(issue.dueDate)}</div>}
      {can.edit && (
        <label className="card-move" onClick={(e) => e.stopPropagation()}>
          <span className="sr-only">Move {keyOf(issue)} to status</span>
          <select value={issue.status} aria-label={`Move ${keyOf(issue)} to status`}
            onChange={(e) => dispatch({ type: "moveIssue", id: issue.id, status: e.target.value, beforeId: null })}>
            {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      )}
      <div className="card-foot">
        <div className="row gap">
          <TypeIcon type={issue.type} />
          <span className={`mono key ${issue.status === "Done" ? "struck" : ""}`}>{keyOf(issue)}</span>
        </div>
        <div className="row gap">
          {issue.points != null && <span className="points">{issue.points}</span>}
          <PriorityIcon priority={issue.priority} />
          <Avatar user={usersById[issue.assigneeId]} size={24} />
        </div>
      </div>
    </div>
  );
}

function CompleteSprintModal({ sprint, issues, onClose }) {
  const { dispatch, projectSprints, notify } = useApp();
  const open = issues.filter((i) => i.status !== "Done");
  const others = projectSprints.filter((s) => s.id !== sprint.id && s.state === "future");
  const [moveTo, setMoveTo] = useState(others[0]?.id || "");
  return (
    <Modal title={`Complete ${sprint.name}`} onClose={onClose} width={460}>
      <div className="form">
        <p>{issues.length - open.length} completed issues, {open.length} open issues.</p>
        {open.length > 0 && (
          <label>Move open issues to
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Backlog</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => { dispatch({ type: "completeSprint", id: sprint.id, moveTo: moveTo || null }); notify(`${sprint.name} completed`); onClose(); }}>
          Complete sprint
        </button>
      </div>
    </Modal>
  );
}

export default function Board() {
  const { state, dispatch, project, projectIssues, projectSprints, keyOf, me, setView, setCreateDraft } = useApp();
  const sprint = projectSprints.find((s) => s.state === "active");
  const [filters, setFilters] = useState(emptyFilters);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [quick, setQuick] = useState({ col: null, text: "" });
  const [completing, setCompleting] = useState(false);

  if (!sprint)
    return (
      <>
        <h1 className="page-title">{project.name} board</h1>
        <Empty title="No active sprint">
          Start a sprint from the backlog to see issues on the board.{" "}
          <button className="link" onClick={() => setView("backlog")}>Go to backlog</button>
        </Empty>
      </>
    );

  const sprintIssues = projectIssues.filter((i) => i.sprintId === sprint.id && i.type !== "Epic");
  const shown = applyFilters(sprintIssues, filters, keyOf, me.id);
  const daysLeft = sprint.end ? Math.max(0, Math.ceil((new Date(sprint.end) - new Date(isoDay())) / 86400000)) : null;

  const drop = (status, beforeId) => {
    if (dragId) dispatch({ type: "moveIssue", id: dragId, status, beforeId: beforeId || null });
    setDragId(null);
    setOverCol(null);
  };
  const addQuick = (status) => {
    const t = quick.text.trim();
    if (t) dispatch({ type: "addIssue", issue: { projectId: project.id, type: "Task", summary: t, status, sprintId: sprint.id } });
    setQuick({ col: null, text: "" });
  };

  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{sprint.name}</h1>
          {sprint.goal && <p className="muted">Goal: {sprint.goal}</p>}
        </div>
        <div className="row gap">
          {daysLeft !== null && <span className="pill">{daysLeft} days remaining</span>}
          <button className="btn" onClick={() => setCompleting(true)}>Complete sprint</button>
        </div>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} />

      <div className="columns">
        {STATUSES.map((status) => {
          const col = shown.filter((i) => i.status === status);
          const pts = col.reduce((a, i) => a + (i.points || 0), 0);
          return (
            <div
              key={status}
              className={`column ${overCol === status ? "over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={() => drop(status)}
            >
              <div className="column-head">
                <span>{status.toUpperCase()} <span className="count">{col.length}</span></span>
                {pts > 0 && <span className={`pts-badge ${statusClass(status)}`}>{pts}</span>}
              </div>
              <div className="column-body">
                {col.map((i) => (
                  <Card key={i.id} issue={i} onDragStartCard={setDragId} onDropOnCard={(beforeId) => drop(status, beforeId)} />
                ))}
                {quick.col === status ? (
                  <div className="quick-create">
                    <textarea
                      autoFocus rows={2} placeholder="What needs to be done?" value={quick.text}
                      onChange={(e) => setQuick({ ...quick, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addQuick(status); }
                        if (e.key === "Escape") setQuick({ col: null, text: "" });
                      }}
                      onBlur={() => addQuick(status)}
                    />
                  </div>
                ) : (
                  <button className="add-card" onClick={() => setQuick({ col: status, text: "" })}><FaPlus size={11} /> Create issue</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {completing && <CompleteSprintModal sprint={sprint} issues={sprintIssues} onClose={() => setCompleting(false)} />}
    </>
  );
}
