import { useEffect, useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { useApp, ROLE_LABEL } from "../store.jsx";
import { api } from "../api.js";

export default function Invites() {
  const { notify } = useApp();
  const [list, setList] = useState([]);
  const [f, setF] = useState({ email: "", role: "viewer" });
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.invites().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.addInvite(f.email, f.role);
      setLast(r);
      setF({ email: "", role: "viewer" });
      notify(r.emailSent ? "Invite email sent" : "Invite created - copy the link below");
      load();
    } catch (ex) { notify(ex.message); } finally { setBusy(false); }
  };
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => notify("Link copied"));
  const origin = location.origin;

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3><FaEnvelope /> Invite by email</h3>
      <form className="user-form" onSubmit={send}>
        <input type="email" placeholder="teammate@company.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {["admin", "coadmin", "viewer"].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button className="btn primary" disabled={busy}>{busy ? "Sending..." : "Send invite"}</button>
      </form>
      {last && (
        <p className="small" style={{ marginTop: 8 }}>
          {last.emailSent ? "Email sent. " : "Email is not configured (SMTP) - share this link manually: "}
          <button className="link small" onClick={() => copy(last.link)}>Copy invite link</button>
        </p>
      )}
      {list.length > 0 && (
        <table className="table" style={{ marginTop: 10 }}>
          <thead><tr><th>Pending invites</th><th>Role</th><th>Expires</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.token}>
                <td>{i.email}</td>
                <td><span className={`role-badge ${i.role}`}>{ROLE_LABEL[i.role]}</span></td>
                <td className="muted">{new Date(i.expiresAt).toLocaleDateString()}</td>
                <td>
                  <button className="link small" onClick={() => copy(`${origin}/?invite=${i.token}`)}>Copy link</button>{" "}
                  <button className="link small" onClick={() => api.deleteInvite(i.token).then(load)}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
