import { useEffect, useState } from "react";
import { FaTrash, FaPaperclip } from "react-icons/fa";
import { api, downloadFile } from "../api.js";
import { useApp, STATUSES, TYPES, PRIORITIES, fmtDate, timeAgo } from "../store.jsx";
import { Avatar, Modal, PriorityIcon, TypeIcon } from "../ui.jsx";

function Field({ label, children }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function IssueModal() {
  const { state, dispatch, openIssueId, setOpenIssueId, keyOf, usersById, projectsById, notify, can, refresh } = useApp();
  const issue = state.issues.find((i) => i.id === openIssueId);
  const [summary, setSummary] = useState(issue?.summary || "");
  const [desc, setDesc] = useState(issue?.description || "");
  const [comment, setComment] = useState("");
  const [labels, setLabels] = useState((issue?.labels || []).join(", "));
  const [confirmDel, setConfirmDel] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return notify("File too large (max 5 MB)");
    setUpBusy(true);
    try { await api.uploadFile(issue.id, file); await refresh(); notify("File uploaded"); }
    catch (ex) { notify(ex.message); }
    finally { setUpBusy(false); }
  };
  const delAtt = async (a) => {
    try { await api.deleteAttachment(issue.id, a.id); await refresh(); } catch (ex) { notify(ex.message); }
  };
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

  useEffect(() => {
    if (!issue) return;
    setSummary(issue.summary);
    setDesc(issue.description);
    setLabels(issue.labels.join(", "));
    setConfirmDel(false);
  }, [openIssueId]); // eslint-disable-line

  if (!issue) return null;
  const project = projectsById[issue.projectId];
  const close = () => setOpenIssueId(null);
  const patch = (p) => dispatch({ type: "updateIssue", id: issue.id, patch: p });
  const members = state.users.filter((u) => project.members.includes(u.id));
  const sprints = state.sprints.filter((s) => s.projectId === project.id && (s.state !== "closed" || s.id === issue.sprintId));
  const epics = state.issues.filter((i) => i.projectId === project.id && i.type === "Epic" && i.id !== issue.id);
  const children = state.issues.filter((i) => i.epicId === issue.id);
  const doneKids = children.filter((c) => c.status === "Done").length;
  const epic = state.issues.find((i) => i.id === issue.epicId);

  return (
    <Modal onClose={close} width={920}>
      <div className="issue-head">
        <div className="crumbs">
          {epic && (<><button className="link" onClick={() => setOpenIssueId(epic.id)}><TypeIcon type="Epic" /> {keyOf(epic)}</button> /</>)}
          <TypeIcon type={issue.type} /> <span className="mono">{keyOf(issue)}</span>
        </div>
        <div className="row gap">
          {confirmDel ? (
            <>
              <span className="muted">Delete this issue?</span>
              <button className="btn danger" onClick={() => { dispatch({ type: "deleteIssue", id: issue.id }); close(); notify(`${keyOf(issue)} deleted`); }}>Delete</button>
              <button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button>
            </>
          ) : (
            <button className="icon-btn" title="Delete issue" onClick={() => setConfirmDel(true)}><FaTrash /></button>
          )}
          <button className="btn" onClick={close}>Close</button>
        </div>
      </div>

      <div className="issue-body">
        <div className="issue-main">
          <input className="title-input" value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary.trim() ? patch({ summary: summary.trim() }) : setSummary(issue.summary)} />

          <h4>Description</h4>
          <textarea className="desc-input" rows={5} placeholder="Add a description..." value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => patch({ description: desc })} />

          {issue.type === "Epic" && (
            <>
              <h4>Child issues <span className="muted">({doneKids}/{children.length} done)</span></h4>
              <div className="progress"><div style={{ width: children.length ? (doneKids / children.length) * 100 + "%" : 0 }} /></div>
              {children.map((c) => (
                <button key={c.id} className="child-row" onClick={() => setOpenIssueId(c.id)}>
                  <TypeIcon type={c.type} /> <span className="mono">{keyOf(c)}</span> <span className="grow">{c.summary}</span>
                  <span className={`lozenge ${c.status === "Done" ? "done" : c.status === "To Do" ? "todo" : c.status === "In Review" ? "review" : "inprog"}`}>{c.status}</span>
                </button>
              ))}
              {children.length === 0 && <p className="muted">No child issues yet. Set an issue's Epic field to link it here.</p>}
            </>
          )}

          <h4>Attachments <span className="muted">({(issue.attachments || []).length})</span></h4>
          <div className="att-list">
            {(issue.attachments || []).map((a) => (
              <div key={a.id} className="att-row">
                <FaPaperclip size={12} />
                <button type="button" className="link grow ellipsis" style={{ textAlign: "left" }} title="Download" onClick={() => downloadFile(a).catch((ex) => notify(ex.message))}>{a.name}</button>
                <span className="muted small">{fmtSize(a.size)}</span>
                {can.edit && <button className="icon-btn" title="Delete attachment" onClick={() => delAtt(a)}><FaTrash size={11} /></button>}
              </div>
            ))}
            {can.edit && <label className="btn edit-only att-add">{upBusy ? "Uploading..." : "+ Add file (max 5 MB)"}<input type="file" hidden disabled={upBusy} onChange={onFile} /></label>}
          </div>

          <h4>Activity</h4>
          <div className="comment-box">
            <Avatar user={usersById[state.currentUserId]} size={32} />
            <div className="grow">
              <textarea rows={2} placeholder="Add a comment..." value={comment} onChange={(e) => setComment(e.target.value)} />
              {comment.trim() && (
                <div className="row gap">
                  <button className="btn primary" onClick={() => { dispatch({ type: "addComment", id: issue.id, text: comment.trim() }); setComment(""); }}>Save</button>
                  <button className="btn" onClick={() => setComment("")}>Cancel</button>
                </div>
              )}
            </div>
          </div>
          {[...issue.comments].reverse().map((c) => (
            <div key={c.id} className="comment">
              <Avatar user={usersById[c.userId]} size={32} />
              <div className="grow">
                <b>{usersById[c.userId]?.name}</b> <span className="muted">{timeAgo(c.at)}</span>
                <p>{c.text}</p>
                {c.userId === state.currentUserId && <button className="link small" onClick={() => dispatch({ type: "deleteComment", id: issue.id, commentId: c.id })}>Delete</button>}
              </div>
            </div>
          ))}
          {issue.comments.length === 0 && <p className="muted">No comments yet.</p>}
        </div>

        <div className="issue-side">
          <select className={`status-select ${issue.status.replace(/\s/g, "").toLowerCase()}`} value={issue.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>

          <div className="details-card">
            <h5>Details</h5>
            <Field label="Assignee">
              <div className="row gap"><Avatar user={usersById[issue.assigneeId]} size={22} />
                <select value={issue.assigneeId || ""} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {issue.assigneeId !== state.currentUserId && <button className="link small" onClick={() => patch({ assigneeId: state.currentUserId })}>Assign to me</button>}
            </Field>
            <Field label="Reporter"><div className="row gap"><Avatar user={usersById[issue.reporterId]} size={22} /> {usersById[issue.reporterId]?.name}</div></Field>
            <Field label="Type">
              <div className="row gap"><TypeIcon type={issue.type} />
                <select value={issue.type} onChange={(e) => patch({ type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </Field>
            <Field label="Priority">
              <div className="row gap"><PriorityIcon priority={issue.priority} />
                <select value={issue.priority} onChange={(e) => patch({ priority: e.target.value })}>{PRIORITIES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </Field>
            <Field label="Labels">
              <input value={labels} placeholder="comma, separated" onChange={(e) => setLabels(e.target.value)} onBlur={() => patch({ labels: labels.split(",").map((l) => l.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Story points">
              <input type="number" min="0" value={issue.points ?? ""} onChange={(e) => patch({ points: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Sprint">
              <select value={issue.sprintId || ""} onChange={(e) => patch({ sprintId: e.target.value || null })}>
                <option value="">Backlog</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {issue.type !== "Epic" && (
              <Field label="Epic">
                <select value={issue.epicId || ""} onChange={(e) => patch({ epicId: e.target.value || null })}>
                  <option value="">None</option>
                  {epics.map((e) => <option key={e.id} value={e.id}>{keyOf(e)} {e.summary}</option>)}
                </select>
              </Field>
            )}
            {issue.type === "Epic" && (
              <Field label="Start date"><input type="date" value={issue.startDate} onChange={(e) => patch({ startDate: e.target.value })} /></Field>
            )}
            <Field label="Due date"><input type="date" value={issue.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} /></Field>
          </div>
          <p className="muted small">Created {fmtDate(new Date(issue.createdAt).toISOString())}</p>
        </div>
      </div>
    </Modal>
  );
}
