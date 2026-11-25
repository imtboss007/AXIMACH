import { useMemo, type CSSProperties } from "react";
import { Handle, MarkerType, Position } from "@xyflow/react";
import type { Edge, Node, NodeProps, NodeTypes } from "@xyflow/react";
import { CheckCircle2, ClipboardCheck, GitBranch, Package, Workflow } from "lucide-react";
import demo from "./single-component-route-demo.json";
import { ProcessIcon } from "./IconStudio";
import { ManufacturingGraphCanvas } from "./ManufacturingGraphCanvas";
import { routeRelationshipEdgeGeometry } from "./manufacturingGraphLayout.mjs";
import { VehicleIcon } from "./TransportVehicle";

type DemoNodeData = {
  label:string; code:string; kind:"material"|"transport"|"quality"|"process"|"delivery"|"decision";
  detail:string; accent:string; vehicleType?:string; processName?:string; category?:string;
  ratePerPartINR?:number; plannedCostINR?:number; quantity?:number; branch?:string; subComponent?:string;
};
type DemoFlowNode = Node<DemoNodeData,"singleComponentRoute">;
type DemoEdgeData = {
  relationshipType:string; pathOptions:{mode:"bezier";curvature:number}|{mode:"smoothstep";offset:number;borderRadius:number};
  parallelIndex:number;
};
type DemoFlowEdge = Edge<DemoEdgeData,"manufacturing">;

const RELATIONSHIP_COLORS:Record<string,string> = {
  main:"#168d9a",alternate:"#4b95eb",rework:"#e38b45",dependency:"#347de5",
  parallel:"#9848d6",merge:"#9e4bc9",split:"#3d79df","follow-on":"#315675",
  feedback:"#455bd6",conditional:"#9954ce",successor:"#23845d",
  material:"#0d9f98",transport:"#397ea4"
};
const RELATIONSHIP_DASHES:Record<string,string> = {
  alternate:"8 5",rework:"7 5",dependency:"2 5",parallel:"8 3",split:"5 3",
  feedback:"2 4",conditional:"10 4 2 4",material:"4 3",transport:"5 4"
};

function SingleComponentRouteNode({data}:NodeProps<DemoFlowNode>) {
  const icon = data.kind==="material"
    ? <Package size={17}/>
    : data.kind==="transport"
      ? <VehicleIcon vehicleType={data.vehicleType||"truck"} size={18}/>
      : data.kind==="quality"
        ? <ClipboardCheck size={17}/>
        : data.kind==="delivery"
          ? <CheckCircle2 size={17}/>
          : data.kind==="decision"
            ? <GitBranch size={17}/>
            : <ProcessIcon processName={data.processName||data.label} category={data.category} fallback={<Workflow size={17}/>}/>;
  return <article className="route-flow-graph-node single-component-route-node" style={{"--route-accent":data.accent} as CSSProperties}>
    <Handle id="target-left" type="target" position={Position.Left} style={{top:"35%"}}/>
    <Handle id="target-right" type="target" position={Position.Right} style={{top:"65%"}}/>
    <Handle id="target-top" type="target" position={Position.Top} style={{left:"35%"}}/>
    <Handle id="target-bottom" type="target" position={Position.Bottom} style={{left:"65%"}}/>
    <Handle id="source-right" type="source" position={Position.Right} style={{top:"35%"}}/>
    <Handle id="source-left" type="source" position={Position.Left} style={{top:"65%"}}/>
    <Handle id="source-top" type="source" position={Position.Top} style={{left:"35%"}}/>
    <Handle id="source-bottom" type="source" position={Position.Bottom} style={{left:"65%"}}/>
    <Handle id="target-left-transport" type="target" position={Position.Left} style={{top:"84%"}}/>
    <Handle id="source-right-transport" type="source" position={Position.Right} style={{top:"84%"}}/>
    <div className="single-component-route-node-head"><span>{icon}</span><small>{data.code}</small></div>
    <strong title={data.label}>{data.label}</strong>
    <small title={data.detail}>{data.detail}</small>
    {data.ratePerPartINR!==undefined&&<div className="single-component-route-node-cost">
      <span><small>RATE / PC</small><strong>₹{data.ratePerPartINR.toLocaleString("en-IN")}</strong></span>
      {data.plannedCostINR!==undefined&&<span><small>PLAN / QTY</small><strong>₹{data.plannedCostINR.toLocaleString("en-IN")}</strong></span>}
    </div>}
    {data.branch&&<em className={"single-component-route-branch "+(data.branch==="Alternate route"?"is-alternate":data.branch==="Rework route"?"is-rework":"")}>{data.branch}{data.subComponent?" · "+data.subComponent:""}</em>}
  </article>;
}
const SINGLE_COMPONENT_NODE_TYPES = {singleComponentRoute:SingleComponentRouteNode} satisfies NodeTypes;

function buildDemoGraph():{nodes:DemoFlowNode[];edges:DemoFlowEdge[]} {
  const rawNodes = demo.nodes as Array<DemoNodeData & {id:string;x:number;y:number}>;
  const nodes:DemoFlowNode[] = rawNodes.map(row=>({
    id:row.id,type:"singleComponentRoute",position:{x:row.x,y:row.y},
    data:{label:row.label,code:row.code,kind:row.kind,detail:row.detail,accent:row.accent,vehicleType:row.vehicleType,processName:row.processName,category:row.category,ratePerPartINR:row.ratePerPartINR,plannedCostINR:row.plannedCostINR,quantity:row.quantity,branch:row.branch,subComponent:row.subComponent},
    draggable:false,selectable:false,focusable:false,style:{width:230}
  }));
  const centers = new Map(rawNodes.map(row=>[row.id,{x:row.x+115,y:row.y+58}]));
  const pairCounts = new Map<string,number>();
  const edges:DemoFlowEdge[] = (demo.edges as Array<{id:string;source:string;target:string;type:string;label:string}>).map(row=>{
    const sourcePoint=centers.get(row.source)||{x:0,y:0};
    const targetPoint=centers.get(row.target)||{x:0,y:0};
    const pairKey=row.source+"::"+row.target;
    const parallelIndex=pairCounts.get(pairKey)||0;
    pairCounts.set(pairKey,parallelIndex+1);
    const geometry=routeRelationshipEdgeGeometry(row.type,sourcePoint,targetPoint,"organic",parallelIndex);
    const color=RELATIONSHIP_COLORS[row.type]||RELATIONSHIP_COLORS.main;
    return {
      id:row.id,source:row.source,target:row.target,
      sourceHandle:geometry.sourceHandle,targetHandle:geometry.targetHandle,
      type:"manufacturing",data:{relationshipType:row.type,pathOptions:geometry.pathOptions,parallelIndex},
      label:row.label,labelStyle:{fontSize:8,fontWeight:800,fill:"#46617a"},
      labelBgStyle:{fill:"#ffffff",fillOpacity:.96},labelBgPadding:[4,2],
      style:{stroke:color,strokeWidth:row.type==="transport"?3:2.5,opacity:.96,...(RELATIONSHIP_DASHES[row.type]?{strokeDasharray:RELATIONSHIP_DASHES[row.type]}:{})},
      markerEnd:{type:MarkerType.ArrowClosed,color},animated:false,selectable:false,focusable:false
    };
  });
  return {nodes,edges};
}

export function SingleComponentRouteGraphDemo() {
  const graph=useMemo(buildDemoGraph,[]);
  const routeTypes=["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];
  return <section className="single-component-route-demo" aria-label="One component complete manufacturing route map">
    <header className="single-component-route-demo-head">
      <div><span className="transport-demo-kicker"><GitBranch size={13}/> ONE COMPANY · ONE PO · ONE COMPONENT</span>
        <h3>{demo.company.name} · {demo.component.partNumber} · {demo.component.name}</h3>
        <p>{demo.purchaseOrder.number} · {demo.component.material} · {demo.component.quantity} {demo.component.quantityUnit}</p>
      </div>
      <span className="module-number">DEMO ONLY · {routeTypes.length} ROUTE TYPES</span>
    </header>
    <div className="route-flow-graph-canvas single-component-route-demo-canvas" data-testid="single-component-route-graph">
      <ManufacturingGraphCanvas nodes={graph.nodes} edges={graph.edges} nodeTypes={SINGLE_COMPONENT_NODE_TYPES}
        fitView fitViewOptions={{padding:.12,minZoom:.06,maxZoom:.9,duration:180}} minZoom={.06} maxZoom={1.8}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        nodesFocusable={false} edgesFocusable={false}
        ariaLabel="Complete single-component process, material and transport route graph"/>
    </div>
    <div className="single-component-route-demo-caption">
      <span>All route relationships, 15+ manufacturing process categories, BOM materials and transport legs are scoped to the same company, PO line and component.</span>
      <small>{demo.nodes.length} nodes · {demo.edges.length} links · {demo.operations.length} rated operations · ₹{demo.component.processCostINR.toLocaleString("en-IN")} base process plan · synthetic only</small>
    </div>
  </section>;
}
