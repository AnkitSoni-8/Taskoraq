import { useState } from "react";
import { FaStar, FaRegStar, FaTrash } from "react-icons/fa";
import { useApp } from "../store.jsx";
import { Avatar, Empty, Modal } from "../ui.jsx";

function CreateProject({ onClose }) {
  const { state, dispatch, setView, notify } = useApp();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const autoKey = (n) => n.replace(/[^a-zA-Z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 4).toUpperCase();
  const submit = () => {
    const k = (key || autoKey(name)).toUpperCase();
    if (!name.trim()) return setErr("Project name is required.");
    if (!/^[A-Z]{2,6}$/.test(k)) return setErr("Key must be 2-6 letters.");
    if (state.projects.some((p) => p.key === k)) return setErr(`Key ${k} is already used.`);
    dispatch({ type: "addProject", name: name.trim(), key: k, description: desc });
    notify(`Project ${name.trim()} created`);
    setView("board");
    onClose();
  };
  return (
    <Modal title="Create project" onClose={onClose} width={460}>
      <div className="form">
        <label>Name *<input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} /></label>
        <label>Key<input placeholder={autoKey(name) || "e.g. WEB"} value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} maxLength={6} /></label>
        <label>Description<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        {err && <p className="error">{err}</p>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Create</button>
      </div>
    </Modal>
  );
}

export default function Projects() {
  const { state, dispatch, usersById, setView } = useApp();
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState(null);
  const [q, setQ] = useState("");
  const list = state.projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.key.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Projects</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>Create project</button>
      </div>
      <div className="filter-bar"><input className="search-box" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length === 0 ? <Empty title="No projects">Create your first project to get started.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th /><th>Name</th><th>Key</th><th>Lead</th><th>Issues</th><th /></tr></thead>
            <tbody>
              {list.map((p) => {
                const issues = state.issues.filter((i) => i.projectId === p.id);
                const done = issues.filter((i) => i.status === "Done").length;
                return (
                  <tr key={p.id} onClick={() => { dispatch({ type: "setProject", id: p.id }); setView("board"); }}>
                    <td onClick={(e) => { e.stopPropagation(); dispatch({ type: "updateProject", id: p.id, patch: { starred: !p.starred } }); }}>
                      {p.starred ? <FaStar color="#E2B203" /> : <FaRegStar />}
                    </td>
                    <td><span className="row gap"><span className="proj-badge">{p.name[0]}</span> <b>{p.name}</b></span></td>
                    <td className="mono">{p.key}</td>
                    <td><span className="row gap"><Avatar user={usersById[p.lead]} size={22} /> {usersById[p.lead]?.name}</span></td>
                    <td>{issues.length} <span className="muted small">({done} done)</span></td>
                    <td onClick={(e) => e.stopPropagation()}><button className="icon-btn admin-only" title="Delete project" onClick={() => setDel(p)}><FaTrash size={12} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateProject onClose={() => setCreating(false)} />}
      {del && (
        <Modal title="Delete project" onClose={() => setDel(null)} width={440}>
          <div className="form"><p>Delete <b>{del.name}</b> and all of its issues and sprints? This can't be undone.</p></div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { dispatch({ type: "deleteProject", id: del.id }); setDel(null); }}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}
