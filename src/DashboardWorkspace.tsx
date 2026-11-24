import {
  Activity, ArrowRight, ArrowUpRight, Boxes, Building2, CalendarClock, CheckCircle2,
  CircleAlert, Command, Factory, Gauge, GitBranch, Layers3, Package, Route,
  ShieldCheck, Truck, Users, Workflow, type LucideIcon
} from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";
import AXIMACHOrb from "./AXIMACHOrb";
import DashboardDataOrb from "./DashboardDataOrb";
import { ComponentIcon } from "./IconStudio";
import ProductionStatusChart from "./ProductionStatusChart";
import DashboardCommandLayer from "./DashboardCommandLayer";

type DashboardNavigationContext = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string; vendorId?:string };
type Props = { onSelectModule:(id:string,context?:DashboardNavigationContext)=>void; onOpenCommandCentre:()=>void; onOpenModules:()=>void; moduleCount:number };

function Kpi({label,value,detail,icon:Icon}:{label:string;value:number;detail:string;icon:LucideIcon}) {
  return <article className="metric-card dashboard-metric-card"><div className="metric-card-top"><span>{label}</span><span className="metric-icon blue"><Icon size={18}/></span></div><strong className="metric-number">{value.toLocaleString("en-IN")}</strong><div className="metric-card-bottom"><span className="metric-trend"><ArrowUpRight size={13}/> Saved records</span><span>{detail}</span></div></article>;
}

function SummaryLine({label,value,icon:Icon,alert=false}:{label:string;value:number;icon:LucideIcon;alert?:boolean}) {
  return <div className={"dashboard-cockpit-summary-line"+(alert?" is-alert":"")}><span className="dashboard-cockpit-summary-icon"><Icon size={15}/></span><span className="dashboard-cockpit-summary-label">{label}</span><strong>{value.toLocaleString("en-IN")}</strong></div>;
}

export default function DashboardWorkspace({onSelectModule,onOpenCommandCentre,onOpenModules,moduleCount}:Props) {
  const {data,syncStatus}=useManufacturingData();
  const companies=activeRows(data.companies), components=activeRows(data.components), pos=activeRows(data.purchaseOrders), vendors=activeRows(data.vendors), ops=activeRows(data.operations);
  const parts=activeRows(data.componentParts);
  const transportLegs=activeRows(data.transportLegs);
  const activeTransportRoutes=activeRows(data.transportRoutes).filter(route=>route.active);
  const lines=pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line})));
  const openOps=ops.filter(op=>op.status!=="Complete"), completeOps=ops.filter(op=>op.status==="Complete"), inProduction=ops.filter(op=>op.status==="Running");
  const todayDate=new Date();
  const today=todayDate.getFullYear()+"-"+String(todayDate.getMonth()+1).padStart(2,"0")+"-"+String(todayDate.getDate()).padStart(2,"0");
  const overdue=ops.filter(op=>op.status!=="Complete"&&op.plannedEnd&&op.plannedEnd<today);
  const holds=ops.filter(op=>op.status==="Quality hold");
  const exceptions=[...overdue,...holds.filter(op=>!overdue.some(item=>item.id===op.id))];
  const visibleExceptions=[...overdue.slice(0,4),...holds.slice(0,4).filter(op=>!overdue.some(item=>item.id===op.id))];
  const dueToday=ops.filter(op=>op.status!=="Complete"&&op.plannedEnd===today);
  const pendingJobs=lines.filter(({line})=>line.jobStatus!=="Finished");
  const recent=[...ops].sort((x,y)=>(y.updatedAt||"").localeCompare(x.updatedAt||"")).slice(0,5);
  const operationContext=(op:typeof ops[number]):DashboardNavigationContext=>({companyId:pos.find(po=>po.id===op.poId)?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id,vendorId:op.vendorId});
  const latestOperation=recent[0];
  const routeOperations=latestOperation?ops.filter(op=>op.poLineId===latestOperation.poLineId).sort((a,b)=>a.sequence-b.sequence):[];
  const routePo=latestOperation?pos.find(po=>po.id===latestOperation.poId):undefined;
  const routeLine=routePo?.lines.find(line=>line.id===latestOperation?.poLineId&&!line.deletedAt);
  const routeComponent=latestOperation?components.find(component=>component.id===latestOperation.componentId):undefined;
  const routeCompany=routePo?companies.find(company=>company.id===routePo.companyId):undefined;
  const routeLegs=latestOperation?transportLegs.filter(leg=>leg.poLineId===latestOperation.poLineId):[];
  const activeLegs=transportLegs.filter(leg=>leg.status==="Running"||leg.status==="Delayed");
  const sync=syncStatus==="synced"?"SHARED DATA SYNCED":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY RETAINED":"LOCAL DATA";
  const completion=ops.reduce((total,op)=>total+(op.quantity>0?Math.max(0,Math.min(op.quantity,op.completed)):0),0);
  const planned=ops.reduce((total,op)=>total+Math.max(0,op.quantity),0);
  const completionPercent=planned?Math.round(completion/planned*100):0;
  const dateLabel=new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(todayDate);

  return <section className="workspace-page dashboard-home dashboard-cockpit" data-testid="dashboard-cockpit">
    <header className="dashboard-cockpit-header">
      <div className="dashboard-cockpit-brand">
        <span className="dashboard-cockpit-mark">A</span>
        <span><strong>AXIMACH<span>™</span></strong><small>MANUFACTURING INTELLIGENCE SYSTEM</small></span>
      </div>
      <div className="dashboard-cockpit-title">
        <div className="dashboard-cockpit-eyebrow">CONNECTED INDUSTRIAL OPERATIONS</div>
        <h1>Manufacturing Universe <em>— Live</em></h1>
        <p>One connected view of companies, orders, components, operations and movement</p>
      </div>
      <div className="dashboard-cockpit-header-actions">
        <span className={"dashboard-cockpit-sync"+(syncStatus==="synced"?" is-synced":"")}><i/>{sync}</span>
        <span className="dashboard-cockpit-date">{dateLabel}</span>
        <button className="dashboard-cockpit-command" onClick={onOpenCommandCentre}><Command size={15}/> 3D Command Centre</button>
      </div>
    </header>

    <DashboardCommandLayer operations={ops} completedQuantity={completion} plannedQuantity={planned} completionPercent={completionPercent} inProduction={inProduction.length} openOperations={openOps.length} completedOperations={completeOps.length} qualityHolds={holds.length} overdue={overdue.length} activeTransport={activeLegs.length} onSelectModule={onSelectModule}/>

    <section className="dashboard-cockpit-main" aria-label="Manufacturing universe command view">
      <aside className="dashboard-cockpit-panel dashboard-cockpit-summary" data-testid="dashboard-cockpit-summary">
        <div className="dashboard-cockpit-panel-title"><div><span className="dashboard-cockpit-section-icon"><Gauge size={16}/></span><span><strong>Universe Summary</strong><small>Saved AXIMACH records</small></span></div><span className="dashboard-cockpit-count">09 / METRICS</span></div>
        <SummaryLine label="Companies" value={companies.length} icon={Building2}/>
        <SummaryLine label="Purchase Orders" value={pos.length} icon={Package}/>
        <SummaryLine label="Components" value={components.length} icon={Factory}/>
        <SummaryLine label="Parts / Varieties" value={parts.length} icon={Boxes}/>
        <SummaryLine label="Active Operations" value={openOps.length} icon={Activity}/>
        <SummaryLine label="In Production" value={inProduction.length} icon={Workflow}/>
        <SummaryLine label="In Transport" value={activeLegs.length} icon={Truck}/>
        <SummaryLine label="Due Today" value={dueToday.length} icon={CalendarClock}/>
        <SummaryLine label="Exceptions" value={exceptions.length} icon={CircleAlert} alert={exceptions.length>0}/>
        <div className="dashboard-cockpit-summary-footer"><span>Vendor network</span><strong>{vendors.length.toLocaleString("en-IN")}</strong><button onClick={()=>onSelectModule("vendors")}>Open vendors <ArrowUpRight size={12}/></button></div>
      </aside>

      <section className="dashboard-cockpit-panel dashboard-cockpit-universe" data-testid="dashboard-cockpit-universe">
        <div className="dashboard-cockpit-panel-title"><div><span className="dashboard-cockpit-section-icon"><GitBranch size={16}/></span><span><strong>AXIMACH Connected Universe</strong><small>Interactive module network · select a node to open its workspace</small></span></div><span className="dashboard-cockpit-3d-tag">3D / 360°</span></div>
        <div className="dashboard-cockpit-orb"><AXIMACHOrb surface="dashboard" onSelectModule={onSelectModule}/></div>
        <div className="dashboard-cockpit-universe-footer"><span><i/> 22 connected workspaces</span><button onClick={onOpenModules}>Explore module universe <ArrowRight size={13}/></button></div>
      </section>

      <aside className="dashboard-cockpit-right">
        <section className="dashboard-cockpit-panel dashboard-cockpit-operations" data-testid="dashboard-cockpit-operations">
          <div className="dashboard-cockpit-panel-title"><div><span className="dashboard-cockpit-section-icon"><Activity size={16}/></span><span><strong>Recent operations</strong><small>Latest saved operation updates</small></span></div><span className="dashboard-cockpit-live-label"><i/> RECORDS</span></div>
          {recent.length?<div className="dashboard-cockpit-operation-list">{recent.map(op=>{
            const po=pos.find(x=>x.id===op.poId),part=components.find(x=>x.id===op.componentId),vendor=vendors.find(x=>x.id===op.vendorId);
            const ratio=op.quantity>0?Math.round(Math.max(0,Math.min(op.quantity,op.completed))/op.quantity*100):0;
            return <button className="dashboard-cockpit-operation" key={op.id} onClick={()=>onSelectModule("production",operationContext(op))}>
              <span className="dashboard-cockpit-operation-icon"><ComponentIcon componentId={part?.id} componentName={(part?.name||"Component")+" "+(part?.partNumber||"")}/></span>
              <span className="dashboard-cockpit-operation-copy"><strong>{op.name}</strong><small>{part?.partNumber||"Component"} · {po?.number||"PO"}</small><span className="dashboard-cockpit-operation-meta">{vendor?.company||"Vendor not assigned"} · {op.status}</span><i className="dashboard-cockpit-progress"><b style={{width:ratio+"%"}}/></i></span>
              <b className="dashboard-cockpit-operation-percent">{ratio}%</b>
            </button>;
          })}</div>:<div className="dashboard-cockpit-empty"><Workflow size={22}/><strong>No operations recorded</strong><span>Create a PO component line and add its process route to populate this panel.</span><button onClick={()=>onSelectModule("purchasing")}>Open Purchase Orders <ArrowRight size={12}/></button></div>}
          <button className="dashboard-cockpit-panel-link" onClick={()=>onSelectModule("production")}>Open production plan <ArrowUpRight size={13}/></button>
        </section>

        <section className="dashboard-cockpit-panel dashboard-cockpit-kpis" data-testid="dashboard-cockpit-kpis">
          <div className="dashboard-cockpit-panel-title"><div><span className="dashboard-cockpit-section-icon"><Gauge size={16}/></span><span><strong>Universe KPIs</strong><small>Calculated from saved records</small></span></div></div>
          <div className="dashboard-cockpit-kpi-grid">
            <div><small>Quantity completion</small><strong>{completionPercent}%</strong><span>{completion.toLocaleString("en-IN")} / {planned.toLocaleString("en-IN")} pcs</span></div>
            <div><small>Open operations</small><strong>{openOps.length.toLocaleString("en-IN")}</strong><span>Not marked complete</span></div>
            <div><small>Completed operations</small><strong>{completeOps.length.toLocaleString("en-IN")}</strong><span>Saved complete status</span></div>
            <div className={holds.length?"is-alert":""}><small>Quality holds</small><strong>{holds.length.toLocaleString("en-IN")}</strong><span>Recorded quality status</span></div>
            <div className={overdue.length?"is-alert":""}><small>Overdue operations</small><strong>{overdue.length.toLocaleString("en-IN")}</strong><span>Open operations past planned end</span></div>
          </div>
          <div className="dashboard-cockpit-kpi-footer"><span>Active transport legs</span><strong>{activeLegs.length.toLocaleString("en-IN")}</strong><span>Active routes</span><strong>{activeTransportRoutes.length.toLocaleString("en-IN")}</strong></div>
        </section>
      </aside>
    </section>

    <section className="dashboard-cockpit-panel dashboard-cockpit-route" data-testid="dashboard-cockpit-route">
      <div className="dashboard-cockpit-panel-title dashboard-cockpit-route-heading">
        <div><span className="dashboard-cockpit-section-icon"><Route size={16}/></span><span><strong>Manufacturing Process Map — Route Flow</strong><small>{routeOperations.length?((routeCompany?.name||"Company")+" · "+(routePo?.number||"PO")+" · "+(routeComponent?.partNumber||routeComponent?.name||"Component")):"Select a saved PO component route to see its operation sequence"}</small></span></div>
        <div className="dashboard-cockpit-route-actions">{routeLine&&<span className="dashboard-cockpit-route-qty">Qty {routeLine.quantity.toLocaleString("en-IN")}</span>}<button onClick={()=>onSelectModule("route-flow",latestOperation?operationContext(latestOperation):undefined)}>Open Route Flow <ArrowUpRight size={13}/></button></div>
      </div>
      {routeOperations.length?<div className="dashboard-cockpit-route-track">
        {routeOperations.map((op,index)=>{
          const relatedLegs=routeLegs.filter(leg=>leg.anchorOperationId===op.id||leg.targetOperationId===op.id);
          return <div className="dashboard-cockpit-route-item" key={op.id}>
            {index>0&&<span className="dashboard-cockpit-route-connector"><ArrowRight size={17}/></span>}
            <button className={"dashboard-cockpit-route-node status-"+op.status.toLowerCase().replace(/[^a-z0-9]+/g,"-")} onClick={()=>onSelectModule("production",operationContext(op))}>
              <span className="dashboard-cockpit-route-node-top"><b>{String(op.sequence).padStart(2,"0")}</b><small>{op.status}</small></span>
              <strong>{op.name}</strong>
              <span>{op.category||"Process"}{op.machine?" · "+op.machine:""}</span>
              <small>{op.vendorId?vendors.find(v=>v.id===op.vendorId)?.company||"Vendor assigned":"Vendor not assigned"}</small>
              {relatedLegs.length>0&&<em><Truck size={11}/> {relatedLegs.length} linked transport leg{relatedLegs.length===1?"":"s"}</em>}
            </button>
          </div>;
        })}
      </div>:<div className="dashboard-cockpit-route-empty"><span className="dashboard-cockpit-empty-symbol"><Route size={20}/></span><span><strong>No saved route to display yet</strong><small>Once a PO component line has operations and transport links, its actual sequence will appear here. Nothing is simulated.</small></span><button onClick={()=>onSelectModule("purchasing")}>Create / open a PO <ArrowRight size={12}/></button></div>}
      <div className="dashboard-cockpit-route-footer"><span>{routeOperations.length} process stage{routeOperations.length===1?"":"s"}</span><span>{routeLegs.length} linked transport leg{routeLegs.length===1?"":"s"}</span><span>{routeLine?.targetDelivery?"Target delivery · "+routeLine.targetDelivery:routePo?.targetDelivery?"Target delivery · "+routePo.targetDelivery:"Target delivery not recorded"}</span></div>
    </section>

    <section className="dashboard-cockpit-ribbon" aria-label="Manufacturing summary totals">
      {[
        {label:"Components",value:components.length,Icon:Factory},
        {label:"Parts / Varieties",value:parts.length,Icon:Layers3},
        {label:"Active Routes",value:activeTransportRoutes.length,Icon:Route},
        {label:"In Production",value:inProduction.length,Icon:Activity},
        {label:"In Transport",value:activeLegs.length,Icon:Truck},
        {label:"Completed Operations",value:completeOps.length,Icon:CheckCircle2},
        {label:"Exceptions",value:exceptions.length,Icon:CircleAlert}
      ].map(({label,value,Icon})=><button key={label} onClick={()=>onSelectModule(label==="In Transport"?"dispatch":label==="Exceptions"?"quality":label==="Components"||label==="Parts / Varieties"?"components":label==="Active Routes"?"transport-master":"production")}><Icon size={17}/><span>{label}</span><strong>{value.toLocaleString("en-IN")}</strong></button>)}
    </section>

    <section className="dashboard-cockpit-secondary">
      <div className="dashboard-cockpit-secondary-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ANALYTICS & RECORD INTELLIGENCE</div><h2>Operational analytics<span>.</span></h2></div><button className="button-quiet" onClick={()=>onSelectModule("reports")}>Open reports <ArrowRight size={14}/></button></div>
      <section className="metric-grid dashboard-metric-grid">
        <Kpi label="Companies" value={companies.length} detail="Company directory" icon={Building2}/>
        <Kpi label="Purchase orders" value={pos.length} detail="PO records" icon={Package}/>
        <Kpi label="PO component lines" value={lines.length} detail="Ordered components" icon={Boxes}/>
        <Kpi label="Components" value={components.length} detail="Component directory" icon={Factory}/>
        <Kpi label="Vendors" value={vendors.length} detail="Vendor directory" icon={Users}/>
        <Kpi label="Open operations" value={openOps.length} detail="Not complete" icon={Activity}/>
      </section>
      <section className="dashboard-cockpit-analytics-grid">
        <div className="surface-panel dashboard-production-chart-panel">
          <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SHOP-FLOOR SNAPSHOT</div><h3>Production status distribution</h3><p>{ops.length.toLocaleString("en-IN")} saved operations · calculated from AXIMACH records</p></div><button className="button-quiet compact-button" onClick={()=>onSelectModule("production")}><Workflow size={14}/> Open production plan</button></div>
          <ProductionStatusChart operations={ops}/>
        </div>
        <div className="surface-panel dashboard-analytics-exceptions"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ATTENTION REQUIRED</div><h3>Recorded exceptions</h3><p>Overdue operations and quality holds only</p></div><span className="attention-count">{exceptions.length}</span></div>
          {exceptions.length?<div className="dashboard-exception-list">{visibleExceptions.map(op=><button className="attention-row" key={op.id} onClick={()=>onSelectModule(op.status==="Quality hold"?"quality":"production",operationContext(op))}><span className="attention-symbol red-symbol"><CircleAlert size={16}/></span><span className="attention-copy"><strong>{op.name}</strong><small>{op.status==="Quality hold"?"Quality hold recorded":"Past target · "+op.plannedEnd}</small></span><ArrowUpRight size={15}/></button>)}</div>:<div className="module-empty-state"><CheckCircle2 size={24}/><h3>No recorded exceptions</h3><p>No overdue operations or quality holds are recorded.</p></div>}
        </div>
      </section>
      <div className="dashboard-cockpit-records-label">Master records</div>
      <section className="dashboard-data-orb-grid" aria-label="Five live rotating 3D dashboard data visualisations">
        <DashboardDataOrb title="Recent Operations" subtitle="Latest saved shop-floor operations" onSelectModule={onSelectModule} items={recent.length?recent.map(op=>({id:op.id,label:op.name,value:op.status,moduleId:"production",Icon:Activity})):[{id:"no-recent-operations",label:"No operations recorded",value:0,moduleId:"production",Icon:Workflow}]}/>
        <DashboardDataOrb title="Records" subtitle="Live totals across master data" onSelectModule={onSelectModule} items={[
          {id:"record-companies",label:"Companies",value:companies.length,moduleId:"companies",Icon:Building2},
          {id:"record-pos",label:"Purchase Orders",value:pos.length,moduleId:"purchasing",Icon:Package},
          {id:"record-lines",label:"PO Component Lines",value:lines.length,moduleId:"purchasing",Icon:Boxes},
          {id:"record-components",label:"Components",value:components.length,moduleId:"components",Icon:Factory},
          {id:"record-vendors",label:"Vendors",value:vendors.length,moduleId:"vendors",Icon:Users},
          {id:"record-operations",label:"Operations",value:ops.length,moduleId:"production",Icon:Activity}
        ]}/>
        <DashboardDataOrb title="Exceptions" subtitle="Overdue work and quality holds" onSelectModule={onSelectModule} items={exceptions.length?exceptions.slice(0,8).map(op=>({id:"exception-"+op.id,label:op.name,value:op.status,moduleId:op.status==="Quality hold"?"quality":"production",Icon:CircleAlert})):[{id:"no-recorded-exceptions",label:"No recorded exceptions",value:0,moduleId:"quality",Icon:CheckCircle2}]}/>
        <DashboardDataOrb title="Master Records" subtitle="Core manufacturing reference data" onSelectModule={onSelectModule} items={[
          {id:"master-companies",label:"Companies",value:companies.length,moduleId:"companies",Icon:Building2},
          {id:"master-components",label:"Components",value:components.length,moduleId:"components",Icon:Boxes},
          {id:"master-vendors",label:"Vendors",value:vendors.length,moduleId:"vendors",Icon:Users},
          {id:"master-processes",label:"Process Definitions",value:activeRows(data.processDefinitions).length,moduleId:"process-master",Icon:Workflow},
          {id:"master-materials",label:"Materials",value:activeRows(data.materials).length,moduleId:"inventory",Icon:Factory},
          {id:"master-transport",label:"Transport Routes",value:activeRows(data.transportRoutes).length,moduleId:"transport-master",Icon:Truck}
        ]}/>
        <DashboardDataOrb title="Production Status" subtitle="Current saved job and operation states" onSelectModule={onSelectModule} items={[
          {id:"status-open",label:"Open Operations",value:openOps.length,moduleId:"production",Icon:Activity},
          {id:"status-complete",label:"Completed Operations",value:completeOps.length,moduleId:"production",Icon:CheckCircle2},
          {id:"status-pending",label:"Jobs In Progress",value:pendingJobs.length,moduleId:"production",Icon:Workflow},
          {id:"status-finished",label:"Jobs Finished",value:lines.length-pendingJobs.length,moduleId:"production",Icon:CheckCircle2},
          {id:"status-holds",label:"Quality Holds",value:holds.length,moduleId:"quality",Icon:CircleAlert}
        ]}/>
      </section>
      <section className="module-shortcuts dashboard-shortcuts"><div className="section-row-title"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUICK ACCESS</div><h2>Open a module<span>.</span></h2></div><button className="button-quiet" onClick={onOpenModules}>All {moduleCount} modules <ArrowRight size={15}/></button></div>
        <div className="shortcut-grid">{[["companies","Company Directory"],["components","Component Directory"],["purchasing","Purchase Orders"],["vendors","Vendor Directory"],["production","Production Plan & Process Plan"],["costing","Costing & Payment"],["inventory","BOM & Inventory"],["quality","Quality Inspection"]].map(([id,label])=><button className="shortcut-card" key={id} onClick={()=>onSelectModule(id)}><span className="shortcut-icon"><ArrowUpRight size={18}/></span><span><strong>{label}</strong><small>Open workspace</small></span><ArrowRight size={15}/></button>)}</div>
      </section>
    </section>
    <div className="dashboard-cockpit-data-note"><ShieldCheck size={15}/><span>{sync}. All figures, operation statuses, route stages and quantities shown here are derived from saved AXIMACH records. No simulated machine readings, invented OEE or fabricated live-production metrics are presented.</span></div>
  </section>;
}
