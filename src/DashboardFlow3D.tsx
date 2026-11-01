import { useMemo, useState } from "react";
import { Activity, Boxes, Building2, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Cog, Factory, Maximize2, Pause, Play, RotateCcw, Truck, Workflow, ZoomIn, ZoomOut } from "lucide-react";
import type { OperationRecord, ComponentRecord, PurchaseOrderRecord, CompanyRecord } from "./manufacturingData";

type Props = {
  operations: OperationRecord[];
  components: ComponentRecord[];
  orders: PurchaseOrderRecord[];
  companies: CompanyRecord[];
  onOpenOperation: (selection: { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string }) => void;
};
const iconFor = (name: string, category: string) => {
  const value = (name + " " + category).toLowerCase();
  if (/mill|vmc|hmc|cnc|machin/.test(value)) return Cog;
  if (/turn|lathe|boring/.test(value)) return CircleDot;
  if (/wire.?edm|edm|laser|cut/.test(value)) return Activity;
  if (/weld|fabricat|assembly/.test(value)) return Factory;
  if (/transport|dispatch|logistic|handover/.test(value)) return Truck;
  if (/inspect|quality|cmm|measure/.test(value)) return CheckCircle2;
  return Workflow;
};
export default function DashboardFlow3D({operations,components,orders,companies,onOpenOperation}:Props) {
  const [active,setActive]=useState(0);
  const [yaw,setYaw]=useState(-18);
  const [pitch,setPitch]=useState(14);
  const [zoom,setZoom]=useState(1);
  const [playing,setPlaying]=useState(false);
  const rows=useMemo(()=>[...operations].sort((a,b)=>a.sequence-b.sequence||a.updatedAt.localeCompare(b.updatedAt)).slice(0,18),[operations]);
  const selected=rows[Math.min(active,Math.max(0,rows.length-1))];
  const po=selected?orders.find(x=>x.id===selected.poId):undefined;
  const component=selected?components.find(x=>x.id===selected.componentId):undefined;
  const company=po?companies.find(x=>x.id===po.companyId):undefined;
  const choose=(index:number)=>setActive(Math.max(0,Math.min(rows.length-1,index)));
  const Icon=selected?iconFor(selected.name,selected.category):Factory;
  return <div className="axi-dashboard-flow3d">
    <div className="axi-flow3d-topline"><span><i/> LIVE ROUTE MODEL</span><span>{rows.length} SAVED STAGES · RECORD LINKED</span></div>
    <div className="axi-flow3d-stage">
      <div className="axi-flow3d-scene" style={{"--flow-yaw":yaw+"deg","--flow-pitch":pitch+"deg","--flow-zoom":zoom} as React.CSSProperties}>
        <div className="axi-flow3d-grid"/>
        <div className="axi-flow3d-ring ring-a"/><div className="axi-flow3d-ring ring-b"/>
        <div className="axi-flow3d-track">
          {rows.length?rows.map((op,index)=>{
            const NodeIcon=iconFor(op.name,op.category);
            return <button type="button" key={op.id} className={"axi-flow3d-node "+(index===active?"is-active":"")+(op.status==="Complete"?" is-complete":"")} style={{"--node-index":index,"--node-count":rows.length} as React.CSSProperties} onClick={()=>choose(index)} title={op.name+" · "+op.status}>
              <span className="axi-flow3d-node-cube"><NodeIcon size={20}/></span><small>{String(index+1).padStart(2,"0")}</small>
            </button>;
          }):<div className="axi-flow3d-empty"><Factory size={34}/><strong>Production route waiting</strong><span>Save a component operation to populate this live 3D model.</span></div>}
        </div>
        {selected&&<div className="axi-flow3d-focus"><div className="axi-flow3d-focus-icon"><Icon size={30}/></div><small>SELECTED OPERATION</small><strong>{selected.name}</strong><span>{selected.category||"Process"} · {selected.status}</span></div>}
      </div>
      <div className="axi-flow3d-tools">
        <div className="axi-flow3d-toolgroup"><button type="button" title="Rotate left" onClick={()=>setYaw(v=>v-12)}>↶</button><button type="button" title="Rotate right" onClick={()=>setYaw(v=>v+12)}>↷</button><button type="button" title="Tilt up" onClick={()=>setPitch(v=>Math.max(-30,v-5))}>↑</button><button type="button" title="Tilt down" onClick={()=>setPitch(v=>Math.min(45,v+5))}>↓</button></div>
        <div className="axi-flow3d-toolgroup"><button type="button" title="Zoom out" onClick={()=>setZoom(v=>Math.max(.65,Number((v-.1).toFixed(2))))}><ZoomOut size={14}/></button><button type="button" title="Zoom in" onClick={()=>setZoom(v=>Math.min(1.5,Number((v+.1).toFixed(2))))}><ZoomIn size={14}/></button><button type="button" title="Reset view" onClick={()=>{setYaw(-18);setPitch(14);setZoom(1)}}><RotateCcw size={14}/></button></div>
        <div className="axi-flow3d-toolgroup"><button type="button" title="Previous stage" disabled={!rows.length} onClick={()=>choose(active-1)}><ChevronLeft size={14}/></button><button type="button" title={playing?"Pause walkthrough":"Play walkthrough"} disabled={rows.length<2} onClick={()=>{if(playing){setPlaying(false);return;}setPlaying(true);const next=(active+1)%rows.length;choose(next);}}>{playing?<Pause size={14}/>:<Play size={14}/>}</button><button type="button" title="Next stage" disabled={!rows.length} onClick={()=>choose(active+1)}><ChevronRight size={14}/></button></div>
      </div>
    </div>
    <div className="axi-flow3d-bottom">
      <div><small>COMPONENT / PO</small><strong>{component?.partNumber||"No component selected"} · {po?.number||"No PO"}</strong><span>{company?.name||"Company not linked"}</span></div>
      <div><small>STAGE</small><strong>{rows.length?String(active+1).padStart(2,"0")+" / "+String(rows.length).padStart(2,"0"):"—"}</strong><span>{selected?.plannedStart||"Start not set"} → {selected?.plannedEnd||"Due not set"}</span></div>
      <button type="button" className="axi-flow3d-open" disabled={!selected||!po} onClick={()=>selected&&po&&onOpenOperation({companyId:po.companyId,factoryId:po.factoryId,poId:po.id,poLineId:selected.poLineId,operationId:selected.id})}><Maximize2 size={14}/> Open selected process</button>
    </div>
    <div className="axi-flow3d-footnote"><Boxes size={13}/> Model reflects saved operation records; select a stage to inspect it. Camera controls change only this view.</div>
  </div>;
}
