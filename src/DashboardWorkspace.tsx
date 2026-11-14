import { Activity, ArrowRight, ArrowUpRight, Boxes, Building2, CalendarClock, CheckCircle2, CircleAlert, Command, Factory, Package, ShieldCheck, Users, Workflow, type LucideIcon } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";
import AXIMACHOrb from "./AXIMACHOrb";
import { ComponentIcon } from "./IconStudio";

type LinkedNavigationContext={companyId?:string;poId?:string;poLineId?:string;componentId?:string;operationId?:string;vendorId?:string};
type Props = { onSelectModule:(id:string,context?:LinkedNavigationContext)=>void; onOpenCommandCentre:()=>void; onOpenModules:()=>void; moduleCount:number };

function Kpi({label,value,detail,icon:Icon}:{label:string;value:number;detail:string;icon:LucideIcon}) {
  return <article className="metric-card dashboard-metric-card"><div className="metric-card-top"><span>{label}</span><span className="metric-icon blue"><Icon size={18}/></span></div><strong className="metric-number">{value.toLocaleString("en-IN")}</strong><div className="metric-card-bottom"><span className="metric-trend"><ArrowUpRight size={13}/> Saved records</span><span>{detail}</span></div></article>;
}

export default function DashboardWorkspace({onSelectModule,onOpenCommandCentre,onOpenModules,moduleCount}:Props) {
  const {data,syncStatus}=useManufacturingData();
  const companies=activeRows(data.companies), components=activeRows(data.components), pos=activeRows(data.purchaseOrders), vendors=activeRows(data.vendors), ops=activeRows(data.operations);
  const lines=pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line})));
  const openOps=ops.filter(op=>op.status!=="Complete"), completeOps=ops.filter(op=>op.status==="Complete");
  const overdue=ops.filter(op=>op.status!=="Complete"&&op.plannedEnd&&op.plannedEnd<new Date().toISOString().slice(0,10));
  const holds=ops.filter(op=>op.status==="Quality hold");
  const pendingJobs=lines.filter(({line})=>line.jobStatus!=="Finished");
  const recent=[...ops].sort((x,y)=>(y.updatedAt||"").localeCompare(x.updatedAt||"")).slice(0,5);
  const sync=syncStatus==="synced"?"SHARED DATA SYNCED":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY RETAINED":"LOCAL DATA";
  return <section className="workspace-page dashboard-home">
    <div className="workspace-topline"><span className="demo-pill"><i/>{sync}</span><span className="module-number">MAIN DASHBOARD · 01</span></div>
    <section className="dashboard-welcome surface-panel">
      <div className="dashboard-welcome-copy"><div className="eyebrow"><span className="eyebrow-mark"/> AXIMACH / MANUFACTURING OPERATIONS</div>
        <h1>Manufacturing Dashboard<span>.</span></h1>
        <p>Live overview of companies, purchase orders, components, production operations, quality holds and delivery risks. Metrics are derived only from saved AXIMACH records.</p>
        <div className="hero-actions"><button className="button-primary" onClick={onOpenCommandCentre}><Command size={16}/> Open 3D Command Centre <ArrowRight size={15}/></button><button className="button-quiet" onClick={onOpenModules}>View all {moduleCount} modules <ArrowRight size={15}/></button></div>
      </div>
      <div className="dashboard-welcome-orb"><AXIMACHOrb surface="dashboard" onSelectModule={onSelectModule}/></div>
    </section>
    <section className="metric-grid dashboard-metric-grid">
      <Kpi label="Companies" value={companies.length} detail="Company directory" icon={Building2}/>
      <Kpi label="Purchase orders" value={pos.length} detail="PO records" icon={Package}/>
      <Kpi label="PO component lines" value={lines.length} detail="Ordered components" icon={Boxes}/>
      <Kpi label="Components" value={components.length} detail="Component directory" icon={Factory}/>
      <Kpi label="Vendors" value={vendors.length} detail="Vendor directory" icon={Users}/>
      <Kpi label="Open operations" value={openOps.length} detail="Not complete" icon={Activity}/>
    </section>
    <section className="dashboard-grid actual-data-dashboard dashboard-live-panels">
      <div className="surface-panel jobs-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PRODUCTION ACTIVITY</div><h3>Recent operations</h3><p>{completeOps.length} complete · {openOps.length} open</p></div><button className="button-quiet compact-button" onClick={()=>onSelectModule("production")}><Workflow size={14}/> Production plan</button></div>
        {recent.length?<div className="job-list">{recent.map(op=>{const po=pos.find(x=>x.id===op.poId),part=components.find(x=>x.id===op.componentId),vendor=vendors.find(x=>x.id===op.vendorId);return <div className="job-row" key={op.id}><span className="job-number">{String(op.sequence).padStart(2,"0")}</span><ComponentIcon componentId={part?.id} componentName={(part?.name||"Component")+" "+(part?.partNumber||"")}/><span className="job-main"><strong>{op.name}</strong><small>{part?.partNumber||"Component"} · {po?.number||"PO"} · {vendor?.company||"Vendor not assigned"}</small></span><span className="job-chip">{op.status}</span></div>;})}</div>:<div className="module-empty-state"><Workflow size={24}/><h3>No production activity recorded</h3><p>Operations appear after purchase orders and process routes are created.</p><button className="button-primary" onClick={()=>onSelectModule("purchasing")}><Package size={14}/> Open Purchase Orders</button></div>}
      </div>
      <div className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ATTENTION REQUIRED</div><h3>Recorded exceptions</h3><p>Calculated from saved status and target dates.</p></div><span className="attention-count">{overdue.length+holds.length}</span></div>
        {overdue.length||holds.length?<div className="dashboard-exception-list">{overdue.slice(0,4).map(op=>{const po=pos.find(row=>row.id===op.poId);return <button className="attention-row" key={"late-"+op.id} onClick={()=>onSelectModule("production",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id,vendorId:op.vendorId||undefined})}><span className="attention-symbol red-symbol"><CalendarClock size={16}/></span><span className="attention-copy"><strong>{op.name}</strong><small>Past target · {op.plannedEnd}</small></span><ArrowUpRight size={15}/></button>;})}{holds.slice(0,4).map(op=>{const po=pos.find(row=>row.id===op.poId);return <button className="attention-row" key={"hold-"+op.id} onClick={()=>onSelectModule("quality",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id,vendorId:op.vendorId||undefined})}><span className="attention-symbol red-symbol"><CircleAlert size={16}/></span><span className="attention-copy"><strong>{op.name}</strong><small>Quality hold recorded</small></span><ArrowUpRight size={15}/></button>;})}</div>:<div className="module-empty-state"><CheckCircle2 size={24}/><h3>No recorded exceptions</h3><p>No overdue operations or quality holds are recorded.</p></div>}
      </div>
      <div className="surface-panel flow-preview"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> BUSINESS SETUP</div><h3>Master records</h3><p>Build company and component records before creating POs.</p></div><button className="round-action" onClick={()=>onSelectModule("companies")} aria-label="Open Company Directory"><ArrowUpRight size={18}/></button></div>
        <div className="setup-steps setup-steps-compact">
          <button onClick={()=>onSelectModule("companies")}><span className="setup-step-icon"><Building2 size={20}/></span><span className="setup-step-copy"><strong>Companies</strong><b className="setup-step-quantity">{companies.length}</b><small>Company records</small></span></button>
          <button onClick={()=>onSelectModule("components")}><span className="setup-step-icon"><Boxes size={20}/></span><span className="setup-step-copy"><strong>Components</strong><b className="setup-step-quantity">{components.length}</b><small>Part numbers</small></span></button>
          <button onClick={()=>onSelectModule("purchasing")}><span className="setup-step-icon"><Package size={20}/></span><span className="setup-step-copy"><strong>Purchase orders</strong><b className="setup-step-quantity">{pos.length}</b><small>{lines.length} component lines</small></span></button>
          <button onClick={()=>onSelectModule("vendors")}><span className="setup-step-icon"><Users size={20}/></span><span className="setup-step-copy"><strong>Vendors</strong><b className="setup-step-quantity">{vendors.length}</b><small>Supplier records</small></span></button>
        </div>
      </div>
      <div className="surface-panel jobs-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> JOB LIFECYCLE</div><h3>Production status</h3><p>PO component jobs, separate from process status.</p></div><span className="attention-count">{pendingJobs.length}</span></div>
        <div className="dashboard-job-summary"><div><strong>{pendingJobs.length}</strong><span>Jobs in progress</span></div><div><strong>{lines.length-pendingJobs.length}</strong><span>Jobs finished</span></div><div><strong>{ops.length}</strong><span>Process operations</span></div></div><button className="related-all" onClick={()=>onSelectModule("production")}>Open Production Plan <ArrowRight size={14}/></button>
      </div>
    </section>
    <section className="module-shortcuts dashboard-shortcuts"><div className="section-row-title"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUICK ACCESS</div><h2>Open a module<span>.</span></h2></div><button className="button-quiet" onClick={onOpenModules}>All {moduleCount} modules <ArrowRight size={15}/></button></div>
      <div className="shortcut-grid">{[["companies","Company Directory"],["components","Component Directory"],["purchasing","Purchase Orders"],["vendors","Vendor Directory"],["production","Production Plan & Process Plan"],["costing","Costing & Payment"],["inventory","BOM & Inventory"],["quality","Quality Inspection"]].map(([id,label])=><button className="shortcut-card" key={id} onClick={()=>onSelectModule(id)}><span className="shortcut-icon"><ArrowUpRight size={18}/></span><span><strong>{label}</strong><small>Open workspace</small></span><ArrowRight size={15}/></button>)}</div>
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Dashboard figures use saved local/shared AXIMACH records only. No sample jobs, simulated machine readings or fabricated financial metrics are displayed.</span></div>
  </section>;
}
