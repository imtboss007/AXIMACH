import { useMemo, useState, type CSSProperties } from "react";
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
    draggable:true,selectable:true,focusable:true,style:{width:200}
  }));
  const centers = new Map(rawNodes.map(row=>[row.id,{x:row.x+100,y:row.y+70}]));
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
      type:"manufacturing",data:{relationshipType:row.type,pathOptions:geometry.pathOptions,parallelIndex,flowMotion:["main","alternate","rework","transport","material"].includes(row.type)},
      label:row.label,labelStyle:{fontSize:8,fontWeight:800,fill:"#46617a"},
      labelBgStyle:{fill:"#ffffff",fillOpacity:.96},labelBgPadding:[4,2],
      style:{stroke:color,strokeWidth:row.type==="transport"?3:2.5,opacity:.96,...(RELATIONSHIP_DASHES[row.type]?{strokeDasharray:RELATIONSHIP_DASHES[row.type]}:{})},
      markerEnd:{type:MarkerType.ArrowClosed,color,width:18,height:18},animated:false,selectable:false,focusable:false
    };
  });
  return {nodes,edges};
}

export function SingleComponentRouteGraphDemo() {
  const graph=useMemo(buildDemoGraph,[]);
  const [edges,setEdges]=useState(graph.edges);
  const [relationshipType,setRelationshipType]=useState("main");
  const routeTypes=["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor","material","transport"];
  const connectDemoNodes=(connection:{source:string|null;target:string|null})=>{
    const source=connection.source||"",target=connection.target||"";
    if(!source||!target||source===target)return;
    const sourceNode=graph.nodes.find(node=>node.id===source),targetNode=graph.nodes.find(node=>node.id===target);
    if(!sourceNode||!targetNode)return;
    const duplicate=edges.some(edge=>edge.source===source&&edge.target===target&&edge.data?.relationshipType===relationshipType);
    if(duplicate)return;
    const parallelIndex=edges.filter(edge=>edge.source===source&&edge.target===target).length;
    const geometry=routeRelationshipEdgeGeometry(relationshipType,
      {x:sourceNode.position.x+100,y:sourceNode.position.y+70},
      {x:targetNode.position.x+100,y:targetNode.position.y+70},"organic",parallelIndex);
    const color=RELATIONSHIP_COLORS[relationshipType]||RELATIONSHIP_COLORS.main;
    const id="demo-link-"+Date.now().toString(36)+"-"+parallelIndex;
    setEdges(current=>[...current,{
      id,source,target,sourceHandle:geometry.sourceHandle,targetHandle:geometry.targetHandle,
      type:"manufacturing",
      data:{relationshipType,pathOptions:geometry.pathOptions,parallelIndex,flowMotion:["main","alternate","rework","transport","material"].includes(relationshipType)},
      label:relationshipType.toUpperCase(),
      labelStyle:{fontSize:8,fontWeight:800,fill:"#46617a"},
      labelBgStyle:{fill:"#ffffff",fillOpacity:.96},labelBgPadding:[4,2],
      style:{stroke:color,strokeWidth:relationshipType==="transport"?3:2.5,opacity:.98,
        ...(RELATIONSHIP_DASHES[relationshipType]?{strokeDasharray:RELATIONSHIP_DASHES[relationshipType]}:{})},
      markerEnd:{type:MarkerType.ArrowClosed,color,width:18,height:18},animated:relationshipType==="main"||relationshipType==="rework",
      selectable:true,focusable:true
    }]);
  };
  return <section className="single-component-route-demo" aria-label="One component complete manufacturing route map">
    <header className="single-component-route-demo-head">
      <div><span className="transport-demo-kicker"><GitBranch size={13}/> ONE COMPANY · ONE PO · ONE COMPONENT</span>
        <h3>{demo.company.name} · {demo.component.partNumber} · {demo.component.name}</h3>
        <p>{demo.purchaseOrder.number} · {demo.component.material} · {demo.component.quantity} {demo.component.quantityUnit}</p>
      </div>
      <span className="module-number">DEMO ONLY · {routeTypes.length} ROUTE TYPES</span>
    </header>
    <div className="single-component-route-tools">
      <label>New connection type<select aria-label="Single component demo connection type" value={relationshipType} onChange={event=>setRelationshipType(event.target.value)}>{routeTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
      <small>Drag from any material, process, quality, decision or transport connector to another node. This is an isolated preview; changes here do not alter live records.</small>
    </div>
    <div className="route-flow-graph-canvas single-component-route-demo-canvas" data-testid="single-component-route-graph">
      <ManufacturingGraphCanvas nodes={graph.nodes} edges={edges} nodeTypes={SINGLE_COMPONENT_NODE_TYPES}
        fitView fitViewOptions={{padding:.08,minZoom:.2,maxZoom:1.1,duration:260}} minZoom={.16} maxZoom={1.8}
        nodesDraggable nodesConnectable elementsSelectable
        onConnect={connectDemoNodes}
        nodesFocusable edgesFocusable
        ariaLabel="Interactive one-company single-PO single-component manufacturing graph"/>
    </div>
    <div className="single-component-route-demo-caption">
      <span>One synthetic company, one PO, one component, all 18 process categories, BOM material feeds and transport legs. Drag nodes and add typed relationships.</span>
      <small>{demo.nodes.length} nodes · {edges.length} links · {demo.operations.length} rated operations · ₹{demo.component.processCostINR.toLocaleString("en-IN")} base process plan · synthetic preview only</small>
    </div>
  </section>;
}
