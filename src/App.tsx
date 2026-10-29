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
type ProcessStep = { id: number; name: string; station: string; duration: string; status: ProcessStatus; owner: string; note: string; vendor?: string; setupMinutes?: number; cycleSeconds?: number; quantity?: number; pricePerPart?: number; missingQuantity?: number; branch?: string; parentId?: number };

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
  const [vendorSearchJump, setVendorSearchJump] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [notice, setNotice] = useState("");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [localJobs, setLocalJobs] = useState(["AX-2048 · Precision housing", "AX-2049 · Valve body", "AX-2050 · Mounting bracket"]);
  const [factory, setFactory] = useState("Precision Works · Main Plant");

  const activeModule = modules.find((item) => item.id === activeModuleId) ?? modules[0];
  const globalRecords = getAllModuleRecords();
  const globalVendorContacts = readLocal<VendorContact[]>(CONTACTS_KEY, seedContacts);
  const normalizedGlobalQuery = query.toLowerCase().trim();
  const globalRecordResults = normalizedGlobalQuery ? Object.entries(globalRecords).flatMap(([moduleId, records]) => records.filter((record) => (record.title + " " + record.reference + " " + record.status + " " + record.owner + " " + record.notes).toLowerCase().includes(normalizedGlobalQuery)).map((record) => ({ ...record, moduleId }))).slice(0, 8) : [];
  const globalVendorResults = normalizedGlobalQuery ? globalVendorContacts.filter((contact) => (contact.company + " " + contact.contact + " " + contact.role + " " + contact.phone + " " + contact.email + " " + contact.processes + " " + contact.notes).toLowerCase().includes(normalizedGlobalQuery)).slice(0, 8) : [];

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
        ) : activeModuleId === "vendors" ? (
          <VendorWorkspace initialSearch={vendorSearchJump} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} />
        ) : activeModuleId === "communications" ? (
          <FollowUpWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} />
        ) : (
          <ModuleWorkspace module={activeModule} onBack={() => selectModule("command-centre")} onNotice={setNotice} onOpenModules={openModuleExplorer} onSelectModule={selectModule} />
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
            <div className="palette-search"><Command size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules, vendors, contacts, jobs, references…" /><button className="close-round compact" onClick={() => setCommandOpen(false)} aria-label="Close search"><X size={17} /></button></div>
            {normalizedGlobalQuery && <><div className="palette-label">VENDOR NAMES & CONTACTS</div><div className="palette-results">{globalVendorResults.map((contact) => <button key={contact.id} onClick={() => { setVendorSearchJump(contact.company + " " + contact.contact); selectModule("vendors"); }}><span className="palette-icon"><Users size={17}/></span><span><strong>{contact.company}</strong><small>{contact.contact} · {contact.phone || contact.email || "Contact details not added"}</small></span><ArrowUpRight size={15}/></button>)}{globalVendorResults.length === 0 && <div className="palette-empty">No vendor/contact matches.</div>}</div><div className="palette-label">SAVED RECORDS ACROSS MODULES</div><div className="palette-results">{globalRecordResults.map((record) => { const target = modules.find((item) => item.id === record.moduleId); const Icon = target?.icon ?? Box; return <button key={record.moduleId + ":" + record.id} onClick={() => selectModule(record.moduleId)}><span className="palette-icon"><Icon size={17}/></span><span><strong>{record.title}</strong><small>{target?.title || record.moduleId} · {record.reference || record.status}</small></span><ArrowUpRight size={15}/></button>; })}{globalRecordResults.length === 0 && <div className="palette-empty">No saved record matches yet.</div>}</div></>}
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
  const [steps, setSteps] = useState<ProcessStep[]>(() => { try { const saved = window.localStorage.getItem("aximach.processRoute.v2"); return saved ? JSON.parse(saved) as ProcessStep[] : startingSteps; } catch { return startingSteps; } });
  useEffect(() => { try { window.localStorage.setItem("aximach.processRoute.v2", JSON.stringify(steps)); } catch { /* browser storage may be unavailable */ } }, [steps]);
  const [activeStepId, setActiveStepId] = useState(3);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ name: "", station: "", duration: "15 min", owner: "Production", note: "", vendor: "", setupMinutes: "0", cycleSeconds: "0", quantity: "1", pricePerPart: "0", missingQuantity: "0", branch: "Main route" });
  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0];
  const visibleSteps = steps.filter((step) => (step.name + " " + step.station + " " + step.owner + " " + step.vendor + " " + step.status).toLowerCase().includes(filter.toLowerCase().trim()));
  const routePlannedMinutes = steps.reduce((sum, step) => { const setup = Number(step.setupMinutes) || 0; const cycle = Number(step.cycleSeconds) || 0; const entered = setup > 0 || cycle > 0; const fallback = Number.parseFloat(step.duration) || 0; return sum + (entered ? setup + (cycle * (Number(step.quantity) || 0)) / 60 : fallback); }, 0);
  const routeVendorCost = steps.reduce((sum, step) => sum + (Number(step.pricePerPart) || 0) * (Number(step.quantity) || 0), 0);
  const routeMissing = steps.reduce((sum, step) => sum + (Number(step.missingQuantity) || 0), 0);
  const branchSteps = steps.filter((step) => step.parentId !== undefined);

  const updateActive = (patch: Partial<ProcessStep>) => {
    if (!activeStep) return;
    setSteps((previous) => previous.map((step) => step.id === activeStep.id ? { ...step, ...patch } : step));
    onNotice("Sample operation updated in this browser session only.");
  };
  const addBranchFromActive = () => {
    if (!activeStep) return;
    const id = Math.max(0, ...steps.map((step) => step.id)) + 1;
    const branchStep: ProcessStep = { id, name: "Alternate / rework operation", station: "Assign machine or vendor", duration: "15 min", status: "Queued", owner: activeStep.owner, note: "Define alternate route, acceptance criteria and return-to-main-route condition.", vendor: "", setupMinutes: 0, cycleSeconds: 0, quantity: activeStep.quantity ?? 1, pricePerPart: 0, missingQuantity: 0, branch: "Alternate vendor", parentId: activeStep.id };
    setSteps(previous => [...previous, branchStep]); setActiveStepId(id); setEditMode(true);
    onNotice("A linked branch was added from the selected operation. Configure its vendor, time and price.");
  };
  const addOperation = () => {
    if (!draft.name.trim()) { onNotice("Enter an operation name before adding it."); return; }
    const id = Math.max(0, ...steps.map((step) => step.id)) + 1;
    const step: ProcessStep = { id, name: draft.name.trim(), station: draft.station.trim() || "Unassigned station", duration: draft.duration.trim() || "15 min", status: "Queued", owner: draft.owner.trim() || "Unassigned", note: draft.note.trim() || "Add the required setup, quality and acceptance instructions.", vendor: draft.vendor.trim(), setupMinutes: Number(draft.setupMinutes)||0, cycleSeconds: Number(draft.cycleSeconds)||0, quantity: Math.max(0,Number(draft.quantity)||0), pricePerPart: Math.max(0,Number(draft.pricePerPart)||0), missingQuantity: Math.max(0,Number(draft.missingQuantity)||0), branch: draft.branch.trim() || "Main route" };
    setSteps((previous) => [...previous, step]);
    setActiveStepId(id);
    setDraft({ name: "", station: "", duration: "15 min", owner: "Production", note: "", vendor: "", setupMinutes: "0", cycleSeconds: "0", quantity: "1", pricePerPart: "0", missingQuantity: "0", branch: "Main route" });
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
      <div className="route-cost-strip"><div><small>ESTIMATED ROUTE TIME</small><strong>{Math.round(routePlannedMinutes*10)/10} min</strong><span>Setup + cycle × quantity</span></div><div><small>ENTERED VENDOR COST</small><strong>₹{routeVendorCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong><span>Quantity × price per part</span></div><div><small>SHORT / MISSING QTY</small><strong>{routeMissing.toLocaleString("en-IN")}</strong><span>Manual shortage entries</span></div></div>
      <div className="route-controls">
        <div className="route-controls-left"><span className="control-label">VIEW</span><button className={orientation === "horizontal" ? "control-active" : ""} onClick={() => setOrientation("horizontal")}>Horizontal</button><button className={orientation === "vertical" ? "control-active" : ""} onClick={() => setOrientation("vertical")}>Vertical</button></div>
        <div className="route-controls-right">
          <input className="route-filter" aria-label="Search operations" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find operation…" />
          <button className={"button-quiet compact-button " + (editMode ? "control-active" : "")} onClick={() => setEditMode((value) => !value)}><GitBranch size={14} /> {editMode ? "Close editor" : "Edit route"}</button><button className="button-quiet compact-button" onClick={addBranchFromActive}><GitBranch size={14} /> Add branch from selected</button>
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
          <label>Vendor / subcontractor<input value={draft.vendor} onChange={(event) => setDraft({ ...draft, vendor: event.target.value })} placeholder="Vendor name (optional)" /></label>
          <label>Setup time (minutes)<input type="number" min="0" value={draft.setupMinutes} onChange={(event) => setDraft({ ...draft, setupMinutes: event.target.value })} /></label>
          <label>Cycle time (seconds / part)<input type="number" min="0" value={draft.cycleSeconds} onChange={(event) => setDraft({ ...draft, cycleSeconds: event.target.value })} /></label>
          <label>Quantity to process<input type="number" min="0" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label>
          <label>Vendor price / part (₹)<input type="number" min="0" step="0.01" value={draft.pricePerPart} onChange={(event) => setDraft({ ...draft, pricePerPart: event.target.value })} /></label>
          <label>Missing / short quantity<input type="number" min="0" value={draft.missingQuantity} onChange={(event) => setDraft({ ...draft, missingQuantity: event.target.value })} /></label>
          <label>Route branch<input value={draft.branch} onChange={(event) => setDraft({ ...draft, branch: event.target.value })} placeholder="Main route / Rework / Alternate vendor" /></label>
          <label className="editor-wide">Work / quality notes<input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Setup, inspection and acceptance notes" /></label>
          <button className="button-primary" onClick={addOperation}><Plus size={15} /> Add operation</button>
        </div>
      </section>}
      <div className="route-canvas-detail-grid">
      <div className="route-canvas-column">
      <div className={"route-scroll " + (orientation === "vertical" ? "route-vertical" : "")} tabIndex={0} aria-label="Scrollable manufacturing process route">
        <div className="route-track" style={{ zoom } as CSSProperties}>
          {visibleSteps.map((step, index) => (
            <div className="route-step-wrap" key={step.id}>
              <button className={"route-step " + step.status.toLowerCase().replace(" ", "-") + (step.id === activeStepId ? " route-selected" : "")} onClick={() => setActiveStepId(step.id)} aria-pressed={step.id === activeStepId}>
                <span className="route-node">{step.status === "Complete" ? <Check size={16} /> : step.status === "Running" ? <Zap size={16} /> : step.status === "Quality hold" ? <ShieldAlert size={16} /> : <span>{String(index + 1).padStart(2, "0")}</span>}</span>
                <span className="route-card"><span className="route-card-top"><small>OP {String((index + 1) * 10).padStart(3, "0")}</small><em>{step.status}</em></span><span className="route-visual-row"><span className={"route-illustration route-art-" + (step.name.toLowerCase().includes("inspect") || step.name.toLowerCase().includes("quality") ? "quality" : step.name.toLowerCase().includes("material") || step.name.toLowerCase().includes("receipt") ? "material" : step.name.toLowerCase().includes("transport") || step.name.toLowerCase().includes("delivery") ? "transport" : step.name.toLowerCase().includes("grind") ? "grinding" : step.name.toLowerCase().includes("coat") || step.name.toLowerCase().includes("paint") ? "coating" : step.name.toLowerCase().includes("turn") || step.name.toLowerCase().includes("mill") || step.name.toLowerCase().includes("machine") ? "machining" : "process")}><span className="route-art-orbit"></span>{step.name.toLowerCase().includes("inspect") || step.name.toLowerCase().includes("quality") ? <ClipboardCheck size={23} /> : step.name.toLowerCase().includes("material") || step.name.toLowerCase().includes("receipt") ? <Boxes size={23} /> : step.name.toLowerCase().includes("transport") || step.name.toLowerCase().includes("delivery") ? <Truck size={23} /> : step.name.toLowerCase().includes("grind") ? <Gauge size={23} /> : step.name.toLowerCase().includes("coat") || step.name.toLowerCase().includes("paint") ? <ScanLine size={23} /> : step.name.toLowerCase().includes("turn") || step.name.toLowerCase().includes("mill") || step.name.toLowerCase().includes("machine") ? <Wrench size={23} /> : <Factory size={23} />}</span><span className="route-visual-copy"><strong>{step.name}</strong><span className="route-station">{step.station}</span></span></span><span className="route-card-bottom"><span><Clock3 size={13} />{step.duration}</span><span>{step.owner}</span></span></span>
              </button>
              {index < visibleSteps.length - 1 && <span className={"route-connector " + (step.status === "Complete" ? "connector-done" : "")}><ArrowRight size={15} /></span>}
            </div>
          ))}
          {visibleSteps.length === 0 && <div className="route-empty">No operations match “{filter}”. Clear the search or add an operation.</div>}
        </div>
      </div>
      <div className="route-legend"><span><i className="legend-done" /> Complete</span><span><i className="legend-live" /> Running</span><span><i className="legend-queued" /> Queued</span><span><i className="legend-hold" /> Quality hold</span><span className="route-scroll-note">Scroll sideways or use Shift + mouse wheel · Swipe on mobile</span></div>
      </div>
      {activeStep && <section className="operation-detail">
        <div className="operation-detail-head"><div><div className="eyebrow"><span className="eyebrow-mark" /> SELECTED OPERATION / OP {String(activeStep.id * 10).padStart(3, "0")}</div><h3>{activeStep.name}</h3><p>{activeStep.note}</p></div><span className={"operation-status status-" + activeStep.status.toLowerCase().replace(" ", "-")}>{activeStep.status}</span></div>
        {editMode ? <div className="route-detail-editor">
          <label>Operation name<input value={activeStep.name} onChange={(event) => updateActive({ name: event.target.value })} /></label>
          <label>Machine / station / vendor<input value={activeStep.station} onChange={(event) => updateActive({ station: event.target.value })} /></label>
          <label>Duration<input value={activeStep.duration} onChange={(event) => updateActive({ duration: event.target.value })} /></label>
          <label>Responsible team<input value={activeStep.owner} onChange={(event) => updateActive({ owner: event.target.value })} /></label>
          <label>Vendor / subcontractor<input value={activeStep.vendor ?? ""} onChange={(event) => updateActive({ vendor: event.target.value })} /></label>
          <label>Setup time (minutes)<input type="number" min="0" value={activeStep.setupMinutes ?? 0} onChange={(event) => updateActive({ setupMinutes: Math.max(0,Number(event.target.value)||0) })} /></label>
          <label>Cycle time (seconds / part)<input type="number" min="0" value={activeStep.cycleSeconds ?? 0} onChange={(event) => updateActive({ cycleSeconds: Math.max(0,Number(event.target.value)||0) })} /></label>
          <label>Quantity<input type="number" min="0" value={activeStep.quantity ?? 1} onChange={(event) => updateActive({ quantity: Math.max(0,Number(event.target.value)||0) })} /></label>
          <label>Vendor price / part (₹)<input type="number" min="0" step="0.01" value={activeStep.pricePerPart ?? 0} onChange={(event) => updateActive({ pricePerPart: Math.max(0,Number(event.target.value)||0) })} /></label>
          <label>Missing / short quantity<input type="number" min="0" value={activeStep.missingQuantity ?? 0} onChange={(event) => updateActive({ missingQuantity: Math.max(0,Number(event.target.value)||0) })} /></label>
          <label>Route branch<input value={activeStep.branch ?? "Main route"} onChange={(event) => updateActive({ branch: event.target.value })} /></label>
          <label>Operation status<select value={activeStep.status} onChange={(event) => updateActive({ status: event.target.value as ProcessStatus })}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
          <label className="editor-wide">Work / quality notes<input value={activeStep.note} onChange={(event) => updateActive({ note: event.target.value })} /></label>
          <div className="route-editor-actions"><button className="button-quiet" onClick={() => moveActive(-1)} disabled={steps.findIndex((step) => step.id === activeStepId) === 0}><ArrowUpRight size={14} /> Move earlier</button><button className="button-quiet" onClick={() => moveActive(1)} disabled={steps.findIndex((step) => step.id === activeStepId) === steps.length - 1}><ArrowDownRight size={14} /> Move later</button><button className="button-danger" onClick={deleteActive}><X size={14} /> Remove operation</button></div>
        </div> : <div className="operation-detail-grid"><div><small>MACHINE / STATION / VENDOR</small><strong>{activeStep.station}</strong></div><div><small>PLANNED DURATION</small><strong>{activeStep.duration}</strong></div><div><small>RESPONSIBLE TEAM</small><strong>{activeStep.owner}</strong></div><div><small>VENDOR / SUBCONTRACTOR</small><strong>{activeStep.vendor || "Not assigned"}</strong></div><div><small>SETUP + CYCLE × QTY</small><strong>{(Number(activeStep.setupMinutes)||0)+((Number(activeStep.cycleSeconds)||0)*(Number(activeStep.quantity)||0))/60} min</strong></div><div><small>VENDOR COST</small><strong>₹{((Number(activeStep.pricePerPart)||0)*(Number(activeStep.quantity)||0)).toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div><div><small>SHORT / MISSING QTY</small><strong>{Number(activeStep.missingQuantity)||0}</strong></div><div><small>ROUTE BRANCH</small><strong>{activeStep.branch || "Main route"}</strong></div><div><small>RECORD STATUS</small><strong>Sample data only</strong></div></div>}
        {!editMode && <div className="operation-detail-footer"><span><ShieldCheck size={14} /> Select “Edit route” to change fields, reorder or remove this operation.</span><button className="button-primary small-primary" onClick={() => setEditMode(true)}><GitBranch size={14} /> Edit selected operation</button></div>}
      </section>}
      </div>
      {branchSteps.length > 0 && <section className="route-branches-panel"><div className="panel-heading"><div><h3><GitBranch size={16} /> Alternate routes & rework branches</h3><p>Each branch is linked to its parent operation and can be edited independently.</p></div><span className="module-number">{branchSteps.length} BRANCHES</span></div><div className="route-branch-list">{branchSteps.map(branch => { const parent = steps.find(step => step.id === branch.parentId); return <button key={branch.id} className={"route-branch-card " + (activeStepId === branch.id ? "route-branch-active" : "")} onClick={() => { setActiveStepId(branch.id); setEditMode(true); }}><span className="branch-link-icon"><GitBranch size={17} /></span><span><small>FROM OP {String((parent?.id ?? 0)*10).padStart(3,"0")} · {branch.branch || "Branch"}</small><strong>{branch.name}</strong><em>{branch.station} · {branch.vendor || "Vendor not assigned"}</em></span><span className="branch-metrics">{(Number(branch.setupMinutes)||0)+((Number(branch.cycleSeconds)||0)*(Number(branch.quantity)||0))/60} min<br/>₹{((Number(branch.pricePerPart)||0)*(Number(branch.quantity)||0)).toLocaleString("en-IN",{maximumFractionDigits:2})}</span></button>; })}</div></section>}
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
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
}
function VendorWorkspace({ onBack, onNotice, notice, initialSearch = "" }: { onBack: () => void; onNotice: (value: string) => void; notice: string; initialSearch?: string }) {
  const [contacts, setContacts] = useState<VendorContact[]>(() => readLocal(CONTACTS_KEY, seedContacts));
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(() => readLocal(FOLLOWUPS_KEY, []));
  const [search, setSearch] = useState(initialSearch);
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Omit<VendorContact, "id">>({ company: "", contact: "", role: "", phone: "", email: "", processes: "", notes: "" });
  const selected = contacts.find((c) => c.id === selectedId) ?? contacts[0];
  const [task, setTask] = useState({ due: new Date(Date.now() + 86400000).toISOString().slice(0,10), channel: "WhatsApp" as FollowUpItem["channel"], message: "Hello, following up on our machining RFQ. Please share your quotation, lead time and current capacity." });
  const filtered = contacts.filter((c) => (c.company+" "+c.contact+" "+c.role+" "+c.phone+" "+c.email+" "+c.processes+" "+c.notes).toLowerCase().includes(search.toLowerCase().trim()) && c.company.toLowerCase().includes(companySearch.toLowerCase().trim()) && (c.contact+" "+c.role+" "+c.phone+" "+c.email).toLowerCase().includes(contactSearch.toLowerCase().trim()));
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
        <label className="vendor-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all vendor fields…"/></label>
         <div className="vendor-search-pair"><label className="vendor-search"><Search size={15}/><input value={companySearch} onChange={e=>setCompanySearch(e.target.value)} placeholder="Search vendor/company name…"/></label><label className="vendor-search"><Search size={15}/><input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search contact name, phone, email…"/></label></div>
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
  type ApiContact = { id: string; name: string; phone: string; company: string; optedIn: boolean; createdAt: string };
  type ApiSchedule = { id: string; to: string; message: string; nextRunAt: string | null; repeat: "once" | "daily" | "weekly"; enabled: boolean; lastRunAt: string | null; lastError: string };
  type ApiLog = { id: string; scheduleId: string; at: string; status: string; detail: string; providerMessageId?: string };
  const [apiUrl,setApiUrl]=useState(()=>window.localStorage.getItem("aximach.scheduler.url")||"http://localhost:8787");
  const [apiKey,setApiKey]=useState(()=>window.sessionStorage.getItem("aximach.scheduler.key")||"");
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [apiError,setApiError]=useState("");
  const [contacts,setContacts]=useState<ApiContact[]>([]);
  const [schedules,setSchedules]=useState<ApiSchedule[]>([]);
  const [logs,setLogs]=useState<ApiLog[]>([]);
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [company,setCompany]=useState(""); const [optedIn,setOptedIn]=useState(false);
  const [to,setTo]=useState(""); const [message,setMessage]=useState(""); const [due,setDue]=useState(()=>{const d=new Date(Date.now()+3600000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [repeat,setRepeat]=useState<"once"|"daily"|"weekly">("once");
  const base=apiUrl.trim().replace(/\/+$/,"");
  const request=async(path:string,init:RequestInit={})=>{const response=await fetch(base+path,{...init,headers:{"content-type":"application/json","x-aximach-key":apiKey,...(init.headers||{})}});const data=await response.json().catch(()=>({error:"The service returned an unreadable response."}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data;};
  const connect=async()=>{setBusy(true);setApiError("");try{if(!base.startsWith("https://")&&!/^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(base))throw new Error("Use HTTPS for a deployed service. HTTP is allowed only for localhost.");const h=await fetch(base+"/health");if(!h.ok)throw new Error("Scheduler health check failed.");await request("/api/contacts");const [c,s]=await Promise.all([request("/api/contacts"),request("/api/schedules")]);setContacts(c.contacts||[]);setSchedules(s.schedules||[]);setLogs(s.logs||[]);setConnected(true);window.localStorage.setItem("aximach.scheduler.url",base);window.sessionStorage.setItem("aximach.scheduler.key",apiKey);setApiError("");onNotice("Connected to the AXIMACH scheduler. Data shown here comes from its server.");}catch(e){setConnected(false);setApiError(e instanceof Error?e.message:"Connection failed.");}finally{setBusy(false);}};
  const refresh=async()=>{setBusy(true);setApiError("");try{const [c,s]=await Promise.all([request("/api/contacts"),request("/api/schedules")]);setContacts(c.contacts||[]);setSchedules(s.schedules||[]);setLogs(s.logs||[]);setConnected(true);}catch(e){setConnected(false);setApiError(e instanceof Error?e.message:"Refresh failed.");}finally{setBusy(false);}};
  const addContact=async()=>{setBusy(true);setApiError("");try{const d=await request("/api/contacts",{method:"POST",body:JSON.stringify({name,phone,company,optedIn})});setContacts(prev=>[...prev,d.contact]);setName("");setPhone("");setCompany("");setOptedIn(false);onNotice("Contact saved to the scheduler server.");}catch(e){setApiError(e instanceof Error?e.message:"Could not save contact.");}finally{setBusy(false);}};
  const addSchedule=async()=>{setBusy(true);setApiError("");try{const d=await request("/api/schedules",{method:"POST",body:JSON.stringify({to,message,nextRunAt:new Date(due).toISOString(),repeat})});setSchedules(prev=>[d.schedule,...prev]);setMessage("");onNotice("Schedule saved on the server. Actual sending still depends on valid Meta credentials and messaging policy.");}catch(e){setApiError(e instanceof Error?e.message:"Could not create schedule.");}finally{setBusy(false);}};
  const toggleSchedule=async(task:ApiSchedule)=>{setBusy(true);setApiError("");try{const d=await request("/api/schedules/"+task.id,{method:"PATCH",body:JSON.stringify({enabled:!task.enabled})});setSchedules(prev=>prev.map(x=>x.id===task.id?d.schedule:x));}catch(e){setApiError(e instanceof Error?e.message:"Could not update schedule.");}finally{setBusy(false);}};
  const downloadContacts=()=>{const csv=["name,phone,company,optedIn",...contacts.map(c=>[c.name,c.phone,c.company,String(c.optedIn)].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="aximach-contacts.csv";a.click();URL.revokeObjectURL(url);};
  return <section className="workspace-page">
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> SERVER-BACKED SCHEDULER CONNECTOR</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMMUNICATION / CRM</div><h1>Follow-up centre<span>.</span></h1><p>Contacts, one-time and recurring individual messages, server schedules and send logs.</p></div><button className="button-quiet" onClick={downloadContacts} disabled={!contacts.length}><FileDown size={15}/> Export contacts CSV</button></div>
    <section className="surface-panel followup-list-panel scheduler-connect-panel"><div className="panel-heading"><div><h3><Plug size={17}/> Scheduler connection</h3><p>Enter the URL of your deployed AXIMACH scheduler and its server API key.</p></div><span className={"module-number "+(connected?"scheduler-connected":"")}>{connected?"CONNECTED":"NOT CONNECTED"}</span></div>
      <div className="scheduler-connect-form"><label>Scheduler URL<input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="https://your-scheduler.example.com"/></label><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Server AXIMACH_API_KEY"/></label><button className="button-primary" disabled={busy||!apiUrl.trim()||!apiKey.trim()} onClick={connect}>{busy?"Connecting…":"Connect / refresh"}</button></div>
      {apiError&&<div className="scheduler-error"><ShieldAlert size={15}/>{apiError}</div>}
      <div className="module-safety-note"><ShieldCheck size={15}/><span>The API key is kept in this browser tab session, not permanently saved. Use HTTPS outside localhost. The Meta token must stay on the server. A successful connection does not prove WhatsApp sending is configured.</span></div>
    </section>
    <div className="scheduler-grid">
      <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3><Users size={17}/> Add contact</h3><p>Contacts are stored in the connected server, not synced from WhatsApp automatically.</p></div></div>
        <div className="scheduler-form"><label>Contact name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Vendor / customer name"/></label><label>Phone with country code<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="9198XXXXXXXX"/></label><label>Company<input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company name (optional)"/></label><label className="scheduler-optin"><input type="checkbox" checked={optedIn} onChange={e=>setOptedIn(e.target.checked)}/> I have verified this person opted in to WhatsApp messages.</label><button className="button-primary" disabled={!connected||busy||!name.trim()||!phone.trim()||!optedIn} onClick={addContact}><Plus size={15}/> Save server contact</button></div>
        <div className="scheduler-subheading"><strong>Saved contacts</strong><span>{contacts.length} contacts</span></div>{contacts.length?<div className="scheduler-contact-list">{contacts.map(c=><button key={c.id} className={"scheduler-contact "+(to===c.phone?"scheduler-contact-active":"")} onClick={()=>setTo(c.phone)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{c.name}</strong><small>{c.company||"No company"} · +{c.phone}</small></span><span className={c.optedIn?"scheduler-optin-chip":"scheduler-noopt-chip"}>{c.optedIn?"Opt-in recorded":"No opt-in"}</span></button>)}</div>:<div className="vendor-empty">Connect the scheduler and add an opted-in contact.</div>}
      </section>
      <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3><CalendarClock size={17}/> Message automation</h3><p>Choose an opted-in individual contact, a future time and recurrence.</p></div></div>
        <div className="scheduler-form"><label>Recipient<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Select contact…</option>{contacts.filter(c=>c.optedIn).map(c=><option key={c.id} value={c.phone}>{c.name} · {c.phone}</option>)}</select></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Write the message to send…"/></label><label>First send time<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)}/></label><label>Repeat<select value={repeat} onChange={e=>setRepeat(e.target.value as "once"|"daily"|"weekly")}><option value="once">One time only</option><option value="daily">Repeat daily</option><option value="weekly">Repeat weekly</option></select></label><button className="button-primary" disabled={!connected||busy||!to||!message.trim()||!due} onClick={addSchedule}><CalendarClock size={15}/> Save schedule on server</button></div>
        <div className="module-safety-note"><ShieldAlert size={15}/><span>Repeat until reply is not enabled: reply webhooks and a safe stop-on-reply rule are still required. Only individual messages are supported; WhatsApp group sends and QR account sync are not implemented.</span></div>
      </section>
    </div>
    <section className="surface-panel followup-list-panel"><div className="panel-heading"><div><h3>Server schedules</h3><p>Runs while the scheduler service is online, even when this UI is closed.</p></div><button className="button-quiet compact-button" disabled={!connected||busy} onClick={refresh}><RotateCcw size={14}/> Refresh</button></div>
      {schedules.length===0?<div className="vendor-empty">No server schedules loaded yet.</div>:<div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Recipient</th><th>Next run</th><th>Repeat</th><th>Message</th><th>State</th><th>Action</th></tr></thead><tbody>{schedules.map(t=><tr key={t.id}><td>+{t.to}</td><td>{t.nextRunAt?new Date(t.nextRunAt).toLocaleString():"—"}</td><td>{t.repeat}</td><td>{t.message}</td><td>{t.lastError?"Paused · error":t.enabled?"Enabled":"Paused"}</td><td><button className="button-quiet compact-button" disabled={busy} onClick={()=>toggleSchedule(t)}>{t.enabled?<Pause size={13}/>:<Play size={13}/>} {t.enabled?"Pause":"Enable"}</button></td></tr>)}</tbody></table></div>}
    </section>
    <section className="surface-panel followup-list-panel"><div className="panel-heading"><div><h3><Activity size={17}/> Send log</h3><p>Provider acceptance/failure log. Delivery and replies require webhooks.</p></div><span className="module-number">{logs.length} EVENTS</span></div>{logs.length===0?<div className="vendor-empty">No send attempts logged by the scheduler yet.</div>:<div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Time</th><th>Schedule</th><th>Status</th><th>Details</th></tr></thead><tbody>{logs.slice(0,100).map(l=><tr key={l.id}><td>{new Date(l.at).toLocaleString()}</td><td>{l.scheduleId.slice(0,8)}</td><td>{l.status}</td><td>{l.detail}</td></tr>)}</tbody></table></div>}</section>
  </section>;
}


type ModuleProfile = { itemLabel: string; referenceLabel: string; ownerLabel: string; notesLabel: string; statuses: string[]; workflow: string[] };
const defaultProfile: ModuleProfile = { itemLabel: "Record name", referenceLabel: "Reference / identifier", ownerLabel: "Responsible person / company", notesLabel: "Notes / instructions", statuses: ["Open", "Planned", "In progress", "On hold", "Completed", "Cancelled"], workflow: ["Intake", "Review", "Work", "Verify", "Close"] };
const moduleProfiles: Record<string, ModuleProfile> = {
  "companies": { itemLabel:"Company / factory name",referenceLabel:"Company code / site code",ownerLabel:"Site manager",notesLabel:"Address, shifts, scope and operating notes",statuses:["Draft","Active","Paused","Under review","Archived"],workflow:["Company","Factory","Shifts","Permissions","Review"] },
  "customers": { itemLabel:"Customer / RFQ / sales order",referenceLabel:"RFQ / PO / order number",ownerLabel:"Customer owner / buyer",notesLabel:"Part, quantity, drawing revision, due date and commercial terms",statuses:["New RFQ","Costing","Quoted","Negotiation","Order confirmed","Lost","On hold"],workflow:["RFQ intake","Drawing review","Costing","Quotation","Order release"] },
  "purchasing": { itemLabel:"Purchase / subcontract order",referenceLabel:"PO / subcontract order number",ownerLabel:"Buyer / supplier",notesLabel:"Scope, quantity, rate, promised date and receipt evidence",statuses:["Draft","Approval pending","Sent","Acknowledged","Part received","Received","Closed","On hold"],workflow:["Requisition","Compare vendors","Approve","Send PO","Receive & reconcile"] },
  "components": { itemLabel:"Component / assembly name",referenceLabel:"Part number / drawing revision",ownerLabel:"Design owner",notesLabel:"Material, BOM, critical characteristics and drawing links",statuses:["Draft","Under engineering review","Released","Superseded","Obsolete","On hold"],workflow:["Part master","BOM","Drawing revision","Release","Impact review"] },
  "process-map": { itemLabel:"Process route / job",referenceLabel:"Part number / route revision",ownerLabel:"Process engineer",notesLabel:"Routing assumptions, setup requirements and quality gates",statuses:["Draft","Engineering review","Released","Running","On hold","Superseded"],workflow:["Define route","Assign resources","Quality gates","Approve revision","Track execution"] },
  "process-master": { itemLabel:"Process definition",referenceLabel:"Process code / revision",ownerLabel:"Process owner",notesLabel:"Inputs, parameters, equipment, controls and acceptance criteria",statuses:["Draft","Validated","Released","Under review","Retired"],workflow:["Define","Set parameters","Validate","Approve","Publish"] },
  "vendors": { itemLabel:"Vendor / sub-vendor",referenceLabel:"Vendor code / GSTIN",ownerLabel:"Vendor contact / relationship owner",notesLabel:"Processes, capacity, rates, certifications and escalation path",statuses:["Prospect","Qualification pending","Approved","Conditional","Blocked","Inactive"],workflow:["Discover","Qualify","Capability check","Approve","Monitor"] },
  "vendor-capability": { itemLabel:"Vendor capability",referenceLabel:"Capability ID / vendor code",ownerLabel:"Technical evaluator",notesLabel:"Machine envelope, tolerances, material range, certificates and evidence",statuses:["Unverified","Evidence requested","Under evaluation","Approved","Expired","Rejected"],workflow:["Claim","Evidence","Audit","Approve","Renew"] },
  "rates": { itemLabel:"Material / process rate",referenceLabel:"Rate code / supplier quote",ownerLabel:"Rate owner / source",notesLabel:"Grade, unit, currency, effective date, yield and source evidence",statuses:["Draft","Needs validation","Approved","Expired","Superseded"],workflow:["Capture","Validate source","Compare","Approve","Version"] },
  "inventory": { itemLabel:"Material lot / stock item",referenceLabel:"Item code / heat / lot number",ownerLabel:"Stores custodian",notesLabel:"Grade, location, quantity, reserved quantity and certificate",statuses:["Available","Reserved","Shortage","Quarantined","Scrap","Consumed"],workflow:["Receive","Inspect","Put away","Reserve","Issue / reconcile"] },
  "production": { itemLabel:"Production job / operation",referenceLabel:"Work order / operation number",ownerLabel:"Planner / cell lead",notesLabel:"Machine, shift, planned quantity, cycle time and constraints",statuses:["Planned","Ready","Running","Waiting","Blocked","Complete","On hold"],workflow:["Plan","Check capacity","Release","Execute","Report actuals"] },
  "shop-floor": { itemLabel:"Shop-floor scan / job traveller",referenceLabel:"QR / traveller / lot ID",ownerLabel:"Operator / shift lead",notesLabel:"Operation, good quantity, scrap, timestamps and custody event",statuses:["Not started","In progress","Waiting","Blocked","Reported","Verified"],workflow:["Scan","Verify job","Record work","Record quantity","Confirm handoff"] },
  "dispatch": { itemLabel:"Dispatch / consignment",referenceLabel:"Challan / shipment number",ownerLabel:"Dispatch coordinator / carrier",notesLabel:"Packages, documents, carrier, handoff and confirmed receipt",statuses:["Packing","Ready to dispatch","Dispatched","In transit","Delivered pending confirmation","Received","Exception"],workflow:["Pack","Documents","Handoff","Track","Confirm receipt"] },
  "quality": { itemLabel:"Inspection / nonconformance",referenceLabel:"Inspection plan / NCR number",ownerLabel:"Quality engineer / inspector",notesLabel:"Characteristic, tolerance, actual reading, gauge ID and evidence",statuses:["Planned","Inspecting","Pass","Hold","Nonconforming","Corrective action","Released"],workflow:["Plan inspection","Measure","Record evidence","Disposition","Authorise release"] },
  "tooling": { itemLabel:"Tool / fixture",referenceLabel:"Tool ID / asset number",ownerLabel:"Tool crib custodian",notesLabel:"Holder, offset, compatible machine, life limit and location",statuses:["Available","Issued","Near life limit","Under maintenance","Unavailable","Retired"],workflow:["Register","Verify compatibility","Issue","Track life","Return / inspect"] },
  "maintenance": { itemLabel:"Maintenance work order",referenceLabel:"Machine / asset ID",ownerLabel:"Maintenance technician",notesLabel:"Fault, safety isolation, parts, downtime and verification",statuses:["Reported","Triaged","Scheduled","In progress","Waiting for parts","Verified","Closed"],workflow:["Report fault","Assess risk","Plan work","Repair","Verify safe return"] },
  "workforce": { itemLabel:"Worker / skill qualification",referenceLabel:"Employee / qualification ID",ownerLabel:"Supervisor / trainer",notesLabel:"Skills, authorisations, expiry date, shift and training evidence",statuses:["Draft","Training required","Assessment pending","Qualified","Expired","Suspended"],workflow:["Define skill","Train","Assess","Authorise","Renew"] },
  "costing": { itemLabel:"Job cost estimate / cost sheet",referenceLabel:"Part / RFQ / cost revision",ownerLabel:"Estimator / finance reviewer",notesLabel:"Material, setup, cycle, tooling, outside services, yield, overhead and tax",statuses:["Draft","Estimating","Review pending","Approved estimate","Committed","Actuals reconciled","Closed"],workflow:["Estimate","Review assumptions","Approve","Capture actuals","Variance analysis"] },
  "invoices": { itemLabel:"Invoice / payment / cash item",referenceLabel:"Invoice / transaction reference",ownerLabel:"Accounts owner / approver",notesLabel:"Counterparty, amount, tax, due date, reconciliation and proof",statuses:["Draft","Approval pending","Due","Part paid","Paid","Disputed","Reconciled","Cancelled"],workflow:["Capture","Match PO / receipt","Approve","Pay / receive","Reconcile"] },
  "communications": { itemLabel:"Follow-up / communication task",referenceLabel:"Contact / RFQ / job reference",ownerLabel:"Assigned coordinator",notesLabel:"Channel, approved message, due date, reply and outcome",statuses:["Draft","Scheduled locally","Ready to send","Sent manually","Reply received","Done","Cancelled"],workflow:["Select contact","Prepare message","Approve","Send","Record reply"] },
  "risk": { itemLabel:"Risk / failure mode",referenceLabel:"Risk ID / affected job",ownerLabel:"Risk owner",notesLabel:"Cause, likelihood, impact, evidence, mitigation and trigger",statuses:["Identified","Assessing","Mitigation planned","Monitoring","Escalated","Closed"],workflow:["Identify","Score","Mitigate","Monitor trigger","Review outcome"] },
  "engineering-change": { itemLabel:"Engineering change request",referenceLabel:"ECR / ECO / revision",ownerLabel:"Change owner / approver",notesLabel:"Reason, affected BOMs, open jobs, inventory, suppliers and inspections",statuses:["Draft","Impact assessment","Approval pending","Approved","Implementing","Verified","Rejected"],workflow:["Raise change","Impact analysis","Approve","Implement","Verify & close"] },
  "reports": { itemLabel:"Report / KPI definition",referenceLabel:"Report ID / period",ownerLabel:"Report owner",notesLabel:"Metric definition, source, filters, refresh time and caveats",statuses:["Draft","Validating","Ready","Published","Needs review","Retired"],workflow:["Define KPI","Select source","Validate","Publish","Review accuracy"] },
  "export": { itemLabel:"Export job",referenceLabel:"Export ID / dataset",ownerLabel:"Requester / approver",notesLabel:"Format, filters, access scope, redactions and retention",statuses:["Requested","Validating","Approval pending","Ready","Downloaded","Expired","Rejected"],workflow:["Choose data","Apply scope","Preview","Approve","Generate export"] },
  "import": { itemLabel:"Import batch",referenceLabel:"Batch ID / source file",ownerLabel:"Data steward",notesLabel:"Mapping, duplicate policy, validation errors and reconciliation",statuses:["Uploaded","Mapping","Validation failed","Ready for review","Approved","Imported","Rolled back"],workflow:["Upload","Map columns","Validate","Preview changes","Commit / reconcile"] },
  "customer-portal": { itemLabel:"Customer portal access / case",referenceLabel:"Customer / order ID",ownerLabel:"Account owner",notesLabel:"Visibility scope, documents, order status and access approval",statuses:["Requested","Approval pending","Active","Suspended","Expired","Closed"],workflow:["Verify customer","Set scope","Approve access","Share status","Review access"] },
  "supplier-portal": { itemLabel:"Supplier portal access / submission",referenceLabel:"Supplier / PO ID",ownerLabel:"Supplier relationship owner",notesLabel:"RFQ response, acknowledgement, dispatch notice and certificates",statuses:["Invited","Awaiting response","Submitted","Under review","Accepted","Rejected","Suspended"],workflow:["Invite supplier","Receive submission","Validate","Accept / reject","Audit history"] },
  "integrations": { itemLabel:"Integration / connector",referenceLabel:"Connector ID / endpoint",ownerLabel:"Technical owner",notesLabel:"Data scope, credentials reference, sync direction, retries and health",statuses:["Not configured","Testing","Healthy","Degraded","Disabled","Failed"],workflow:["Configure","Limit permissions","Test","Enable","Monitor / revoke"] },
  "ai-policy": { itemLabel:"Automation / AI policy",referenceLabel:"Policy ID / version",ownerLabel:"Policy owner / approver",notesLabel:"Allowed actions, limits, stop conditions, evidence and escalation",statuses:["Draft","Review required","Approved","Active","Suspended","Retired"],workflow:["Define scope","Set limits","Test safely","Approve","Monitor / stop"] },
  "admin-security": { itemLabel:"Access / governance review",referenceLabel:"Review ID / user / role",ownerLabel:"Security reviewer",notesLabel:"Tenant scope, role grants, session evidence and audit trail",statuses:["Requested","Under review","Approved","Denied","Expired","Revoked"],workflow:["Request","Verify identity","Review least privilege","Approve","Audit / revoke"] },
  "continuity": { itemLabel:"Backup / recovery exercise",referenceLabel:"Run ID / incident ID",ownerLabel:"Recovery owner",notesLabel:"Backup point, RPO/RTO target, restore evidence and unresolved gaps",statuses:["Planned","Running","Passed","Failed","Remediation","Closed"],workflow:["Plan recovery","Verify backup","Restore","Validate integrity","Sign off"] }
};

type ModuleRecord = { id: string; title: string; reference: string; status: string; owner: string; linkedModule: string; notes: string; updatedAt: string };
const MODULE_RECORDS_KEY = "aximach.moduleRecords.v1";
function getAllModuleRecords(): Record<string, ModuleRecord[]> {
  try { const raw = window.localStorage.getItem(MODULE_RECORDS_KEY); return raw ? JSON.parse(raw) as Record<string, ModuleRecord[]> : {}; } catch { return {}; }
}
function setAllModuleRecords(data: Record<string, ModuleRecord[]>) {
  try { window.localStorage.setItem(MODULE_RECORDS_KEY, JSON.stringify(data)); } catch { /* browser storage may be unavailable */ }
}
function ModuleWorkspace({ module, onBack, onNotice, onOpenModules, onSelectModule }: { module: ModuleItem; onBack: () => void; onNotice: (value: string) => void; onOpenModules: () => void; onSelectModule: (id: string) => void }) {
  const Icon = module.icon;
  const profile = moduleProfiles[module.id] ?? defaultProfile;
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [allRecords, setAllRecords] = useState<Record<string, ModuleRecord[]>>(() => getAllModuleRecords());
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({ title: "", reference: "", status: "Open", owner: "", linkedModule: "", notes: "" });
  const records = allRecords[module.id] ?? [];
  const related = modules.filter((item) => item.id !== module.id && [module.group, "Engineering", "Operations", "Governance", "Supply Network", "Commercial", "Finance", "Connections"].includes(item.group)).slice(0, 8);
  const filtered = records.filter((record) => (record.title + " " + record.reference + " " + record.status + " " + record.owner + " " + record.notes).toLowerCase().includes(search.toLowerCase()));
  const persist = (next: Record<string, ModuleRecord[]>) => { setAllRecords(next); setAllModuleRecords(next); };
  const resetForm = () => { setDraft({ title: "", reference: "", status: "Open", owner: "", linkedModule: "", notes: "" }); setEditingId(""); setShowForm(false); };
  const saveRecord = () => {
    if (!draft.title.trim()) { onNotice("Enter a record name before saving."); return; }
    const record: ModuleRecord = { ...draft, title: draft.title.trim(), id: editingId || "rec-" + Date.now().toString(36), updatedAt: new Date().toISOString() };
    const current = records.filter((item) => item.id !== editingId);
    persist({ ...allRecords, [module.id]: [record, ...current] });
    resetForm();
    onNotice("Record saved on this device. It is not synced to a shared server.");
  };
  const editRecord = (record: ModuleRecord) => { setDraft({ title: record.title, reference: record.reference, status: record.status, owner: record.owner, linkedModule: record.linkedModule, notes: record.notes }); setEditingId(record.id); setShowForm(true); };
  const removeRecord = (id: string) => { if (!window.confirm("Remove this local sample record? This cannot be undone in this browser.")) return; persist({ ...allRecords, [module.id]: records.filter((item) => item.id !== id) }); onNotice("Local record removed."); };
  const exportRecords = () => { const blob = new Blob([JSON.stringify({ module: module.id, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "aximach-" + module.id + "-records.json"; a.click(); URL.revokeObjectURL(url); onNotice("Module records exported as JSON."); };
  const totalLinked = Object.values(allRecords).flat().filter((record) => record.linkedModule).length;
  return (
    <section className="workspace-page module-functional-page">
      <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15} /> Command centre</button><span className="demo-pill"><i /> LOCAL WORKSPACE</span></div>
      <div className="module-hero">
        <div className="module-hero-icon animated-module-icon"><Icon size={27} /></div>
        <div className="module-hero-copy"><div className="eyebrow"><span className="eyebrow-mark" /> {module.group.toUpperCase()} / AXIMACH MODULE</div><h1>{module.title}<span>.</span></h1><p>{module.description}</p></div>
        <button className="button-quiet" onClick={onOpenModules}><LayoutGrid size={16} /> All modules</button>
      </div>
      <section className="module-workflow-strip surface-panel" aria-label={module.title + " workflow"}>
        <div className="module-workflow-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> MODULE-SPECIFIC WORKFLOW</div><strong>{profile.workflow[activeWorkflowStep]}</strong><small>Select a stage to start a record at that point in the workflow.</small></div><span className="module-number">STEP {activeWorkflowStep + 1} / {profile.workflow.length}</span></div>
        <div className="module-workflow-steps">{profile.workflow.map((stage, index) => <button key={stage} className={"module-workflow-step " + (index === activeWorkflowStep ? "workflow-step-active" : index < activeWorkflowStep ? "workflow-step-done" : "")} onClick={() => { setActiveWorkflowStep(index); setDraft({ title:"", reference:"", status:profile.statuses[Math.min(index, profile.statuses.length - 1)], owner:"", linkedModule:"", notes:stage + " stage: add the required evidence, owner and acceptance criteria." }); setEditingId(""); setShowForm(true); }}><span>{index < activeWorkflowStep ? <Check size={13}/> : String(index + 1).padStart(2,"0")}</span><strong>{stage}</strong><ArrowRight size={13}/></button>)}</div>
      </section>
      <div className="module-action-bar">
        <label className="module-record-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={"Search " + module.title.toLowerCase() + " records…"} /></label>
        <button className="button-primary" onClick={() => { setDraft({ title: "", reference: "", status: profile.statuses[0], owner: "", linkedModule: "", notes: "" }); setEditingId(""); setShowForm(true); }}><Plus size={15} /> Add {profile.itemLabel.toLowerCase()}</button>
        <button className="button-quiet" onClick={exportRecords}><FileDown size={15} /> Export</button>
      </div>
      {showForm && <section className="surface-panel module-record-form-panel">
        <div className="panel-heading"><div><h3>{editingId ? "Edit record" : "Create " + module.title + " record"}</h3><p>Required: record name. Data stays in this browser.</p></div><button className="icon-control" onClick={resetForm} aria-label="Close editor"><X size={15} /></button></div>
        <div className="module-record-form">
          <label>{profile.itemLabel} *<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={"Enter " + profile.itemLabel.toLowerCase()} /></label>
          <label>{profile.referenceLabel}<input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder={profile.referenceLabel} /></label>
          <label>Lifecycle status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{profile.statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>{profile.ownerLabel}<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} placeholder={profile.ownerLabel} /></label>
          <label>Link to another module<select value={draft.linkedModule} onChange={(event) => setDraft({ ...draft, linkedModule: event.target.value })}><option value="">No linked module</option>{modules.filter((item) => item.id !== module.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="module-form-wide">{profile.notesLabel}<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder={profile.notesLabel} /></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveRecord}><Check size={14} /> Save record</button><button className="button-quiet" onClick={resetForm}>Cancel</button></div>
        </div>
      </section>}
      <div className="module-workbench-grid">
        <section className="surface-panel module-records-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> RECORDS / WORK ITEMS</div><h3>{module.title}</h3><p>{records.length} saved locally · {filtered.length} shown</p></div><span className="module-number">{String(modules.findIndex((item) => item.id === module.id) + 1).padStart(2, "0")} / 32</span></div>
          {filtered.length ? <div className="module-record-list">{filtered.map((record) => <article className="module-record-card" key={record.id}>
            <div className="module-record-mark"><Icon size={18} /></div><div className="module-record-copy"><strong>{record.title}</strong><span>{record.reference || "No reference"} · {record.owner || "Unassigned"}</span><p>{record.notes || "No notes added."}</p>{record.linkedModule && <button className="inline-module-link" onClick={() => onSelectModule(record.linkedModule)}><GitBranch size={13} /> Open linked {modules.find((item) => item.id === record.linkedModule)?.title ?? "module"} <ArrowUpRight size={13} /></button>}</div>
            <div className="module-record-card-actions"><span className={"record-state state-" + record.status.toLowerCase().replace(/[^a-z]+/g, "-")}>{record.status}</span><button onClick={() => editRecord(record)}>Edit</button><button onClick={() => removeRecord(record.id)}>Delete</button></div>
          </article>)}</div> : <div className="module-empty-state"><div className="module-empty-icon"><Icon size={25} /></div><h3>{search ? "No matching records" : "Start using this module"}</h3><p>{search ? "Try another search term or clear the search." : "Create your first record. Then link it to another AXIMACH module to build a connected workflow."}</p>{!search && <button className="button-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Create first record</button>}</div>}
          <div className="module-storage-note"><ShieldCheck size={14} /> Saved in this browser only · no shared database is connected yet.</div>
        </section>
        <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> CROSS-MODULE LINKS</div><h3>Connected workspaces</h3><p>{totalLinked} linked records across local modules</p></div></div>
          {related.map((item) => { const RelatedIcon = item.icon; return <button className="related-row" key={item.id} onClick={() => onSelectModule(item.id)}><span className="related-icon"><RelatedIcon size={16} /></span><span><strong>{item.title}</strong><small>{(allRecords[item.id] ?? []).length} local records · {item.group}</small></span><ArrowUpRight size={14} /></button>; })}
          <button className="related-all" onClick={onOpenModules}>Browse all 32 modules <ArrowRight size={14} /></button>
        </aside>
      </div>
      <div className="module-safety-note"><ShieldCheck size={16} /><span>This workspace now supports local create, edit, delete, search, export and navigation links. It is not a production database; multi-user sync, server permissions, automated external actions and audit-grade persistence remain to be implemented.</span></div>
    </section>
  );
}

export default App;
