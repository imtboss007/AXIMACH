import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ScreenOrientation as CapacitorScreenOrientation } from "@capacitor/screen-orientation";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, Bot,
  Box, Boxes, CalendarClock, Check, ChevronDown, CircleDollarSign, CircleHelp,
  ClipboardCheck, Clock3, Command, Cpu, Factory, FileDown, FileUp, Gauge, GitBranch, Network, Route,
  HardDrive, LayoutGrid, Handshake, Layers3, Menu, MessageCircle,
  Package, Pause, Play, Plug, Plus, RotateCcw, ScanLine, Search, Settings2,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Target, Truck, Users,
  Wallet, Workflow, Wrench, X, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProcessIcon } from "./IconStudio";
import FollowUpAssignmentsLauncher from "./FollowUpAssignments";
import SearchableMultiSelect from "./SearchableMultiSelect";
import SearchablePicker from "./SearchablePicker";

// Lazy module workspaces keep the initial dashboard bundle small on mobile.
const AXIMACHOrb = lazy(() => import("./AXIMACHOrb"));
const IconStudio = lazy(() => import("./IconStudio"));
const ManufacturingMasterWorkspace = lazy(() => import("./ManufacturingMasterWorkspace"));
const DashboardWorkspace = lazy(() => import("./DashboardWorkspace"));
const SpecializedDirectoryWorkspace = lazy(() => import("./SpecializedDirectoryWorkspace"));
const TransportDirectoryWorkspace = lazy(() => import("./TransportDirectoryWorkspace"));
const Contact360Workspace = lazy(() => import("./RelationshipWorkspaces").then(module => ({ default: module.Contact360Workspace })));
const VendorNetworkWorkspace = lazy(() => import("./RelationshipWorkspaces").then(module => ({ default: module.VendorNetworkWorkspace })));
const ProductionPlanWorkspace = lazy(() => import("./OperationsWorkspaces").then(module => ({ default: module.ProductionPlanWorkspace })));
const TransportDispatchWorkspace = lazy(() => import("./OperationsWorkspaces").then(module => ({ default: module.TransportDispatchWorkspace })));
const QualityInspectionWorkspace = lazy(() => import("./OperationsWorkspaces").then(module => ({ default: module.QualityInspectionWorkspace })));
const ReportsAnalyticsWorkspace = lazy(() => import("./IntelligenceWorkspaces").then(module => ({ default: module.ReportsAnalyticsWorkspace })));
const AIInsightsWorkspace = lazy(() => import("./IntelligenceWorkspaces").then(module => ({ default: module.AIInsightsWorkspace })));
const ExportCentreWorkspace = lazy(() => import("./IntelligenceWorkspaces").then(module => ({ default: module.ExportCentreWorkspace })));
const ImportCentreWorkspace = lazy(() => import("./IntelligenceWorkspaces").then(module => ({ default: module.ImportCentreWorkspace })));
const LinkedProcessWorkspace = lazy(() => import("./LinkedProcessWorkspace"));
const RouteFlowWorkspace = lazy(() => import("./RouteFlowWorkspace"));
const ManufacturingUniverseWorkspace = lazy(() => import("./ManufacturingUniverseWorkspace"));
const LinkedCostingWorkspace = lazy(() => import("./LinkedCostingWorkspace"));
const InventoryWorkspace = lazy(() => import("./InventoryWorkspace"));
import { activeRows, makeId, mergeManufacturingData, nowIso, readManufacturingData, removeLegacyDemoData, useManufacturingData, type VendorRecord } from "./manufacturingData";
import { AXIMACH_DEMO_ID_PREFIX, archiveAxMachTwoCompanyDemo, createAxMachTwoCompanyDemo } from "./aximachDemoData";

function isAllowedAxMachServiceUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    const octets = host.split(".").map(Number);
    const privateIpv4 = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255)
      && (octets[0] === 10
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
    const localHost = host === "localhost" || host === "127.0.0.1";
    return parsed.protocol === "https:" || (parsed.protocol === "http:" && (localHost || privateIpv4));
  } catch {
    return false;
  }
}

type ModuleItem = {
  id: string;
  title: string;
  group: string;
  description: string;
  icon: LucideIcon;
  action: string;
};

const modules: ModuleItem[] = [
  { id: "companies", title: "Company Directory", group: "Master Data", description: "Company name, GST, contact person, email and address.", icon: Factory, action: "Open company directory" },
  { id: "components", title: "Component Directory", group: "Master Data", description: "Company-linked component names, numbers and piece or set prices.", icon: Box, action: "Open component directory" },
  { id: "purchasing", title: "Purchase Orders", group: "Commercial", description: "Company purchase orders, dates, due dates and multiple component quantities.", icon: Package, action: "Open purchase orders" },
  { id: "vendors", title: "Vendor Directory", group: "Supply Network", description: "Individual vendors with multiple process capabilities and contact details.", icon: Users, action: "Open vendor directory" },
  { id: "transport-master", title: "Transport Directory", group: "Supply Network", description: "Fixed route rates by vendor, vehicle type and one-way or two-way trip.", icon: Truck, action: "Open transport directory" },
  { id: "contact360", title: "Contact 360", group: "Connections", description: "Interlinked company, vendor and contact records with communication history.", icon: Users, action: "Open Contact 360" },
  { id: "process-master", title: "Process Directory", group: "Manufacturing", description: "Process types, categories, subcategories and linked vendors.", icon: Layers3, action: "Open process directory" },
  { id: "planned-cost", title: "Component Planned Cost", group: "Finance", description: "Independent planned component and process costs for comparison in costing.", icon: CircleDollarSign, action: "Open planned costs" },
  { id: "vendor-capability", title: "Vendor Network", group: "Supply Network", description: "Filter vendors by process category and supported processes.", icon: Workflow, action: "Open vendor network" },
  { id: "inventory", title: "Material Directory", group: "Operations", description: "Material grades, shapes, dimensions, density, supplier rates, BOM links and stock ledger.", icon: Boxes, action: "Open Material Directory" },
  { id: "production", title: "Production Plan & Process Plan", group: "Operations", description: "PO-wise component production, process assignments, transport and job completion.", icon: Activity, action: "Open production and process plans" },
  { id: "route-flow", title: "Route Flow & Relationships", group: "Manufacturing", description: "Full-screen editable material, transport and process route with 11 persisted relationship types.", icon: GitBranch, action: "Open full-screen route flow" },
  { id: "manufacturing-universe", title: "Manufacturing Universe", group: "Manufacturing", description: "Dedicated large-format live 3D manufacturing universe connected to all AXIMACH modules.", icon: Network, action: "Open live manufacturing universe" },
  { id: "dispatch", title: "Transport & Dispatch", group: "Operations", description: "Transport vendors, pickup, delivery, cost and dispatch status.", icon: Truck, action: "Open transport and dispatch" },
  { id: "quality", title: "Quality Inspection", group: "Quality", description: "Inspection measurements, accepted and rejected quantities and quality status.", icon: ClipboardCheck, action: "Open quality inspection" },
  { id: "costing", title: "Costing & Payment", group: "Finance", description: "Company, PO and component-wise planned versus actual process costs and payments.", icon: CircleDollarSign, action: "Open costing and payment" },
  { id: "communications", title: "Follow-up Centre", group: "Connections", description: "Contact follow-ups, reminders, WhatsApp-related communication and history.", icon: MessageCircle, action: "Open follow-up centre" },
  { id: "reports", title: "Reports & Analytics", group: "Insights", description: "PO, component, process, vendor, production, delivery and financial reporting.", icon: BarChart3, action: "Open reports and analytics" },
  { id: "ai-insights", title: "AI Insights", group: "Insights", description: "Evidence-based insights from saved AXIMACH operational and financial data.", icon: Sparkles, action: "Open AI insights" },
  { id: "export", title: "Data Exchange Centre", group: "Data", description: "Import and export records, validate files, review duplicates and create full backups.", icon: FileDown, action: "Open data exchange centre" }
];

const groupOptions = ["All domains", ...Array.from(new Set(modules.map((item) => item.group)))];

function DataExchangeWorkspace({onBack,onNotice,notice}: {onBack:()=>void;onNotice:(value:string)=>void;notice:string}) {
  const [mode,setMode] = useState<"export"|"import">("export");
  const { data, update, syncStatus } = useManufacturingData();
  const [demoBusy,setDemoBusy] = useState(false);
  const demoRows = Object.values(data).filter(value => Array.isArray(value)).flatMap(value => value as Array<{id?:string;deletedAt?:string}>).filter(row => row.id?.startsWith(AXIMACH_DEMO_ID_PREFIX));
  const activeDemoCount = demoRows.filter(row => !row.deletedAt).length;
  const demoLoaded = activeDemoCount > 0;
  const demoCounts = { companies:data.companies.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length, factories:data.factories.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length, vendors:data.vendors.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length, components:data.components.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length, orders:data.purchaseOrders.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length, operations:data.operations.filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)&&!row.deletedAt).length };
  const importDemo = () => {
    if (demoLoaded) { onNotice("Demo Factory is already imported. Delete the existing demo dataset before importing it again."); return; }
    if (!window.confirm("Import the isolated AXIMACH Demo Factory? All records are synthetic and clearly marked DEMO. Live factory records will be preserved.")) return;
    setDemoBusy(true);
    try {
      const sample = createAxMachTwoCompanyDemo();
      update(current => {
        const mergeById = <T extends {id:string}>(live:T[], incoming:T[]) => { const map=new Map(live.map(row=>[row.id,row])); incoming.forEach(row=>map.set(row.id,row)); return [...map.values()]; };
        return { ...current, updatedAt:sample.updatedAt,
          companies:mergeById(current.companies,sample.companies), factories:mergeById(current.factories,sample.factories),
          purchaseOrders:mergeById(current.purchaseOrders,sample.purchaseOrders), components:mergeById(current.components,sample.components),
          vendors:mergeById(current.vendors,sample.vendors), operations:mergeById(current.operations,sample.operations),
          quotations:mergeById(current.quotations,sample.quotations), materials:mergeById(current.materials,sample.materials),
          componentParts:mergeById(current.componentParts,sample.componentParts), materialCostEntries:mergeById(current.materialCostEntries,sample.materialCostEntries),
          routeRelationships:mergeById(current.routeRelationships||[],sample.routeRelationships||[]),
          bomLines:mergeById(current.bomLines,sample.bomLines), inventoryTransactions:mergeById(current.inventoryTransactions,sample.inventoryTransactions),
          contactProfiles:mergeById(current.contactProfiles,sample.contactProfiles), processDefinitions:mergeById(current.processDefinitions,sample.processDefinitions),
          plannedCosts:mergeById(current.plannedCosts,sample.plannedCosts), transportRoutes:mergeById(current.transportRoutes,sample.transportRoutes),
          transportLegs:mergeById(current.transportLegs,sample.transportLegs), paymentTransactions:mergeById(current.paymentTransactions,sample.paymentTransactions),
          inspectionMeasurements:mergeById(current.inspectionMeasurements,sample.inspectionMeasurements), followUpAssignments:mergeById(current.followUpAssignments,sample.followUpAssignments)
        };
      });
      onNotice("Demo Factory imported. Synthetic records are isolated with DEMO IDs; actual factory records were preserved.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "Demo import failed."); }
    finally { setDemoBusy(false); }
  };
  const deleteDemo = () => {
    if (!demoLoaded) { onNotice("No active Demo Factory records to delete."); return; }
    if (!window.confirm("Delete the imported Demo Factory? Only records with the reserved DEMO- ID prefix will be archived. Actual factory records will not be changed.")) return;
    update(current => archiveAxMachTwoCompanyDemo(current));
    onNotice("Demo Factory records archived. Actual factory records were preserved; the demo can be imported again.");
  };
  return (
    <section className="workspace-page">
      <div className="workspace-topline">
        <button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button>
        <span className="demo-pill"><i/> DATA EXCHANGE</span>
      </div>
      <div className="workspace-title-row">
        <div><div className="eyebrow"><span className="eyebrow-mark"/> DATA / IMPORT &amp; EXPORT</div><h1>Data Exchange Centre<span>.</span></h1><p>One workspace for validated imports, module exports and full AXIMACH backups.</p></div>
      </div>
      <section className="workspace-card" aria-label="Demo Factory data centre" style={{marginBottom:20,border:"1px solid var(--line, #d9e0e8)"}}>
        <div className="workspace-title-row" style={{alignItems:"center"}}>
          <div><div className="eyebrow"><span className="eyebrow-mark"/> DATA CENTRE / SANDBOX</div><h2 style={{margin:"4px 0"}}>Demo Factory</h2><p>Import a complete synthetic manufacturing workspace for testing. It remains identifiable by DEMO IDs and can be archived independently.</p></div>
          <span className="demo-pill"><i/> {demoLoaded?"DEMO LOADED":"ISOLATED SANDBOX"}</span>
        </div>
        <div className="metric-grid" style={{margin:"14px 0"}}>
          <div className="metric-card"><small>Companies</small><strong>{demoCounts.companies}</strong></div><div className="metric-card"><small>Factories</small><strong>{demoCounts.factories}</strong></div><div className="metric-card"><small>Demo vendors</small><strong>{demoCounts.vendors}</strong></div><div className="metric-card"><small>Components</small><strong>{demoCounts.components}</strong></div><div className="metric-card"><small>Purchase orders</small><strong>{demoCounts.orders}</strong></div><div className="metric-card"><small>Operations</small><strong>{demoCounts.operations}</strong></div>
        </div>
        <div className="linked-route-actions">
          <button type="button" className="button-primary compact-button" disabled={demoBusy||demoLoaded} onClick={importDemo}><Package size={14}/> {demoBusy?"Importing…":"Import Demo Factory"}</button>
          <button type="button" className="button-quiet compact-button" disabled={demoBusy||!demoLoaded} onClick={deleteDemo}><RotateCcw size={14}/> Delete Demo Data</button>
          <span className="muted-copy">Sync: {syncStatus} · Live records are retained</span>
        </div>
        <p className="muted-copy" style={{marginTop:10}}>Demo records are fictional test data, not real supplier offers, payments, inspections or production results. Delete archives only DEMO-prefixed records.</p>
      </section>
      <div className="linked-route-actions" role="tablist" aria-label="Data exchange mode">
        <button type="button" role="tab" aria-selected={mode==="export"} className={(mode==="export"?"button-primary":"button-quiet")+" compact-button"} onClick={()=>setMode("export")}><FileDown size={14}/> Export records</button>
        <button type="button" role="tab" aria-selected={mode==="import"} className={(mode==="import"?"button-primary":"button-quiet")+" compact-button"} onClick={()=>setMode("import")}><FileUp size={14}/> Import and validate</button>
      </div>
      {mode==="export"
        ? <ExportCentreWorkspace onBack={onBack} onNotice={onNotice} notice={notice} onSelectModule={()=>{}} />
        : <ImportCentreWorkspace onBack={onBack} onNotice={onNotice} notice={notice} onSelectModule={()=>{}} />}
    </section>
  );
}

type LinkedNavigationContext = { companyId?: string; poId?: string; poLineId?: string; componentId?: string; operationId?: string; vendorId?: string; routeId?: string; subtab?: string };

function App() {
  useState(() => { removeLegacyDemoData(); return true; });
  const [activeModuleId, setActiveModuleId] = useState("dashboard");
  const [moduleContext, setModuleContext] = useState<LinkedNavigationContext>({});
  const [moduleExplorerOpen, setModuleExplorerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [iconStudioOpen, setIconStudioOpen] = useState(false);
  const [iconStudioTarget,setIconStudioTarget] = useState<{targetType:"process"|"component"|"subcategory";targetRecordId:string}|null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("All domains");
  const [vendorSearchJump, setVendorSearchJump] = useState("");
  const [contactVendorSeed,setContactVendorSeed] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [notice, setNotice] = useState("");
  const [appearance, setAppearance] = useState<"light"|"dark"|"midnight"|"ocean">(() => { try { const saved=localStorage.getItem("aximach.ui.appearance"); return saved==="dark"||saved==="midnight"||saved==="ocean"?saved:"light"; } catch { return "light"; } });
  const [followUpSeed,setFollowUpSeed] = useState<{name:string;phone:string;company:string;vendorId:string;process:string;operationId:string}>({name:"",phone:"",company:"",vendorId:"",process:"",operationId:""});
  const needsLandscapeOrientation = activeModuleId === "process-map" || activeModuleId === "route-flow" || activeModuleId === "manufacturing-universe";
  const [orientationLockUnavailable,setOrientationLockUnavailable] = useState(false);
  const [orientationHintDismissed,setOrientationHintDismissed] = useState(false);
  const requestLandscapeOrientation = async ():Promise<boolean> => {
    try {
      await CapacitorScreenOrientation.lock({ orientation: "landscape-primary" });
      return true;
    } catch {
      try {
        const browserOrientation = window.screen?.orientation as unknown as { lock?: (orientation:"landscape-primary")=>Promise<void> };
        if (!browserOrientation?.lock) return false;
        await browserOrientation.lock("landscape-primary");
        return true;
      } catch {
        return false;
      }
    }
  };
  useEffect(() => {
    let disposed = false;
    setOrientationHintDismissed(false);
    if (!needsLandscapeOrientation || !window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches) {
      setOrientationLockUnavailable(false);
      void CapacitorScreenOrientation.unlock().catch(() => undefined);
      return;
    }
    setOrientationLockUnavailable(false);
    void requestLandscapeOrientation().then(locked => {
      if (disposed) {
        // A slow native bridge must not re-apply landscape after the user
        // has already left this workspace.
        if (locked) void CapacitorScreenOrientation.unlock().catch(() => undefined);
        return;
      }
      setOrientationLockUnavailable(!locked);
    });
    return () => {
      disposed = true;
      // Release the temporary landscape lock only when the user leaves all
      // landscape-first manufacturing workspaces.
      if (needsLandscapeOrientation) void CapacitorScreenOrientation.unlock().catch(() => undefined);
    };
  },[needsLandscapeOrientation]);
  const retryLandscapeOrientation = async () => {
    const locked = await requestLandscapeOrientation();
    setOrientationLockUnavailable(!locked);
  };
  const openVendorFollowUp = (vendor:{id:string;company:string;contact:string;phone:string;whatsappNumber:string;processes:string}, operationId="", processName="") => {
    setFollowUpSeed({name:vendor.contact,phone:vendor.whatsappNumber||vendor.phone,company:vendor.company,vendorId:vendor.id,process:processName||vendor.processes||"",operationId});
    selectModule("communications");
  };
  useEffect(() => { try { localStorage.setItem("aximach.ui.appearance",appearance); document.documentElement.dataset.theme=appearance; } catch { /* appearance remains active for this session */ } },[appearance]);

  const activeModule = modules.find((item) => item.id === activeModuleId) ?? modules[0];
  const globalRecords = getAllModuleRecords();
  const globalManufacturingData = readManufacturingData();
  const globalVendorContacts = activeRows(globalManufacturingData.vendors);
  const globalContactProfiles = activeRows(globalManufacturingData.contactProfiles || []);
  const normalizedGlobalQuery = query.toLowerCase().trim();
  const globalRecordResults = normalizedGlobalQuery ? Object.entries(globalRecords).flatMap(([moduleId, records]) => records.filter((record) => !record.deletedAt && (record.title + " " + record.reference + " " + record.status + " " + record.owner + " " + record.notes).toLowerCase().includes(normalizedGlobalQuery)).map((record) => ({ ...record, moduleId }))).slice(0, 8) : [];
  const globalVendorResults = normalizedGlobalQuery ? globalVendorContacts.filter((contact) => {
    const masterText = (contact.company + " " + contact.contact + " " + contact.role + " " + contact.phone + " " + contact.email + " " + contact.processes + " " + contact.notes).toLowerCase();
    const linkedText = globalContactProfiles.filter(profile => profile.linkedType === "vendor" && profile.linkedId === contact.id)
      .map(profile => [profile.name, profile.role, profile.group, profile.phone, profile.whatsapp, profile.email, profile.address, profile.history].join(" ")).join(" ").toLowerCase();
    return masterText.includes(normalizedGlobalQuery) || linkedText.includes(normalizedGlobalQuery);
  }).slice(0, 8) : [];

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
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectModule = (id: string, context: LinkedNavigationContext = {}) => {
    setModuleContext(context);
    setActiveModuleId(id);
    setModuleExplorerOpen(false);
    setMobileNavOpen(false);
    setCommandOpen(false);
    setQuery("");
    setNotice("");
  };

  const openModuleExplorer = () => {
    setQuery("");
    setDomain("All domains");
    setModuleExplorerOpen(true);
    setMobileNavOpen(false);
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
    <div className="app-shell" data-theme={appearance}>
      <header className="command-deck">
        <button className="brand-lockup" onClick={() => selectModule("dashboard")} aria-label="Open AXIMACH dashboard">
          <span className="brand-symbol"><span>A</span><i /></span>
          <span className="brand-copy"><strong>Machining Flow Control</strong><small>Multi-Company Manufacturing OS</small></span>
        </button>

        <button type="button" className="mobile-nav-trigger" aria-label="Open navigation menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}><Menu size={19} /></button>
        <div className="deck-divider" />
        <button className="factory-switcher" onClick={() => selectModule("dashboard")} aria-label="Open main dashboard">
          <Gauge size={16} /><span>Dashboard</span>
        </button>
        <button className="factory-switcher" onClick={() => selectModule("command-centre")} aria-label="Open 3D command centre">
          <Command size={16} /><span>3D Command Centre</span>
        </button>

        <div className="deck-spacer" />
        <button className="command-search" onClick={() => { setCommandOpen(true); setModuleExplorerOpen(false); }} aria-label="Open command search">
          <Search size={17} /><span>Search modules, jobs, vendors…</span><kbd>⌘ K</kbd>
        </button>
        <button className="deck-action" onClick={openModuleExplorer}><LayoutGrid size={17} /><span>Modules</span><b>{modules.length}</b></button>
        <button className="deck-action" onClick={() => setIconStudioOpen(true)}><Sparkles size={16}/><span>Logo Studio</span></button>
        <label className="appearance-picker" title="Appearance"><Settings2 size={15}/><select aria-label="Appearance" value={appearance} onChange={e=>setAppearance(e.target.value as "light"|"dark"|"midnight"|"ocean")}><option value="light">Light</option><option value="dark">Dark</option><option value="midnight">Midnight</option><option value="ocean">Ocean</option></select></label>
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
        {needsLandscapeOrientation && orientationLockUnavailable && !orientationHintDismissed && <div className="ax-landscape-rotate-prompt" role="status">
          <section>
            <RotateCcw size={38}/>
            <strong>Landscape view required</strong>
            <p>This browser could not rotate the screen automatically. Enable auto-rotate and turn your phone sideways for the full route canvas.</p>
            <div>
              <button type="button" className="button-primary" onClick={() => void retryLandscapeOrientation()}>Try landscape again</button>
              <button type="button" className="button-quiet" onClick={() => setOrientationHintDismissed(true)}>Continue in portrait</button>
            </div>
          </section>
        </div>}
        <Suspense fallback={<div className="workspace-loading-state" role="status"><span className="workspace-loading-spinner" /> Loading AXIMACH workspace…</div>}>
        {activeModuleId === "dashboard" ? (
          <DashboardWorkspace onSelectModule={selectModule} onOpenCommandCentre={() => selectModule("command-centre")} onOpenModules={openModuleExplorer} />
        ) : activeModuleId === "command-centre" ? (
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
        ) : activeModuleId === "manufacturing-universe" ? (
          <ManufacturingUniverseWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "route-flow" ? (
          <RouteFlowWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "process-map" ? (
          <LinkedProcessWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} onOpenIconStudio={(processDefinitionId)=>{setIconStudioTarget(processDefinitionId?{targetType:"process",targetRecordId:processDefinitionId}:null);setIconStudioOpen(true);}} onScheduleVendor={(vendorId,operationId,processName)=>{const vendor=globalVendorContacts.find(item=>item.id===vendorId);if(vendor)openVendorFollowUp(vendor,operationId,processName);else selectModule("vendors");}} />
        ) : activeModuleId === "companies" || activeModuleId === "purchasing" || activeModuleId === "components" ? (
          <ManufacturingMasterWorkspace navigationContext={moduleContext} moduleId={activeModuleId} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} onOpenIconStudio={(componentId)=>{setIconStudioTarget(componentId?{targetType:"component",targetRecordId:componentId}:null);setIconStudioOpen(true);}} />
        ) : activeModuleId === "inventory" ? (
          <InventoryWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "costing" ? (
          <LinkedCostingWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "process-master" || activeModuleId === "planned-cost" ? (
          <SpecializedDirectoryWorkspace moduleId={activeModuleId} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onOpenIconStudio={(processDefinitionId)=>{setIconStudioTarget(processDefinitionId?{targetType:"process",targetRecordId:processDefinitionId}:null);setIconStudioOpen(true);}} />
        ) : activeModuleId === "transport-master" ? (
          <TransportDirectoryWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} onOpenContact360={vendorId=>{setContactVendorSeed(vendorId);selectModule("contact360");}} />
        ) : activeModuleId === "reports" ? (
          <ReportsAnalyticsWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "ai-insights" ? (
          <AIInsightsWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "export" ? (
          <DataExchangeWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} />
        ) : activeModuleId === "production" ? (
          <ProductionPlanWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "dispatch" ? (
          <TransportDispatchWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "quality" ? (
          <QualityInspectionWorkspace initialContext={moduleContext} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "contact360" ? (
          <Contact360Workspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} initialVendorId={moduleContext.vendorId||contactVendorSeed} onInitialVendorConsumed={()=>setContactVendorSeed("")} />
        ) : activeModuleId === "vendor-capability" ? (
          <VendorNetworkWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />
        ) : activeModuleId === "vendors" ? (
          <VendorWorkspace initialSearch={vendorSearchJump} initialVendorId={moduleContext.vendorId} onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} onScheduleVendor={openVendorFollowUp} onAddContactForVendor={vendorId=>{setContactVendorSeed(vendorId);selectModule("contact360");}} />
        ) : activeModuleId === "communications" ? (
          <FollowUpWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} initialRecipient={followUpSeed} />
        ) : (
          <ModuleWorkspace module={activeModule} onBack={() => selectModule("command-centre")} onNotice={setNotice} onOpenModules={openModuleExplorer} onSelectModule={selectModule} />
        )}
        </Suspense>
      </main>

      {activeModuleId !== "dashboard" && activeModuleId !== "command-centre" && (
        <FollowUpAssignmentsLauncher
          moduleId={activeModuleId}
          moduleTitle={activeModuleId === "process-map" ? "Process Plan" : activeModule.title}
          onNotice={setNotice}
          onSelectModule={selectModule}
        />
      )}

      {mobileNavOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}
      <nav className={`command-rail${mobileNavOpen ? " mobile-nav-open" : ""}`} aria-label="AXIMACH navigation">
        <div className="rail-section-label">COMMAND CENTRES</div>
        <button title="Main Dashboard" className={activeModuleId === "dashboard" ? "rail-active" : ""} onClick={() => selectModule("dashboard")}><Gauge size={16} /><span>Main Dashboard</span></button>
        <button title="3D Command Centre" className={activeModuleId === "command-centre" ? "rail-active" : ""} onClick={() => selectModule("command-centre")}><Command size={16} /><span>3D Command Centre</span></button>
        <div className="rail-section-label">ALL MODULES</div>
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
              <label className="universe-search"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find any module or capability…" /><kbd>{modules.length} MODULES</kbd></label>
              <div className="domain-filters" aria-label="Filter modules by domain">
                {groupOptions.map((option) => <button key={option} className={domain === option ? "domain-active" : ""} onClick={() => setDomain(option)}>{option}</button>)}
              </div>
            </div>
            <div className="universe-grid">
              {filteredModules.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className="universe-card" onClick={() => selectModule(item.id)}>
                    <span className="universe-card-index">{String(modules.indexOf(item) + 3).padStart(2, "0")}</span>
                    <span className="universe-icon"><Icon size={20} strokeWidth={1.7} /></span>
                    <span className="universe-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                    <ArrowUpRight size={16} className="universe-arrow" />
                  </button>
                );
              })}
              {filteredModules.length === 0 && <div className="no-modules"><Search size={24} /><strong>No modules found</strong><span>Try another search or choose a different domain.</span><button onClick={() => { setQuery(""); setDomain("All domains"); }}>Clear filters</button></div>}
            </div>
            <div className="universe-footer"><span><LayoutGrid size={14} /> {filteredModules.length} of 18 modules</span><span>Tip: press <kbd>Ctrl/⌘ K</kbd> to search from anywhere</span></div>
          </section>
        </div>
      )}

      {commandOpen && (
        <div className="overlay-shell command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command search">
            <div className="palette-search"><Command size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules, vendors, contacts, jobs, references…" /><button className="close-round compact" onClick={() => setCommandOpen(false)} aria-label="Close search"><X size={17} /></button></div>
            {normalizedGlobalQuery && <><div className="palette-label">VENDOR NAMES & CONTACTS</div><div className="palette-results">{globalVendorResults.map((contact) => { const linked = globalContactProfiles.find(profile => profile.linkedType === "vendor" && profile.linkedId === contact.id && [profile.name, profile.role, profile.group, profile.phone, profile.whatsapp, profile.email, profile.address, profile.history].join(" ").toLowerCase().includes(normalizedGlobalQuery)); return <button key={contact.id} onClick={() => { setVendorSearchJump(contact.company + " " + contact.contact + (linked ? " " + linked.name + " " + (linked.group || "") : "")); selectModule("vendors"); }}><span className="palette-icon"><Users size={17}/></span><span><strong>{contact.company}</strong><small>{linked ? linked.name + " · " + (linked.group || linked.role || "Additional contact") : contact.contact + " · " + (contact.phone || contact.email || "Contact details not added")}</small></span><ArrowUpRight size={15}/></button>; })}{globalVendorResults.length === 0 && <div className="palette-empty">No vendor/contact matches.</div>}</div><div className="palette-label">SAVED RECORDS ACROSS MODULES</div><div className="palette-results">{globalRecordResults.map((record) => { const target = modules.find((item) => item.id === record.moduleId); const Icon = target?.icon ?? Box; return <button key={record.moduleId + ":" + record.id} onClick={() => selectModule(record.moduleId)}><span className="palette-icon"><Icon size={17}/></span><span><strong>{record.title}</strong><small>{target?.title || record.moduleId} · {record.reference || record.status}</small></span><ArrowUpRight size={15}/></button>; })}{globalRecordResults.length === 0 && <div className="palette-empty">No saved record matches yet.</div>}</div></>}
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

      <Suspense fallback={<div className="workspace-loading-state" role="status">Loading Icon Studio…</div>}><IconStudio open={iconStudioOpen} initialTarget={iconStudioTarget} onClose={() => {setIconStudioOpen(false);setIconStudioTarget(null);}} /></Suspense>

      <footer className="global-footer"><span>AXIMACH <b>PRECISION · FLOW · INTELLIGENCE</b></span><span>Master records · server sync status shown in each workspace</span></footer>
    </div>
  );
}

function CommandCentre(props: {
  activeModule: ModuleItem; aiPrompt: string; aiResponse: string; notice: string;
  onAiPromptChange: (value: string) => void; onRunCommand: () => void; onNotice: (value: string) => void;
  onSelectModule: (id: string, context?: LinkedNavigationContext) => void; onOpenModules: () => void;
}) {
  const { aiPrompt, aiResponse, notice, onAiPromptChange, onRunCommand, onNotice, onSelectModule, onOpenModules } = props;
  const { data: actualData } = useManufacturingData();
  return (
    <>
      {notice && <div className="notice-banner"><ShieldCheck size={16} /><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}
      <section className="hero-command">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-mark" /> 3D COMMAND CENTRE / 02</div>
          <h1>One sphere.<br /><em>Every command.</em></h1>
          <p>An interactive manufacturing command surface. Rotate the sphere, open workspaces and control the connected operating flow.</p>
          <div className="hero-actions"><button className="button-primary" onClick={() => onSelectModule("process-map")}><Workflow size={17} /> Open process universe <ArrowRight size={15} /></button><button className="button-quiet" onClick={onOpenModules}><LayoutGrid size={16} /> Explore all {modules.length} modules</button></div>
        </div>
        <div className="hero-graphic axim-hero-graphic" aria-label="Interactive AXIMACH 3D operations sphere">
          <div className="graphic-grid" />
          <AXIMACHOrb surface="command-centre" onSelectModule={onSelectModule} />
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
          <div className="setup-steps setup-steps-compact">
            <button onClick={() => onSelectModule("companies")} aria-label="Open company directory">
              <span className="setup-step-icon"><Factory size={21}/></span>
              <span className="setup-step-copy"><strong>Companies</strong><b className="setup-step-quantity">{activeRows(actualData.companies).length}</b><small>Company master</small></span>
            </button>
            <button onClick={() => onSelectModule("components")} aria-label="Open component master">
              <span className="setup-step-icon"><Box size={21}/></span>
              <span className="setup-step-copy"><strong>Components</strong><b className="setup-step-quantity">{activeRows(actualData.components).length}</b><small>part numbers</small></span>
            </button>
            <button onClick={() => onSelectModule("purchasing")} aria-label="Open purchase orders">
              <span className="setup-step-icon"><Package size={21}/></span>
              <span className="setup-step-copy"><strong>PO lines</strong><b className="setup-step-quantity">{actualData.purchaseOrders.reduce((sum,po) => sum + po.lines.filter(line => !("deletedAt" in line && (line as any).deletedAt)).length,0)}</b><small>component lines</small></span>
            </button>
            <button onClick={() => onSelectModule("contact360")} aria-label="Open Contact 360">
              <span className="setup-step-icon"><Users size={21}/></span>
              <span className="setup-step-copy"><strong>Contacts</strong><b className="setup-step-quantity">{activeRows(actualData.vendors).length}</b><small>Contact 360</small></span>
            </button>
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
          {activeRows(actualData.operations).filter(op => op.status === "Quality hold" || (op.plannedEnd && op.status !== "Complete" && op.plannedEnd < new Date().toISOString().slice(0,10))).length ? activeRows(actualData.operations).filter(op => op.status === "Quality hold" || (op.plannedEnd && op.status !== "Complete" && op.plannedEnd < new Date().toISOString().slice(0,10))).slice(0,5).map(op => {const po=actualData.purchaseOrders.find(row=>row.id===op.poId);return <button className="attention-row" key={op.id} onClick={() => onSelectModule("process-map",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id,vendorId:op.vendorId||undefined})}><span className="attention-symbol red-symbol"><ShieldAlert size={17}/></span><span className="attention-copy"><strong>{op.name}</strong><small>{op.status === "Quality hold" ? "Quality hold entered" : "Target date overdue"} · {op.plannedEnd || "No target date"}</small><em>Open linked Process Map</em></span><ArrowUpRight size={16}/></button>;}) : <div className="vendor-empty">No overdue operations or quality holds are recorded.</div>}
          <div className="attention-safety"><ShieldCheck size={14}/> Alerts are calculated from saved operation status and target dates.</div>
        </div>
      </section>
      <section className="module-shortcuts">
        <div className="section-row-title"><div><div className="eyebrow"><span className="eyebrow-mark" /> QUICK ACCESS</div><h2>Jump into a domain<span>.</span></h2></div><button className="button-quiet" onClick={onOpenModules}>View all 18 modules <ArrowRight size={15} /></button></div>
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
  processes:"",machines:"",materials:"",notes:"",status:"Unverified contact — review",vendorType:"",transportRoutes:[],additionalPhones:[],
  sourceContactId:"",whatsappSyncedAt:""
});
function VendorWorkspace({ onBack, onNotice, notice, initialSearch = "", initialVendorId = "", onSelectModule, onScheduleVendor, onAddContactForVendor }: { onBack:()=>void; onNotice:(value:string)=>void; notice:string; initialSearch?:string; initialVendorId?:string; onSelectModule:(id:string,context?:LinkedNavigationContext)=>void; onScheduleVendor:(vendor:{id:string;company:string;contact:string;phone:string;whatsappNumber:string;processes:string})=>void; onAddContactForVendor:(vendorId:string)=>void }) {
  const { data, update, syncStatus } = useManufacturingData();
  const contacts = activeRows(data.vendors);
  const linkedPeople = activeRows(data.contactProfiles || []).filter(person => person.linkedType === "vendor");
  const [search,setSearch]=useState(initialSearch);
  const [selectedId,setSelectedId]=useState(initialVendorId);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<VendorDraft>(emptyVendorDraft());
  const [vendorTypeFilters,setVendorTypeFilters]=useState<string[]>([]);
  const [capabilityCategoryFilters,setCapabilityCategoryFilters]=useState<string[]>([]);
  const [capabilityProcessFilters,setCapabilityProcessFilters]=useState<string[]>([]);
  const selected=contacts.find(v=>v.id===selectedId)||contacts[0];
  const processDefinitions=activeRows(data.processDefinitions);
  const vendorTypeOptions=[...new Set(contacts.map(v=>v.vendorType||"").filter(Boolean))].sort();
  const processCategoryOptions=[...new Set(processDefinitions.map(definition=>definition.category).filter(Boolean))].sort();
  const processTypeOptions=[...new Set(processDefinitions.map(definition=>definition.processType).filter(Boolean))].sort();
  const filtered=contacts.filter(v=>{
    const linkedText=linkedPeople.filter(person=>person.linkedId===v.id).map(person=>[person.name,person.role,person.group,person.phone,person.whatsapp,person.email,person.address,person.history].join(" ")).join(" ");
    const definitions=processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(v.id));
    const searchable=(v.company+" "+v.contact+" "+v.role+" "+v.phone+" "+v.whatsappNumber+" "+v.email+" "+v.address+" "+v.processes+" "+v.machines+" "+v.materials+" "+v.notes+" "+v.status+" "+linkedText).toLowerCase();
    const categoryText=definitions.map(definition=>definition.category).join(" ").toLowerCase();
    const processText=definitions.map(definition=>definition.processType).join(" ").toLowerCase()+" "+v.processes.toLowerCase();
    return searchable.includes(search.toLowerCase().trim())
      &&(!vendorTypeFilters.length||vendorTypeFilters.includes(v.vendorType||""))
      &&(!capabilityCategoryFilters.length||capabilityCategoryFilters.some(value=>categoryText.includes(value.toLowerCase())))
      &&(!capabilityProcessFilters.length||capabilityProcessFilters.some(value=>processText.includes(value.toLowerCase())));
  });
  const beginNew=()=>{setSelectedId("");setDraft(emptyVendorDraft());setEditing(true);};
  const beginEdit=(v:VendorRecord)=>{setSelectedId(v.id);setDraft({company:v.company,contact:v.contact,role:v.role,phone:v.phone,whatsappNumber:v.whatsappNumber,email:v.email,address:v.address,processes:[...new Set([...(v.processes||"").split(/[,;|]/).map(value=>value.trim()).filter(Boolean),...data.processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(v.id)).map(definition=>definition.processType)])].join(", "),processDefinitionIds:data.processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(v.id)).map(definition=>definition.id),machines:v.machines,materials:v.materials,notes:v.notes,status:v.status,vendorType:v.vendorType||"",transportRoutes:v.transportRoutes||[],additionalPhones:v.additionalPhones||[],sourceContactId:v.sourceContactId,whatsappSyncedAt:v.whatsappSyncedAt});setEditing(true);};
  const saveContact=()=>{
    if(!draft.company.trim()||!draft.contact.trim()){onNotice("Vendor company and contact person are required.");return;}
    const phone=String(draft.phone||"").replace(/\D/g,"");
    const whatsappNumber=String(draft.whatsappNumber||"").replace(/\D/g,"");
    const additionalPhones=[...new Set((draft.additionalPhones||[]).map(value=>String(value||"").replace(/\D/g,"")).filter(value=>value.length>=8&&value.length<=15&&value!==phone&&value!==whatsappNumber))];
    const duplicate=contacts.find(v=>v.id!==selectedId&&phone&&String(v.phone||"").replace(/\D/g,"")===phone);
    if(duplicate){onNotice("This phone number is already linked to "+duplicate.company+". Edit that record to avoid duplicate vendor IDs.");return;}
    const stamp=nowIso();const id=selectedId||makeId("vendor");
    update(current=>{const old=current.vendors.find(v=>v.id===id);const record:VendorRecord={...draft,company:draft.company.trim(),contact:draft.contact.trim(),phone,whatsappNumber,additionalPhones,vendorType:draft.vendorType||"",processDefinitionIds:draft.processDefinitionIds||[],id,createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};const selectedProcessTypes=new Set((draft.processes||"").split(/[,;|]/).map(value=>value.trim().toLowerCase()).filter(Boolean));const selectedDefinitionIds=new Set(draft.processDefinitionIds||[]);const processDefinitions=current.processDefinitions.map(definition=>{const linked=(definition.vendorIds||[]).includes(id);const shouldLink=selectedDefinitionIds.size?selectedDefinitionIds.has(definition.id):selectedProcessTypes.has(definition.processType.toLowerCase());if(linked===shouldLink)return definition;return {...definition,vendorIds:shouldLink?[...new Set([...(definition.vendorIds||[]),id])]:definition.vendorIds.filter(vendorId=>vendorId!==id),updatedAt:stamp};});return {...current,vendors:[...current.vendors.filter(v=>v.id!==id),record],processDefinitions};});
    setSelectedId(id);setEditing(false);onNotice(syncStatus==="synced"?"Vendor saved to shared AXIMACH data.":"Vendor saved; cross-device sync activates when the existing AXIMACH server is connected and reachable.");
  };
  const archive=(v:VendorRecord)=>{if(!window.confirm("Archive this vendor? Historical operations and quotations will retain the vendor ID."))return;const stamp=nowIso();update(current=>({...current,vendors:current.vendors.map(x=>x.id===v.id?{...x,deletedAt:stamp,updatedAt:stamp}:x)}));setSelectedId("");setEditing(false);onNotice("Vendor archived; historical operation and quotation links were retained.");};
  const contactSuggestions = [
    ...linkedPeople.map(person=>({name:person.name,phone:person.phone||person.whatsapp,whatsapp:person.whatsapp||person.phone,additionalPhones:person.additionalPhones||[],email:person.email,role:person.role,linkedId:person.linkedId,company:contacts.find(v=>v.id===person.linkedId)?.company||""})),
    ...contacts.filter(v=>v.id!==selectedId).map(v=>({name:v.contact,phone:v.phone,whatsapp:v.whatsappNumber||v.phone,additionalPhones:v.additionalPhones||[],email:v.email,role:v.role,linkedId:v.id,company:v.company}))
  ].filter(person=>person.name.trim()).map(person=>({...person,label:person.name+" · "+(person.phone||person.whatsapp||"No number")+" · "+person.company}));
  const fillContactFromSuggestion = (value:string) => {
    const normalized=value.trim().toLowerCase();
    const match=contactSuggestions.find(person=>person.label.toLowerCase()===normalized)
      || contactSuggestions.find(person=>person.name.trim().toLowerCase()===normalized);
    setDraft(current=>match?{...current,contact:match.name,phone:match.phone||current.phone,whatsappNumber:match.whatsapp||match.phone||current.whatsappNumber,additionalPhones:match.additionalPhones||current.additionalPhones,email:match.email||current.email,role:match.role||current.role}:{...current,contact:value});
  };
  const toggleProcessCapability = (processType:string) => {
    const selected=new Set(draft.processes.split(/[,;|]/).map(value=>value.trim()).filter(Boolean));
    if(selected.has(processType))selected.delete(processType);else selected.add(processType);
    setDraft(current=>({...current,processes:[...selected].join(", ")}));
  };

  return <section className="workspace-page vendor-master-page">
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED SERVER DATA":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"NO DEMO VENDORS · MASTER RECORDS"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / CONTACT MASTER</div><h1>Vendor Directory<span>.</span></h1><p>Vendor companies, process capabilities and all linked contact persons, including their groups, phone numbers and follow-up details.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("communications")}><ScanLine size={15}/> WhatsApp sync & follow-up</button><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add vendor</button></div></div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, contact person, group, phone, email or process…"/></label><span className="module-number">{contacts.length} CONTACTS · {contacts.filter(v => String(v.phone || v.whatsappNumber || "").replace(/\D/g, "").length >= 8).length} WITH NUMBERS</span></div>
    <div className="module-safety-note contact-sync-guidance"><ShieldCheck size={15}/><span>WhatsApp numbers are imported from Communications & WhatsApp. For PC ↔ mobile records to stay identical, both devices must use the same Shared AXIMACH data server URL and API key there. Without that shared server, records remain local to each device.</span><button className="button-quiet compact-button" onClick={()=>onSelectModule("communications")}><ScanLine size={13}/> Open sync settings</button></div>
    <section className="surface-panel vendor-directory-filter-panel">
      <div className="panel-heading"><div><h3>Vendor capability filters</h3><p>Search and select vendor category, Process Directory category and process type independently.</p></div><button className="button-quiet compact-button" onClick={()=>{setVendorTypeFilters([]);setCapabilityCategoryFilters([]);setCapabilityProcessFilters([]);setSearch("");}}>Clear all filters</button></div>
      <div className="ax-search-filter-columns">
        <SearchableMultiSelect id="vendor-filter-type" label="Vendor category" options={vendorTypeOptions.map(x=>({id:x,label:x}))} selected={vendorTypeFilters} onChange={setVendorTypeFilters} emptyMeansAll/>
        <SearchableMultiSelect id="vendor-filter-category" label="Process category" options={processCategoryOptions.map(x=>({id:x,label:x}))} selected={capabilityCategoryFilters} onChange={setCapabilityCategoryFilters} emptyMeansAll/>
        <SearchableMultiSelect id="vendor-filter-process" label="Process type" options={processTypeOptions.map(x=>({id:x,label:x}))} selected={capabilityProcessFilters} onChange={setCapabilityProcessFilters} emptyMeansAll/>
      </div>
    </section>
    <div className="vendor-workspace-grid">
      <section className="surface-panel vendor-list-panel"><div className="panel-heading"><div><h3>Vendor directory</h3><p>Shared master records · imported WhatsApp contacts remain unverified until reviewed</p></div></div>
        <div className="vendor-record-list">{filtered.map(v=><button key={v.id} className={"vendor-record "+(selected?.id===v.id?"vendor-record-active":"")} onClick={()=>{setSelectedId(v.id);setEditing(false);}}><span className="vendor-avatar">{v.company.slice(0,1).toUpperCase()}</span><span className="vendor-record-copy"><strong>{v.company}</strong><small>{v.contact} · {v.whatsappNumber ? "WhatsApp +" + v.whatsappNumber : v.phone ? "Phone +" + v.phone : "Number missing"}</small><small>{v.processes||"Capabilities not recorded"} · {v.status}</small><span className="vendor-process-logo-row">{processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(v.id)).slice(0,5).map(definition=><span className="vendor-process-logo-chip" key={definition.id}><ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={<Wrench size={12}/>} /><small>{definition.processType}</small></span>)}</span>{linkedPeople.filter(person=>person.linkedId===v.id).length>0&&<small>Other contacts: {linkedPeople.filter(person=>person.linkedId===v.id).map(person=>person.name+(person.group?" · "+person.group:"")).join(", ")}</small>}</span><ArrowRight size={14}/></button>)}{!filtered.length&&<div className="module-empty-state"><Users size={25}/><h3>{search?"No matching vendor":"No vendors added"}</h3><p>{search?"Try another search.":"No placeholder vendors are preloaded. Add actual suppliers here or scan the WhatsApp bridge QR to import available contacts."}</p>{!search&&<button className="button-primary" onClick={beginNew}><Plus size={14}/> Add first vendor</button>}</div>}</div>
      </section>
      <section className="surface-panel vendor-detail-panel">
        {editing?<><div className="panel-heading"><div><h3>{selectedId?"Edit vendor master":"New vendor master"}</h3><p>Company and contact person are required; phone numbers are checked for duplicates.</p></div><button className="icon-control" onClick={()=>setEditing(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="vendor-form">
            <label>Vendor company *<input list="aximach-vendor-company-suggestions" value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Type company name; reuse an existing company where applicable"/><datalist id="aximach-vendor-company-suggestions">{[...new Set([...contacts.map(v=>v.company),...activeRows(data.companies).map(company=>company.name)].filter(Boolean))].map(name=><option key={name} value={name}/>)}</datalist></label>
            <div className="editor-wide"><SearchablePicker id="vendor-contact-person" label="Contact person *" value={draft.contact} placeholder="Type name or WhatsApp contact…" options={contactSuggestions.map(person=>({id:person.label,label:person.label}))} onChange={value=>fillContactFromSuggestion(value)} allowCustom/><small className="field-hint">Selecting an existing Contact 360 / WhatsApp-synced person fills available phone, WhatsApp, email and role details.</small></div>
            <label>Role / department<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Sales, production, accounts…"/></label>
            <label>Phone with country code<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Country code + number"/></label>
            <label>WhatsApp number<input value={draft.whatsappNumber} onChange={e=>setDraft({...draft,whatsappNumber:e.target.value})} placeholder="Leave blank to use phone"/></label>
            <label>Additional phone numbers<input value={(draft.additionalPhones||[]).join(", ")} onChange={e=>setDraft({...draft,additionalPhones:e.target.value.split(/[,;|]/).map(value=>value.trim()).filter(Boolean)})} placeholder="Alternate office / mobile numbers, comma-separated"/></label>
            <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
            <label className="editor-wide">Address<input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Vendor site / dispatch address"/></label>
            <div className="editor-wide vendor-process-capabilities"><strong>Process capabilities · Process Directory</strong>
              <SearchableMultiSelect id="vendor-capability-pick" label="Linked process types" options={processDefinitions.map(process=>({id:process.id,label:process.category+" / "+process.processType+" · "+(process.subcategories||[]).join(", ")}))} selected={draft.processDefinitionIds||[]} onChange={values=>setDraft(current=>({...current,processDefinitionIds:values,processes:[...new Set(values.map(id=>processDefinitions.find(process=>process.id===id)?.processType).filter(Boolean) as string[])].join(", ")}))} placeholder="Search category, process or subcategory…"/>
              <div className="vendor-process-logo-row">{processDefinitions.filter(definition=>(draft.processDefinitionIds||[]).includes(definition.id)).map(definition=><span className="vendor-process-logo-chip" key={definition.id}><ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={<Wrench size={12}/>} /><small>{definition.processType}</small></span>)}</div><small>Selected process types are linked back to Process Directory and reflected in Vendor Network. Current selections: {draft.processes||"None"}.</small>
            </div>            <label>Machines / capacity<input value={draft.machines} onChange={e=>setDraft({...draft,machines:e.target.value})} placeholder="Machine models, travel, capacity…"/></label>
            <label>Material capabilities<input value={draft.materials} onChange={e=>setDraft({...draft,materials:e.target.value})} placeholder="Steel grades, aluminium, plastics…"/></label>
            <SearchablePicker id="vendor-type-edit" label="Type of vendor" value={draft.vendorType||""} options={["Raw material","Milling","Plano milling","Horizontal milling","Turning","Grinding","Heat treatment","Surface treatment","Wire EDM","Welding","Laser cutting","Fabrication","Transport","Tooling","Inspection","Other"].map(type=>({id:type,label:type}))} onChange={value=>setDraft(current=>({...current,vendorType:value}))} placeholder="Search vendor category…"/>
            {draft.vendorType==="Transport" && <div className="editor-wide vendor-transport-routes"><p>Transport route rates are maintained once in Transport Directory, not inside Vendor Directory.</p><button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("transport-master")}><Truck size={13}/> Manage routes in Transport Directory</button></div>
            }
            <label>Vendor status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option>Unverified contact — review</option><option>Review pending</option><option>Approved</option><option>Not approved</option><option>On hold</option></select></label>
            <label className="editor-wide">Notes / lead time / certificates<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Quotation notes, lead time, certifications, capacity"/></label>
            <div className="vendor-form-actions"><button className="button-primary" onClick={saveContact}><Check size={14}/> Save vendor master</button><button className="button-quiet" onClick={()=>setEditing(false)}>Cancel</button></div>
          </div>
        </>:selected?<><div className="vendor-detail-title"><span className="vendor-avatar vendor-avatar-large">{selected.company.slice(0,1).toUpperCase()}</span><div><h3>{selected.company}</h3><p>{selected.contact} · {selected.role||"Role not set"}</p><span className="record-state">{selected.status}</span></div><button className="button-quiet" onClick={()=>beginEdit(selected)}>Edit</button></div>
          <div className="vendor-contact-grid"><div><small>PHONE</small><strong>{selected.phone||"Not added"}</strong></div><div><small>WHATSAPP</small><strong>{selected.whatsappNumber||selected.phone||"Not linked"}</strong></div><div><small>EMAIL</small><strong>{selected.email||"Not added"}</strong></div><div><small>ADDRESS</small><strong>{selected.address||"Not added"}</strong></div><div><small>VENDOR TYPE</small><strong>{selected.vendorType||"Not specified"}</strong></div>{selected.vendorType==="Transport"&&<div className="editor-wide"><small>TRANSPORT ROUTES</small><button className="button-quiet compact-button" onClick={()=>onSelectModule("transport-master")}><Truck size={13}/> Open Transport Directory route master</button></div>}<div className="editor-wide"><small>PROCESS CAPABILITIES</small><div className="vendor-process-logo-row">{processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(selected.id)).map(definition=><span className="vendor-process-logo-chip" key={definition.id}><ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={<Wrench size={12}/>} /><small>{definition.processType}</small></span>)}</div><strong>{selected.processes||"Not recorded"}</strong></div><div><small>MACHINES / CAPACITY</small><strong>{selected.machines||"Not recorded"}</strong></div><div><small>MATERIAL CAPABILITIES</small><strong>{selected.materials||"Not recorded"}</strong></div><div><small>WHATSAPP SYNC</small><strong>{selected.whatsappSyncedAt?new Date(selected.whatsappSyncedAt).toLocaleString():"Not synced"}</strong></div><div className="editor-wide"><small>NOTES</small><strong>{selected.notes||"No notes entered"}</strong></div></div>
          <section className="vendor-linked-people"><div className="panel-heading"><div><h4>Other contact persons</h4><p>{linkedPeople.filter(person=>person.linkedId===selected.id).length} linked people</p></div><div className="relationship-actions"><button className="button-primary compact-button" onClick={()=>onAddContactForVendor(selected.id)}><Plus size={12}/> Add person</button><button className="button-quiet compact-button" onClick={()=>onSelectModule("contact360")}>Manage in Contact 360</button></div></div>{linkedPeople.filter(person=>person.linkedId===selected.id).map(person=><div className="vendor-linked-person" key={person.id}><strong>{person.name}</strong><span>{person.role||"Role not entered"} · {person.group||"No group"}</span><small>{person.phone||person.whatsapp||"No number"} · {person.email||"No email"}</small></div>)}{!linkedPeople.some(person=>person.linkedId===selected.id)&&<p className="field-hint">Add more people in Contact 360 and link them to this vendor company. Numbers remain attached to the individual contact.</p>}</section>
          <div className="vendor-actions"><button className="button-primary" onClick={()=>{const phone=(selected.whatsappNumber||selected.phone).replace(/\D/g,"");if(!phone){onNotice("Add a phone / WhatsApp number first.");return;}window.open("https://wa.me/"+phone,"_blank","noopener,noreferrer");}}><MessageCircle size={15}/> Open WhatsApp</button><button className="button-quiet" onClick={()=>onSelectModule("costing")}><CircleDollarSign size={15}/> Quotes & costing</button><button className="button-quiet" onClick={()=>onSelectModule("process-map")}><Workflow size={15}/> Assign to operation</button><button className="button-quiet" onClick={()=>onScheduleVendor(selected)}><CalendarClock size={15}/> Schedule follow-up</button><button className="button-quiet" onClick={()=>archive(selected)}><X size={14}/> Archive vendor</button></div>
          <div className="module-safety-note"><ShieldCheck size={14}/><span>Operation assignments and quotations reference the vendor ID. QR-imported contacts stay unverified until you review them.</span></div>
        </>:<div className="module-empty-state"><Users size={25}/><h3>Select or add a vendor</h3><p>QR-synced contacts appear here after the WhatsApp bridge connects and returns contacts.</p><button className="button-primary" onClick={beginNew}><Plus size={14}/> Add vendor</button></div>}
      </section>
    </div>
  </section>;
}

function FollowUpWorkspace({ onBack, onNotice, notice, initialRecipient }: { onBack: () => void; onNotice: (value: string) => void; notice: string; initialRecipient?: {name:string;phone:string;company:string;vendorId:string;process:string;operationId:string} }) {
  type ApiContact = { id: string; name: string; phone: string; company: string; optedIn: boolean; createdAt: string };
  type ApiSchedule = { id: string; to: string; message: string; nextRunAt: string | null; repeat: "once" | "daily" | "weekly"; enabled: boolean; lastRunAt: string | null; lastError: string; vendorId?: string; operationId?: string; process?: string; company?: string };
  type ApiLog = { id: string; scheduleId: string; at: string; status: string; detail: string; providerMessageId?: string };
  const [storageMode,setStorageMode]=useState<"local-only"|"shared-server">(()=>window.localStorage.getItem("aximach.storage.mode")==="local-only"?"local-only":(window.localStorage.getItem("aximach.scheduler.url")&&window.localStorage.getItem("aximach.scheduler.key")?"shared-server":"local-only"));
  const [apiUrl,setApiUrl]=useState(()=>window.localStorage.getItem("aximach.storage.mode")==="local-only"?"":window.localStorage.getItem("aximach.scheduler.url")||((window.location.protocol==="file:"||window.location.protocol==="aximach:")?"http://127.0.0.1:8787":""));
  const [apiKey,setApiKey]=useState(()=>window.localStorage.getItem("aximach.scheduler.key")||"");
  const [connected,setConnected]=useState(false);
  const [lanInfo,setLanInfo]=useState<{addresses:string[];apiKey:string;port:number}|null>(null);
  useEffect(()=>{
    if(window.location.protocol!=="file:"&&window.location.protocol!=="aximach:")return;
    if(window.localStorage.getItem("aximach.storage.mode")==="local-only")return;
    let cancelled=false;
    let attempts=0;
    let timer:number|undefined;
    const loadLanInfo=async()=>{
      try{
        const response=await fetch("http://127.0.0.1:8787/api/connection-info",{cache:"no-store"});
        if(!response.ok)throw new Error("Local server unavailable");
        const info=await response.json();
        if(!cancelled&&window.localStorage.getItem("aximach.storage.mode")!=="local-only"){setLanInfo(info);setApiKey(info.apiKey||"");setApiUrl("http://127.0.0.1:8787");setStorageMode("shared-server");}
      }catch{
        attempts++;
        if(!cancelled&&attempts<12)timer=window.setTimeout(loadLanInfo,1000);
      }
    };
    void loadLanInfo();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[]);

  const [busy,setBusy]=useState(false);
  const [apiError,setApiError]=useState("");
  const [contacts,setContacts]=useState<ApiContact[]>([]);
  const [contactSearch,setContactSearch]=useState("");
  const [schedules,setSchedules]=useState<ApiSchedule[]>([]);
  const [logs,setLogs]=useState<ApiLog[]>([]);
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [company,setCompany]=useState(""); const [optedIn,setOptedIn]=useState(false);
  const [to,setTo]=useState(""); const [message,setMessage]=useState(""); const [due,setDue]=useState(()=>{const d=new Date(Date.now()+3600000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [repeat,setRepeat]=useState<"once"|"daily"|"weekly">("once");
  const [waUrl,setWaUrl]=useState(()=>{
    const savedBridge=window.localStorage.getItem("aximach.whatsapp.url");
    if(savedBridge)return savedBridge;
    if((window.location.protocol==="file:"||window.location.protocol==="aximach:"))return "http://127.0.0.1:8789";
    // The QR bridge runs beside the local shared-data server on port 8789.
    // A phone/tablet configured with the PC's LAN address can derive it too.
    try {
      const sharedServer=window.localStorage.getItem("aximach.scheduler.url")||"";
      const parsed=new URL(sharedServer);
      if(parsed.protocol==="http:"){parsed.port="8789";parsed.pathname="";parsed.search="";parsed.hash="";return parsed.toString().replace(/\/$/,"");}
    } catch {}
    return "";
  });
  const [waConnected,setWaConnected]=useState(false);
  const [waQr,setWaQr]=useState("");
  const [waUser,setWaUser]=useState("");
  type WhatsAppContact = { id:string; phone:string; name:string; notify?:string; lid?:string; phoneNumber?:string; phone_number?:string; number?:string; pn?:string; senderPn?:string; participantPn?:string; remoteJidAlt?:string; participantAlt?:string; remoteJid?:string; jid?:string };
  const [waContacts,setWaContacts]=useState<WhatsAppContact[]>([]);
  const { update: updateManufacturingData } = useManufacturingData();
  const [waGroups,setWaGroups]=useState<Array<{id:string;name:string;participants:number}>>([]);
  const [waSearch,setWaSearch]=useState("");
  const [waTarget,setWaTarget]=useState("");
  const [waMessage,setWaMessage]=useState("");
  const [waOptIn,setWaOptIn]=useState(false);
  const [waSchedules,setWaSchedules]=useState<Array<{id:string;to:string;message:string;nextRunAt:string|null;repeat:"once"|"daily"|"weekly";enabled:boolean;lastError?:string;vendorId?:string;operationId?:string;process?:string;company?:string}>>([]);
  const [waDue,setWaDue]=useState(()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [waRepeat,setWaRepeat]=useState<"once"|"daily"|"weekly">("once");
  const [waError,setWaError]=useState("");
  useEffect(()=>{
    if(!initialRecipient)return;
    if(initialRecipient.phone){
      const digits=verifiedWhatsAppPhone(initialRecipient.phone);
      const matching=digits?waContacts.find(contact=>whatsappContactPhone(contact)===digits):undefined;
      setWaTarget(matching?.id||digits||initialRecipient.phone);
    }
    const subject=initialRecipient.process||"manufacturing follow-up";
    const operationRef=initialRecipient.operationId?" (AXIMACH operation "+initialRecipient.operationId.slice(0,8)+")":"";
    setWaMessage("Hello "+(initialRecipient.name||"")+", regarding "+subject+operationRef+" for "+initialRecipient.company+". Please share the current status and expected completion / delivery time. Thank you.");
  },[initialRecipient?.vendorId,initialRecipient?.operationId,waContacts.length]);
  useEffect(()=>{
    if(!initialRecipient?.phone)return;
    const digits=String(initialRecipient.phone).replace(/\D/g,"");
    const match=contacts.find(contact=>contact.phone.replace(/\D/g,"")===digits&&contact.optedIn);
    if(match)setTo(match.phone);
    const subject=initialRecipient.process||"manufacturing follow-up";
    const operationRef=initialRecipient.operationId?" (AXIMACH operation "+initialRecipient.operationId.slice(0,8)+")":"";
    setMessage("Hello "+(initialRecipient.name||"")+", regarding "+subject+operationRef+" for "+initialRecipient.company+". Please share the current status and expected completion / delivery time. Thank you.");
  },[initialRecipient?.vendorId,initialRecipient?.operationId,contacts.length]);

  const waBase=waUrl.trim().replace(/\/+$/,"");
  const waApiKey=apiKey;
  const waRequest=async(path:string,init:RequestInit={})=>{const response=await fetch(waBase+path,{...init,headers:{"content-type":"application/json","x-aximach-key":waApiKey,...(init.headers||{})}});const data=await response.json().catch(()=>({error:"WhatsApp bridge returned an unreadable response."}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data;};
  const verifiedWhatsAppPhone=(value:unknown)=>{
    const raw=String(value||"").trim();
    if(!raw||/@(lid|g\.us|broadcast)(?:$|[.:])/i.test(raw))return "";
    const digits=raw.split("@")[0].split(":")[0].replace(/\D/g,"");
    return digits.length>=8&&digits.length<=15?digits:"";
  };
  const whatsappContactPhone=(contact:WhatsAppContact)=>{
    const candidates=[contact.phone,contact.phoneNumber,contact.phone_number,contact.number,contact.pn,contact.senderPn,contact.participantPn,contact.remoteJidAlt,contact.participantAlt,contact.remoteJid,contact.jid,contact.id];
    for(const candidate of candidates){const number=verifiedWhatsAppPhone(candidate);if(number)return number;}
    return "";
  };
  const syncWhatsAppContactsToVendors=(incoming:WhatsAppContact[])=>{
    if(!incoming.length)return {added:0,updated:0};
    const current=readManufacturingData();
    const next=[...current.vendors];
    const syncedAt=nowIso();
    let added=0;
    let updated=0;
    for(const contact of incoming){
      const phone=whatsappContactPhone(contact);
      const label=String(contact.name||contact.notify||"WhatsApp contact").trim();
      const identityKeys=[contact.id,contact.lid].filter(Boolean);
      const index=next.findIndex(v=>identityKeys.includes(v.sourceContactId)||(phone&&([v.phone,v.whatsappNumber].some(value=>verifiedWhatsAppPhone(value)===phone))));
      if(index>=0){
        const old=next[index];
        const sameIdentity=identityKeys.includes(old.sourceContactId);
        const sourceWasLid=String(old.sourceContactId||"").endsWith("@lid");
        const oldLidDigits=String(old.sourceContactId||"").split("@")[0].replace(/\D/g,"");
        const oldPhoneLooksLikeLid=sourceWasLid&&oldLidDigits&&oldLidDigits===String(old.phone||"").replace(/\D/g,"");
        const oldWhatsAppLooksLikeLid=sourceWasLid&&oldLidDigits&&oldLidDigits===String(old.whatsappNumber||"").replace(/\D/g,"");
        const oldPhone=oldPhoneLooksLikeLid?"":verifiedWhatsAppPhone(old.phone);
        const oldWhatsApp=oldWhatsAppLooksLikeLid?"":verifiedWhatsAppPhone(old.whatsappNumber);
        const patch:VendorRecord={
          ...old,
          sourceContactId:old.sourceContactId||contact.id,
          phone:phone&&sameIdentity?phone:(oldPhone||phone),
          whatsappNumber:phone&&sameIdentity?phone:(oldWhatsApp||phone),
          contact:old.contact||label
        };
        const changed=patch.sourceContactId!==old.sourceContactId||patch.phone!==old.phone||patch.whatsappNumber!==old.whatsappNumber||patch.contact!==old.contact;
        if(changed){patch.whatsappSyncedAt=syncedAt;patch.updatedAt=syncedAt;next[index]=patch;updated++;}
      }else{
        next.push({
          id:makeId("vendor"),company:label,contact:label,role:"WhatsApp contact",
          phone,whatsappNumber:phone,email:"",address:"",processes:"",machines:"",materials:"",
          notes:"Imported from WhatsApp linked devices. Verify the real vendor identity, process capabilities and consent before approval.",
          status:"Unverified contact — review",sourceContactId:contact.id,whatsappSyncedAt:syncedAt,
          createdAt:syncedAt,updatedAt:syncedAt
        });
        added++;
      }
    }
    if(added||updated)updateManufacturingData(currentData=>({...currentData,vendors:next}));
    return {added,updated};
  };
  const refreshWhatsApp=async()=>{setBusy(true);setWaError("");try{if(!waApiKey.trim())throw new Error("AXIMACH shared API key is missing.");if(!isAllowedAxMachServiceUrl(waBase))throw new Error("Use HTTPS, localhost, or a private Wi-Fi address (10.x, 172.16–31.x, or 192.168.x). Public HTTP is blocked.");const h=await fetch(waBase+"/health");if(!h.ok)throw new Error("WhatsApp bridge health check failed.");const [st,co,gr,sc]=await Promise.all([waRequest("/api/whatsapp/status"),waRequest("/api/whatsapp/contacts"),waRequest("/api/whatsapp/groups"),waRequest("/api/whatsapp/schedules")]);setWaConnected(Boolean(st.connected));setWaQr(st.qrDataUrl||"");setWaUser(st.user||"");const contactRows:WhatsAppContact[]=co.contacts||[];setWaContacts(contactRows);setWaGroups(gr.groups||[]);setWaSchedules(sc.schedules||[]);const synced=syncWhatsAppContactsToVendors(contactRows);window.localStorage.setItem("aximach.whatsapp.url",waBase);window.localStorage.setItem("aximach.scheduler.key",apiKey);setApiError("");onNotice(st.connected?"WhatsApp linked-device bridge connected; "+synced.added+" new contacts added to the AXIMACH vendor master and "+synced.updated+" existing records refreshed. They stay unverified until reviewed; cross-device persistence depends on the scheduler data server being connected.":"Bridge reachable. Scan the QR code below from WhatsApp > Linked devices.");}catch(e){setWaConnected(false);setWaError(e instanceof Error?e.message:"Could not connect to WhatsApp bridge.");}finally{setBusy(false);}};
  const addWhatsAppSchedule=async()=>{setBusy(true);setWaError("");try{if(!waOptIn)throw new Error("Confirm you have permission to message this recipient.");const d=await waRequest("/api/whatsapp/schedules",{method:"POST",body:JSON.stringify({to:waTarget,message:waMessage,nextRunAt:new Date(waDue).toISOString(),repeat:waRepeat,optedIn:true,vendorId:initialRecipient?.vendorId||"",operationId:initialRecipient?.operationId||"",process:initialRecipient?.process||"",company:initialRecipient?.company||""})});setWaSchedules(prev=>[d.schedule,...prev]);setWaMessage("");onNotice("WhatsApp automation saved to the bridge server.");}catch(e){setWaError(e instanceof Error?e.message:"Could not save WhatsApp automation.");}finally{setBusy(false);}};
  const toggleWhatsAppSchedule=async(task:{id:string;enabled:boolean})=>{setBusy(true);setWaError("");try{const d=await waRequest("/api/whatsapp/schedules/"+task.id,{method:"PATCH",body:JSON.stringify({enabled:!task.enabled})});setWaSchedules(prev=>prev.map(x=>x.id===task.id?d.schedule:x));}catch(e){setWaError(e instanceof Error?e.message:"Could not update WhatsApp schedule.");}finally{setBusy(false);}};
  const visibleWaContacts=waContacts.filter(c=>(c.name+" "+c.notify+" "+whatsappContactPhone(c)).toLowerCase().includes(waSearch.toLowerCase().trim()));
  const visibleWaGroups=waGroups.filter(group=>(group.name+" "+group.id+" "+group.participants).toLowerCase().includes(waSearch.toLowerCase().trim()));
  const importWhatsAppContactsToVendors=()=>{if(!waContacts.length){setWaError("No WhatsApp contacts are synced yet. Link WhatsApp and refresh contacts first.");return;}const result=syncWhatsAppContactsToVendors(waContacts);const withoutNumber=waContacts.filter(c=>!whatsappContactPhone(c)).length;onNotice("Contact 360 sync complete: "+result.added+" new contacts added, "+result.updated+" existing records refreshed. "+withoutNumber+" contacts did not have a phone number shared by WhatsApp and were not assigned a fabricated number.");};
  useEffect(()=>{if((window.location.protocol==="file:"||window.location.protocol==="aximach:")){if(apiUrl)window.localStorage.setItem("aximach.scheduler.url",apiUrl);if(apiKey)window.localStorage.setItem("aximach.scheduler.key",apiKey);if(waUrl)window.localStorage.setItem("aximach.whatsapp.url",waUrl);const timer=window.setTimeout(()=>{void refreshWhatsApp();},1800);return()=>window.clearTimeout(timer);}if(window.localStorage.getItem("aximach.scheduler.key"))void refreshWhatsApp();},[]);
  useEffect(()=>{const local=(window.location.protocol==="file:"||window.location.protocol==="aximach:");const pollBase=local?"http://127.0.0.1:8789":waBase;const pollKey=apiKey;if(!pollKey.trim())return;let cancelled=false;const poll=async()=>{try{const headers={"x-aximach-key":pollKey};const statusResponse=await fetch(pollBase+"/api/whatsapp/status",{headers});if(!statusResponse.ok)return;const status=await statusResponse.json();if(cancelled)return;setWaConnected(Boolean(status.connected));setWaQr(status.qrDataUrl||"");setWaUser(status.user||"");if(!status.connected)return;const [co,gr,sc]=await Promise.all([fetch(pollBase+"/api/whatsapp/contacts",{headers}),fetch(pollBase+"/api/whatsapp/groups",{headers}),fetch(pollBase+"/api/whatsapp/schedules",{headers})]);if(cancelled)return;if(co.ok){const rows:WhatsAppContact[]=(await co.json()).contacts||[];setWaContacts(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);syncWhatsAppContactsToVendors(rows);}if(gr.ok){const rows=(await gr.json()).groups||[];setWaGroups(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);}if(sc.ok){const rows=(await sc.json()).schedules||[];setWaSchedules(previous=>JSON.stringify(previous)===JSON.stringify(rows)?previous:rows);}}catch{/* bridge may be unavailable while starting */}};void poll();const timer=window.setInterval(()=>void poll(),3000);return()=>{cancelled=true;window.clearInterval(timer);};},[waBase,apiKey]);

  const base=apiUrl.trim().replace(/\/+$/,"");
  const visibleContacts=contacts.filter(c=>(c.name+" "+c.company+" "+c.phone).toLowerCase().includes(contactSearch.toLowerCase().trim()));
  const request=async(path:string,init:RequestInit={})=>{const response=await fetch(base+path,{...init,headers:{"content-type":"application/json","x-aximach-key":apiKey,...(init.headers||{})}});const data=await response.json().catch(()=>({error:"The service returned an unreadable response."}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data;};
  const connect=async()=>{setBusy(true);setApiError("");try{if(!isAllowedAxMachServiceUrl(base))throw new Error("Use HTTPS, localhost, or a private Wi-Fi address (10.x, 172.16–31.x, or 192.168.x). Public HTTP is blocked.");const h=await fetch(base+"/health");if(!h.ok)throw new Error("AXIMACH shared-data server health check failed.");const [manufacturing,c,s]=await Promise.all([request("/api/manufacturing-data"),request("/api/contacts"),request("/api/schedules")]);setContacts(c.contacts||[]);setSchedules(s.schedules||[]);setLogs(s.logs||[]);window.localStorage.setItem("aximach.scheduler.url",base);window.localStorage.setItem("aximach.scheduler.key",apiKey);window.localStorage.setItem("aximach.storage.mode","shared-server");setStorageMode("shared-server");if(base.startsWith("http://")){const bridge=new URL(base);bridge.port="8789";const bridgeUrl=bridge.toString().replace(/\/$/,"");setWaUrl(bridgeUrl);window.localStorage.setItem("aximach.whatsapp.url",bridgeUrl);}if(manufacturing.data&&typeof manufacturing.data==="object"){updateManufacturingData(currentData=>mergeManufacturingData(currentData,manufacturing.data));}else{updateManufacturingData(currentData=>({...currentData}));}const synced=readManufacturingData();setConnected(true);setApiError("");onNotice("AXIMACH PC shared data connected and manufacturing records fetched: "+activeRows(synced.companies).length+" companies, "+activeRows(synced.purchaseOrders).length+" POs, "+activeRows(synced.components).length+" components and "+activeRows(synced.operations).length+" process operations. Shared sync is now active on this device.");}catch(e){setConnected(false);setApiError(e instanceof Error?e.message:"Connection failed.");}finally{setBusy(false);}};
  useEffect(()=>{
    if(!apiKey.trim()||!isAllowedAxMachServiceUrl(apiUrl))return;
    let cancelled=false;
    const verify=async()=>{
      try{
        const health=await fetch(apiUrl.trim().replace(/\/+$/,"")+"/health",{cache:"no-store"});
        if(!health.ok)throw new Error("Server unavailable");
        const response=await fetch(apiUrl.trim().replace(/\/+$/,"")+"/api/contacts",{headers:{"x-aximach-key":apiKey}});
        if(!response.ok)throw new Error("Server authentication failed");
        if(!cancelled)setConnected(true);
      }catch{
        if(!cancelled)setConnected(false);
      }
    };
    void verify();
    const timer=window.setInterval(()=>void verify(),10000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[apiUrl,apiKey]);
  const prepareSharedPcServer=async()=>{
    if(window.location.protocol!=="file:"&&window.location.protocol!=="aximach:"){
      onNotice("Enter the PC's private Wi-Fi server URL and API key, then press Connect / refresh shared data.");
      return;
    }
    setBusy(true);setApiError("");
    try{
      const response=await fetch("http://127.0.0.1:8787/api/connection-info",{cache:"no-store"});
      const info=await response.json();
      if(!response.ok||!info.apiKey||!Array.isArray(info.addresses))throw new Error("The PC shared-data server is not ready. Keep AXIMACH running on the PC and try again.");
      setLanInfo(info);setApiUrl("http://127.0.0.1:8787");setApiKey(info.apiKey);
      onNotice("PC shared-server details loaded. Use a displayed LAN address and this API key on Android, then press Connect / refresh shared data.");
    }catch(error){setApiError(error instanceof Error?error.message:"Could not load the PC shared-server details.");}
    finally{setBusy(false);}
  };
  const useLocalOnly=()=>{
    window.localStorage.setItem("aximach.storage.mode","local-only");
    window.localStorage.removeItem("aximach.scheduler.url");
    setApiUrl("");
    setConnected(false);
    setStorageMode("local-only");
    window.dispatchEvent(new Event("aximach-storage-mode-change"));
    setLanInfo(null);
    setApiError("");
    onNotice("Local-only storage is active on this device. Manufacturing records remain in this device's local storage. The PC server and its data are not deleted; reconnect to the same shared server to resume cross-device sync.");
  };
  const refresh=async()=>{setBusy(true);setApiError("");try{const [c,s]=await Promise.all([request("/api/contacts"),request("/api/schedules")]);setContacts(c.contacts||[]);setSchedules(s.schedules||[]);setLogs(s.logs||[]);setConnected(true);}catch(e){setConnected(false);setApiError(e instanceof Error?e.message:"Refresh failed.");}finally{setBusy(false);}};
  const addContact=async()=>{setBusy(true);setApiError("");try{const d=await request("/api/contacts",{method:"POST",body:JSON.stringify({name,phone,company,optedIn})});setContacts(prev=>[...prev,d.contact]);setName("");setPhone("");setCompany("");setOptedIn(false);onNotice("Contact saved to the scheduler server.");}catch(e){setApiError(e instanceof Error?e.message:"Could not save contact.");}finally{setBusy(false);}};
  const addSchedule=async()=>{setBusy(true);setApiError("");try{const d=await request("/api/schedules",{method:"POST",body:JSON.stringify({to,message,nextRunAt:new Date(due).toISOString(),repeat,vendorId:initialRecipient?.vendorId||"",operationId:initialRecipient?.operationId||"",process:initialRecipient?.process||"",company:initialRecipient?.company||""})});setSchedules(prev=>[d.schedule,...prev]);setMessage("");onNotice("Schedule saved on the server. Actual sending still depends on valid Meta credentials and messaging policy.");}catch(e){setApiError(e instanceof Error?e.message:"Could not create schedule.");}finally{setBusy(false);}};
  const toggleSchedule=async(task:ApiSchedule)=>{setBusy(true);setApiError("");try{const d=await request("/api/schedules/"+task.id,{method:"PATCH",body:JSON.stringify({enabled:!task.enabled})});setSchedules(prev=>prev.map(x=>x.id===task.id?d.schedule:x));}catch(e){setApiError(e instanceof Error?e.message:"Could not update schedule.");}finally{setBusy(false);}};
  const downloadContacts=()=>{const csv=["name,phone,company,optedIn",...contacts.map(c=>[c.name,c.phone,c.company,String(c.optedIn)].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="aximach-contacts.csv";a.click();URL.revokeObjectURL(url);};
  return <section className="workspace-page">
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> SERVER-BACKED SCHEDULER CONNECTOR</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMMUNICATION / CRM</div><h1>Follow-up centre<span>.</span></h1><p>Contacts, one-time and recurring individual messages, server schedules and send logs.</p></div><button className="button-quiet" onClick={downloadContacts} disabled={!contacts.length}><FileDown size={15}/> Export contacts CSV</button></div>
    <section className="surface-panel followup-list-panel scheduler-connect-panel"><div className="panel-heading"><div><h3><Plug size={17}/> Scheduler connection</h3><p>Connect to your PC-hosted private Wi-Fi server or a deployed AXIMACH server.</p></div><span className={"module-number "+(connected?"scheduler-connected":"")}>{connected?"CONNECTED":"NOT CONNECTED"}</span></div>
      <div className="scheduler-connect-form"><label>Shared AXIMACH data server URL<input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="http://192.168.x.x:8787 (same Wi-Fi) or HTTPS server"/></label><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Server AXIMACH_API_KEY"/></label><button className="button-primary" disabled={busy||!apiUrl.trim()||!apiKey.trim()} onClick={connect}>{busy?"Connecting…":"Connect / refresh shared data"}</button><button type="button" className="button-quiet" disabled={busy||storageMode==="local-only"} onClick={useLocalOnly}>Use local-only on this device</button></div>
      <div className="module-safety-note"><ShieldCheck size={15}/><span><strong>Manufacturing storage mode: {storageMode==="local-only"?"LOCAL ONLY · THIS DEVICE":connected?"SHARED SERVER · CONNECTED":"SHARED SERVER · NOT CONNECTED"}.</strong> Local-only data is saved on this device and does not synchronize. Shared mode synchronizes devices using the same server URL and API key. This build does not include a cloud account/login service; cloud account sync needs a separately configured account backend.</span>{storageMode==="local-only"&&<button type="button" className="button-quiet compact-button" onClick={()=>void prepareSharedPcServer()}>Set up shared sync</button>}</div>
      {apiError&&<div className="scheduler-error"><ShieldAlert size={15}/>{apiError}</div>}
      <div className="module-safety-note"><ShieldCheck size={15}/><span>Use one shared server URL and API key on both devices. A Windows-installed AXIMACH can host the private server: keep the PC and this Android device on the same Wi-Fi, keep AXIMACH running on the PC, then enter one of the PC LAN addresses below on Android (not localhost). Public HTTP is blocked; HTTPS and private LAN HTTP only are allowed. Keep the API key private.</span></div>
      {lanInfo&&<div className="aximach-lan-share">
        <div className="aximach-lan-share-heading"><strong>PC → Android private Wi-Fi connection</strong><span>LOCAL SERVER READY</span></div>
        <p>On Android, enter one of these URLs as the Shared AXIMACH data server. Use the same API key shown below.</p>
        <div className="aximach-lan-share-values">
          {lanInfo.addresses.map(address=><div className="aximach-lan-share-row" key={address}><code>{address}</code><button className="button-quiet compact-button" onClick={()=>{void navigator.clipboard?.writeText(address);}}>Copy data URL</button><button className="button-quiet compact-button" onClick={()=>{void navigator.clipboard?.writeText(address.replace(/:8787$/,":8789"));}}>Copy WhatsApp URL</button></div>)}
          {!lanInfo.addresses.length&&<small>No private Wi-Fi IPv4 address detected. Connect the PC to Wi-Fi/Ethernet and reopen this section.</small>}
          <div className="aximach-lan-share-row"><code>{lanInfo.apiKey}</code><button className="button-quiet compact-button" onClick={()=>{void navigator.clipboard?.writeText(lanInfo.apiKey);}}>Copy API key</button></div>
        </div>
        <small>WhatsApp bridge (optional): use the same LAN address with port 8789, for example http://192.168.x.x:8789. The data server uses port 8787.</small>
      </div>}
    </section>
    <section className="surface-panel followup-list-panel scheduler-connect-panel">
      <div className="panel-heading"><div><h3><ScanLine size={17}/> QR-paired WhatsApp account</h3><p>Link your WhatsApp account once. Keep this service running on an always-on host with persistent disk.</p></div><span className={"module-number "+(waConnected?"scheduler-connected":"")}>{waConnected?"LINKED":"NOT LINKED"}</span></div>
      <div className="scheduler-connect-form"><label>WhatsApp bridge URL<input value={waUrl} onChange={e=>setWaUrl(e.target.value)} placeholder="http://192.168.x.x:8788 (PC Wi-Fi bridge) or HTTPS bridge"/></label><button className="button-primary" disabled={busy||!waUrl.trim()||!apiKey.trim()} onClick={refreshWhatsApp}>{busy?"Connecting…":"Connect / refresh QR"}</button><button className="button-quiet" disabled={busy||!waConnected} onClick={()=>{setWaQr("");refreshWhatsApp();}}>Refresh status</button></div>
      {waError&&<div className="scheduler-error"><ShieldAlert size={15}/>{waError}</div>}
      {waQr&&!waConnected&&<div className="wa-pairing-box"><img src={waQr} alt="WhatsApp linked-device QR code"/><div><strong>Scan with your phone</strong><p>WhatsApp → Settings → Linked devices → Link a device. Keep this page private; QR codes grant account access.</p></div></div>}
      {waConnected&&<div className="module-safety-note"><ShieldCheck size={15}/><span>WhatsApp linked. {waUser?"Session: "+waUser+". ":""}The phone and AXIMACH UI can be closed while the bridge server remains online. WhatsApp only shares phone numbers when the linked-device sync provides a phone-number JID or sender phone field; contacts with an internal LID and no number stay visibly unnumbered. This uses an unofficial WhatsApp Web library.</span></div>}
      <div className="wa-sync-grid">
        <div><div className="scheduler-subheading"><strong>Contact 360 · WhatsApp contacts</strong><span>{visibleWaContacts.length} / {waContacts.length} · {waContacts.filter(c=>whatsappContactPhone(c)).length} with numbers</span><button className="button-quiet compact-button" disabled={!waConnected||!waContacts.length} onClick={importWhatsAppContactsToVendors}><Users size={13}/> Import to Contact 360</button></div><label className="vendor-search scheduler-contact-search"><Search size={16}/><input value={waSearch} onChange={e=>setWaSearch(e.target.value)} placeholder="Search synced contacts and groups…"/></label><div className="wa-scroll-list">{visibleWaContacts.map(c=><button key={c.id} className={"scheduler-contact "+(waTarget===c.id?"scheduler-contact-active":"")} onClick={()=>setWaTarget(c.id)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{c.name}</strong><small>{whatsappContactPhone(c) ? "+"+whatsappContactPhone(c) : "Phone number not shared by WhatsApp"}</small></span></button>)}{!visibleWaContacts.length&&<div className="vendor-empty">{waContacts.length?"No WhatsApp contacts match this search.":"No synced contacts yet. Pair the device and refresh after WhatsApp syncs contact history."}</div>}</div></div>
        <div><div className="scheduler-subheading"><strong>WhatsApp groups</strong><span>{visibleWaGroups.length} of {waGroups.length} groups</span></div><div className="wa-scroll-list">{visibleWaGroups.map(g=><button key={g.id} className={"scheduler-contact "+(waTarget===g.id?"scheduler-contact-active":"")} onClick={()=>setWaTarget(g.id)}><span className="scheduler-avatar"><Users size={15}/></span><span><strong>{g.name}</strong><small>{g.participants} participants</small></span></button>)}{!visibleWaGroups.length&&<div className="vendor-empty">{waGroups.length?"No WhatsApp groups match this search.":"No groups loaded. Refresh after pairing."}</div>}</div></div>
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
        <div className="scheduler-form">{initialRecipient?.vendorId&&<div className="module-safety-note"><ShieldCheck size={14}/><span>Linked vendor: {initialRecipient.company} · Process: {initialRecipient.process||"Not specified"} · Operation ID: {initialRecipient.operationId||"Vendor-level reminder"}. The schedule will retain these references on the AXIMACH scheduler server.</span></div>}<label>Recipient<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Select contact…</option>{contacts.filter(c=>c.optedIn&&(c.name+" "+c.company+" "+c.phone).toLowerCase().includes(contactSearch.toLowerCase().trim())).map(c=><option key={c.id} value={c.phone}>{c.name} · {c.phone}</option>)}</select></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Write the message to send…"/></label><label>First send time<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)}/></label><label>Repeat<select value={repeat} onChange={e=>setRepeat(e.target.value as "once"|"daily"|"weekly")}><option value="once">One time only</option><option value="daily">Repeat daily</option><option value="weekly">Repeat weekly</option></select></label><button className="button-primary" disabled={!connected||busy||!to||!message.trim()||!due} onClick={addSchedule}><CalendarClock size={15}/> Save schedule on server</button></div>
        <div className="module-safety-note"><ShieldAlert size={15}/><span>Repeat until reply is not enabled: reply webhooks and a safe stop-on-reply rule are still required. Only individual messages are supported; WhatsApp group sends and QR account sync are not implemented.</span></div>
      </section>
    </div>
    <section className="surface-panel followup-list-panel"><div className="panel-heading"><div><h3>Server schedules</h3><p>Runs while the scheduler service is online, even when this UI is closed.</p></div><button className="button-quiet compact-button" disabled={!connected||busy} onClick={refresh}><RotateCcw size={14}/> Refresh</button></div>
      {schedules.length===0?<div className="vendor-empty">No server schedules loaded yet.</div>:<div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Recipient</th><th>Vendor / process link</th><th>Next run</th><th>Repeat</th><th>Message</th><th>State</th><th>Action</th></tr></thead><tbody>{schedules.map(t=><tr key={t.id}><td>+{t.to}</td><td>{t.company||"—"}<small>{t.process||"No process link"}{t.operationId?" · OP "+t.operationId.slice(0,8):""}</small></td><td>{t.nextRunAt?new Date(t.nextRunAt).toLocaleString():"—"}</td><td>{t.repeat}</td><td>{t.message}</td><td>{t.lastError?"Paused · error":t.enabled?"Enabled":"Paused"}</td><td><button className="button-quiet compact-button" disabled={busy} onClick={()=>toggleSchedule(t)}>{t.enabled?<Pause size={13}/>:<Play size={13}/>} {t.enabled?"Pause":"Enable"}</button></td></tr>)}</tbody></table></div>}
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
  "production": { itemLabel:"Production job / operation",referenceLabel:"Work order / operation number",ownerLabel:"Planner / cell lead",notesLabel:"Machine, shift, planned quantity, cycle time and constraints",statuses:["Planned","Ready","Running","Waiting","Blocked","Complete","Job Finished","On hold"],workflow:["Plan","Check capacity","Release","Execute","Report actuals"] },
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

type ModuleRecord = { id: string; title: string; reference: string; status: string; owner: string; linkedModule: string; notes: string; updatedAt: string; deletedAt?: string };
const MODULE_RECORDS_KEY = "aximach.moduleRecords.v1";
function getAllModuleRecords(): Record<string, ModuleRecord[]> {
  try { const raw = window.localStorage.getItem(MODULE_RECORDS_KEY); return raw ? JSON.parse(raw) as Record<string, ModuleRecord[]> : {}; } catch { return {}; }
}
function setAllModuleRecords(data: Record<string, ModuleRecord[]>) {
  try { window.localStorage.setItem(MODULE_RECORDS_KEY, JSON.stringify(data)); } catch { /* browser storage may be unavailable */ }
}
function mergeModuleRecordSets(local: Record<string, ModuleRecord[]>, remote: Record<string, ModuleRecord[]>) {
  const merged: Record<string, ModuleRecord[]> = {};
  const moduleIds = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const moduleId of moduleIds) {
    const rows = new Map<string, ModuleRecord>();
    for (const row of Array.isArray(remote?.[moduleId]) ? remote[moduleId] : []) if (row?.id) rows.set(row.id, row);
    for (const row of Array.isArray(local?.[moduleId]) ? local[moduleId] : []) {
      if (!row?.id) continue;
      const old = rows.get(row.id);
      const localTime = Date.parse(row.updatedAt || "") || 0;
      const remoteTime = Date.parse(old?.updatedAt || "") || 0;
      if (!old || localTime >= remoteTime) rows.set(row.id, row);
    }
    merged[moduleId] = [...rows.values()];
  }
  return merged;
}
function ModuleWorkspace({ module, onBack, onNotice, onOpenModules, onSelectModule }: { module: ModuleItem; onBack: () => void; onNotice: (value: string) => void; onOpenModules: () => void; onSelectModule: (id: string) => void }) {
  const Icon = module.icon;
  const profile = moduleProfiles[module.id] ?? defaultProfile;
  const { data: linkedManufacturing, update: updateLinkedManufacturing } = useManufacturingData();
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [allRecords, setAllRecords] = useState<Record<string, ModuleRecord[]>>(() => getAllModuleRecords());
  const [recordSync, setRecordSync] = useState<"local" | "syncing" | "synced" | "error">("local");
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let syncPending = false;

    const sync = async () => {
      if (busy) { syncPending = true; return; }
      const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
      const key = window.localStorage.getItem("aximach.scheduler.key") || "";
      if (!base || !key) { if (!cancelled) setRecordSync("local"); return; }

      busy = true;
      const headers = { "content-type": "application/json", "x-aximach-key": key };
      try {
        do {
          syncPending = false;
          const beforeFetch = getAllModuleRecords();
          const response = await fetch(base + "/api/records", { headers });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Record sync failed");
          if (cancelled) return;

          const local = getAllModuleRecords();
          if (JSON.stringify(local) !== JSON.stringify(beforeFetch)) syncPending = true;
          const remote = (data.records || {}) as Record<string, ModuleRecord[]>;
          const merged = mergeModuleRecordSets(local, remote);
          if (JSON.stringify(merged) !== JSON.stringify(remote)) {
            setRecordSync("syncing");
            const write = await fetch(base + "/api/records", { method: "PUT", headers, body: JSON.stringify({ records: merged }) });
            const saved = await write.json().catch(() => ({}));
            if (!write.ok) throw new Error(saved.error || "Could not persist merged module records");
            const latestLocal = getAllModuleRecords();
            if (JSON.stringify(latestLocal) !== JSON.stringify(local)) syncPending = true;
            const finalRecords = mergeModuleRecordSets(latestLocal, (saved.records || merged) as Record<string, ModuleRecord[]>);
            setAllModuleRecords(finalRecords);
            if (!cancelled) setAllRecords(finalRecords);
          } else if (JSON.stringify(merged) !== JSON.stringify(local)) {
            setAllModuleRecords(merged);
            if (!cancelled) setAllRecords(merged);
          }
        } while (syncPending && !cancelled);

        if (!cancelled) setRecordSync("synced");
      } catch {
        if (!cancelled) setRecordSync("error");
      } finally {
        busy = false;
        if (syncPending && !cancelled) void sync();
      }
    };

    const refreshLocal = () => {
      const latest = getAllModuleRecords();
      setAllRecords(latest);
      void sync();
    };
    const syncWhenActive = () => {
      if (document.visibilityState !== "hidden") void sync();
    };

    window.addEventListener("aximach-module-records-updated", refreshLocal);
    window.addEventListener("storage", refreshLocal);
    window.addEventListener("focus", syncWhenActive);
    window.addEventListener("online", syncWhenActive);
    document.addEventListener("visibilitychange", syncWhenActive);
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 2500)
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("aximach-module-records-updated", refreshLocal);
      window.removeEventListener("storage", refreshLocal);
      window.removeEventListener("focus", syncWhenActive);
      window.removeEventListener("online", syncWhenActive);
      document.removeEventListener("visibilitychange", syncWhenActive);
    };
  }, []);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({ title: "", reference: "", status: "Open", owner: "", linkedModule: "", notes: "" });
  const records = (allRecords[module.id] ?? []).filter(record => !record.deletedAt);
  const related = modules.filter((item) => item.id !== module.id && [module.group, "Engineering", "Operations", "Governance", "Supply Network", "Commercial", "Finance", "Connections"].includes(item.group)).slice(0, 8);
  const filtered = records.filter((record) => (record.title + " " + record.reference + " " + record.status + " " + record.owner + " " + record.notes).toLowerCase().includes(search.toLowerCase()));
  const persist = (next: Record<string, ModuleRecord[]>) => {
    const latestLocal = getAllModuleRecords();
    const updated = mergeModuleRecordSets(latestLocal, next);
    setAllRecords(updated);
    setAllModuleRecords(updated);
    window.dispatchEvent(new Event("aximach-module-records-updated"));
    const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
    const key = window.localStorage.getItem("aximach.scheduler.key") || "";
    setRecordSync(base && key ? "syncing" : "local");
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
  const removeRecord = (id: string) => {
    if (!window.confirm("Remove this record from the current module? The deletion will sync to other AXIMACH devices when the shared server is connected.")) return;
    const stamp = new Date().toISOString();
    const rows = allRecords[module.id] || [];
    persist({ ...allRecords, [module.id]: rows.map(item => item.id === id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item) });
    onNotice("Record archived from this module. Its deletion marker will sync to other AXIMACH devices.");
  };
  const exportRecords = () => { const blob = new Blob([JSON.stringify({ module: module.id, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "aximach-" + module.id + "-records.json"; a.click(); URL.revokeObjectURL(url); onNotice("Module records exported as JSON."); };
  const totalLinked = Object.values(allRecords).flat().filter((record) => !record.deletedAt && record.linkedModule).length;
  const productionJobRows = module.id === "production"
    ? activeRows(linkedManufacturing.purchaseOrders).flatMap(po => po.lines.filter(line => !line.deletedAt).map(line => ({
        po, line,
        component: linkedManufacturing.components.find(component => component.id === line.componentId),
        company: linkedManufacturing.companies.find(company => company.id === po.companyId),
        operationCount: linkedManufacturing.operations.filter(operation => operation.poId === po.id && operation.poLineId === line.id).length
      })))
    : [];
  const updateProductionJob = (poId: string, lineId: string, finished: boolean) => {
    const stamp = nowIso();
    const po = linkedManufacturing.purchaseOrders.find(item => item.id === poId);
    const line = po?.lines.find(item => item.id === lineId);
    if (!po || !line) return;
    const incomplete = linkedManufacturing.operations.filter(operation => operation.poId === poId && operation.poLineId === lineId && operation.status !== "Complete");
    if (finished && incomplete.length && !window.confirm(incomplete.length + " route operation(s) are not marked Complete. Mark the job Finished anyway? Operation statuses and history will remain unchanged.")) return;
    updateLinkedManufacturing(current => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map(order => order.id !== poId ? order : {
        ...order, updatedAt: stamp,
        lines: order.lines.map(item => item.id !== lineId ? item : {
          ...item, jobStatus: finished ? "Finished" : "In progress",
          jobFinishedAt: finished ? stamp : undefined
        })
      })
    }));
    onNotice(finished
      ? "PO line job marked Finished. Operation status and quantity history were not changed."
      : "PO line job reopened as In progress. Existing operation history was retained.");
  };
  return (
    <section className="workspace-page module-functional-page">
      <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15} /> Command centre</button><span className="demo-pill"><i /> LOCAL WORKSPACE</span></div>
      <div className="module-hero">
        <div className="module-hero-icon animated-module-icon"><Icon size={27} /></div>
        <div className="module-hero-copy"><div className="eyebrow"><span className="eyebrow-mark" /> {module.group.toUpperCase()} / AXIMACH MODULE</div><h1>{module.title}<span>.</span></h1><p>{module.description}</p></div>
        <button className="button-quiet" onClick={onOpenModules}><LayoutGrid size={16} /> All modules</button>
      </div>
      {module.id === "production" && <section className="surface-panel production-job-register">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PO-LINE JOB LIFECYCLE</div><h3>Production jobs ({productionJobRows.length})</h3><p>Job Finished / In Progress is tracked separately from every operation's Complete status.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><Workflow size={14}/> Open 3D process plan</button></div>
        {productionJobRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Purchase order</th><th>Part / component</th><th>Quantity</th><th>Delivery target</th><th>Route steps</th><th>Job status</th><th>Action</th></tr></thead><tbody>
          {productionJobRows.map(({po,line,component,company,operationCount}) => {
            const finished = line.jobStatus === "Finished";
            return <tr key={po.id + ":" + line.id}>
              <td><strong>{po.number}</strong><small>{company?.name || "Company"}</small></td>
              <td><strong>{component?.partNumber || "Component master missing"}</strong><small>{component?.name || "PO line retained"}</small></td>
              <td>{line.quantity.toLocaleString("en-IN")} pcs</td>
              <td>{line.targetDelivery || po.targetDelivery || "—"}</td>
              <td>{operationCount} operations</td>
              <td><span className={"record-state " + (finished ? "state-selected" : "state-open")}>{finished ? "Job Finished" : "In Progress"}</span>{finished && line.jobFinishedAt && <small>{new Date(line.jobFinishedAt).toLocaleDateString("en-IN")}</small>}</td>
              <td><div className="production-job-actions"><button className={finished ? "button-quiet compact-button" : "button-primary compact-button"} onClick={() => updateProductionJob(po.id,line.id,!finished)}>{finished ? <RotateCcw size={12}/> : <Check size={12}/>} {finished ? "Reopen job" : "Mark finished"}</button><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><Workflow size={12}/> Route</button></div></td>
            </tr>;
          })}
        </tbody></table></div> : <div className="module-empty-state"><Package size={24}/><h3>No production PO lines yet</h3><p>Real production jobs appear here after a component line is saved in Purchase Orders.</p><button className="button-primary" onClick={() => onSelectModule("purchasing")}><Plus size={14}/> Open purchase orders</button></div>}
      </section>}
      {module.id === "production" && <section className="production-route-launcher surface-panel">
        <span className="production-route-launcher-icon"><Workflow size={21}/></span>
        <div><div className="eyebrow"><span className="eyebrow-mark"/> LIVE PO-LINKED PRODUCTION ROUTE</div><h3>3D process graph & job completion</h3><p>Open the actual PO component route to view interactive 3D operations, branches, quantities, simulation preview and the separate Job Finished / Reopen job control. This does not replace your Production & Capacity records.</p></div>
        <button className="button-primary" onClick={() => onSelectModule("process-map")}><Workflow size={15}/> Open 3D process planning</button>
      </section>}
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
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> RECORDS / WORK ITEMS</div><h3>{module.title}</h3><p>{records.length} saved locally · {filtered.length} shown</p></div><span className="module-number">{String(modules.findIndex((item) => item.id === module.id) + 3).padStart(2, "0")} / 20</span></div>
          {filtered.length ? <div className="module-record-list">{filtered.map((record) => <article className="module-record-card" key={record.id}>
            <div className="module-record-mark"><Icon size={18} /></div><div className="module-record-copy"><strong>{record.title}</strong><span>{record.reference || "No reference"} · {record.owner || "Unassigned"}</span><p>{record.notes || "No notes added."}</p>{record.linkedModule && <button className="inline-module-link" onClick={() => onSelectModule(record.linkedModule)}><GitBranch size={13} /> Open linked {modules.find((item) => item.id === record.linkedModule)?.title ?? "module"} <ArrowUpRight size={13} /></button>}</div>
            <div className="module-record-card-actions"><span className={"record-state state-" + record.status.toLowerCase().replace(/[^a-z]+/g, "-")}>{record.status}</span><button onClick={() => editRecord(record)}>Edit</button><button onClick={() => removeRecord(record.id)}>Delete</button></div>
          </article>)}</div> : <div className="module-empty-state"><div className="module-empty-icon"><Icon size={25} /></div><h3>{search ? "No matching records" : "Start using this module"}</h3><p>{search ? "Try another search term or clear the search." : "Create your first record. Then link it to another AXIMACH module to build a connected workflow."}</p>{!search && <button className="button-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Create first record</button>}</div>}
          <div className="module-storage-note"><ShieldCheck size={14} /> Saved in this browser only · no shared database is connected yet.</div>
        </section>
        <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> CROSS-MODULE LINKS</div><h3>Connected workspaces</h3><p>{totalLinked} linked records across local modules</p></div></div>
          {related.map((item) => { const RelatedIcon = item.icon; return <button className="related-row" key={item.id} onClick={() => onSelectModule(item.id)}><span className="related-icon"><RelatedIcon size={16} /></span><span><strong>{item.title}</strong><small>{(allRecords[item.id] ?? []).length} local records · {item.group}</small></span><ArrowUpRight size={14} /></button>; })}
          <button className="related-all" onClick={onOpenModules}>Browse all 18 modules <ArrowRight size={14} /></button>
        </aside>
      </div>
      <div className="module-safety-note"><ShieldCheck size={16} /><span>This workspace now supports local create, edit, delete, search, export and navigation links. It is not a production database; multi-user sync, server permissions, automated external actions and audit-grade persistence remain to be implemented.</span></div>
    </section>
  );
}

export default App;
