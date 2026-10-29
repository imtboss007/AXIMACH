import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, Bot,
  Box, Boxes, CalendarClock, Check, ChevronDown, CircleDollarSign, CircleHelp,
  ClipboardCheck, Clock3, Command, Cpu, Factory, FileDown, FileUp, Gauge,
  GitBranch, HardDrive, LayoutGrid, Handshake, Layers3, Menu, MessageCircle,
  Package, Pause, Play, Plug, Plus, RotateCcw, ScanLine, Search, Settings2,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Target, Truck, Users,
  Wallet, Workflow, Wrench, X, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ModuleItem = {
  id: string;
  title: string;
  group: string;
  description: string;
  icon: LucideIcon;
  action: string;
};

const modules: ModuleItem[] = [
  { id: "command-centre", title: "Command Centre & AI Copilot", group: "Command", description: "Factory health, alerts, priorities and evidence-linked AI assistance.", icon: Sparkles, action: "Open command centre" },
  { id: "companies", title: "Companies & Factories", group: "Governance", description: "Manage company, factory, shift and operating scopes.", icon: Factory, action: "Explore factory structure" },
  { id: "customers", title: "Customers, RFQs & Sales Orders", group: "Commercial", description: "Customer requirements, quotations, commitments and order intake.", icon: Target, action: "Review commercial pipeline" },
  { id: "purchasing", title: "Purchase Orders & Subcontract Orders", group: "Commercial", description: "Purchase approvals, subcontract work, acknowledgements and receipts.", icon: Package, action: "Review purchase workflow" },
  { id: "components", title: "Components, BOMs & Drawings", group: "Engineering", description: "Part masters, bills of material, drawings and linked revisions.", icon: Box, action: "Explore component records" },
  { id: "process-map", title: "Process Map / Process Graph", group: "Engineering", description: "Explore route operations, branches, subcontracting and rework loops.", icon: Workflow, action: "Open process universe" },
  { id: "process-master", title: "Process Master", group: "Engineering", description: "Maintain reusable manufacturing process definitions and parameters.", icon: Layers3, action: "Browse process library" },
  { id: "vendors", title: "Vendors & Sub-vendors", group: "Supply Network", description: "Manage suppliers, subcontractors, sites, contacts and relationships.", icon: Users, action: "Explore supplier network" },
  { id: "vendor-capability", title: "Vendor Capability Master", group: "Supply Network", description: "Match process capabilities, machine envelopes, tolerances and certificates.", icon: Cpu, action: "Explore capability matching" },
  { id: "rates", title: "Material & Rate Book", group: "Supply Network", description: "Track material grades, rate history, yield assumptions and pricing sources.", icon: Gauge, action: "Review rate book" },
  { id: "inventory", title: "Material & Inventory", group: "Operations", description: "Track lots, stock, reservations, shortages, scrap and balances.", icon: Boxes, action: "Explore inventory" },
  { id: "production", title: "Production & Capacity", group: "Operations", description: "Plan finite capacity across machines, shifts, people and outside processes.", icon: Activity, action: "Open production planning" },
  { id: "shop-floor", title: "Shop-floor Mobile & QR", group: "Operations", description: "Capture scan events, operation progress, custody and offline updates.", icon: ScanLine, action: "Explore shop-floor flow" },
  { id: "dispatch", title: "Transport & Dispatch", group: "Operations", description: "Track packing, challans, consignments, handoffs and confirmed receipt.", icon: Truck, action: "Explore logistics" },
  { id: "quality", title: "Quality & Inspection", group: "Quality & Reliability", description: "Inspection plans, measurements, holds, certificates and corrective actions.", icon: ClipboardCheck, action: "Review quality workflow" },
  { id: "tooling", title: "Tooling, Fixtures & Tool Crib", group: "Operations", description: "Manage tooling, fixtures, offsets, life limits and availability.", icon: Wrench, action: "Explore tooling" },
  { id: "maintenance", title: "Maintenance & Spare Parts", group: "Operations", description: "Preventive maintenance, faults, spare parts and machine readiness.", icon: Settings2, action: "Review maintenance" },
  { id: "workforce", title: "Workforce & Skills", group: "Operations", description: "Track qualifications, skill matrices, shifts and training requirements.", icon: Users, action: "Explore workforce" },
  { id: "costing", title: "Costing & Profitability", group: "Finance", description: "Compare estimates, commitments, actuals and cost per accepted part.", icon: CircleDollarSign, action: "Explore job costing" },
  { id: "invoices", title: "Invoices, Payments & Cash Flow", group: "Finance", description: "Reconcile invoices, credits, approvals, dues and payment status.", icon: Wallet, action: "Review finance controls" },
  { id: "communications", title: "Communication & Follow-up", group: "Connections", description: "Schedule supplier follow-ups and monitor messaging delivery and replies.", icon: MessageCircle, action: "Explore communication workflows" },
  { id: "risk", title: "Risk & Failure Prediction", group: "Quality & Reliability", description: "Model delivery, quality, capacity and process risks with traceable evidence.", icon: ShieldAlert, action: "Explore risk register" },
  { id: "engineering-change", title: "Engineering Change & Configuration Control", group: "Engineering", description: "Assess revision impact on open jobs, inventory, vendors and inspection plans.", icon: GitBranch, action: "Explore change control" },
  { id: "reports", title: "Reports & Analytics", group: "Insights", description: "Analyse performance, trends, exceptions and measured forecast accuracy.", icon: BarChart3, action: "Explore analytics" },
  { id: "export", title: "Export Centre", group: "Data & Platform", description: "Generate permission-aware CSV, spreadsheet and print-ready exports.", icon: FileDown, action: "Explore export options" },
  { id: "import", title: "Import Data", group: "Data & Platform", description: "Validate uploaded data, preview changes, detect duplicates and reconcile errors.", icon: FileUp, action: "Explore import workflow" },
  { id: "customer-portal", title: "Customer Portal", group: "Commercial", description: "Provide controlled customer visibility into orders, quality documents and delivery.", icon: Target, action: "Explore customer portal" },
  { id: "supplier-portal", title: "Supplier Portal", group: "Supply Network", description: "Support vendor RFQs, acknowledgements, dispatch notices and certificates.", icon: Handshake, action: "Explore supplier portal" },
  { id: "integrations", title: "Integrations & API", group: "Data & Platform", description: "Manage secure integrations for CAD, accounting, messaging and machine data.", icon: Plug, action: "Explore integrations" },
  { id: "ai-policy", title: "AI Policy & Automation", group: "Governance", description: "Configure bounded autonomy, approvals, policies and automation stop controls.", icon: Bot, action: "Review AI safeguards" },
  { id: "admin-security", title: "Administration, Governance & Security", group: "Governance", description: "Control roles, tenant scope, access reviews, audit events and sessions.", icon: ShieldCheck, action: "Review access model" },
  { id: "continuity", title: "Business Continuity & Recovery", group: "Data & Platform", description: "Manage backups, recovery targets, restore evidence and incident runbooks.", icon: HardDrive, action: "Explore recovery readiness" }
];

type ProcessStatus = "Complete" | "Running" | "Queued" | "Quality hold";
type ProcessStep = { id: number; name: string; station: string; duration: string; status: ProcessStatus; owner: string; note: string };

const startingSteps: ProcessStep[] = [
  { id: 1, name: "Material receipt & traceability", station: "Incoming stores", duration: "08 min", status: "Complete", owner: "Stores", note: "Verify material grade, heat number, certificate and received quantity." },
  { id: 2, name: "Incoming material inspection", station: "Quality lab", duration: "15 min", status: "Complete", owner: "Quality", note: "Confirm dimensions, material certificate and acceptance evidence." },
  { id: 3, name: "Face & datum milling", station: "VMC · Operation 10", duration: "24 min", status: "Running", owner: "Production", note: "Maintain datum traceability and record setup approval before cycle start." },
  { id: 4, name: "Rough pocket milling", station: "VMC · Operation 20", duration: "38 min", status: "Queued", owner: "Production", note: "Confirm tool availability, setup sheet and remaining stock allowance." },
  { id: 5, name: "Precision boring", station: "CNC · Operation 30", duration: "17 min", status: "Queued", owner: "Production", note: "Record bore measurement and gauge ID against the active drawing revision." },
  { id: 6, name: "Wire EDM profile", station: "Special process vendor", duration: "42 min", status: "Queued", owner: "Procurement", note: "Use an approved capability-matched vendor and track confirmed custody handoff." },
  { id: 7, name: "Deburr & edge finish", station: "Finishing cell", duration: "12 min", status: "Queued", owner: "Production", note: "Protect critical edges and capture the required finish acceptance." },
  { id: 8, name: "Final CMM inspection", station: "Quality lab", duration: "16 min", status: "Queued", owner: "Quality", note: "Hold shipment until authorised sign-off and all required characteristics pass." }
];

const groupOptions = ["All domains", ...Array.from(new Set(modules.map((item) => item.group)))];

function App() {
  const [activeModuleId, setActiveModuleId] = useState("command-centre");
  const [moduleExplorerOpen, setModuleExplorerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("All domains");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [notice, setNotice] = useState("");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [localJobs, setLocalJobs] = useState(["AX-2048 · Precision housing", "AX-2049 · Valve body", "AX-2050 · Mounting bracket"]);
  const [factory, setFactory] = useState("Precision Works · Main Plant");

  const activeModule = modules.find((item) => item.id === activeModuleId) ?? modules[0];

  const filteredModules = useMemo(() => modules.filter((item) => {
    const matchesDomain = domain === "All domains" || item.group === domain;
    const text = (item.title + " " + item.description + " " + item.group).toLowerCase();
    return matchesDomain && text.includes(query.toLowerCase().trim());
  }), [domain, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
        setModuleExplorerOpen(false);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setModuleExplorerOpen(false);
        setNewJobOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectModule = (id: string) => {
    setActiveModuleId(id);
    setModuleExplorerOpen(false);
    setCommandOpen(false);
    setQuery("");
    setNotice("");
  };

  const openModuleExplorer = () => {
    setQuery("");
    setDomain("All domains");
    setModuleExplorerOpen(true);
    setCommandOpen(false);
  };

  const runCommand = () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    if (lower.includes("delay") || lower.includes("late")) {
      setAiResponse("Demo insight: review the queued EDM profile and final CMM inspection before confirming the delivery promise. No live order data is connected yet.");
    } else if (lower.includes("vendor") || lower.includes("supplier")) {
      setAiResponse("Demo insight: compare process capability, available capacity, lead time, quality history and total landed cost. AXIMACH must show source evidence before recommending a vendor.");
    } else if (lower.includes("cost") || lower.includes("profit")) {
      setAiResponse("Demo insight: separate material, setup, cycle time, tooling, subcontracting, inspection, transport, rejection, overhead and tax. Compare actual cost per accepted piece—not only cost per produced piece.");
    } else if (lower.includes("quality") || lower.includes("inspection")) {
      setAiResponse("Demo insight: keep the affected batch on hold until an authorised quality role reviews the measurement evidence and records a release decision.");
    } else {
      setAiResponse("Demo response: I can help scope this request, but live records, connected models and authorised actions are not configured in this prototype. No business action has been executed.");
    }
    setNotice("Illustrative AI response only — no live business data was queried and no action was executed.");
  };

  const addLocalJob = () => {
    if (!newJobName.trim()) return;
    setLocalJobs((jobs) => [newJobName.trim(), ...jobs]);
    setNotice("The example work order was added to this browser session only; it is not saved to a server.");
    setNewJobName("");
    setNewJobOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="command-deck">
        <button className="brand-lockup" onClick={() => selectModule("command-centre")} aria-label="Open AXIMACH command centre">
          <span className="brand-symbol"><span>A</span><i /></span>
          <span className="brand-copy"><strong>AXI<span>MACH</span></strong><small>MANUFACTURING OS</small></span>
        </button>

        <div className="deck-divider" />
        <label className="factory-switcher">
          <Factory size={16} />
          <select value={factory} onChange={(event) => { setFactory(event.target.value); setNotice("Factory selection changed in this prototype; company-scoped server data is not connected."); }} aria-label="Select factory">
            <option>Precision Works · Main Plant</option>
            <option>Precision Works · Plant 02</option>
            <option>Prototype · Subcontract Network</option>
          </select>
          <ChevronDown size={14} />
        </label>

        <div className="deck-spacer" />
        <button className="command-search" onClick={() => { setCommandOpen(true); setModuleExplorerOpen(false); }} aria-label="Open command search">
          <Search size={17} /><span>Search modules, jobs, vendors…</span><kbd>⌘ K</kbd>
        </button>
        <button className="deck-action" onClick={openModuleExplorer}><LayoutGrid size={17} /><span>Modules</span><b>32</b></button>
        <button className="deck-icon alert-trigger" aria-label="Notifications" onClick={() => setNotice("Demo notifications: 1 simulated tool-life warning and 1 simulated quality sign-off reminder.")}><Bell size={18} /><i /></button>
        <button className="profile-trigger" onClick={() => setNotice("Profile and role management are not connected in this prototype.")}><span className="profile-mark">PE</span><span className="profile-name">Engineer</span><ChevronDown size={13} /></button>
      </header>

      <div className="status-ribbon">
        <span className="ribbon-dot" /> PROTOTYPE WORKSPACE
        <span className="ribbon-separator">/</span>
        <span>Sample data · No live machine or financial integrations</span>
        <span className="ribbon-right"><ShieldCheck size={13} /> Safety gates are design requirements</span>
      </div>

      <main className="page-content">
        {activeModuleId === "command-centre" ? (
          <CommandCentre
            activeModule={activeModule}
            aiPrompt={aiPrompt}
            aiResponse={aiResponse}
            localJobs={localJobs}
            notice={notice}
            onAiPromptChange={setAiPrompt}
            onRunCommand={runCommand}
            onNotice={setNotice}
            onNewJob={() => setNewJobOpen(true)}
            onSelectModule={selectModule}
            onOpenModules={openModuleExplorer}
          />
        ) : activeModuleId === "process-map" ? (
          <ProcessWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} />
        ) : (
          <ModuleWorkspace module={activeModule} onBack={() => selectModule("command-centre")} onNotice={setNotice} onOpenModules={openModuleExplorer} />
        )}
      </main>

      <nav className="command-rail" aria-label="Quick navigation">
        <button className={activeModuleId === "command-centre" ? "rail-active" : ""} onClick={() => selectModule("command-centre")}><Sparkles size={17} /><span>Command</span></button>
        <button className={activeModuleId === "process-map" ? "rail-active" : ""} onClick={() => selectModule("process-map")}><Workflow size={17} /><span>Process map</span></button>
        <button className={activeModuleId === "production" ? "rail-active" : ""} onClick={() => selectModule("production")}><Activity size={17} /><span>Production</span></button>
        <button className={activeModuleId === "vendors" ? "rail-active" : ""} onClick={() => selectModule("vendors")}><Users size={17} /><span>Vendors</span></button>
        <button className={activeModuleId === "quality" ? "rail-active" : ""} onClick={() => selectModule("quality")}><ClipboardCheck size={17} /><span>Quality</span></button>
        <button className="rail-all" onClick={openModuleExplorer}><LayoutGrid size={17} /><span>All modules</span></button>
      </nav>

      {moduleExplorerOpen && (
        <div className="overlay-shell" onMouseDown={(event) => { if (event.target === event.currentTarget) setModuleExplorerOpen(false); }}>
          <section className="module-universe" role="dialog" aria-modal="true" aria-labelledby="universe-title">
            <div className="universe-header">
              <div>
                <div className="eyebrow"><span className="eyebrow-mark" /> AXIMACH NAVIGATION SYSTEM</div>
                <h2 id="universe-title">Module universe<span>.</span></h2>
                <p>Every domain, one connected manufacturing workspace.</p>
              </div>
              <button className="close-round" onClick={() => setModuleExplorerOpen(false)} aria-label="Close module universe"><X size={19} /></button>
            </div>
            <div className="universe-tools">
              <label className="universe-search"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find any module or capability…" /><kbd>32 MODULES</kbd></label>
              <div className="domain-filters" aria-label="Filter modules by domain">
                {groupOptions.map((option) => <button key={option} className={domain === option ? "domain-active" : ""} onClick={() => setDomain(option)}>{option}</button>)}
              </div>
            </div>
            <div className="universe-grid">
              {filteredModules.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className="universe-card" onClick={() => selectModule(item.id)}>
                    <span className="universe-card-index">{String(modules.indexOf(item) + 1).padStart(2, "0")}</span>
                    <span className="universe-icon"><Icon size={20} strokeWidth={1.7} /></span>
                    <span className="universe-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                    <ArrowUpRight size={16} className="universe-arrow" />
                  </button>
                );
              })}
              {filteredModules.length === 0 && <div className="no-modules"><Search size={24} /><strong>No modules found</strong><span>Try another search or choose a different domain.</span><button onClick={() => { setQuery(""); setDomain("All domains"); }}>Clear filters</button></div>}
            </div>
            <div className="universe-footer"><span><LayoutGrid size={14} /> {filteredModules.length} of 32 modules</span><span>Tip: press <kbd>Ctrl/⌘ K</kbd> to search from anywhere</span></div>
          </section>
        </div>
      )}

      {commandOpen && (
        <div className="overlay-shell command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command search">
            <div className="palette-search"><Command size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any module…" /><button className="close-round compact" onClick={() => setCommandOpen(false)} aria-label="Close search"><X size={17} /></button></div>
            <div className="palette-label">MODULES & WORKSPACES</div>
            <div className="palette-results">
              {modules.filter((item) => (item.title + " " + item.group + " " + item.description).toLowerCase().includes(query.toLowerCase().trim())).slice(0, 10).map((item) => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => selectModule(item.id)}><span className="palette-icon"><Icon size={17} /></span><span><strong>{item.title}</strong><small>{item.group}</small></span><ArrowUpRight size={15} /></button>;
              })}
              {modules.filter((item) => (item.title + " " + item.group + " " + item.description).toLowerCase().includes(query.toLowerCase().trim())).length === 0 && <div className="palette-empty">No matching module. Try “quality”, “cost” or “process”.</div>}
            </div>
            <div className="palette-footer"><span><kbd>↵</kbd> Open module</span><span><kbd>Esc</kbd> Close</span></div>
          </section>
        </div>
      )}

      {newJobOpen && (
        <div className="overlay-shell modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewJobOpen(false); }}>
          <section className="new-job-modal" role="dialog" aria-modal="true" aria-labelledby="new-job-title">
            <div className="modal-heading"><span className="modal-icon"><Plus size={19} /></span><button className="close-round compact" onClick={() => setNewJobOpen(false)} aria-label="Close"><X size={18} /></button></div>
            <h2 id="new-job-title">Create a work order<span>.</span></h2>
            <p>Prototype only. This creates a session example, not a production order in a connected database.</p>
            <label htmlFor="job-name">Job name or part number</label>
            <input id="job-name" value={newJobName} onChange={(event) => setNewJobName(event.target.value)} placeholder="e.g. AX-2051 · Mounting bracket" onKeyDown={(event) => { if (event.key === "Enter") addLocalJob(); }} autoFocus />
            <div className="modal-actions"><button className="button-quiet" onClick={() => setNewJobOpen(false)}>Cancel</button><button className="button-primary" disabled={!newJobName.trim()} onClick={addLocalJob}><Plus size={16} /> Add example</button></div>
          </section>
        </div>
      )}
      <footer className="global-footer"><span>AXIMACH <b>PRECISION · FLOW · INTELLIGENCE</b></span><span>Design prototype v0.2 · Backend not connected</span></footer>
    </div>
  );
}

function CommandCentre(props: {
  activeModule: ModuleItem; aiPrompt: string; aiResponse: string; localJobs: string[]; notice: string;
  onAiPromptChange: (value: string) => void; onRunCommand: () => void; onNotice: (value: string) => void;
  onNewJob: () => void; onSelectModule: (id: string) => void; onOpenModules: () => void;
}) {
  const { aiPrompt, aiResponse, localJobs, notice, onAiPromptChange, onRunCommand, onNotice, onNewJob, onSelectModule, onOpenModules } = props;
  return (
    <>
      {notice && <div className="notice-banner"><ShieldCheck size={16} /><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}
      <section className="hero-command">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-mark" /> MANUFACTURING INTELLIGENCE / 01</div>
          <h1>See the whole flow.<br /><em>Control the details.</em></h1>
          <p>One connected view of work orders, machines, suppliers, quality and cost — designed for how real manufacturing runs.</p>
          <div className="hero-actions"><button className="button-primary" onClick={() => onSelectModule("process-map")}><Workflow size={17} /> Open process universe <ArrowRight size={15} /></button><button className="button-quiet" onClick={onOpenModules}><LayoutGrid size={16} /> Explore all 32 modules</button></div>
        </div>
        <div className="hero-graphic" aria-label="Illustrative connected manufacturing process visualization">
          <div className="graphic-grid" />
          <svg className="orbit-svg" viewBox="0 0 440 330" role="img" aria-label="Abstract manufacturing flow network">
            <defs><linearGradient id="flow-line" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8ebfff" /><stop offset="100%" stopColor="#2765e8" /></linearGradient></defs>
            <circle cx="220" cy="158" r="112" fill="none" stroke="#b5cef7" strokeWidth="1" strokeDasharray="3 7" />
            <circle cx="220" cy="158" r="77" fill="none" stroke="#a7c5f5" strokeWidth="1" strokeDasharray="2 8" />
            <path d="M84 91 L163 133 L282 73 L350 139 L287 232 L163 203 L84 91" fill="none" stroke="url(#flow-line)" strokeWidth="1.8" />
            <path d="M163 133 L168 254 L287 232 M282 73 L282 158 L350 139 M84 91 L65 174 L163 203" fill="none" stroke="#9dbded" strokeWidth="1.2" strokeDasharray="4 5" />
            <circle cx="220" cy="158" r="54" fill="#f9fbff" stroke="#7ba7f2" strokeWidth="1.4" />
            <circle cx="220" cy="158" r="44" fill="#e6efff" stroke="#b3cdf8" />
            <text x="220" y="151" fontSize="10" fontWeight="700" textAnchor="middle" fill="#4269b1" letterSpacing="2">AXI</text>
            <text x="220" y="169" fontSize="17" fontWeight="700" textAnchor="middle" fill="#142a4c">FLOW</text>
            <g className="orbit-node"><circle cx="84" cy="91" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><path d="M76 93 L84 85 L92 93 M78 94 V100 H90 V94" fill="none" stroke="#3975da" strokeWidth="1.4" /></g>
            <g className="orbit-node"><circle cx="282" cy="73" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><rect x="274" y="65" width="16" height="16" rx="3" fill="none" stroke="#3975da" strokeWidth="1.4" /><path d="M278 69 H286 M278 73 H286 M278 77 H283" stroke="#3975da" strokeWidth="1.2" /></g>
            <g className="orbit-node"><circle cx="350" cy="139" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><path d="M342 141 H358 M345 136 H355 M347 131 H353" stroke="#3975da" strokeWidth="1.6" /></g>
            <g className="orbit-node"><circle cx="287" cy="232" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><path d="M279 226 H295 V238 H279 Z M283 230 H291 M283 234 H291" fill="none" stroke="#3975da" strokeWidth="1.4" /></g>
            <g className="orbit-node"><circle cx="163" cy="203" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><circle cx="163" cy="203" r="8" fill="none" stroke="#3975da" strokeWidth="1.4" /><path d="M163 191 V195 M163 211 V215 M151 203 H155 M171 203 H175" stroke="#3975da" strokeWidth="1.2" /></g>
            <g className="orbit-node"><circle cx="65" cy="174" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><path d="M57 174 L63 180 L73 168" fill="none" stroke="#3975da" strokeWidth="1.6" /></g>
            <g className="orbit-node"><circle cx="168" cy="254" r="18" fill="#fff" stroke="#75a9fb" strokeWidth="1.5" /><path d="M160 250 H176 V258 H160 Z M163 246 H173 V250" fill="none" stroke="#3975da" strokeWidth="1.4" /></g>
          </svg>
          <div className="graphic-caption"><span className="ribbon-dot" /> CONNECTED FLOW / DEMO VISUAL</div>
          <span className="graphic-coordinate coord-one">01 / MATERIAL</span><span className="graphic-coordinate coord-two">07 / QUALITY</span>
        </div>
      </section>

      <section className="pulse-heading">
        <div><div className="eyebrow"><span className="eyebrow-mark" /> FACTORY PULSE</div><h2>Operational overview<span>.</span></h2><p>Illustrative values for interface review — not live shop-floor telemetry.</p></div>
        <div className="pulse-actions"><span className="demo-pill"><i /> SAMPLE DATA</span><button className="button-quiet compact-button" onClick={() => onNotice("Report export is not connected. No file was generated.")}><FileDown size={15} /> Export</button></div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Active work orders" value="24" trend="+12.8%" detail="sample · vs prior week" icon={ClipboardCheck} accent="blue" />
        <MetricCard title="Machine utilization" value="86.4%" trend="+4.2%" detail="sample · vs prior shift" icon={Gauge} accent="violet" />
        <MetricCard title="On-time completion" value="94.8%" trend="+2.6%" detail="sample · target comparison" icon={Activity} accent="green" />
        <MetricCard title="Quality alerts" value="02" trend="Needs review" detail="sample · 1 high priority" icon={ScanLine} accent="amber" />
      </section>

      <section className="dashboard-grid">
        <div className="surface-panel flow-preview">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> LIVE WORKFLOW PREVIEW</div><h3>Machining process route</h3><p>AX-2048 · Precision housing · Rev C</p></div><button className="round-action" onClick={() => onSelectModule("process-map")} aria-label="Expand process map"><ArrowUpRight size={18} /></button></div>
          <div className="mini-route">
            <span className="mini-node done"><Check size={13} /></span><span className="mini-connector complete" />
            <span className="mini-node done"><Check size={13} /></span><span className="mini-connector complete" />
            <span className="mini-node active"><Zap size={13} /></span><span className="mini-connector" />
            <span className="mini-node"><span>04</span></span><span className="mini-connector" />
            <span className="mini-node"><span>05</span></span><span className="mini-connector" />
            <span className="mini-node"><span>06</span></span><span className="mini-connector" />
            <span className="mini-node"><span>07</span></span>
          </div>
          <div className="mini-route-labels"><span>Material</span><span>Inspection</span><span>Machining</span><span>+4 steps</span></div>
          <div className="flow-summary"><span><i className="state-dot good" /> 2 complete</span><span><i className="state-dot live" /> 1 running</span><span><i className="state-dot pending" /> 4 queued</span><button onClick={() => onSelectModule("process-map")}>Explore full route <ArrowRight size={14} /></button></div>
        </div>

        <div className="surface-panel ai-panel">
          <div className="ai-panel-heading"><span className="ai-symbol"><Sparkles size={17} /></span><div><h3>AXIMACH intelligence</h3><p>Ask about manufacturing decisions</p></div><span className="demo-ai-label">DEMO</span></div>
          <form className="ai-form" onSubmit={(event) => { event.preventDefault(); onRunCommand(); }}>
            <input aria-label="Ask AXIMACH intelligence" value={aiPrompt} onChange={(event) => onAiPromptChange(event.target.value)} placeholder="e.g. Find delayed jobs…" />
            <button type="submit" disabled={!aiPrompt.trim()} aria-label="Send command"><ArrowRight size={17} /></button>
          </form>
          <div className="prompt-chips"><button onClick={() => onAiPromptChange("Which jobs are delayed?")}>Delayed jobs</button><button onClick={() => onAiPromptChange("Compare alternate vendors")}>Alternate vendors</button><button onClick={() => onAiPromptChange("Review job cost")}>Job cost</button></div>
          {aiResponse ? <div className="ai-response"><Sparkles size={15} /><span>{aiResponse}</span></div> : <div className="ai-disclaimer"><ShieldCheck size={15} /><span>Recommendations must cite source records. Payments, quality release and safety-critical actions require human approval.</span></div>}
        </div>

        <div className="surface-panel jobs-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> PLANNING QUEUE</div><h3>Work orders</h3><p>Session examples only · not saved to a database</p></div><button className="button-primary small-primary" onClick={onNewJob}><Plus size={15} /> Add example</button></div>
          <div className="job-list">
            {localJobs.slice(0, 4).map((job, index) => <div className="job-row" key={job}><span className="job-number">{String(index + 1).padStart(2, "0")}</span><span className="job-main"><strong>{job}</strong><small>{index === 0 ? "Prototype queue" : index === 1 ? "Plan review" : index === 2 ? "Material verification" : "New session record"}</small></span><span className={"job-chip " + (index === 0 ? "job-running" : "job-planned")}>{index === 0 ? "Running*" : "Planned*"}</span></div>)}
          </div>
          <div className="panel-footnote"><Clock3 size={13} /> All statuses are illustrative. *No work order is connected.</div>
        </div>

        <div className="surface-panel attention-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> ATTENTION QUEUE</div><h3>Review priorities</h3><p>Example alerts for workflow design</p></div><span className="attention-count">02</span></div>
          <button className="attention-row" onClick={() => onSelectModule("tooling")}><span className="attention-symbol amber-symbol"><Wrench size={17} /></span><span className="attention-copy"><strong>Tool-life warning</strong><small>VMC-04 · End mill T12 · example alert</small><em>Open tooling workspace</em></span><ArrowUpRight size={16} /></button>
          <button className="attention-row" onClick={() => onSelectModule("quality")}><span className="attention-symbol red-symbol"><ClipboardCheck size={17} /></span><span className="attention-copy"><strong>Inspection sign-off pending</strong><small>AX-2041 · Final CMM report · example alert</small><em>Open quality workspace</em></span><ArrowUpRight size={16} /></button>
          <div className="attention-safety"><ShieldCheck size={14} /> Quality holds release only through an authorised role.</div>
        </div>
      </section>

      <section className="module-shortcuts">
        <div className="section-row-title"><div><div className="eyebrow"><span className="eyebrow-mark" /> QUICK ACCESS</div><h2>Jump into a domain<span>.</span></h2></div><button className="button-quiet" onClick={onOpenModules}>View all 32 modules <ArrowRight size={15} /></button></div>
        <div className="shortcut-grid">
          {modules.filter((item) => ["process-map", "production", "vendors", "quality", "costing", "inventory"].includes(item.id)).map((item) => <ModuleShortcut key={item.id} module={item} onClick={() => onSelectModule(item.id)} />)}
        </div>
      </section>
    </>
  );
}

function MetricCard({ title, value, trend, detail, icon: Icon, accent }: { title: string; value: string; trend: string; detail: string; icon: LucideIcon; accent: string }) {
  return <article className="metric-card"><div className="metric-card-top"><span>{title}</span><span className={"metric-icon " + accent}><Icon size={18} /></span></div><strong className="metric-number">{value}</strong><div className="metric-card-bottom"><span className={"metric-trend " + (accent === "amber" ? "trend-warning" : "")}>{accent !== "amber" && <ArrowUpRight size={13} />}{trend}</span><span>{detail}</span></div><span className={"metric-flare " + accent} /></article>;
}

function ModuleShortcut({ module, onClick }: { module: ModuleItem; onClick: () => void }) {
  const Icon = module.icon;
  return <button className="shortcut-card" onClick={onClick}><span className="shortcut-icon"><Icon size={18} /></span><span><strong>{module.title}</strong><small>{module.group}</small></span><ArrowUpRight size={16} /></button>;
}

function ProcessWorkspace({ onBack, onNotice, notice }: { onBack: () => void; onNotice: (value: string) => void; notice: string }) {
  return (
    <section className="workspace-page">
      {notice && <div className="notice-banner"><ShieldCheck size={16} /><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}
      <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15} /> Command centre</button><span className="demo-pill"><i /> SAMPLE ROUTE · LOCAL EDITING</span></div>
      <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark" /> ENGINEERING / PROCESS GRAPH</div><h1>Process universe<span>.</span></h1><p>Add, select, edit, reorder and remove sample operations. Changes stay in this browser session.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onNotice("Export is not connected yet. Use the browser print option to save this screen as PDF.")}><FileDown size={15} /> Export / Print</button></div></div>
      <ProcessRoute onNotice={onNotice} />
      <div className="route-principles"><div><ShieldCheck size={17} /><span><strong>Editable demo route</strong><small>Local changes are for testing only and are not saved to a server.</small></span></div><div><Truck size={17} /><span><strong>Traceable custody</strong><small>Production handoffs need confirmed receipt and audit evidence.</small></span></div><div><ClipboardCheck size={17} /><span><strong>Quality gate</strong><small>Production release controls must be implemented before live use.</small></span></div></div>
    </section>
  );
}

function ProcessRoute({ onNotice }: { onNotice: (value: string) => void }) {
  const [steps, setSteps] = useState(startingSteps);
  const [activeStepId, setActiveStepId] = useState(3);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ name: "", station: "", duration: "15 min", owner: "Production", note: "" });
  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0];
  const visibleSteps = steps.filter((step) => (step.name + " " + step.station + " " + step.owner + " " + step.status).toLowerCase().includes(filter.toLowerCase().trim()));

  const updateActive = (patch: Partial<ProcessStep>) => {
    if (!activeStep) return;
    setSteps((previous) => previous.map((step) => step.id === activeStep.id ? { ...step, ...patch } : step));
    onNotice("Sample operation updated in this browser session only.");
  };
  const addOperation = () => {
    if (!draft.name.trim()) { onNotice("Enter an operation name before adding it."); return; }
    const id = Math.max(0, ...steps.map((step) => step.id)) + 1;
    const step: ProcessStep = { id, name: draft.name.trim(), station: draft.station.trim() || "Unassigned station", duration: draft.duration.trim() || "15 min", status: "Queued", owner: draft.owner.trim() || "Unassigned", note: draft.note.trim() || "Add the required setup, quality and acceptance instructions." };
    setSteps((previous) => [...previous, step]);
    setActiveStepId(id);
    setDraft({ name: "", station: "", duration: "15 min", owner: "Production", note: "" });
    setFilter("");
    onNotice("Operation added to the sample route. This is not saved to a server.");
  };
  const moveActive = (direction: -1 | 1) => {
    const index = steps.findIndex((step) => step.id === activeStepId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= steps.length) return;
    setSteps((previous) => { const copy = [...previous]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
    onNotice("Sample route order changed locally. Production route revisioning is not connected.");
  };
  const deleteActive = () => {
    if (!activeStep) return;
    if (steps.length <= 1) { onNotice("Keep at least one operation in the route."); return; }
    const nextSteps = steps.filter((step) => step.id !== activeStep.id);
    setSteps(nextSteps);
    setActiveStepId(nextSteps[Math.max(0, steps.findIndex((step) => step.id === activeStepId) - 1)].id);
    onNotice("Sample operation removed locally. No production record was deleted.");
  };

  return (
    <div className="route-workspace surface-panel">
      <div className="route-topbar">
        <div className="route-part"><span className="part-symbol"><Box size={20} /></span><span><strong>PH-2048-C · Precision housing</strong><small>Aluminium 6061-T6 <b>·</b> Batch 0241 <b>·</b> Revision C · DEMO</small></span></div>
        <div className="route-progress"><span>ROUTE COMPLETION <strong>{steps.filter((step) => step.status === "Complete").length} / {steps.length}</strong></span><div><i style={{ width: (steps.filter((step) => step.status === "Complete").length / steps.length * 100) + "%" }} /></div></div>
        <span className="demo-pill compact-demo"><i /> DEMO DATA</span>
      </div>
      <div className="route-controls">
        <div className="route-controls-left"><span className="control-label">VIEW</span><button className={orientation === "horizontal" ? "control-active" : ""} onClick={() => setOrientation("horizontal")}>Horizontal</button><button className={orientation === "vertical" ? "control-active" : ""} onClick={() => setOrientation("vertical")}>Vertical</button></div>
        <div className="route-controls-right">
          <input className="route-filter" aria-label="Search operations" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find operation…" />
          <button className={"button-quiet compact-button " + (editMode ? "control-active" : "")} onClick={() => setEditMode((value) => !value)}><GitBranch size={14} /> {editMode ? "Close editor" : "Edit route"}</button>
          <button className="icon-control" aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((value) => Math.max(0.6, Math.round((value - 0.1) * 10) / 10))}>−</button><input aria-label="Route zoom" type="range" min="0.6" max="1.3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button className="icon-control" aria-label="Zoom in" disabled={zoom >= 1.3} onClick={() => setZoom((value) => Math.min(1.3, Math.round((value + 0.1) * 10) / 10))}>+</button><span className="zoom-readout">{Math.round(zoom * 100)}%</span><button className="button-quiet compact-button" onClick={() => setZoom(1)}><RotateCcw size={14} /> Fit route</button>
        </div>
      </div>
      {editMode && <section className="route-editor-panel">
        <div className="route-editor-heading"><div><strong><Plus size={15} /> Add operation</strong><small>Fill the fields and add it to this sample route.</small></div><span>LOCAL DEMO EDITOR</span></div>
        <div className="route-editor-form">
          <label>Operation name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. CNC turning OD/ID" /></label>
          <label>Machine / station / vendor<input value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value })} placeholder="e.g. CNC lathe · Vendor A" /></label>
          <label>Duration<input value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} placeholder="e.g. 25 min" /></label>
          <label>Responsible team<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} placeholder="Production" /></label>
          <label className="editor-wide">Work / quality notes<input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Setup, inspection and acceptance notes" /></label>
          <button className="button-primary" onClick={addOperation}><Plus size={15} /> Add operation</button>
        </div>
      </section>}
      <div className={"route-scroll " + (orientation === "vertical" ? "route-vertical" : "")} tabIndex={0} aria-label="Scrollable manufacturing process route">
        <div className="route-track" style={{ zoom } as CSSProperties}>
          {visibleSteps.map((step, index) => (
            <div className="route-step-wrap" key={step.id}>
              <button className={"route-step " + step.status.toLowerCase().replace(" ", "-") + (step.id === activeStepId ? " route-selected" : "")} onClick={() => setActiveStepId(step.id)} aria-pressed={step.id === activeStepId}>
                <span className="route-node">{step.status === "Complete" ? <Check size={16} /> : step.status === "Running" ? <Zap size={16} /> : step.status === "Quality hold" ? <ShieldAlert size={16} /> : <span>{String(index + 1).padStart(2, "0")}</span>}</span>
                <span className="route-card"><span className="route-card-top"><small>OP {String((index + 1) * 10).padStart(3, "0")}</small><em>{step.status}</em></span><strong>{step.name}</strong><span className="route-station">{step.station}</span><span className="route-card-bottom"><span><Clock3 size={13} />{step.duration}</span><span>{step.owner}</span></span></span>
              </button>
              {index < visibleSteps.length - 1 && <span className={"route-connector " + (step.status === "Complete" ? "connector-done" : "")}><ArrowRight size={15} /></span>}
            </div>
          ))}
          {visibleSteps.length === 0 && <div className="route-empty">No operations match “{filter}”. Clear the search or add an operation.</div>}
        </div>
      </div>
      <div className="route-legend"><span><i className="legend-done" /> Complete</span><span><i className="legend-live" /> Running</span><span><i className="legend-queued" /> Queued</span><span><i className="legend-hold" /> Quality hold</span><span className="route-scroll-note">Scroll sideways or use Shift + mouse wheel · Swipe on mobile</span></div>
      {activeStep && <section className="operation-detail">
        <div className="operation-detail-head"><div><div className="eyebrow"><span className="eyebrow-mark" /> SELECTED OPERATION / OP {String(activeStep.id * 10).padStart(3, "0")}</div><h3>{activeStep.name}</h3><p>{activeStep.note}</p></div><span className={"operation-status status-" + activeStep.status.toLowerCase().replace(" ", "-")}>{activeStep.status}</span></div>
        {editMode ? <div className="route-detail-editor">
          <label>Operation name<input value={activeStep.name} onChange={(event) => updateActive({ name: event.target.value })} /></label>
          <label>Machine / station / vendor<input value={activeStep.station} onChange={(event) => updateActive({ station: event.target.value })} /></label>
          <label>Duration<input value={activeStep.duration} onChange={(event) => updateActive({ duration: event.target.value })} /></label>
          <label>Responsible team<input value={activeStep.owner} onChange={(event) => updateActive({ owner: event.target.value })} /></label>
          <label>Operation status<select value={activeStep.status} onChange={(event) => updateActive({ status: event.target.value as ProcessStatus })}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
          <label className="editor-wide">Work / quality notes<input value={activeStep.note} onChange={(event) => updateActive({ note: event.target.value })} /></label>
          <div className="route-editor-actions"><button className="button-quiet" onClick={() => moveActive(-1)} disabled={steps.findIndex((step) => step.id === activeStepId) === 0}><ArrowUpRight size={14} /> Move earlier</button><button className="button-quiet" onClick={() => moveActive(1)} disabled={steps.findIndex((step) => step.id === activeStepId) === steps.length - 1}><ArrowDownRight size={14} /> Move later</button><button className="button-danger" onClick={deleteActive}><X size={14} /> Remove operation</button></div>
        </div> : <div className="operation-detail-grid"><div><small>MACHINE / STATION / VENDOR</small><strong>{activeStep.station}</strong></div><div><small>PLANNED DURATION</small><strong>{activeStep.duration}</strong></div><div><small>RESPONSIBLE TEAM</small><strong>{activeStep.owner}</strong></div><div><small>RECORD STATUS</small><strong>Sample data only</strong></div></div>}
        {!editMode && <div className="operation-detail-footer"><span><ShieldCheck size={14} /> Select “Edit route” to change fields, reorder or remove this operation.</span><button className="button-primary small-primary" onClick={() => setEditMode(true)}><GitBranch size={14} /> Edit selected operation</button></div>}
      </section>}
      <div className="route-bottom-note"><ShieldCheck size={14} /> This is an interactive sample route. Changes are temporary and reset when the page reloads; production API, version history, approvals and database persistence are not connected.</div>
    </div>
  );
}


type VendorContact = { id: string; company: string; contact: string; role: string; phone: string; email: string; processes: string; notes: string };
type FollowUpItem = { id: string; contactId: string; due: string; channel: "WhatsApp" | "Call" | "Email"; message: string; status: "Scheduled" | "Done" | "Cancelled" };
const CONTACTS_KEY = "aximach.vendorContacts.v1";
const FOLLOWUPS_KEY = "aximach.followUps.v1";
const seedContacts: VendorContact[] = [
  { id: "demo-v1", company: "Example CNC Works", contact: "Demo Contact", role: "Sales / RFQ", phone: "", email: "", processes: "CNC Turning, VMC", notes: "Replace with your actual vendor details." },
  { id: "demo-v2", company: "Example Heat Treatment", contact: "Demo Contact", role: "Operations", phone: "", email: "", processes: "Hardening, Tempering", notes: "Demo record — not a real verified vendor." }
];
function readLocal<T,>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function saveLocal<T,>(key: string, value: T) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("aximach-local-data-updated")); } catch { /* storage may be unavailable */ }
}
function VendorWorkspace({ onBack, onNotice, notice }: { onBack: () => void; onNotice: (value: string) => void; notice: string }) {
  const [contacts, setContacts] = useState<VendorContact[]>(() => readLocal(CONTACTS_KEY, seedContacts));
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(() => readLocal(FOLLOWUPS_KEY, []));
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Omit<VendorContact, "id">>({ company: "", contact: "", role: "", phone: "", email: "", processes: "", notes: "" });
  const selected = contacts.find((c) => c.id === selectedId) ?? contacts[0];
  const [task, setTask] = useState({ due: new Date(Date.now() + 86400000).toISOString().slice(0,10), channel: "WhatsApp" as FollowUpItem["channel"], message: "Hello, following up on our machining RFQ. Please share your quotation, lead time and current capacity." });
  const filtered = contacts.filter((c) => (c.company+" "+c.contact+" "+c.role+" "+c.phone+" "+c.email+" "+c.processes).toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { saveLocal(CONTACTS_KEY, contacts); }, [contacts]);
  useEffect(() => { saveLocal(FOLLOWUPS_KEY, followUps); }, [followUps]);
  useEffect(() => {
    const refresh = () => { setContacts(readLocal(CONTACTS_KEY, seedContacts)); setFollowUps(readLocal(FOLLOWUPS_KEY, [])); };
    window.addEventListener("aximach-local-data-updated", refresh);
    return () => window.removeEventListener("aximach-local-data-updated", refresh);
  }, []);
  const beginNew = () => { setSelectedId(""); setDraft({ company:"",contact:"",role:"",phone:"",email:"",processes:"",notes:"" }); setEditing(true); };
  const beginEdit = (c: VendorContact) => { setSelectedId(c.id); setDraft({ company:c.company,contact:c.contact,role:c.role,phone:c.phone,email:c.email,processes:c.processes,notes:c.notes }); setEditing(true); };
  const saveContact = () => {
    if (!draft.company.trim() || !draft.contact.trim()) { onNotice("Vendor company and contact name are required."); return; }
    if (selectedId && contacts.some(c=>c.id===selectedId)) setContacts(previous=>previous.map(c=>c.id===selectedId?{...draft,id:selectedId}:c));
    else { const id = "v-"+Date.now().toString(36); setContacts(previous=>[{...draft,id},...previous]); setSelectedId(id); }
    setEditing(false); onNotice("Vendor contact saved on this device only. No cloud sync or server database is connected.");
  };
  const addFollowUp = () => {
    if (!selected) { onNotice("Select a vendor contact first."); return; }
    const item: FollowUpItem = { id:"fu-"+Date.now().toString(36), contactId:selected.id, due:task.due, channel:task.channel, message:task.message, status:"Scheduled" };
    setFollowUps(previous=>[item,...previous]); onNotice("Follow-up saved locally. Browser-based reminders are not guaranteed when the app is closed.");
  };
  const openChannel = (c: VendorContact, channel: FollowUpItem["channel"], message = task.message) => {
    const phone = c.phone.replace(/[^0-9]/g,"");
    if (channel === "WhatsApp") {
      if (!phone) { onNotice("Add the contact's phone number including country code before opening WhatsApp."); return; }
      window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(message), "_blank", "noopener,noreferrer");
    } else if (channel === "Email") {
      if (!c.email) { onNotice("Add an email address to this vendor contact first."); return; }
      window.location.href = "mailto:"+c.email+"?subject="+encodeURIComponent("AXIMACH vendor follow-up")+"&body="+encodeURIComponent(message);
    } else {
      if (!phone) { onNotice("Add the contact's phone number including country code first."); return; }
      window.location.href = "tel:"+phone;
    }
  };
  return <section className="workspace-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> DEVICE-SAVED CONTACTS</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / CONTACTS</div><h1>Vendor network<span>.</span></h1><p>Manage vendor contacts, capabilities and follow-ups from one linked workspace.</p></div><div className="workspace-title-actions"><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add vendor contact</button></div></div>
    <div className="vendor-workspace-grid">
      <section className="surface-panel vendor-list-panel">
        <div className="panel-heading"><div><h3>Vendor directory</h3><p>{contacts.length} records · saved in this browser only</p></div></div>
        <label className="vendor-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, person, phone, process…"/></label>
        <div className="vendor-record-list">{filtered.map(c=><button key={c.id} className={"vendor-record "+(selected?.id===c.id?"vendor-record-active":"")} onClick={()=>{setSelectedId(c.id);setEditing(false);}}><span className="vendor-avatar">{c.company.slice(0,1).toUpperCase()}</span><span className="vendor-record-copy"><strong>{c.company}</strong><small>{c.contact} · {c.role||"Contact role not set"}</small><small>{c.processes||"Capabilities not set"}</small></span><ArrowRight size={14}/></button>)}{!filtered.length&&<p className="vendor-empty">No matching vendors. Add a contact or clear the search.</p>}</div>
        <div className="vendor-panel-foot">Export/import and multi-user sync are not connected yet.</div>
      </section>
      <section className="surface-panel vendor-detail-panel">
        {editing ? <><div className="panel-heading"><div><h3>{selectedId?"Edit vendor contact":"New vendor contact"}</h3><p>Required fields: company and contact name.</p></div></div><div className="vendor-form">
          <label>Vendor company *<input value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Company name"/></label>
          <label>Contact person *<input value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})} placeholder="Full name"/></label>
          <label>Role / department<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Sales, production, accounts…"/></label>
          <label>Phone with country code<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="9198xxxxxxxx"/></label>
          <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
          <label>Processes / capabilities<input value={draft.processes} onChange={e=>setDraft({...draft,processes:e.target.value})} placeholder="CNC turning, VMC, grinding…"/></label>
          <label className="editor-wide">Notes<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Rates, capacity, lead time, certifications…"/></label>
          <div className="vendor-form-actions"><button className="button-primary" onClick={saveContact}><Check size={14}/> Save contact</button><button className="button-quiet" onClick={()=>setEditing(false)}>Cancel</button></div>
        </div></> : selected ? <><div className="vendor-detail-title"><span className="vendor-avatar vendor-avatar-large">{selected.company.slice(0,1).toUpperCase()}</span><div><h3>{selected.company}</h3><p>{selected.contact} · {selected.role||"Role not set"}</p></div><button className="button-quiet" onClick={()=>beginEdit(selected)}>Edit</button></div>
          <div className="vendor-contact-grid"><div><small>PHONE</small><strong>{selected.phone||"Not added"}</strong></div><div><small>EMAIL</small><strong>{selected.email||"Not added"}</strong></div><div><small>CAPABILITIES</small><strong>{selected.processes||"Not added"}</strong></div><div><small>NOTES</small><strong>{selected.notes||"No notes"}</strong></div></div>
          <div className="vendor-actions"><button className="button-primary" onClick={()=>openChannel(selected,"WhatsApp")}><MessageCircle size={15}/> Open WhatsApp</button><button className="button-quiet" onClick={()=>openChannel(selected,"Call")}><Users size={15}/> Call</button><button className="button-quiet" onClick={()=>openChannel(selected,"Email")}><MessageCircle size={15}/> Email</button></div>
          <div className="followup-create"><h4><CalendarClock size={16}/> Schedule follow-up</h4><div className="followup-form"><label>Due date<input type="date" value={task.due} onChange={e=>setTask({...task,due:e.target.value})}/></label><label>Channel<select value={task.channel} onChange={e=>setTask({...task,channel:e.target.value as FollowUpItem["channel"]})}><option>WhatsApp</option><option>Call</option><option>Email</option></select></label><label className="editor-wide">Message<textarea value={task.message} onChange={e=>setTask({...task,message:e.target.value})}/></label><button className="button-primary" onClick={addFollowUp}><Plus size={14}/> Save follow-up</button></div></div>
        </> : <div className="vendor-empty">Select a vendor or add a new contact to begin.</div>}
      </section>
    </div>
    <section className="surface-panel followup-list-panel"><div className="panel-heading"><div><h3>Follow-up queue</h3><p>Due dates and status are saved locally; no background service is running.</p></div><span className="module-number">{followUps.filter(f=>f.status==="Scheduled").length} OPEN</span></div>
      {followUps.length===0?<p className="vendor-empty">No follow-ups yet. Select a vendor, then create one above.</p>:<div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Due</th><th>Vendor contact</th><th>Channel</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead><tbody>{followUps.map(f=>{const c=contacts.find(x=>x.id===f.contactId);return <tr key={f.id}><td>{f.due}</td><td>{c?c.company+" · "+c.contact:"Contact removed"}</td><td>{f.channel}</td><td>{f.message}</td><td><span className={"followup-status "+f.status.toLowerCase()}>{f.status}</span></td><td><div className="followup-row-actions">{c&&f.status==="Scheduled"&&<button onClick={()=>openChannel(c,f.channel,f.message)}>Open</button>}{f.status==="Scheduled"&&<button onClick={()=>setFollowUps(p=>p.map(x=>x.id===f.id?{...x,status:"Done"}:x))}>Mark done</button>}{f.status==="Scheduled"&&<button onClick={()=>setFollowUps(p=>p.map(x=>x.id===f.id?{...x,status:"Cancelled"}:x))}>Cancel</button>}</div></td></tr>})}</tbody></table></div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={16}/><span>WhatsApp button opens a prefilled message in WhatsApp for you to send. It does not send automatically, pair a WhatsApp device, monitor replies or run reminders in the background. Those require a separate running backend and integration.</span></div>
  </section>;
}
function FollowUpWorkspace({ onBack, onNotice, notice }: { onBack: () => void; onNotice: (value: string) => void; notice: string }) {
  const [contacts,setContacts]=useState<VendorContact[]>(()=>readLocal(CONTACTS_KEY,seedContacts));
  const [followUps,setFollowUps]=useState<FollowUpItem[]>(()=>readLocal(FOLLOWUPS_KEY,[]));
  useEffect(()=>{const refresh=()=>{setContacts(readLocal(CONTACTS_KEY,seedContacts));setFollowUps(readLocal(FOLLOWUPS_KEY,[]));};window.addEventListener("aximach-local-data-updated",refresh);return()=>window.removeEventListener("aximach-local-data-updated",refresh);},[]);
  const open = (f:FollowUpItem) => {const c=contacts.find(x=>x.id===f.contactId);if(!c){onNotice("Vendor contact not found. Open Vendors & Sub-vendors to add or restore it.");return;}const phone=c.phone.replace(/[^0-9]/g,"");if(f.channel==="WhatsApp"&&phone)window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(f.message),"_blank","noopener,noreferrer");else if(f.channel==="Email"&&c.email)window.location.href="mailto:"+c.email+"?subject="+encodeURIComponent("AXIMACH follow-up")+"&body="+encodeURIComponent(f.message);else if(f.channel==="Call"&&phone)window.location.href="tel:"+phone;else onNotice("This contact needs a valid phone number or email address first.");};
  const changeStatus=(id:string,status:FollowUpItem["status"])=>{const next=followUps.map(f=>f.id===id?{...f,status}:f);setFollowUps(next);saveLocal(FOLLOWUPS_KEY,next);};
  return <section className="workspace-page">{notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}<div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> LOCAL FOLLOW-UP QUEUE</span></div><div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMMUNICATION / CRM</div><h1>Follow-up centre<span>.</span></h1><p>Open a prepared message, update task status and keep vendor communication linked.</p></div><button className="button-primary" onClick={()=>onNotice("Open Vendors & Sub-vendors to add a contact and schedule a follow-up.")}><Users size={15}/> Add vendor contact</button></div>
    <section className="surface-panel followup-list-panel"><div className="panel-heading"><div><h3>Scheduled follow-ups</h3><p>Locally stored task list · automatic sending and reply monitoring are not configured.</p></div><span className="module-number">{followUps.filter(f=>f.status==="Scheduled").length} OPEN</span></div>{followUps.length===0?<div className="vendor-empty">No tasks scheduled. Open Vendors & Sub-vendors, select a contact and create a follow-up.</div>:<div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Due</th><th>Vendor</th><th>Channel</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead><tbody>{followUps.map(f=>{const c=contacts.find(x=>x.id===f.contactId);return <tr key={f.id}><td>{f.due}</td><td>{c?c.company+" · "+c.contact:"Contact removed"}</td><td>{f.channel}</td><td>{f.message}</td><td>{f.status}</td><td><div className="followup-row-actions">{c&&f.status==="Scheduled"&&<button onClick={()=>open(f)}>Open</button>}{f.status==="Scheduled"&&<button onClick={()=>changeStatus(f.id,"Done")}>Mark done</button>}{f.status==="Scheduled"&&<button onClick={()=>changeStatus(f.id,"Cancelled")}>Cancel</button>}</div></td></tr>})}</tbody></table></div>}</section><div className="module-safety-note"><ShieldCheck size={16}/><span>Tasks remain on this device. They will not run while the app is closed, and WhatsApp replies cannot be detected until a backend/provider integration is implemented.</span></div></section>;
}

function ModuleWorkspace({ module, onBack, onNotice, onOpenModules }: { module: ModuleItem; onBack: () => void; onNotice: (value: string) => void; onOpenModules: () => void }) {
  const Icon = module.icon;
  return (
    <section className="workspace-page">
      <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15} /> Command centre</button><span className="demo-pill"><i /> MODULE PREVIEW</span></div>
      <div className="module-hero">
        <div className="module-hero-icon"><Icon size={27} /></div>
        <div className="module-hero-copy"><div className="eyebrow"><span className="eyebrow-mark" /> {module.group.toUpperCase()} / AXIMACH MODULE</div><h1>{module.title}<span>.</span></h1><p>{module.description}</p></div>
        <button className="button-quiet" onClick={onOpenModules}><LayoutGrid size={16} /> Switch module</button>
      </div>
      <div className="module-preview-banner"><ShieldCheck size={17} /><span><strong>Module shell ready for detailed implementation.</strong> This is a navigable design prototype. Connect the database, permissions and module-specific operations before using business data.</span></div>
      <div className="module-kpi-grid"><div className="module-kpi"><small>WORKSPACE</small><strong>Available</strong><span>Navigation prototype</span></div><div className="module-kpi"><small>DATA CONNECTION</small><strong>Not connected</strong><span>No live records queried</span></div><div className="module-kpi"><small>PERMISSIONS</small><strong>Not enforced</strong><span>Server-side access control pending</span></div><div className="module-kpi"><small>INTEGRATION</small><strong>Not configured</strong><span>External actions disabled</span></div></div>
      <div className="module-layout-grid">
        <div className="surface-panel module-main-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> WORKSPACE OVERVIEW</div><h3>{module.title}</h3><p>Proposed structure for the next implementation phase.</p></div><span className="module-number">{String(modules.findIndex((item) => item.id === module.id) + 1).padStart(2, "0")} / 32</span></div>
          <div className="module-capabilities">{["Search and filter records", "Role-scoped detail views", "Linked manufacturing history", "Import, export and audit controls"].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><Check size={15} /></div>)}</div>
          <div className="module-implementation-note"><Sparkles size={17} /><span><strong>Next engineering step</strong><small>Implement the data schema, API contract, validation rules, permissions and tests for this module before connecting production actions.</small></span></div>
        </div>
        <div className="surface-panel module-related"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> CONNECTED DOMAINS</div><h3>Related modules</h3></div></div>
          {modules.filter((item) => item.id !== module.id && [module.group, "Engineering", "Operations", "Governance"].includes(item.group)).slice(0, 5).map((item) => { const RelatedIcon = item.icon; return <button className="related-row" key={item.id} onClick={() => onNotice("Related module selection: " + item.title + ". Use the module universe to open it.")}><span className="related-icon"><RelatedIcon size={16} /></span><span><strong>{item.title}</strong><small>{item.group}</small></span><ArrowUpRight size={14} /></button>; })}
          <button className="related-all" onClick={onOpenModules}>Browse all 32 modules <ArrowRight size={14} /></button>
        </div>
      </div>
      <div className="module-safety-note"><ShieldCheck size={16} /><span>AXIMACH design rule: no payment, role change, quality release, safety-critical engineering change or destructive data operation should run autonomously without explicit server-side authorization and the required approval.</span></div>
    </section>
  );
}

export default App;
