import { useState } from "react";
import { useApp, TYPES, PRIORITIES } from "../store.jsx";
import { Modal } from "./../ui.jsx";

export default function CreateIssueModal() {
  const { state, dispatch, project, createDraft, setCreateDraft, setOpenIssueId, keyOf, notify } = useApp();
  const [f, setF] = useState({
    projectId: project.id, type: "Task", summary: "", description: "", priority: "Medium", assigneeId: "",
    labels: "", points: "", sprintId: "", epicId: "", dueDate: "", ...createDraft,
  });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const p = state.projects.find((x) => x.id === f.projectId);
  const members = state.users.filter((u) => p.members.includes(u.id));
  const sprints = state.sprints.filter((s) => s.projectId === p.id && s.state !== "closed");
  const epics = state.issues.filter((i) => i.projectId === p.id && i.type === "Epic");
  const close = () => setCreateDraft(null);

  const submit = (another) => {
    if (!f.summary.trim()) return setErr("Summary is required.");
    dispatch({
      type: "addIssue",
      issue: {
        projectId: p.id, type: f.type, summary: f.summary.trim(), description: f.description, priority: f.priority,
        assigneeId: f.assigneeId || null, labels: f.labels.split(",").map((l) => l.trim()).filter(Boolean),
        points: f.points === "" ? null : Number(f.points), sprintId: f.sprintId || null,
        epicId: f.type === "Epic" ? null : f.epicId || null, dueDate: f.dueDate, status: f.status || "To Do",
      },
    });
    notify(`${p.key}-${p.counter + 1} created`);
    if (another) { setF((x) => ({ ...x, summary: "", description: "" })); setErr(""); }
    else close();
  };

  return (
    <Modal title="Create issue" onClose={close} width={620}>
      <div className="form">
        <label>Project
          <select value={f.projectId} onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value, sprintId: "", epicId: "", assigneeId: "" }))}>
            {state.projects.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.key})</option>)}
          </select>
        </label>
        <label>Issue type
          <select value={f.type} onChange={(e) => set("type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label>Summary *
          <input autoFocus value={f.summary} onChange={(e) => { set("summary", e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && submit(false)} />
        </label>
        {err && <p className="error">{err}</p>}
        <label>Description
          <textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="grid2">
          <label>Priority
            <select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label>Assignee
            <select value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>Sprint
            <select value={f.sprintId} onChange={(e) => set("sprintId", e.target.value)}>
              <option value="">Backlog</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {f.type !== "Epic" && (
            <label>Epic
              <select value={f.epicId} onChange={(e) => set("epicId", e.target.value)}>
                <option value="">None</option>
                {epics.map((e) => <option key={e.id} value={e.id}>{p.key}-{e.num} {e.summary}</option>)}
              </select>
            </label>
          )}
          <label>Story points
            <input type="number" min="0" value={f.points} onChange={(e) => set("points", e.target.value)} />
          </label>
          <label>Due date
            <input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </label>
        </div>
        <label>Labels
          <input placeholder="comma, separated" value={f.labels} onChange={(e) => set("labels", e.target.value)} />
        </label>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={() => submit(true)}>Create & add another</button>
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={() => submit(false)}>Create</button>
      </div>
    </Modal>
  );
}
