import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  FaSearch, FaPlus, FaMoon, FaSun, FaHome, FaColumns, FaListUl, FaTable, FaBolt, FaChartBar, FaFolder, FaCog, FaStar, FaChevronDown, FaAngleLeft, FaAngleRight, FaUsers, FaSignOutAlt,
} from "react-icons/fa";
import { useApp, ROLE_LABEL } from "./store.jsx";
import { Avatar, TypeIcon, Logo } from "./ui.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Board from "./views/Board.jsx";
import Backlog from "./views/Backlog.jsx";
import Issues from "./views/Issues.jsx";
import Epics from "./views/Epics.jsx";
import Reports from "./views/Reports.jsx";
import Projects from "./views/Projects.jsx";
import Settings from "./views/Settings.jsx";
import Users from "./views/Users.jsx";
import Audit from "./views/Audit.jsx";
import { Bell } from "./realtime.jsx";
import { BackgroundLayer, BgPicker } from "./bg/Backgrounds.jsx";
import { FaHistory } from "react-icons/fa";
import IssueModal from "./views/IssueModal.jsx";
import CreateIssueModal from "./views/CreateIssueModal.jsx";

const NAV = [
  { id: "dashboard", label: "For you", icon: FaHome, global: true },
  { id: "projects", label: "Projects", icon: FaFolder, global: true },
  { id: "board", label: "Board", icon: FaColumns },
  { id: "backlog", label: "Backlog", icon: FaListUl },
  { id: "issues", label: "Issues", icon: FaTable },
  { id: "epics", label: "Roadmap", icon: FaBolt },
  { id: "reports", label: "Reports", icon: FaChartBar },
  { id: "settings", label: "Project settings", icon: FaCog },
  { id: "users", label: "Users & roles", icon: FaUsers, global: true },
  { id: "audit", label: "Audit log", icon: FaHistory, global: true, adminOnly: true },
];

function TopBar() {
  const { state, dispatch, project, me, role, can, onLogout, projectsById, usersById, keyOf, setOpenIssueId, setCreateDraft, setView } = useApp();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return state.issues
      .filter((i) => i.summary.toLowerCase().includes(t) || keyOf(i).toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, state.issues]); // eslint-disable-line

  return (
    <header className="topbar">
      <div className="brand" onClick={() => setView("dashboard")}>
        <Logo height={46} />
      </div>

      <div className="menu-wrap">
        <button className="top-link" onClick={() => setMenu(menu === "proj" ? null : "proj")}>
          Projects <FaChevronDown size={10} />
        </button>
        {menu === "proj" && (
          <div className="dropdown" onMouseLeave={() => setMenu(null)}>
            <div className="dropdown-label">Recent</div>
            {state.projects.map((p) => (
              <button key={p.id} className="dropdown-item" onClick={() => { dispatch({ type: "setProject", id: p.id }); setView("board"); setMenu(null); }}>
                <span className="proj-badge">{p.key[0]}</span> {p.name} <small>({p.key})</small>
                {p.starred && <FaStar color="#E2B203" size={11} />}
              </button>
            ))}
            <hr />
            <button className="dropdown-item" onClick={() => { setView("projects"); setMenu(null); }}>View all projects</button>
          </div>
        )}
      </div>

      <button className="btn primary" onClick={() => setCreateDraft({})} disabled={!project || !can.edit} title={can.edit ? "" : "Viewers have read-only access"}>
        <FaPlus size={11} /> Create
      </button>

      <div className="search-wrap">
        <FaSearch size={13} className="search-icon" />
        <input
          placeholder="Search issues by key or summary"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
        />
        {focus && q.trim() && (
          <div className="dropdown search-results">
            {results.length === 0 && <div className="dropdown-label">No matching issues</div>}
            {results.map((i) => (
              <button key={i.id} className="dropdown-item" onMouseDown={() => { setOpenIssueId(i.id); setQ(""); }}>
                <TypeIcon type={i.type} /> <span className="mono">{keyOf(i)}</span> {i.summary}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <BgPicker />
        <Bell />
        <button className="icon-btn" title="Toggle theme" onClick={() => dispatch({ type: "setTheme", theme: state.theme === "dark" ? "light" : "dark" })}>
          {state.theme === "dark" ? <FaSun /> : <FaMoon />}
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu(menu === "user" ? null : "user")}>
            <Avatar user={me} size={28} />
          </button>
          {menu === "user" && (
            <div className="dropdown right" onMouseLeave={() => setMenu(null)}>
              <div className="dropdown-label">{me.name}<br /><small>{me.email}</small></div>
              <div className="dropdown-label"><span className={`role-badge ${role}`}>{ROLE_LABEL[role]}</span></div>
              <hr />
              <button className="dropdown-item" onClick={onLogout}><FaSignOutAlt /> Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({ collapsed, setCollapsed }) {
  const { project, view, setView, can } = useApp();
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {project && !collapsed && (
        <div className="side-project">
          <span className="proj-badge lg">{project.key[0]}</span>
          <div>
            <b>{project.name}</b>
            <small>Software project</small>
          </div>
        </div>
      )}
      <nav>
        {NAV.map((n, idx) => {
          if (n.adminOnly && !can.manageUsers) return null;
          const disabled = !n.global && !project;
          return (
            <div key={n.id}>
              {idx === 2 && <div className="side-sep">{!collapsed && "PLANNING"}</div>}
              <button
                disabled={disabled}
                className={`side-item ${view === n.id ? "active" : ""}`}
                onClick={() => setView(n.id)}
                title={n.label}
              >
                <n.icon /> {!collapsed && n.label}
              </button>
            </div>
          );
        })}
      </nav>
      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Collapse sidebar">
        {collapsed ? <FaAngleRight /> : <FaAngleLeft />}
      </button>
    </aside>
  );
}

const VIEWS = { dashboard: Dashboard, board: Board, backlog: Backlog, issues: Issues, epics: Epics, reports: Reports, projects: Projects, settings: Settings, users: Users, audit: Audit };

export default function App() {
  const { view, setView, project, openIssueId, createDraft, toast, role, can } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const needsProject = !["dashboard", "projects", "users", "audit"].includes(view);
  const View = needsProject && !project ? Projects : VIEWS[view] || Dashboard;

  return (
    <div className="app">
      <div className="bg-blobs" aria-hidden="true"><span /><span /><span /></div>
      <BackgroundLayer />
      <TopBar />
      <div className="layout">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="content">
          {role === "viewer" && <div className="ro-banner">You have <b>view-only</b> access. Ask an admin for Co-admin rights to make changes.</div>}
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(3px)" }} transition={{ duration: 0.22 }} className="view">
              <View />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {openIssueId && <IssueModal />}
      {createDraft && <CreateIssueModal />}
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
