import { useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Box, ChevronDown, CircleHelp,
  Command, Cpu, Gauge, LayoutDashboard, Menu, Plus, Search, Settings2,
  ShieldCheck, Sparkles, Wrench, X, Zap, Factory, ClipboardCheck, Workflow,
  CalendarClock, ScanLine, Layers3, CircleDot, Clock3
} from "lucide-react";

type ProcessStep = { id: number; name: string; machine: string; duration: string; status: "Complete" | "Running" | "Queued"; };
const initialSteps: ProcessStep[] = [
  { id: 1, name: "Raw stock verification", machine: "Incoming inspection", duration: "08 min", status: "Complete" },
  { id: 2, name: "Face & datum milling", machine: "VMC · Operation 10", duration: "24 min", status: "Complete" },
  { id: 3, name: "Rough pocket milling", machine: "VMC · Operation 20", duration: "38 min", status: "Running" },
  { id: 4, name: "Precision boring", machine: "CNC · Operation 30", duration: "17 min", status: "Queued" },
  { id: 5, name: "Wire EDM profile", machine: "Wire EDM · Operation 40", duration: "42 min", status: "Queued" },
  { id: 6, name: "Deburr & edge finish", machine: "Finishing cell", duration: "12 min", status: "Queued" },
  { id: 7, name: "Final CMM inspection", machine: "Quality lab", duration: "16 min", status: "Queued" },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Process planner", icon: Workflow },
  { label: "Machine fleet", icon: Cpu },
  { label: "Tooling & offsets", icon: Wrench },
  { label: "Quality control", icon: ShieldCheck },
  { label: "Jobs & routing", icon: Layers3 },
];

const navContent: Record<string, { eyebrow: string; title: string; description: string }> = {
  Overview: { eyebrow: "MANUFACTURING INTELLIGENCE", title: "Good morning, Engineer.", description: "Your shop floor at a glance. Here's what needs attention today." },
  "Process planner": { eyebrow: "ENGINEERING WORKSPACE", title: "Process planner.", description: "Map every operation from raw stock to final inspection." },
  "Machine fleet": { eyebrow: "SHOP-FLOOR CONTROL", title: "Machine fleet.", description: "Monitor utilization, cycle states, and machine readiness." },
  "Tooling & offsets": { eyebrow: "TOOL MANAGEMENT", title: "Tooling & offsets.", description: "Keep cutting tools, holders, and offsets traceable." },
  "Quality control": { eyebrow: "QUALITY SYSTEM", title: "Quality control.", description: "Bring inspection plans and non-conformance into one view." },
  "Jobs & routing": { eyebrow: "PRODUCTION CONTROL", title: "Jobs & routing.", description: "Track active work orders and their route through the shop." },
};

function App() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [jobName, setJobName] = useState("");
  const [steps, setSteps] = useState(initialSteps);
  const [activeStep, setActiveStep] = useState(3);
  const [notice, setNotice] = useState("");
  const current = navContent[activeNav];
  const visibleSteps = useMemo(() => steps.filter(s => (s.name + " " + s.machine).toLowerCase().includes(search.toLowerCase())), [steps, search]);

  const addJob = () => {
    if (!jobName.trim()) return;
    setNotice(`Job “${jobName.trim()}” added to the planning queue.`);
    setJobName("");
    setShowNewJob(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>A</span><i /></div>
          <div className="brand-word">axi<span>mach</span><small>MANUFACTURING OS</small></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
        <div className="workspace-card">
          <div className="workspace-avatar"><Factory size={17} /></div>
          <div><strong>Precision Works</strong><span>Production floor</span></div>
          <span className="online-dot" />
        </div>
        <div className="nav-caption">COMMAND CENTER</div>
        <nav className="main-nav">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => { setActiveNav(label); setMobileMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Quality control" && <span className="nav-count">2</span>}
              {activeNav === label && <span className="active-rail" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ai-card">
            <div className="ai-card-icon"><Sparkles size={16} /></div>
            <div><strong>Machining copilot</strong><p>Explore smarter process decisions.</p></div>
            <ArrowUpRight size={15} />
          </div>
          <button className="nav-item" onClick={() => setNotice("Settings panel is planned for the next build.")}><Settings2 size={18} /><span>Settings</span></button>
          <div className="profile-row">
            <div className="profile-avatar">PE</div><div className="profile-text"><strong>Production Engineer</strong><span>Workspace admin</span></div><MoreDots />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><button className="icon-button menu-toggle" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span>axi<strong>mach</strong></span></div>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(v => !v)}><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button>
            {searchOpen && <div className="search-popover"><div className="search-input-wrap"><Search size={17} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search process steps…" /><button onClick={() => {setSearch("");setSearchOpen(false);}}><X size={16}/></button></div><p>Filtering the process chart below</p></div>}
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("You're all caught up — no new critical alerts.")}><Bell size={18} /><i /></button>
            <div className="topbar-divider" />
            <div className="user-chip"><div className="profile-avatar small">PE</div><ChevronDown size={14} /></div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" />{current.eyebrow}</div><h1>{current.title}</h1><p className="page-description">{current.description}</p></div>
            <div className="welcome-actions"><span className="live-pill"><i /> SYSTEM LIVE</span><button className="primary-button" onClick={() => setShowNewJob(true)}><Plus size={17} /> New job</button></div>
          </section>

          {notice && <div className="notice"><ShieldCheck size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}

          <section className="metrics-grid">
            <MetricCard label="Active work orders" value="24" delta="+12.8%" up detail="vs. last week" icon={<ClipboardCheck size={18}/>} accent="violet" />
            <MetricCard label="Machine utilization" value="86.4%" delta="+4.2%" up detail="vs. last shift" icon={<Gauge size={18}/>} accent="cyan" />
            <MetricCard label="On-time completion" value="94.8%" delta="+2.6%" up detail="vs. target" icon={<Activity size={18}/>} accent="green" />
            <MetricCard label="Quality alerts" value="02" delta="Needs review" up={false} detail="1 high priority" icon={<ScanLine size={18}/>} accent="amber" />
          </section>

          <section className="section-heading-row">
            <div><div className="section-kicker"><span className="section-kicker-dot" /> LIVE WORKFLOW</div><h2>Machining process chart</h2><p>Job <strong>AX-2048</strong> <span className="muted-separator">·</span> Precision housing / Rev C</p></div>
            <div className="chart-actions"><span className="job-status"><span /> IN PROGRESS</span><button className="secondary-button" onClick={() => setNotice("Process chart export is being prepared for a future release.")}><Command size={15} /> Export</button></div>
          </section>

          <section className="process-panel">
            <div className="process-panel-top">
              <div className="process-meta"><div className="part-icon"><Box size={21}/></div><div><strong>Housing · PH-2048-C</strong><span>Aluminium 6061-T6 <b>·</b> Batch 0241</span></div></div>
              <div className="process-progress"><div className="progress-label"><span>ROUTE COMPLETION</span><strong>2 / 7 <small>operations</small></strong></div><div className="progress-track"><span style={{width:"35%"}} /></div></div>
              <button className="icon-button more-button" aria-label="Process options" onClick={() => setNotice("Process options will be available in the next build.")}><MoreDots /></button>
            </div>
            <div className="chart-scroll-hint"><ArrowDownRight size={14}/> Scroll horizontally to explore the full route <span>→</span></div>
            <div className="process-scroll" tabIndex={0} aria-label="Scrollable machining process chart">
              <div className="process-track">
                <div className="track-line"><span className="track-line-complete" /></div>
                {visibleSteps.map((step, index) => (
                  <button key={step.id} className={`process-step ${step.status.toLowerCase()} ${activeStep === step.id ? "selected" : ""}`} onClick={() => setActiveStep(step.id)}>
                    <div className="step-node-wrap"><div className="step-node">{step.status === "Complete" ? <ShieldCheck size={16}/> : step.status === "Running" ? <Zap size={16}/> : <span>{String(step.id).padStart(2,"0")}</span>}</div>{step.status === "Running" && <span className="node-pulse" />}</div>
                    <div className="step-card"><div className="step-card-top"><span>OP {String(step.id * 10).padStart(3,"0")}</span><span className={`status-label ${step.status.toLowerCase()}`}>{step.status}</span></div><strong>{step.name}</strong><p>{step.machine}</p><div className="step-card-footer"><span><Clock3 size={13}/>{step.duration}</span><span className="step-index">{String(step.id).padStart(2,"0")}</span></div></div>
                    {index < visibleSteps.length - 1 && <div className="step-connector" />}
                  </button>
                ))}
                {visibleSteps.length === 0 && <div className="empty-search">No process steps match “{search}”.</div>}
              </div>
            </div>
            <div className="process-footer"><div className="legend"><span><i className="legend-complete"/>Complete</span><span><i className="legend-running"/>Running</span><span><i className="legend-queued"/>Queued</span></div><div className="selected-step">Selected: <strong>{steps.find(s => s.id === activeStep)?.name ?? "—"}</strong></div><button className="text-button" onClick={() => setActiveNav("Process planner")}>Open process planner <ArrowUpRight size={15}/></button></div>
          </section>

          <section className="lower-grid">
            <div className="surface-card machine-card">
              <div className="card-heading"><div><span className="section-kicker">SHOP FLOOR</span><h3>Machine status</h3></div><button className="text-button" onClick={() => setActiveNav("Machine fleet")}>View fleet <ArrowUpRight size={14}/></button></div>
              <div className="machine-row"><div className="machine-icon running"><Cpu size={19}/></div><div className="machine-info"><strong>VMC-04 <span className="machine-tag">3-axis</span></strong><span>Doosan · Rough pocket milling</span><div className="machine-progress"><i style={{width:"78%"}}/></div></div><div className="machine-state"><i className="state-green"/>Running<strong>78%</strong></div></div>
              <div className="machine-row"><div className="machine-icon idle"><Cpu size={19}/></div><div className="machine-info"><strong>CNC-02 <span className="machine-tag">Turning</span></strong><span>NL2000 · Awaiting next job</span><div className="machine-progress"><i style={{width:"0%"}}/></div></div><div className="machine-state idle-text"><i/>Idle<strong>Ready</strong></div></div>
              <div className="machine-row"><div className="machine-icon running"><Cpu size={19}/></div><div className="machine-info"><strong>EDM-01 <span className="machine-tag">Wire EDM</span></strong><span>Profile cutting · Job AX-2045</span><div className="machine-progress"><i style={{width:"42%"}}/></div></div><div className="machine-state"><i className="state-green"/>Running<strong>42%</strong></div></div>
            </div>
            <div className="surface-card attention-card">
              <div className="card-heading"><div><span className="section-kicker">PRIORITY QUEUE</span><h3>Needs attention</h3></div><span className="alert-count">02</span></div>
              <div className="attention-item"><div className="attention-icon amber"><Wrench size={17}/></div><div><strong>Tool life nearing limit</strong><p>VMC-04 · End mill T12 · 8% remaining</p><span className="attention-time">4 min ago</span></div><button aria-label="Open tool alert" onClick={() => setActiveNav("Tooling & offsets")}><ArrowUpRight size={16}/></button></div>
              <div className="attention-item"><div className="attention-icon red"><ScanLine size={17}/></div><div><strong>Inspection sign-off pending</strong><p>Job AX-2041 · Final CMM report</p><span className="attention-time">18 min ago</span></div><button aria-label="Open inspection alert" onClick={() => setActiveNav("Quality control")}><ArrowUpRight size={16}/></button></div>
              <button className="all-alerts" onClick={() => setActiveNav("Quality control")}>Review all alerts <ArrowUpRight size={14}/></button>
            </div>
          </section>
          <footer className="page-footer"><span><span className="footer-status"/> All systems operational</span><span>AxiMach <b>·</b> Manufacturing intelligence <b>·</b> Prototype workspace</span><span>v0.1.0</span></footer>
        </div>
      </main>

      {showNewJob && <div className="modal-backdrop" onClick={() => setShowNewJob(false)}><div className="new-job-modal" onClick={e => e.stopPropagation()}><div className="modal-heading"><div className="modal-icon"><Plus size={19}/></div><button className="icon-button" onClick={() => setShowNewJob(false)} aria-label="Close"><X size={18}/></button></div><h2>Create a work order</h2><p>Start a new job in the AxiMach planning workspace.</p><label htmlFor="job-name">Job name or part number</label><input id="job-name" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. AX-2050 · Mounting bracket" onKeyDown={e => e.key === "Enter" && addJob()} autoFocus/><div className="modal-actions"><button className="secondary-button" onClick={() => setShowNewJob(false)}>Cancel</button><button className="primary-button" onClick={addJob} disabled={!jobName.trim()}><Plus size={16}/> Add to queue</button></div><span className="modal-note">Prototype only — job persistence will be connected in a later phase.</span></div></div>}
    </div>
  );
}

function MetricCard({label,value,delta,up,detail,icon,accent}:{label:string;value:string;delta:string;up:boolean;detail:string;icon:React.ReactNode;accent:string}) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${accent}`}>{icon}</div></div><div className="metric-value">{value}</div><div className="metric-bottom"><span className={`metric-delta ${up ? "positive" : "negative"}`}>{up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {delta}</span><span className="metric-detail">{detail}</span></div><div className={`metric-glow ${accent}`}/></div>;
}

function MoreDots() { return <span className="more-dots"><i/><i/><i/></span>; }

export default App;
