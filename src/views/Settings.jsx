import { useState } from "react";
import { useApp } from "../store.jsx";
import { Avatar } from "../ui.jsx";

export default function Settings() {
  const { state, dispatch, project, notify } = useApp();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [lead, setLead] = useState(project.lead);
  const toggle = (uid) => {
    const members = project.members.includes(uid) ? project.members.filter((m) => m !== uid) : [...project.members, uid];
    dispatch({ type: "updateProject", id: project.id, patch: { members } });
  };
  return (
    <>
      <div className="crumb-line">Projects / {project.name}</div>
      <div className="page-head"><h1 className="page-title">Project settings</h1></div>
      <section className="panel narrow">
        <h3>Details</h3>
        <div className="form">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Key<input value={project.key} disabled /></label>
          <label>Description<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
          <label>Project lead
            <select value={lead} onChange={(e) => setLead(e.target.value)}>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
          <div><button className="btn primary" onClick={() => { if (!name.trim()) return; dispatch({ type: "updateProject", id: project.id, patch: { name: name.trim(), description: desc, lead } }); notify("Project saved"); }}>Save changes</button></div>
        </div>
      </section>
      <section className="panel narrow">
        <h3>People</h3>
        {state.users.map((u) => (
          <label key={u.id} className="member-row">
            <input type="checkbox" checked={project.members.includes(u.id)} onChange={() => toggle(u.id)} />
            <Avatar user={u} size={26} /> <span>{u.name}</span> <span className="muted small">{u.email}</span>
            {u.id === project.lead && <span className="pill">Lead</span>}
          </label>
        ))}
      </section>
      <section className="panel narrow">
        <h3>Appearance & data</h3>
        <div className="row gap">
          <button className="btn" onClick={() => dispatch({ type: "setTheme", theme: state.theme === "dark" ? "light" : "dark" })}>Switch to {state.theme === "dark" ? "light" : "dark"} theme</button>
          <button className="btn danger admin-only" onClick={() => { if (confirm("Reset all data to the demo data?")) { dispatch({ type: "reset" }); notify("Demo data restored"); } }}>Reset demo data</button>
        </div>
        <p className="muted small">Data is saved in MongoDB through the Express backend (backend/ folder).</p>
      </section>
    </>
  );
}
