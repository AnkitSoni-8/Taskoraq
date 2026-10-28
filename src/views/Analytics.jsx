import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useApp, STATUSES, PRIORITIES, isoDay } from "../store.jsx";
import { PRIORITY_META, Reveal } from "../ui.jsx";

const SC = { "To Do": "#8c9bab", "In Progress": "#1d7afc", "In Review": "#e56910", Done: "#22a06b" };
const DAY = 864e5;

function Bars({ data, color, tip, unit = "issues" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.length === 0 && <span className="muted small">No data yet</span>}
      {data.map((d) => (
        <div className="bar-row hoverable" key={d.label} onMouseMove={tip.show(`${d.label}: ${d.value} ${unit}`)} onMouseLeave={tip.hide}>
          <span className="bar-label ellipsis">{d.label}</span>
          <div className="bar-track"><motion.div className="bar-fill" style={{ background: d.color || color }} initial={{ width: 0 }} whileInView={{ width: (d.value / max) * 100 + "%" }} viewport={{ once: true }} transition={{ duration: 0.7 }} /></div>
          <b>{d.value}</b>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { state, usersById } = useApp();
  const d = useMemo(() => {
    const issues = state.issues.filter((i) => i.type !== "Epic");
    const done = issues.filter((i) => i.status === "Done");
    const today = isoDay();
    const byStatus = STATUSES.map((s) => ({ label: s, value: issues.filter((i) => i.status === s).length, color: SC[s] }));
    const byPriority = PRIORITIES.map((p) => ({ label: p, value: issues.filter((i) => i.priority === p && i.status !== "Done").length, color: PRIORITY_META[p].color }));
    const load = {};
    issues.filter((i) => i.status !== "Done").forEach((i) => { const k = i.assigneeId || "none"; load[k] = (load[k] || 0) + 1; });
    const workload = Object.entries(load).map(([k, v]) => ({ label: usersById[k]?.name || "Unassigned", value: v })).sort((a, b) => b.value - a.value).slice(0, 6);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const trend = Array.from({ length: 14 }, (_, n) => {
      const s = t0.getTime() - (13 - n) * DAY;
      return { created: issues.filter((i) => i.createdAt >= s && i.createdAt < s + DAY).length, done: issues.filter((i) => i.doneAt && i.doneAt >= s && i.doneAt < s + DAY).length };
    });
    return {
      total: issues.length, done: done.length, pct: issues.length ? Math.round((done.length / issues.length) * 100) : 0,
      overdue: issues.filter((i) => i.dueDate && i.dueDate < today && i.status !== "Done").length,
      inProg: issues.filter((i) => i.status === "In Progress").length, byStatus, byPriority, workload, trend,
    };
  }, [state.issues, usersById]);

  const [tipState, setTipState] = useState(null);
  const [hot, setHot] = useState(null);
  const tip = {
    show: (text) => (e) => setTipState({ x: e.clientX, y: e.clientY, text }),
    hide: () => setTipState(null),
  };
  const R = 40, C = 2 * Math.PI * R;
  let acc = 0;
  const t0d = (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); })();
  const tmax = Math.max(1, ...d.trend.flatMap((t) => [t.created, t.done]));

  return (
    <div className="analytics">
      <Reveal className="kpis">
        {[["Total issues", d.total], ["Completed", d.pct + "%"], ["In progress", d.inProg], ["Overdue", d.overdue]].map(([l, v]) => (
          <motion.div key={l} className="kpi hoverable" whileHover={{ y: -4, scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <small>{l}</small><b>{v}</b>
          </motion.div>
        ))}
      </Reveal>
      <div className="an-grid">
        <Reveal className="an-card">
          <h3>Status</h3>
          <div className="row gap" style={{ gap: 16 }}>
            <svg viewBox="0 0 100 100" width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
              {d.total > 0 && d.byStatus.map((s) => {
                const len = (s.value / d.total) * C;
                const el = (
                  <circle key={s.label} className="donut-seg" cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth={hot === s.label ? 19 : 14} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}
                    opacity={hot && hot !== s.label ? 0.35 : 1}
                    onMouseEnter={() => setHot(s.label)} onMouseMove={tip.show(`${s.label}: ${s.value} (${Math.round((s.value / d.total) * 100)}%)`)} onMouseLeave={() => { setHot(null); tip.hide(); }} />
                );
                acc += len;
                return el;
              })}
            </svg>
            <div className="legend">{d.byStatus.map((s) => <div key={s.label} className={"legend-item" + (hot === s.label ? " on" : "")} onMouseEnter={() => setHot(s.label)} onMouseLeave={() => setHot(null)}><i style={{ background: s.color }} /> {s.label} <b>{s.value}</b></div>)}</div>
          </div>
        </Reveal>
        <Reveal className="an-card" delay={0.08}><h3>Open by priority</h3><Bars data={d.byPriority} tip={tip} /></Reveal>
        <Reveal className="an-card" delay={0.16}><h3>Open work per person</h3><Bars data={d.workload} color="#1d7afc" tip={tip} unit="open issues" /></Reveal>
        <Reveal className="an-card" delay={0.24}>
          <h3>Created vs done (14 days)</h3>
          <svg viewBox="0 0 280 90" width="100%" height="110">
            {d.trend.map((t, n) => (
              <g key={n} className="trend-col" transform={`translate(${n * 20 + 2},0)`} onMouseMove={tip.show(`${new Date(t0d - (13 - n) * DAY).toLocaleDateString(undefined, { day: "numeric", month: "short" })} — Created ${t.created}, Done ${t.done}`)} onMouseLeave={tip.hide}>
                <rect x="-2" y="0" width="19" height="90" fill="transparent" />
                <rect x="0" y={80 - (t.created / tmax) * 76} width="7" height={(t.created / tmax) * 76} rx="2" fill="#1d7afc" />
                <rect x="8" y={80 - (t.done / tmax) * 76} width="7" height={(t.done / tmax) * 76} rx="2" fill="#22a06b" />
              </g>
            ))}
          </svg>
          <div className="legend row gap"><span><i style={{ background: "#1d7afc" }} /> Created</span><span><i style={{ background: "#22a06b" }} /> Done</span></div>
        </Reveal>
      </div>
      {tipState && <div className="chart-tip" style={{ left: tipState.x + 14, top: tipState.y + 14 }}>{tipState.text}</div>}
    </div>
  );
}
