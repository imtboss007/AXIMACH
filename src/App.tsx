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
import ManufacturingMasterWorkspace from "./ManufacturingMasterWorkspace";
import LinkedProcessWorkspace from "./LinkedProcessWorkspace";
import LinkedCostingWorkspace from "./LinkedCostingWorkspace";
import InventoryWorkspace from "./InventoryWorkspace";
import MachineCapacityWorkspace from "./MachineCapacityWorkspace";
import ProductionPlanningWorkspace from "./ProductionPlanningWorkspace";
import { activeRows, makeId, nowIso, readManufacturingData, removeLegacyDemoData, useManufacturingData, type VendorRecord } from "./manufacturingData";

type ModuleItem = {
  id: string;
  title: string;
  group: string;
  description: string;
  icon: LucideIcon;
  action: string;
};

const dashboardItem: ModuleItem = { id: "dashboard", title: "Dashboard", group: "Overview", description: "Live overview of saved manufacturing records, active work and operational exceptions.", icon: LayoutGrid, action: "Open dashboard" };

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
  { id: "ai-policy", title: "AI Policy & Automation", group: "Governance", description: "Configure bounded autonomy, approvals, policies and automation stop controls.", icon: Bot, action: "Review AI safeguards" },
  { id: "admin-security", title: "Administration, Governance & Security", group: "Governance", description: "Control roles, tenant scope, access reviews, audit events and sessions.", icon: ShieldCheck, action: "Review access model" },
  { id: "continuity", title: "Business Continuity & Recovery", group: "Data & Platform", description: "Manage backups, recovery targets, restore evidence and incident runbooks.", icon: HardDrive, action: "Explore recovery readiness" }
];

const groupOptions = ["All domains", ...Array.from(new Set(modules.map((item) => item.group)))];

function App() {
  useState(() => { removeLegacyDemoData(); return true; });
  const [activeModuleId, setActiveModuleId] = useState("dashboard");
  const [moduleExplorerOpen, setModuleExplorerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("All domains");
  const [vendorSearchJump, setVendorSearchJump] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [notice, setNotice] = useState("");

  const activeModule = activeModuleId === "dashboard" ? dashboardItem : modules.find((item) => item.id === activeModuleId) ?? modules[0];
  const globalRecords = getAllModuleRecords();
  const globalVendorContacts = activeRows(readManufacturingData().vendors);
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
      setAiResponse("No connected production schedule is available to analyse yet. Add a real PO, component and route first; no delivery promise has been inferred.");
    } else if (lower.includes("vendor") || lower.includes("supplier")) {
      setAiResponse("No vendor recommendation is generated until vendor capability, quotations, lead times and recorded quality history are available.");
    } else if (lower.includes("cost") || lower.includes("profit")) {
      setAiResponse("Use the linked Costing workspace to record material, process quotations, transport, actual rates, rejects, overhead and tax for a selected component.");
    } else if (lower.includes("quality") || lower.includes("inspection")) {
      setAiResponse("Quality recommendations are not connected to a live inspection record yet. No release or production action has been executed.");
    } else {
      setAiResponse("AXIMACH AI analysis is not connected to an inference service yet. This screen will not invent live facts or execute a business action.");
    }
    setNotice("AI service not connected. No live business data was queried and no action was executed.");
  };

  return (
    <div className="app-shell">
      <header className="command-deck">
        <button className="brand-lockup" onClick={() => selectModule("dashboard")} aria-label="Open AXIMACH dashboard">
          <span className="brand-symbol"><span>A</span><i /></span>
          <span className="brand-copy"><strong>Machining Flow Control</strong><small>Multi-Company Manufacturing OS</small></span>
        </button>

        <div className="deck-divider" />
        <button className="factory-switcher" onClick={() => selectModule("companies")} aria-label="Manage companies and factories">
          <Factory size={16} /><span>Companies &amp; Factories</span><ChevronDown size={14}/>
        </button>

        <div className="deck-spacer" />
        <button className="command-search" onClick={() => { setCommandOpen(true); setModuleExplorerOpen(false); }} aria-label="Open command search">
          <Search size={17} /><span>Search modules, jobs, vendors…</span><kbd>⌘ K</kbd>
        </button>
        <button className="deck-action" onClick={openModuleExplorer}><LayoutGrid size={17} /><span>Modules</span><b>32</b></button>
        <button className="deck-icon alert-trigger" aria-label="Notifications" onClick={() => setNotice("AXIMACH shows alerts only when actual operation, quality or delivery records produce them.")}><Bell size={18} /><i /></button>
        <button className="profile-trigger" onClick={() => setNotice("Profile and role management are not connected in this prototype.")}><span className="profile-mark">AX</span><span className="profile-name">Workspace</span><ChevronDown size={13} /></button>
      </header>

      <div className="status-ribbon">
        <span className="ribbon-dot" /> AXIMACH WORKSPACE
        <span className="ribbon-separator">/</span>
        <span>No example records loaded · production metrics populate from saved records</span>
        <span className="ribbon-right"><ShieldCheck size={13} /> Safety gates are design requirements</span>
      </div>

      <main className="page-content">
        {activeModuleId === "dashboard" ? (
          <CommandCentre
            activeModule={activeModule}
            aiPrompt={aiPrompt}
            aiResponse={aiResponse}
            notice={notice}
            onAiPromptChange={setAiPrompt}
            onRunCommand={runCommand}
            onNotice={setNotice}
            onSelectModule={selectModule}
            onOpenModules={openModuleExplorer}
          />
        ) : activeModuleId === "process-map" ? (
          <LinkedProcessWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "companies" || activeModuleId === "purchasing" || activeModuleId === "components" ? (
          <ManufacturingMasterWorkspace moduleId={activeModuleId} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "production" ? (
          <ProductionPlanningWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} onSelectModule={selectModule} />
        ) : activeModuleId === "maintenance" ? (
          <MachineCapacityWorkspace mode="maintenance" onBack={() => selectModule("command-centre")} onNotice={setNotice} onSelectModule={selectModule} />
        ) : activeModuleId === "inventory" ? (
          <InventoryWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "costing" ? (
          <LinkedCostingWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "process-master" ? (
          <ModuleWorkspace module={activeModule} onBack={() => selectModule("command-centre")} onNotice={setNotice} onOpenModules={openModuleExplorer} onSelectModule={selectModule} />
        ) : activeModuleId === "vendors" ? (
          <VendorWorkspace initialSearch={vendorSearchJump} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "communications" ? (
          <FollowUpWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} />
        ) : (
          <ModuleWorkspace module={activeModule} onBack={() => selectModule("command-centre")} onNotice={setNotice} onOpenModules={openModuleExplorer} onSelectModule={selectModule} />
        )}
      </main>

      <nav className="command-rail" aria-label="Manufacturing modules">
        <div className="rail-section-label">WORKSPACES</div>
        <button title="Dashboard" className={activeModuleId === "dashboard" ? "rail-active" : ""} onClick={() => selectModule("dashboard")}><LayoutGrid size={16} /><span>Dashboard</span></button>
        {modules.map((item) => { const ItemIcon = item.icon; return <button key={item.id} title={item.title} className={activeModuleId === item.id ? "rail-active" : ""} onClick={() => selectModule(item.id)}><ItemIcon size={16} /><span>{item.title}</span></button>; })}
        <button className="rail-all" onClick={openModuleExplorer}><LayoutGrid size={16} /><span>Module explorer</span></button>
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

      <footer className="global-footer"><span>AXIMACH <b>PRECISION · FLOW · INTELLIGENCE</b></span><span>Master records · server sync status shown in each workspace</span></footer>
    </div>
  );
}

function CommandCentre(props: {
  activeModule: ModuleItem; aiPrompt: string; aiResponse: string; notice: string;
  onAiPromptChange: (value: string) => void; onRunCommand: () => void; onNotice: (value: string) => void;
  onSelectModule: (id: string) => void; onOpenModules: () => void;
}) {
  const { aiPrompt, aiResponse, notice, onAiPromptChange, onRunCommand, onNotice, onSelectModule, onOpenModules } = props;
  const actualData = readManufacturingData();
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
          <div className="graphic-caption"><span className="ribbon-dot" /> MANUFACTURING FLOW / LIVE RECORDS WHEN CONNECTED</div>
          <span className="graphic-coordinate coord-one">01 / MATERIAL</span><span className="graphic-coordinate coord-two">07 / QUALITY</span>
        </div>
      </section>

      <section className="pulse-heading">
        <div><div className="eyebrow"><span className="eyebrow-mark"/> FACTORY PULSE</div><h2>Operational overview<span>.</span></h2><p>Only saved AXIMACH records appear here; no sample jobs, fabricated rates or simulated machine readings are loaded.</p></div>
        <div className="pulse-actions"><span className="demo-pill"><i/> RECORD-DRIVEN</span><button className="button-primary compact-button" onClick={() => onSelectModule("companies")}><Plus size={14}/> Start with company</button></div>
      </section>
      <section className="metric-grid">
        <MetricCard title="Companies" value={String(activeRows(actualData.companies).length)} trend="Saved records" detail="Company master" icon={Factory} accent="blue"/>
        <MetricCard title="PO component lines" value={String(activeRows(actualData.purchaseOrders).reduce((sum,po) => sum + po.lines.filter(line => !("deletedAt" in line && (line as any).deletedAt)).length,0))} trend="Linked records" detail="Quantity and delivery target" icon={Package} accent="violet"/>
        <MetricCard title="Components" value={String(activeRows(actualData.components).length)} trend="Saved records" detail="Part numbers and revisions" icon={Boxes} accent="green"/>
        <MetricCard title="Operations" value={String(activeRows(actualData.operations).length)} trend="Saved records" detail="Routes linked to PO lines" icon={Activity} accent="amber"/>
      </section>
      <section className="dashboard-grid actual-data-dashboard">
        <div className="surface-panel flow-preview">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER DATA SETUP</div><h3>Build your manufacturing records</h3><p>Save each master once; choose its ID from linked workflows.</p></div><button className="round-action" onClick={() => onSelectModule("companies")} aria-label="Open company master"><ArrowUpRight size={18}/></button></div>
          <div className="setup-steps">
            <button onClick={() => onSelectModule("companies")}><span>01</span><strong>Company & factory</strong><small>{activeRows(actualData.companies).length} companies · {activeRows(actualData.factories).length} factories</small></button>
            <button onClick={() => onSelectModule("components")}><span>02</span><strong>Component master</strong><small>{activeRows(actualData.components).length} part numbers saved</small></button>
            <button onClick={() => onSelectModule("purchasing")}><span>03</span><strong>Purchase order lines</strong><small>{actualData.purchaseOrders.reduce((sum,po) => sum + po.lines.length,0)} lines saved</small></button>
            <button onClick={() => onSelectModule("vendors")}><span>04</span><strong>Vendor directory</strong><small>{activeRows(actualData.vendors).length} saved vendor/contact records</small></button>
          </div>
        </div>
        <div className="surface-panel jobs-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PRODUCTION ROUTES</div><h3>Recent operations</h3><p>Only operations saved for real PO component lines.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><Workflow size={14}/> Process Map</button></div>
          {activeRows(actualData.operations).length ? <div className="job-list">{activeRows(actualData.operations).slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,5).map(op => <div className="job-row" key={op.id}><span className="job-number">{String(op.sequence).padStart(2,"0")}</span><span className="job-main"><strong>{op.name}</strong><small>{actualData.components.find(c=>c.id===op.componentId)?.partNumber || "Component"} · {actualData.purchaseOrders.find(po=>po.id===op.poId)?.number || "PO"}</small></span><span className="job-chip">{op.status}</span></div>)}</div> : <div className="module-empty-state"><Workflow size={24}/><h3>No operations yet</h3><p>Select a PO component line and add the processes that this job actually needs.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}><Plus size={14}/> Open Process Map</button></div>}
        </div>
        <div className="surface-panel attention-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUOTATIONS</div><h3>Supplier rate history</h3><p>Received quotes are linked to a component, PO line, process and vendor.</p></div><span className="attention-count">{activeRows(actualData.quotations).length}</span></div>
          {activeRows(actualData.quotations).length ? <div className="job-list">{activeRows(actualData.quotations).slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,4).map(q => <div className="job-row" key={q.id}><span className="job-number"><CircleDollarSign size={15}/></span><span className="job-main"><strong>{actualData.components.find(x=>x.id===q.componentId)?.partNumber || "Component"} · {actualData.operations.find(x=>x.id===q.operationId)?.name || "Process"}</strong><small>{actualData.vendors.find(x=>x.id===q.vendorId)?.company || "Vendor"} · {q.quoteReference || "No reference"}</small></span><span className="job-chip">{q.status}</span></div>)}</div> : <div className="module-empty-state"><CircleDollarSign size={24}/><h3>No quotations yet</h3><p>Add real vendor quotations to compare rates per component and process.</p><button className="button-primary" onClick={() => onSelectModule("costing")}><Plus size={14}/> Add quotation</button></div>}
        </div>
        <div className="surface-panel attention-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> REVIEW QUEUE</div><h3>Recorded risks</h3><p>No illustrative alerts are shown.</p></div><ShieldCheck size={18}/></div>
          {activeRows(actualData.operations).filter(op => op.status === "Quality hold" || (op.plannedEnd && op.status !== "Complete" && op.plannedEnd < new Date().toISOString().slice(0,10))).length ? activeRows(actualData.operations).filter(op => op.status === "Quality hold" || (op.plannedEnd && op.status !== "Complete" && op.plannedEnd < new Date().toISOString().slice(0,10))).slice(0,5).map(op => <button className="attention-row" key={op.id} onClick={() => onSelectModule("process-map")}><span className="attention-symbol red-symbol"><ShieldAlert size={17}/></span><span className="attention-copy"><strong>{op.name}</strong><small>{op.status === "Quality hold" ? "Quality hold entered" : "Target date overdue"} · {op.plannedEnd || "No target date"}</small><em>Open linked Process Map</em></span><ArrowUpRight size={16}/></button>) : <div className="vendor-empty">No overdue operations or quality holds are recorded.</div>}
          <div className="attention-safety"><ShieldCheck size={14}/> Alerts are calculated from saved operation status and target dates.</div>
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

type CostingLine={id:string;process:string;vendor:string;qty:number;rate:number;marketRate:number;transport:number;actual:boolean};
type CostingComponent={id:string;code:string;name:string;revision:string;material:string;batchQty:number;salePrice:number;stockQty:number;materialQty:number;materialRate:number;marketMaterialRate:number;overhead:number;toolingCost:number;reworkCost:number;rejectedQty:number;scrapCost:number;gstRate:number;lines:CostingLine[]};
type VendorDraft = Omit<VendorRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
const emptyVendorDraft = (): VendorDraft => ({
  company:"",contact:"",role:"",phone:"",whatsappNumber:"",email:"",address:"",
  processes:"",machines:"",materials:"",notes:"",status:"Unverified contact — review",
  sourceContactId:"",whatsappSyncedAt:""
});
function VendorWorkspace({ onBack, onNotice, notice, initialSearch = "", onSelectModule }: { onBack:()=>void; onNotice:(value:string)=>void; notice:string; initialSearch?:string; onSelectModule:(id:string)=>void }) {
  const { data, update, syncStatus } = useManufacturingData();
  const contacts = activeRows(data.vendors);
  const [search,setSearch]=useState(initialSearch);
  const [selectedId,setSelectedId]=useState("");
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<VendorDraft>(emptyVendorDraft());
  const selected=contacts.find(v=>v.id===selectedId)||contacts[0];
  const filtered=contacts.filter(v=>(v.company+" "+v.contact+" "+v.role+" "+v.phone+" "+v.whatsappNumber+" "+v.email+" "+v.address+" "+v.processes+" "+v.machines+" "+v.materials+" "+v.notes+" "+v.status).toLowerCase().includes(search.toLowerCase().trim()));
  const beginNew=()=>{setSelectedId("");setDraft(emptyVendorDraft());setEditing(true);};
  const beginEdit=(v:VendorRecord)=>{setSelectedId(v.id);setDraft({company:v.company,contact:v.contact,role:v.role,phone:v.phone,whatsappNumber:v.whatsappNumber,email:v.email,address:v.address,processes:v.processes,machines:v.machines,materials:v.materials,notes:v.notes,status:v.status,sourceContactId:v.sourceContactId,whatsappSyncedAt:v.whatsappSyncedAt});setEditing(true);};
  const saveContact=()=>{
    if(!draft.company.trim()||!draft.contact.trim()){onNotice("Vendor company and contact person are required.");return;}
    const phone=String(draft.phone||"").replace(/\D/g,"");
    const whatsappNumber=String(draft.whatsappNumber||"").replace(/\D/g,"");
    const duplicate=contacts.find(v=>v.id!==selectedId&&phone&&String(v.phone||"").replace(/\D/g,"")===phone);
    if(duplicate){onNotice("This phone number is already linked to "+duplicate.company+". Edit that record to avoid duplicate vendor IDs.");return;}
    const stamp=nowIso();const id=selectedId||makeId("vendor");
    update(current=>{const old=current.vendors.find(v=>v.id===id);const record:VendorRecord={...draft,company:draft.company.trim(),contact:draft.contact.trim(),phone,whatsappNumber,id,createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};return {...current,vendors:[...current.vendors.filter(v=>v.id!==id),record]};});
    setSelectedId(id);setEditing(false);onNotice(syncStatus==="synced"?"Vendor saved to shared AXIMACH data.":"Vendor saved; cross-device sync activates when the existing AXIMACH server is connected and reachable.");
  };
  const archive=(v:VendorRecord)=>{if(!window.confirm("Archive this vendor? Historical operations and quotations will retain the vendor ID."))return;const stamp=nowIso();update(current=>({...current,vendors:current.vendors.map(x=>x.id===v.id?{...x,deletedAt:stamp,updatedAt:stamp}:x)}));setSelectedId("");setEditing(false);onNotice("Vendor archived; historical operation and quotation links were retained.");};
  return <section className="workspace-page vendor-master-page">
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED SERVER DATA":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"NO DEMO VENDORS · MASTER RECORDS"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / CONTACT MASTER</div><h1>Vendor network<span>.</span></h1><p>One vendor record connects its phone number, machine/process capability, operation assignments and quotation history.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("communications")}><CalendarClock size={15}/> Communications & follow-up</button><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add vendor</button></div></div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor, phone, process, machine, material…"/></label><span className="module-number">{contacts.length} VENDORS / CONTACTS</span></div>
    <div className="vendor-workspace-grid">
      <section className="surface-panel vendor-list-panel"><div className="panel-heading"><div><h3>Vendor directory</h3><p>Shared master records · imported WhatsApp contacts remain unverified until reviewed</p></div></div>
        <div className="vendor-record-list">{filtered.map(v=><button key={v.id} className={"vendor-record "+(selected?.id===v.id?"vendor-record-active":"")} onClick={()=>{setSelectedId(v.id);setEditing(false);}}><span className="vendor-avatar">{v.company.slice(0,1).toUpperCase()}</span><span className="vendor-record-copy"><strong>{v.company}</strong><small>{v.contact} · {v.phone?"+"+v.phone:"Phone missing"}</small><small>{v.processes||"Capabilities not recorded"} · {v.status}</small></span><ArrowRight size={14}/></button>)}{!filtered.length&&<div className="module-empty-state"><Users size={25}/><h3>{search?"No matching vendor":"No vendors added"}</h3><p>{search?"Try another search.":"No placeholder vendors are preloaded. Add actual suppliers here or scan the WhatsApp bridge QR to import available contacts."}</p>{!search&&<button className="button-primary" onClick={beginNew}><Plus size={14}/> Add first vendor</button>}</div>}</div>
      </section>
      <section className="surface-panel vendor-detail-panel">
        {editing?<><div className="panel-heading"><div><h3>{selectedId?"Edit vendor master":"New vendor master"}</h3><p>Company and contact person are required; phone numbers are checked for duplicates.</p></div><button className="icon-control" onClick={()=>setEditing(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="vendor-form">
            <label>Vendor company *<input value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Actual supplier / subcontractor name"/></label>
            <label>Contact person *<input value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})} placeholder="Actual contact name"/></label>
            <label>Role / department<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Sales, production, accounts…"/></label>
            <label>Phone with country code<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Country code + number"/></label>
            <label>WhatsApp number<input value={draft.whatsappNumber} onChange={e=>setDraft({...draft,whatsappNumber:e.target.value})} placeholder="Leave blank to use phone"/></label>
            <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
            <label className="editor-wide">Address<input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Vendor site / dispatch address"/></label>
            <label>Process capabilities<input value={draft.processes} onChange={e=>setDraft({...draft,processes:e.target.value})} placeholder="CNC turning, VMC, grinding, EDM…"/></label>
            <label>Machines / capacity<input value={draft.machines} onChange={e=>setDraft({...draft,machines:e.target.value})} placeholder="Machine models, travel, capacity…"/></label>
            <label>Material capabilities<input value={draft.materials} onChange={e=>setDraft({...draft,materials:e.target.value})} placeholder="Steel grades, aluminium, plastics…"/></label>
            <label>Vendor status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option>Unverified contact — review</option><option>Review pending</option><option>Approved</option><option>Not approved</option><option>On hold</option></select></label>
            <label className="editor-wide">Notes / lead time / certificates<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Quotation notes, lead time, certifications, capacity"/></label>
            <div className="vendor-form-actions"><button className="button-primary" onClick={saveContact}><Check size={14}/> Save vendor master</button><button className="button-quiet" onClick={()=>setEditing(false)}>Cancel</button></div>
          </div>
        </>:selected?<><div className="vendor-detail-title"><span className="vendor-avatar vendor-avatar-large">{selected.company.slice(0,1).toUpperCase()}</span><div><h3>{selected.company}</h3><p>{selected.contact} · {selected.role||"Role not set"}</p><span className="record-state">{selected.status}</span></div><button className="button-quiet" onClick={()=>beginEdit(selected)}>Edit</button></div>
          <div className="vendor-contact-grid"><div><small>PHONE</small><strong>{selected.phone||"Not added"}</strong></div><div><small>WHATSAPP</small><strong>{selected.whatsappNumber||selected.phone||"Not linked"}</strong></div><div><small>EMAIL</small><strong>{selected.email||"Not added"}</strong></div><div><small>ADDRESS</small><strong>{selected.address||"Not added"}</strong></div><div><small>PROCESS CAPABILITIES</small><strong>{selected.processes||"Not recorded"}</strong></div><div><small>MACHINES / CAPACITY</small><strong>{selected.machines||"Not recorded"}</strong></div><div><small>MATERIAL CAPABILITIES</small><strong>{selected.materials||"Not recorded"}</strong></div><div><small>WHATSAPP SYNC</small><strong>{selected.whatsappSyncedAt?new Date(selected.whatsappSyncedAt).toLocaleString():"Not synced"}</strong></div><div className="editor-wide"><small>NOTES</small><strong>{selected.notes||"No notes entered"}</strong></div></div>
          <div className="vendor-actions"><button className="button-primary" onClick={()=>{const phone=(selected.whatsappNumber||selected.phone).replace(/\D/g,"");if(!phone){onNotice("Add a phone / WhatsApp number first.");return;}window.open("https://wa.me/"+phone,"_blank","noopener,noreferrer");}}><MessageCircle size={15}/> Open WhatsApp</button><button className="button-quiet" onClick={()=>onSelectModule("costing")}><CircleDollarSign size={15}/> Quotes & costing</button><button className="button-quiet" onClick={()=>onSelectModule("process-map")}><Workflow size={15}/> Assign to operation</button><button className="button-quiet" onClick={()=>onSelectModule("communications")}><CalendarClock size={15}/> Schedule follow-up</button><button className="button-quiet" onClick={()=>archive(selected)}><X size={14}/> Archive vendor</button></div>
          <div className="module-safety-note"><ShieldCheck size={14}/><span>Operation assignments and quotations reference the vendor ID. QR-imported contacts stay unverified until you review them.</span></div>
        </>:<div className="module-empty-state"><Users size={25}/><h3>Select or add a vendor</h3><p>QR-synced contacts appear here after the WhatsApp bridge connects and returns contacts.</p><button className="button-primary" onClick={beginNew}><Plus size={14}/> Add vendor</button></div>}
      </section>
    </div>
  </section>;
}

function FollowUpWorkspace({ onBack, onNotice, notice }: { onBack: () => void; onNotice: (value: string) => void; notice: string }) {
  type ApiContact = { id: string; name: string; phone: string; company: string; optedIn: boolean; createdAt: string };
  type ApiSchedule = { id: string; to: string; message: string; nextRunAt: string | null; repeat: "once" | "daily" | "weekly"; enabled: boolean; lastRunAt: string | null; lastError: string };
  type ApiLog = { id: string; scheduleId: string; at: string; status: string; detail: string; providerMessageId?: string };
  const [apiUrl,setApiUrl]=useState(()=>window.localStorage.getItem("aximach.scheduler.url")||"http://localhost:8787");
  const [apiKey,setApiKey]=useState(()=>window.localStorage.getItem("aximach.scheduler.key")||(window.location.protocol==="file:"?"aximach-desktop-local-bridge-v1":""));
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [apiError,setApiError]=useState("");
  const [contacts,setContacts]=useState<ApiContact[]>([]);
  const [contactSearch,setContactSearch]=useState("");
  const [schedules,setSchedules]=useState<ApiSchedule[]>([]);
  const [logs,setLogs]=useState<ApiLog[]>([]);
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [company,setCompany]=useState(""); const [optedIn,setOptedIn]=useState(false);
  const [to,setTo]=useState(""); const [message,setMessage]=useState(""); const [due,setDue]=useState(()=>{const d=new Date(Date.now()+3600000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [repeat,setRepeat]=useState<"once"|"daily"|"weekly">("once");
  const [waUrl,setWaUrl]=useState(()=>window.localStorage.getItem("aximach.whatsapp.url")||(window.location.protocol==="file:"?"http://127.0.0.1:8788":"http://localhost:8788"));
  const [waConnected,setWaConnected]=useState(false);
  const [waQr,setWaQr]=useState("");
  const [waUser,setWaUser]=useState("");
  type WhatsAppContact = { id:string; phone:string; name:string; notify?:string };
  const [waContacts,setWaContacts]=useState<WhatsAppContact[]>([]);
  const { update: updateManufacturingData } = useManufacturingData();
  const [waGroups,setWaGroups]=useState<Array<{id:string;name:string;participants:number}>>([]);
  const [waSearch,setWaSearch]=useState("");
  const [waTarget,setWaTarget]=useState("");
  const [waMessage,setWaMessage]=useState("");
  const [waOptIn,setWaOptIn]=useState(false);
  const [waSchedules,setWaSchedules]=useState<Array<{id:string;to:string;message:string;nextRunAt:string|null;repeat:"once"|"daily"|"weekly";enabled:boolean;lastError?:string}>>([]);
  const [waDue,setWaDue]=useState(()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [waRepeat,setWaRepeat]=useState<"once"|"daily"|"weekly">("once");
  const [waError,setWaError]=useState("");
  const waBase=waUrl.trim().replace(/\/+$/,"");
  const waRequest=async(path:string,init:RequestInit={})=>{const response=await fetch(waBase+path,{...init,headers:{"content-type":"application/json","x-aximach-key":apiKey,...(init.headers||{})}});const data=await response.json().catch(()=>({error:"WhatsApp bridge returned an unreadable response."}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data;};
  const syncWhatsAppContactsToVendors=(incoming:WhatsAppContact[])=>{if(!incoming.length)return {added:0,updated:0};const current=readManufacturingData();const next=[...current.vendors];const syncedAt=nowIso();let added=0;let updated=0;for(const contact of incoming){const phone=String(contact.phone||"").replace(/\D/g,"");const label=String(contact.name||contact.notify||phone||"Imported WhatsApp contact").trim();const index=next.findIndex(v=>v.sourceContactId===contact.id||(phone&&([v.phone,v.whatsappNumber].some(value=>String(value||"").replace(/\D/g,"")===phone))));if(index>=0){const old=next[index];const patch:VendorRecord={...old,sourceContactId:old.sourceContactId||contact.id,phone:old.phone||phone,whatsappNumber:phone||old.whatsappNumber,contact:old.contact||label};const changed=patch.sourceContactId!==old.sourceContactId||patch.phone!==old.phone||patch.whatsappNumber!==old.whatsappNumber||patch.contact!==old.contact;if(changed){patch.whatsappSyncedAt=syncedAt;patch.updatedAt=syncedAt;next[index]=patch;updated++;}}else{next.push({id:makeId("vendor"),company:label,contact:label,role:"WhatsApp contact",phone,whatsappNumber:phone,email:"",address:"",processes:"",machines:"",materials:"",notes:"Imported from WhatsApp linked devices. Verify the real vendor identity, process capabilities and consent before approval.",status:"Unverified contact — review",sourceContactId:contact.id,whatsappSyncedAt:syncedAt,createdAt:syncedAt,updatedAt:syncedAt});added++;}}if(added||updated)updateManufacturingData(currentData=>({...currentData,vendors:next}));return {added,updated};};
  const refreshWhatsApp=async()=>{setBusy(true);setWaError("");try{if(!apiKey.trim())throw new Error("Enter the server API key above first.");if(!waBase.startsWith("https://")&&!/^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(waBase))throw new Error("Use HTTPS for a deployed bridge. HTTP is allowed only for localhost.");const h=await fetch(waBase+"/health");if(!h.ok)throw new Error("WhatsApp bridge health check failed.");const [st,co,gr,sc]=await Promise.all([waRequest("/api/whatsapp/status"),waRequest("/api/whatsapp/contacts"),waRequest("/api/whatsapp/groups"),waRequest("/api/whatsapp/schedules")]);setWaConnected(Boolean(st.connected));setWaQr(st.qrDataUrl||"");setWaUser(st.user||"");const contactRows:WhatsAppContact[]=co.contacts||[];setWaContacts(contactRows);setWaGroups(gr.groups||[]);setWaSchedules(sc.schedules||[]);const synced=st.connected?syncWhatsAppContactsToVendors(contactRows):{added:0,updated:0};window.localStorage.setItem("aximach.whatsapp.url",waBase);window.localStorage.setItem("aximach.scheduler.key",apiKey);setApiError("");onNotice(st.connected?"WhatsApp linked-device bridge connected; "+synced.added+" new contacts added to the AXIMACH vendor master and "+synced.updated+" existing records refreshed. They stay unverified until reviewed; cross-device persistence depends on the scheduler data server being connected.":"Bridge reachable. Scan the QR code below from WhatsApp > Linked devices.");}catch(e){setWaConnected(false);setWaError(e instanceof Error?e.message:"Could not connect to WhatsApp bridge.");}finally{setBusy(false);}};
  const addWhatsAppSchedule=async()=>{setBusy(true);setWaError("");try{if(!waOptIn)throw new Error("Confirm you have permission to message this recipient.");const d=await waRequest("/api/whatsapp/schedules",{method:"POST",body:JSON.stringify({to:waTarget,message:waMessage,nextRunAt:new Date(waDue).toISOString(),repeat:waRepeat,optedIn:true})});setWaSchedules(prev=>[d.schedule,...prev]);setWaMessage("");onNotice("WhatsApp automation saved to the bridge server.");}catch(e){setWaError(e instanceof Error?e.message:"Could not save WhatsApp automation.");}finally{setBusy(false);}};
  const toggleWhatsAppSchedule=async(task:{id:string;enabled:boolean})=>{setBusy(true);setWaError("");try{const d=await waRequest("/api/whatsapp/schedules/"+task.id,{method:"PATCH",body:JSON.stringify({enabled:!task.enabled})});setWaSchedules(prev=>prev.map(x=>x.id===task.id?d.schedule:x));}catch(e){setWaError(e instanceof Error?e.message:"Could not update WhatsApp schedule.");}finally{setBusy(false);}};
  const visibleWaContacts=waContacts.filter(c=>(c.name+" "+c.notify+" "+c.phone).toLowerCase().includes(waSearch.toLowerCase().trim()));
  const importWhatsAppContactsToVendors=()=>{if(!waContacts.length){setWaError("No WhatsApp contacts are synced yet. Link WhatsApp and refresh contacts first.");return;}const result=syncWhatsAppContactsToVendors(waContacts);onNotice("Vendor master sync complete: "+result.added+" new contacts added, "+result.updated+" existing records refreshed. Every imported contact remains unverified until reviewed.");};
  useEffect(()=>{if(window.location.protocol==="file:"){window.localStorage.setItem("aximach.scheduler.key",apiKey);window.localStorage.setItem("aximach.whatsapp.url",waUrl);const timer=window.setTimeout(()=>{void refreshWhatsApp();},1800);return()=>window.clearTimeout(timer);}if(window.localStorage.getItem("aximach.scheduler.key"))void refreshWhatsApp();},[]);
  useEffect(()=>{const local=window.location.protocol==="file:";const pollBase=local?"http://127.0.0.1:8788":waBase;const pollKey=local?"aximach-desktop-local-bridge-v1":apiKey;if(!pollKey.trim())return;let cancelled=false;const poll=async()=>{try{const headers={"x-aximach-key":pollKey};const statusResponse=await fetch(pollBase+"/api/whatsapp/status",{headers});if(!statusResponse.ok)return;const status=await statusResponse.json();if(cancelled)return;setWaConnected(Boolean(status.connected));setWaQr(status.qrDataUrl||"");setWaUser(status.user||"");if(!status.connected)return;const [co,gr,sc]=await Promise.all([fetch(pollBase+"/api/whatsapp/contacts",{headers}),fetch(pollBase+"/api/whatsapp/groups",{headers}),fetch(pollBase+"/api/whatsapp/schedules",{headers})]);if(cancelled)return;if(co.ok){const rows:WhatsAppContact[]=(await co.json()).contacts||[];setWaContacts(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);syncWhatsAppContactsToVendors(rows);}if(gr.ok){const rows=(await gr.json()).groups||[];setWaGroups(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);}if(sc.ok){const rows=(await sc.json()).schedules||[];setWaSchedules(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);}}catch{/* bridge may be unavailable while starting */}};void poll();const timer=window.setInterval(()=>void poll(),5000);return()=>{cancelled=true;window.clearInterval(timer);};},[waBase,apiKey]);

  const base=apiUrl.trim().replace(/\/+$/,"");
  const visibleContacts=contacts.filter(c=>(c.name+" "+c.company+" "+c.phone).toLowerCase().includes(contactSearch.toLowerCase().trim()));
  const request=async(path:string,init:RequestInit={})=>{const response=await fetch(base+path,{...init,headers:{"content-type":"application/json","x-aximach-key":apiKey,...(init.headers||{})}});const data=await response.json().catch(()=>({error:"The service returned an unreadable response."}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data;};
  const connect=async()=>{setBusy(true);setApiError("");try{if(!base.startsWith("https://")&&!/^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(base))throw new Error("Use HTTPS for a deployed service. HTTP is allowed only for localhost.");const h=await fetch(base+"/health");if(!h.ok)throw new Error("Scheduler health check failed.");await request("/api/contacts");const [c,s]=await Promise.all([request("/api/contacts"),request("/api/schedules")]);setContacts(c.contacts||[]);setSchedules(s.schedules||[]);setLogs(s.logs||[]);setConnected(true);window.localStorage.setItem("aximach.scheduler.url",base);window.localStorage.setItem("aximach.scheduler.key",apiKey);updateManufacturingData(currentData=>({...currentData}));setApiError("");onNotice("Scheduler connected. AXIMACH is syncing your saved companies, factories, PO lines, components, vendors, operations and quotations to this server; check each workspace sync status.");}catch(e){setConnected(false);setApiError(e instanceof Error?e.message:"Connection failed.");}finally{setBusy(false);}};
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
      <div className="module-safety-note"><ShieldCheck size={15}/><span>The server API key is saved in this browser so you do not need to enter it every time. Use this only on a trusted device; local browser storage is not a secure vault. Use HTTPS outside localhost and keep WhatsApp auth files and provider tokens private.</span></div>
    </section>
    <section className="surface-panel followup-list-panel scheduler-connect-panel">
      <div className="panel-heading"><div><h3><ScanLine size={17}/> QR-paired WhatsApp account</h3><p>Link your WhatsApp account once. Keep this service running on an always-on host with persistent disk.</p></div><span className={"module-number "+(waConnected?"scheduler-connected":"")}>{waConnected?"LINKED":"NOT LINKED"}</span></div>
      <div className="scheduler-connect-form"><label>WhatsApp bridge URL<input value={waUrl} onChange={e=>setWaUrl(e.target.value)} placeholder="https://your-whatsapp-bridge.example.com"/></label><button className="button-primary" disabled={busy||!waUrl.trim()||!apiKey.trim()} onClick={refreshWhatsApp}>{busy?"Connecting…":"Connect / refresh QR"}</button><button className="button-quiet" disabled={busy||!waConnected} onClick={()=>{setWaQr("");refreshWhatsApp();}}>Refresh status</button></div>
      {waError&&<div className="scheduler-error"><ShieldAlert size={15}/>{waError}</div>}
      {waQr&&!waConnected&&<div className="wa-pairing-box"><img src={waQr} alt="WhatsApp linked-device QR code"/><div><strong>Scan with your phone</strong><p>WhatsApp → Settings → Linked devices → Link a device. Keep this page private; QR codes grant account access.</p></div></div>}
      {waConnected&&<div className="module-safety-note"><ShieldCheck size={15}/><span>WhatsApp linked. {waUser?"Session: "+waUser+". ":""}The phone and AXIMACH UI can be closed while the bridge server remains online. This uses an unofficial WhatsApp Web library.</span></div>}
      <div className="wa-sync-grid">
        <div><div className="scheduler-subheading"><strong>Synced contacts</strong><span>{visibleWaContacts.length} / {waContacts.length}</span><button className="button-quiet compact-button" disabled={!waConnected||!waContacts.length} onClick={importWhatsAppContactsToVendors}><Users size={13}/> Import to vendors</button></div><label className="vendor-search scheduler-contact-search"><Search size={16}/><input value={waSearch} onChange={e=>setWaSearch(e.target.value)} placeholder="Search synced contact…"/></label><div className="wa-scroll-list">{visibleWaContacts.slice(0,100).map(c=><button key={c.id} className={"scheduler-contact "+(waTarget===c.id?"scheduler-contact-active":"")} onClick={()=>setWaTarget(c.id)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{c.name}</strong><small>{c.phone?"+":""}{c.phone||c.id}</small></span></button>)}{!visibleWaContacts.length&&<div className="vendor-empty">No synced contacts yet. Pair the device and refresh after WhatsApp syncs contact history.</div>}</div></div>
        <div><div className="scheduler-subheading"><strong>WhatsApp groups</strong><span>{waGroups.length} groups</span></div><div className="wa-scroll-list">{waGroups.map(g=><button key={g.id} className={"scheduler-contact "+(waTarget===g.id?"scheduler-contact-active":"")} onClick={()=>setWaTarget(g.id)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{g.name}</strong><small>{g.participants} participants</small></span></button>)}{!waGroups.length&&<div className="vendor-empty">No groups loaded. Refresh after pairing.</div>}</div></div>
      </div>
      <div className="scheduler-grid">
        <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3><CalendarClock size={17}/> QR-account automation</h3><p>One-time or recurring messages for a selected contact or group.</p></div></div>
          <div className="scheduler-form"><label>Recipient<input readOnly value={waTarget?(waContacts.find(c=>c.id===waTarget)?.name||waGroups.find(g=>g.id===waTarget)?.name||waTarget):""} placeholder="Choose a contact or group above"/></label><label>Message<textarea value={waMessage} onChange={e=>setWaMessage(e.target.value)} rows={4} placeholder="Write your WhatsApp message…"/></label><label>First send time<input type="datetime-local" value={waDue} onChange={e=>setWaDue(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)}/></label><label>Repeat<select value={waRepeat} onChange={e=>setWaRepeat(e.target.value as "once"|"daily"|"weekly")}><option value="once">One time only</option><option value="daily">Repeat daily</option><option value="weekly">Repeat weekly</option></select></label><label className="scheduler-optin"><input type="checkbox" checked={waOptIn} onChange={e=>setWaOptIn(e.target.checked)}/> I have permission to message this person/group and will honour opt-outs.</label><button className="button-primary" disabled={!waConnected||busy||!waTarget||!waMessage.trim()||!waDue||!waOptIn} onClick={addWhatsAppSchedule}><CalendarClock size={15}/> Save QR-account automation</button></div>
        </section>
        <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3>QR-account schedules</h3><p>Stored by the bridge server; paused tasks can be resumed.</p></div></div>{waSchedules.length?<div className="scheduler-contact-list">{waSchedules.map(task=><div key={task.id} className="scheduler-contact"><span className="scheduler-avatar"><CalendarClock size={15}/></span><span><strong>{task.message.slice(0,68)}{task.message.length>68?"…":""}</strong><small>{task.to} · {task.repeat} · {task.nextRunAt?new Date(task.nextRunAt).toLocaleString():"completed"}</small>{task.lastError&&<small className="scheduler-error">{task.lastError}</small>}</span><button className="button-quiet compact-button" onClick={()=>toggleWhatsAppSchedule(task)}>{task.enabled?"Pause":"Resume"}</button></div>)}</div>:<div className="vendor-empty">No QR-account schedules yet.</div>}</section>
      </div>
      <div className="module-safety-note"><ShieldAlert size={15}/><span>Keep the bridge and persistent auth directory private. This is an unofficial WhatsApp Web integration and may break or trigger account restrictions. Do not send unsolicited messages. Schedules run only while the bridge host is online; group sends should be used only with appropriate permission.</span></div>
    </section>
    <div className="scheduler-grid">
      <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3><Users size={17}/> Add contact</h3><p>Contacts are stored in the connected server, not synced from WhatsApp automatically.</p></div></div>
        <div className="scheduler-form"><label>Contact name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Vendor / customer name"/></label><label>Phone with country code<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="9198XXXXXXXX"/></label><label>Company<input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company name (optional)"/></label><label className="scheduler-optin"><input type="checkbox" checked={optedIn} onChange={e=>setOptedIn(e.target.checked)}/> I have verified this person opted in to WhatsApp messages.</label><button className="button-primary" disabled={!connected||busy||!name.trim()||!phone.trim()||!optedIn} onClick={addContact}><Plus size={15}/> Save server contact</button></div>
        <div className="scheduler-subheading"><strong>Saved contacts</strong><span>{visibleContacts.length} of {contacts.length} contacts</span></div><label className="vendor-search scheduler-contact-search"><Search size={16}/><input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search contact name, company or phone…"/><button type="button" className="button-quiet compact-button" onClick={()=>setContactSearch("")} disabled={!contactSearch}>Clear</button></label>{contacts.length?<div className="scheduler-contact-list">{visibleContacts.map(c=><button key={c.id} className={"scheduler-contact "+(to===c.phone?"scheduler-contact-active":"")} onClick={()=>setTo(c.phone)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{c.name}</strong><small>{c.company||"No company"} · +{c.phone}</small></span><span className={c.optedIn?"scheduler-optin-chip":"scheduler-noopt-chip"}>{c.optedIn?"Opt-in recorded":"No opt-in"}</span></button>)}{visibleContacts.length===0&&<div className="vendor-empty">No contact matches. Try another name or phone number.</div>}</div>:<div className="vendor-empty">Connect the scheduler and add an opted-in contact.</div>}
      </section>
      <section className="surface-panel scheduler-form-panel"><div className="panel-heading"><div><h3><CalendarClock size={17}/> Message automation</h3><p>Choose an opted-in individual contact, a future time and recurrence.</p></div></div>
        <div className="scheduler-form"><label>Recipient<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Select contact…</option>{contacts.filter(c=>c.optedIn&&(c.name+" "+c.company+" "+c.phone).toLowerCase().includes(contactSearch.toLowerCase().trim())).map(c=><option key={c.id} value={c.phone}>{c.name} · {c.phone}</option>)}</select></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Write the message to send…"/></label><label>First send time<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)}/></label><label>Repeat<select value={repeat} onChange={e=>setRepeat(e.target.value as "once"|"daily"|"weekly")}><option value="once">One time only</option><option value="daily">Repeat daily</option><option value="weekly">Repeat weekly</option></select></label><button className="button-primary" disabled={!connected||busy||!to||!message.trim()||!due} onClick={addSchedule}><CalendarClock size={15}/> Save schedule on server</button></div>
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
  const [recordSync, setRecordSync] = useState<"local" | "syncing" | "synced" | "error">("local");
  useEffect(() => {
    const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
    const key = window.localStorage.getItem("aximach.scheduler.key") || "";
    if (!base || !key) return;
    let cancelled = false;
    const headers = { "content-type": "application/json", "x-aximach-key": key };
    setRecordSync("syncing");
    fetch(base + "/api/records", { headers })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Record sync failed"); return data.records as Record<string, ModuleRecord[]>; })
      .then(async remote => {
        if (cancelled) return;
        const local = getAllModuleRecords();
        const merged: Record<string, ModuleRecord[]> = { ...(remote || {}) };
        for (const [moduleId, rows] of Object.entries(local)) {
          const byId = new Map((merged[moduleId] || []).map(row => [row.id, row]));
          for (const row of rows) if (!byId.has(row.id) || Date.parse(row.updatedAt || "") > Date.parse(byId.get(row.id)?.updatedAt || "")) byId.set(row.id, row);
          merged[moduleId] = Array.from(byId.values());
        }
        setAllRecords(merged);
        setAllModuleRecords(merged);
        const response = await fetch(base + "/api/records", { method: "PUT", headers, body: JSON.stringify({ records: merged }) });
        if (!response.ok) throw new Error("Could not persist merged module records to server");
        if (!cancelled) setRecordSync("synced");
      })
      .catch(() => { if (!cancelled) setRecordSync("error"); });
    return () => { cancelled = true; };
  }, []);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({ title: "", reference: "", status: "Open", owner: "", linkedModule: "", notes: "" });
  const records = allRecords[module.id] ?? [];
  const related = modules.filter((item) => item.id !== module.id && [module.group, "Engineering", "Operations", "Governance", "Supply Network", "Commercial", "Finance", "Connections"].includes(item.group)).slice(0, 8);
  const filtered = records.filter((record) => (record.title + " " + record.reference + " " + record.status + " " + record.owner + " " + record.notes).toLowerCase().includes(search.toLowerCase()));
  const persist = (next: Record<string, ModuleRecord[]>) => {
    setAllRecords(next); setAllModuleRecords(next);
    const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
    const key = window.localStorage.getItem("aximach.scheduler.key") || "";
    if (!base || !key) { setRecordSync("local"); return; }
    setRecordSync("syncing");
    fetch(base + "/api/records", { method: "PUT", headers: { "content-type": "application/json", "x-aximach-key": key }, body: JSON.stringify({ records: next }) })
      .then(response => { if (!response.ok) throw new Error("Record sync failed"); setRecordSync("synced"); })
      .catch(() => setRecordSync("error"));
  };
  const resetForm = () => { setDraft({ title: "", reference: "", status: "Open", owner: "", linkedModule: "", notes: "" }); setEditingId(""); setShowForm(false); };
  const saveRecord = () => {
    if (!draft.title.trim()) { onNotice("Enter a record name before saving."); return; }
    const record: ModuleRecord = { ...draft, title: draft.title.trim(), id: editingId || "rec-" + Date.now().toString(36), updatedAt: new Date().toISOString() };
    const current = records.filter((item) => item.id !== editingId);
    persist({ ...allRecords, [module.id]: [record, ...current] });
    resetForm();
    onNotice(recordSync === "synced" ? "Record saved and synced to the AXIMACH server." : "Record saved on this device. Connect the scheduler server to enable shared backup and cross-device sync.");
  };
  const editRecord = (record: ModuleRecord) => { setDraft({ title: record.title, reference: record.reference, status: record.status, owner: record.owner, linkedModule: record.linkedModule, notes: record.notes }); setEditingId(record.id); setShowForm(true); };
  const removeRecord = (id: string) => { if (!window.confirm("Remove this record from the current module? This cannot be undone in this browser.")) return; persist({ ...allRecords, [module.id]: records.filter((item) => item.id !== id) }); onNotice("Record removed from this device. Reconnect to the server to sync the change."); };
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
        <div className="panel-heading"><div><h3>{editingId ? "Edit record" : "Create " + module.title + " record"}</h3><p>Required: record name. Storage: {recordSync === "synced" ? "server synced" : recordSync === "syncing" ? "syncing to server…" : recordSync === "error" ? "sync failed — local copy retained" : "local device only until server connection is configured"}.</p></div><button className="icon-control" onClick={resetForm} aria-label="Close editor"><X size={15} /></button></div>
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
