import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, Boxes, Building2, ClipboardCheck, FileDown, Factory, Network, Search, Truck, UserRound, Wallet, Workflow, X } from "lucide-react";
import { Handle, MarkerType, Position } from "@xyflow/react";
import type { Connection, Edge, Node, NodeProps, NodeTypes, OnNodesChange } from "@xyflow/react";
import "@xyflow/react/style.css";
import { activeRows, type ManufacturingData } from "./manufacturingData";
import { expandEcosystemGroupLimit, getVisibleEcosystemNodes, loadEcosystemGraphLayout, loadEcosystemGraphPreferences, searchEcosystemNodes, updateEcosystemGraphLayout, type EcosystemGraphPreferences } from "./manufacturingEcosystemGraphModel.mjs";
import { layoutManufacturingUniverseNodes, routeRelationshipEdgeGeometry } from "./manufacturingGraphLayout.mjs";
import { ManufacturingGraphCanvas } from "./ManufacturingGraphCanvas";
import { RouteConnectorLegend } from "./RouteConnectorLegend";

type Context = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string };
type Props = { data:ManufacturingData; onNavigate:(moduleId:string,context?:Context)=>void; onConnect?:(connection:Connection,relationshipType:string)=>void };
type NodeKind = "company"|"customer"|"factory"|"order"|"component"|"vendor"|"process"|"operation"|"material"|"quality"|"transport"|"finance"|"contact";
type GraphNode = { id:string; label:string; detail:string; kind:NodeKind; moduleId:string; context:Context; x:number; y:number };
type GraphEdge = { id:string; from:string; to:string; kind:string };
type EcosystemEntityNodeData = { label:string; detail:string; group:string; accent:string; kind:NodeKind };
type EcosystemHubNodeData = { label:string; detail:string };
type EcosystemEntityNode = Node<EcosystemEntityNodeData,"ecosystem">;
type EcosystemHubNode = Node<EcosystemHubNodeData,"hub">;
type EcosystemFlowNode = EcosystemEntityNode | EcosystemHubNode;

const EDGE_LEGEND = [
  {label:"Structure",color:"var(--ax-theme-graph-1,#2875bd)"},
  {label:"Production",color:"var(--ax-theme-graph-2,#168d89)"},
  {label:"Supply",color:"var(--ax-theme-graph-3,#b17a27)"},
  {label:"Material flow",color:"var(--ax-theme-graph-4,#8b68c5)"},
  {label:"Quality",color:"var(--ax-theme-graph-5,#b95665)"},
  {label:"Logistics",color:"var(--ax-theme-graph-6,#397ea4)"},
  {label:"Finance",color:"var(--ax-theme-graph-7,#7565b5)"}
];

const edgeColor = (kind:string) => {
  if (/^main$|^successor$|owns|belongs to|contact for/.test(kind)) return "var(--ax-theme-graph-1,#2875bd)";
  if (/^alternate$/.test(kind)) return "#b17a27";
  if (/^rework$/.test(kind)) return "#c45b50";
  if (/^dependency$/.test(kind)) return "#347de5";
  if (/^parallel$|^merge$/.test(kind)) return "#9848d6";
  if (/^split$|^follow-on$/.test(kind)) return "#3d79df";
  if (/^feedback$|^conditional$/.test(kind)) return "#9954ce";
  if (/^transport$/.test(kind)) return "#397ea4";
  if (/orders|placed by|makes|performed by|defined by/.test(kind)) return "var(--ax-theme-graph-2,#168d89)";
  if (/capable vendor|supplied by|procured for|allocated to/.test(kind)) return "var(--ax-theme-graph-3,#b17a27)";
  if (/feeds operation/.test(kind)) return "var(--ax-theme-graph-4,#8b68c5)";
  if (/inspects/.test(kind)) return "var(--ax-theme-graph-5,#b95665)";
  if (/moves between|carried by/.test(kind)) return "var(--ax-theme-graph-6,#397ea4)";
  if (/serves|settles|paid to/.test(kind)) return "var(--ax-theme-graph-7,#7565b5)";
  return "var(--ax-theme-graph-1,#7ba5c1)";
};

const GROUPS: Array<{kind:NodeKind;title:string;moduleId:string;color:string}> = [
  {kind:"company",title:"Companies",moduleId:"companies",color:"var(--ax-theme-graph-1,#2875bd)"},
  {kind:"customer",title:"Customers",moduleId:"customers",color:"var(--ax-theme-graph-2,#2f9b82)"},
  {kind:"factory",title:"Factories",moduleId:"companies",color:"var(--ax-theme-graph-1,#4b8cbd)"},
  {kind:"order",title:"Purchase orders",moduleId:"purchasing",color:"var(--ax-theme-graph-4,#8b68c5)"},
  {kind:"component",title:"Components",moduleId:"components",color:"var(--ax-theme-graph-2,#168d89)"},
  {kind:"vendor",title:"Vendors",moduleId:"vendors",color:"var(--ax-theme-graph-3,#c07a2b)"},
  {kind:"process",title:"Process definitions",moduleId:"process-master",color:"var(--ax-theme-graph-1,#5b83cf)"},
  {kind:"operation",title:"Operations",moduleId:"production",color:"var(--ax-theme-graph-2,#1a9b68)"},
  {kind:"material",title:"Materials & allocations",moduleId:"inventory",color:"var(--ax-theme-graph-3,#b18a2d)"},
  {kind:"quality",title:"Quality inspections",moduleId:"quality",color:"var(--ax-theme-graph-5,#b95665)"},
  {kind:"transport",title:"Transport & dispatch",moduleId:"dispatch",color:"var(--ax-theme-graph-6,#397ea4)"},
  {kind:"finance",title:"Payments",moduleId:"costing",color:"var(--ax-theme-graph-7,#8b69aa)"},
  {kind:"contact",title:"Contacts",moduleId:"contact360",color:"var(--ax-theme-graph-6,#648b91)"}
];

function EcosystemEntityFlowNode({data}:NodeProps<EcosystemEntityNode>) {
  const connectable=data.kind==="operation";
  return <div className="ax-ecosystem-flow-node" style={{"--node-accent":data.accent} as CSSProperties}>
    <Handle id="target-top" type="target" position={Position.Top} isConnectable={connectable}/>
    <Handle id="target-bottom" type="target" position={Position.Bottom} isConnectable={connectable}/>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={connectable}/>
    <Handle id="target-right" type="target" position={Position.Right} isConnectable={connectable}/>
    <span className="ax-ecosystem-node-heading">{data.kind==="transport"?<Truck size={13}/>:data.kind==="operation"||data.kind==="process"?<Workflow size={13}/>:data.kind==="material"||data.kind==="component"?<Boxes size={13}/>:data.kind==="quality"?<ClipboardCheck size={13}/>:data.kind==="finance"?<Wallet size={13}/>:data.kind==="company"?<Building2 size={13}/>:data.kind==="factory"?<Factory size={13}/>:data.kind==="customer"||data.kind==="contact"?<UserRound size={13}/>:<Network size={13}/>}<b>{data.group}</b></span>
    <strong title={data.label}>{data.label}</strong>
    <small title={data.detail}>{data.detail}</small>
    <Handle id="source-top" type="source" position={Position.Top} isConnectable={connectable}/>
    <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable={connectable}/>
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={connectable}/>
    <Handle id="source-right" type="source" position={Position.Right} isConnectable={connectable}/>
    <Handle id="target-left-transport" type="target" position={Position.Left} style={{top:"84%"}} isConnectable={connectable}/>
    <Handle id="source-right-transport" type="source" position={Position.Right} style={{top:"84%"}} isConnectable={connectable}/>
  </div>;
}

function EcosystemHubFlowNode({data}:NodeProps<EcosystemHubNode>) {
  return <div className="ax-ecosystem-flow-hub">
    <Handle type="target" position={Position.Top} isConnectable={false}/>
    <Network size={17}/>
    <strong>{data.label}</strong>
    <small>{data.detail}</small>
    <Handle type="source" position={Position.Bottom} isConnectable={false}/>
  </div>;
}

const ECOSYSTEM_FLOW_NODE_TYPES = {
  ecosystem:EcosystemEntityFlowNode,
  hub:EcosystemHubFlowNode
} satisfies NodeTypes;

// Show every saved entity by default. Users can hide groups, but the graph must
// never silently replace real records with a small mobile sample.
const INITIAL_VISIBLE_LIMITS = Object.fromEntries(
  GROUPS.map(group => [group.kind, 5000])
) as Record<NodeKind, number>;

const GRAPH_PREFERENCES_KEY = "aximach.manufacturing-ecosystem-graph.preferences.v1";
const VALID_GROUP_KINDS = GROUPS.map(group => group.kind);
const GRAPH_LAYOUT_KEY = "aximach.manufacturing-ecosystem-graph.layout.v2";

export default function ManufacturingEcosystemGraph({data,onNavigate,onConnect}:Props) {
  const [relationshipType,setRelationshipType]=useState("main");
  const [graphPreferences,setGraphPreferences]=useState<EcosystemGraphPreferences<NodeKind>>(() => {
    try {
      const loaded=loadEcosystemGraphPreferences(
        typeof window === "undefined" ? null : window.localStorage.getItem(GRAPH_PREFERENCES_KEY),
        VALID_GROUP_KINDS,
        INITIAL_VISIBLE_LIMITS
      );
      return loaded;
    } catch {
      return loadEcosystemGraphPreferences(null,VALID_GROUP_KINDS,INITIAL_VISIBLE_LIMITS);
    }
  });
  const visibleKinds=graphPreferences.visibleKinds;
  const visibleLimits=graphPreferences.visibleLimits;
  const [graphLayout,setGraphLayout]=useState<Record<string,{x:number;y:number}>>(()=>{
    try {
      return loadEcosystemGraphLayout(typeof window === "undefined" ? null : window.localStorage.getItem(GRAPH_LAYOUT_KEY));
    } catch {
      return {};
    }
  });
  const [selectedId,setSelectedId]=useState("");
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResultLimit,setSearchResultLimit]=useState(10);
  const [exportFormat,setExportFormat]=useState<"svg"|"csv"|"json">("svg");
  useEffect(()=>{
    try {
      window.localStorage.setItem(GRAPH_PREFERENCES_KEY,JSON.stringify({
        version:3,
        visibleKinds:graphPreferences.visibleKinds,
        visibleLimits:graphPreferences.visibleLimits
      }));
    } catch { /* Persisted view preferences are optional when storage is unavailable. */ }
  },[graphPreferences]);
  const resetGraphPreferences=()=>{
    setGraphPreferences({
      version:3,
      visibleKinds:[...VALID_GROUP_KINDS],
      visibleLimits:{...INITIAL_VISIBLE_LIMITS}
    });
    setGraphLayout({});
    try { window.localStorage.removeItem(GRAPH_LAYOUT_KEY); } catch { /* Layout reset still applies in memory. */ }
  };
  const handleGraphNodesChange:OnNodesChange<EcosystemFlowNode>=(changes)=>{
    const positions:Array<{id:string;position:{x:number;y:number}}>=[];
    for(const change of changes){
      if(change.type==="position" && change.position && change.id!=="aximach-hub"){
        positions.push({id:change.id,position:change.position});
      }
    }
    if(!positions.length)return;
    setGraphLayout(current=>positions.reduce((next,change)=>updateEcosystemGraphLayout(next,change.id,change.position),current));
  };
  const persistGraphNodePosition=(_:unknown,node:EcosystemFlowNode)=>{
    if(node.type!=="ecosystem")return;
    const next=updateEcosystemGraphLayout(graphLayout,node.id,node.position);
    setGraphLayout(next);
    try { window.localStorage.setItem(GRAPH_LAYOUT_KEY,JSON.stringify(next)); }
    catch { /* The graph remains usable when device storage is unavailable. */ }
  };
  const graph=useMemo(()=>{
    const nodes:GraphNode[]=[];
    const edges:GraphEdge[]=[];
    const add=(id:string,label:string,detail:string,kind:NodeKind,moduleId:string,context:Context={})=>{
      if(!id||nodes.some(node=>node.id===id))return;
      nodes.push({id,label:label||"Unnamed record",detail,kind,moduleId,context,x:0,y:0});
    };
    const companies=activeRows(data.companies||[]);
    const customers=activeRows(data.customers||[]);
    const factories=activeRows(data.factories||[]);
    const orders=activeRows(data.purchaseOrders||[]);
    const components=activeRows(data.components||[]);
    const vendors=activeRows(data.vendors||[]);
    const definitions=activeRows(data.processDefinitions||[]);
    const operations=activeRows(data.operations||[]);
    const allocations=activeRows(data.materialCostEntries||[]);
    const inspections=activeRows(data.inspectionMeasurements||[]);
    const legs=activeRows(data.transportLegs||[]);
    const payments=activeRows(data.paymentTransactions||[]);
    const contacts=activeRows(data.contactProfiles||[]);
    const inventory=activeRows(data.inventoryTransactions||[]);
    const edgeKeys=new Set<string>();
    const edge=(from:string,to:string,kind:string)=>{
      if(!from||!to||from===to)return;
      const id=from+"|"+to+"|"+kind;
      if(edgeKeys.has(id))return;
      edgeKeys.add(id);
      edges.push({id,from,to,kind});
    };
    companies.forEach(row=>add("company:"+row.id,row.name,"Company · "+(row.gstin||"GSTIN not recorded"),"company","companies",{companyId:row.id}));
    customers.forEach(row=>{
      const id="customer:"+row.id;
      add(id,row.displayName||row.legalName,"Customer · "+row.customerCode+" · "+row.status,"customer","customers",row.ownerCompanyId?{companyId:row.ownerCompanyId}:{});
      edge(id,"company:"+row.ownerCompanyId,"belongs to");
    });
    factories.forEach(row=>{add("factory:"+row.id,row.name,"Factory · "+(row.address||"Address not recorded"),"factory","companies",{companyId:row.companyId});edge("factory:"+row.id,"company:"+row.companyId,"owns");});
    orders.forEach(row=>{add("order:"+row.id,row.number,"Purchase order · "+row.status,"order","purchasing",{companyId:row.companyId,poId:row.id});edge("order:"+row.id,"company:"+row.companyId,"placed by");row.lines.filter(line=>!line.deletedAt).forEach(line=>edge("order:"+row.id,"component:"+line.componentId,"orders"));});
    components.forEach(row=>add("component:"+row.id,row.partNumber||row.name,"Component · "+row.name+" · Rev "+(row.revision||"—"),"component","components",{companyId:row.companyId}));
    vendors.forEach(row=>add("vendor:"+row.id,row.company,"Vendor · "+(row.vendorType||row.role||"Supplier"),"vendor","vendors"));
    definitions.forEach(row=>{add("process:"+row.id,row.processType,"Process definition · "+row.category,"process","process-master");(row.vendorIds||[]).forEach(vendorId=>edge("process:"+row.id,"vendor:"+vendorId,"capable vendor"));});
    operations.forEach(row=>{
      const context={poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.id};
      add("operation:"+row.id,row.sequence+". "+row.name,"Operation · "+row.status+" · "+row.machine,"operation","production",context);
      edge("operation:"+row.id,"order:"+row.poId,"belongs to");
      edge("operation:"+row.id,"component:"+row.componentId,"makes");
      edge("operation:"+row.id,"vendor:"+row.vendorId,"performed by");
      edge("operation:"+row.id,"process:"+row.processDefinitionId,"defined by");
    });
    // Preserve the PO-line route model: branch sequence, branch origin and every
    // enabled saved relationship type are visible on this same graph.
    const routeLinks=activeRows(data.routeRelationships||[]).filter(link=>link.status!=="Disabled");
    const operationsByBranch=new Map<string,typeof operations>();
    operations.forEach(operation=>{
      const key=operation.poId+"::"+operation.poLineId+"::"+(operation.branch||"Main route");
      const bucket=operationsByBranch.get(key)||[];
      bucket.push(operation);operationsByBranch.set(key,bucket);
    });
    for(const [key,branchRows] of operationsByBranch){
      const ordered=branchRows.slice().sort((a,b)=>a.sequence-b.sequence);
      const branchName=ordered[0]?.branch||"Main route";
      const type=/rework/i.test(branchName)?"rework":branchName==="Main route"?"main":"alternate";
      for(let index=0;index<ordered.length-1;index++)edge("operation:"+ordered[index].id,"operation:"+ordered[index+1].id,type);
      ordered.filter(operation=>(operation.relationType==="alternate"||operation.relationType==="rework")&&operation.parentId)
        .forEach(operation=>edge("operation:"+operation.parentId,"operation:"+operation.id,operation.relationType==="rework"?"rework":"alternate"));
    }
    routeLinks.forEach(link=>edge("operation:"+link.fromOperationId,"operation:"+link.toOperationId,link.relationshipType));
    const inboundMaterialTransportCount=allocations.filter(row=>row.transportVendorId||row.transportVehicleType||row.transportFrom||row.transportTo||Number(row.transportCost)>0).length;
    allocations.forEach(row=>{
      const context={companyId:row.companyId,poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.anchorOperationId};
      const materialId="material:"+row.id;
      add(materialId,row.materialName||"Material allocation","Material · "+(row.materialGrade||"Grade not set")+" · "+(row.totalWeightKg||0)+" kg","material","inventory",context);
      edge(materialId,"order:"+row.poId,"procured for");
      edge(materialId,"component:"+row.componentId,"allocated to");
      edge(materialId,"vendor:"+row.vendorId,"supplied by");
      const hasInbound=Boolean(row.transportVendorId||row.transportVehicleType||row.transportFrom||row.transportTo||Number(row.transportCost)>0);
      if(hasInbound){
        const transportId="material-transport:"+row.id;
        add(transportId,(row.transportFrom||"Supplier pickup")+" → "+(row.transportTo||"Factory destination"),"Inbound transport · "+(row.transportVehicleType||"Vehicle not set")+" · "+(row.transportStatus||"Planned"),"transport","dispatch",{...context,operationId:row.anchorOperationId});
        edge(materialId,transportId,"transport");
        edge(transportId,"operation:"+row.anchorOperationId,"transport");
        edge(transportId,"vendor:"+row.transportVendorId,"carried by");
      }else edge(materialId,"operation:"+row.anchorOperationId,"feeds operation");
    });
    inspections.forEach(row=>{
      const context={poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.operationId};
      add("quality:"+row.id,row.characteristic,"Inspection · "+row.result+" · "+row.measuredValue+" "+row.unit,"quality","quality",context);
      edge("quality:"+row.id,"operation:"+row.operationId,"inspects");
    });
    legs.forEach(row=>{
      const context={poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.anchorOperationId};
      add("transport:"+row.id,(row.fromLocation||"Origin")+" → "+(row.toLocation||"Destination"),"Dispatch leg · "+(row.status||"Planned")+" · "+row.vehicleType,"transport","dispatch",context);
      edge("operation:"+row.anchorOperationId,"transport:"+row.id,"transport");
      edge("transport:"+row.id,"operation:"+row.targetOperationId,"transport");
      edge("transport:"+row.id,"vendor:"+row.vendorId,"carried by");
      edge("transport:"+row.id,"order:"+row.poId,"serves");
    });
    payments.forEach(row=>{
      add("finance:"+row.id,"₹"+Number(row.amount||0).toLocaleString("en-IN"),"Payment · "+(row.reference||"No reference"),"finance","costing",{poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.operationId});
      edge("finance:"+row.id,"operation:"+row.operationId,"settles");
      edge("finance:"+row.id,"vendor:"+row.vendorId,"paid to");
    });
    contacts.forEach(row=>{
      add("contact:"+row.id,row.name,"Contact · "+row.role,"contact","contact360",row.linkedType==="company"?{companyId:row.linkedId}:{});
      edge("contact:"+row.id,(row.linkedType==="company"?"company:":"vendor:")+row.linkedId,"contact for");
    });
    inventory.forEach(row=>{
      const target=(row.itemType==="material"?"material:":"component:")+row.itemId;
      if(nodes.some(node=>node.id===target))edge(target,"order:"+row.poId,row.transactionType);
    });
    const byId=new Map(nodes.map(node=>[node.id,node]));
    const filteredEdges=edges.filter(item=>byId.has(item.from)&&byId.has(item.to));
    const visibleNodes=getVisibleEcosystemNodes(nodes,visibleKinds,visibleLimits,selectedId);
    const visibleIds=new Set(visibleNodes.map(node=>node.id));
    const visibleEdges=filteredEdges.filter(item=>visibleIds.has(item.from)&&visibleIds.has(item.to));
    const availableCounts:Record<NodeKind,number>={
      company:companies.length,customer:customers.length,factory:factories.length,order:orders.length,component:components.length,
      vendor:vendors.length,process:definitions.length,operation:operations.length,material:allocations.length,
      quality:inspections.length,transport:legs.length+inboundMaterialTransportCount,finance:payments.length,contact:contacts.length
    };
    const totals=GROUPS.map(group=>({...group,count:availableCounts[group.kind]||0,renderedCount:visibleNodes.filter(node=>node.kind===group.kind).length}));
    const totalAvailable=Object.values(availableCounts).reduce((sum,count)=>sum+count,0);
    // Grouped two-column tiles keep all entity groups readable and prevent the
    // old 34%-radius ring from stacking 190px cards on top of one another.
    const positions=layoutManufacturingUniverseNodes(visibleNodes,GROUPS.map(group=>group.kind),{columns:4,innerColumns:2,nodeWidth:190,nodeHeight:92,gapX:26,gapY:34,groupGapX:72,groupGapY:78});
    const visible=visibleNodes.map(node=>({...node,...(positions[node.id]||{x:0,y:0})}));
    const searchResults=searchEcosystemNodes(nodes,searchQuery);
    return {nodes:visible,allNodes:nodes,edges:visibleEdges,totals,totalAvailable,searchResults};
  },[data,visibleKinds,visibleLimits,selectedId,searchQuery]);
  const flowNodes=useMemo<EcosystemFlowNode[]>(()=>{
    const canvasWidth=Math.max(146,...graph.nodes.map(node=>node.x+190));
    const hub:EcosystemHubNode={
      id:"aximach-hub",
      type:"hub",
      position:{x:Math.max(0,canvasWidth/2-73),y:-160},
      data:{label:"AXIMACH",detail:"MANUFACTURING OS"},
      draggable:false,
      selectable:false,
      focusable:false,
      style:{width:146,height:94}
    };
    const entities:EcosystemEntityNode[]=graph.nodes.map(node=>{
      const group=GROUPS.find(item=>item.kind===node.kind)!;
      return {
        id:node.id,
        type:"ecosystem",
        position:graphLayout[node.id]||{x:node.x,y:node.y},
        data:{label:node.label,detail:node.detail,group:group.title,accent:group.color,kind:node.kind},
        draggable:true,
        selectable:false,
        focusable:true,
        style:{width:190}
      };
    });
    // Keep the AXIMACH anchor node but do not draw hub-to-every-record spokes;
    // those synthetic links previously obscured real manufacturing relationships.
    return [hub,...entities];
  },[graph.nodes,graphLayout]);
  const flowEdges=useMemo<Edge[]>(()=>{
    const nodeById=new Map(flowNodes.map(node=>[node.id,node]));
    const center=(id:string)=>{
      const node=nodeById.get(id);
      if(!node)return {x:0,y:0};
      const width=typeof node.style?.width==="number"?node.style.width:190;
      return {x:node.position.x+width/2,y:node.position.y+52};
    };
    const parallelEdgeCounts=new Map<string,number>();
    const relationships:Edge[]=graph.edges.map(link=>{
      const color=edgeColor(link.kind);
      const pairKey=link.from+"::"+link.to;
      const parallelIndex=parallelEdgeCounts.get(pairKey)||0;
      parallelEdgeCounts.set(pairKey,parallelIndex+1);
      const geometry=routeRelationshipEdgeGeometry(link.kind,center(link.from),center(link.to),"organic",parallelIndex);
      const routeType=/^(main|alternate|rework|dependency|parallel|merge|split|follow-on|feedback|conditional|successor|transport)$/.test(link.kind);
      return {
        id:link.id,
        source:link.from,
        target:link.to,
        sourceHandle:geometry.sourceHandle,
        targetHandle:geometry.targetHandle,
        type:geometry.edgeType,
        data:{relationshipType:link.kind,layout:"organic",parallelIndex,pathOptions:geometry.pathOptions},
        label:routeType?link.kind.replaceAll("-"," ").toUpperCase():undefined,
        labelStyle:{fontSize:8,fontWeight:750,fill:"#50677d"},
        labelBgStyle:{fill:"#ffffff",fillOpacity:.92},
        labelBgPadding:[4,2],
        selectable:false,
        focusable:false,
        style:{stroke:color,strokeWidth:routeType?2.4:1.8,opacity:.9,...(/^(alternate|rework|dependency|parallel|split|feedback|conditional)$/.test(link.kind)?{strokeDasharray:"7 4"}:{})},
        markerEnd:{type:MarkerType.ArrowClosed,color}
      };
    });
    return relationships;
  },[flowNodes,graph.edges]);
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const selected=graph.allNodes.find(node=>node.id===selectedId);
  const exportGraph=()=>{
    const escapeXml=(value:string)=>value.replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[char]||char));
    let body="",mime="application/json",extension=exportFormat;
    if(exportFormat==="json"){
      body=JSON.stringify({generatedAt:new Date().toISOString(),nodes:graph.nodes,relationships:graph.edges},null,2);
    }else if(exportFormat==="csv"){
      const quote=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';
      const rows=[["record_type","id","label","entity_type","module","detail","from_id","to_id","relationship"]];
      graph.nodes.forEach(node=>rows.push(["node",node.id,node.label,node.kind,node.moduleId,node.detail,"","",""]));
      graph.edges.forEach(edge=>rows.push(["relationship",edge.id,"","", "", "",edge.from,edge.to,edge.kind]));
      body=rows.map(row=>row.map(quote).join(",")).join("\r\n");
      mime="text/csv;charset=utf-8";
    }else{
      // Standalone SVG: resolve Theme Studio colours before download, not CSS var()
      // references, and render explicit visible strokes for all saved relationships.
      const fallbackPalette=["#2875bd","#168d89","#b17a27","#8b68c5","#b95665","#397ea4","#7565b5"];
      const groupColor=(kind:string)=>{
        const groupIndex=GROUPS.findIndex(group=>group.kind===kind);
        const paletteIndex=(groupIndex<0?0:groupIndex)%fallbackPalette.length+1;
        const cssColor=typeof window!=="undefined"
          ? window.getComputedStyle(document.documentElement).getPropertyValue("--ax-theme-graph-"+paletteIndex).trim()
          : "";
        return /^#[0-9a-f]{6}$/i.test(cssColor)?cssColor:fallbackPalette[paletteIndex-1];
      };
      const point=(node:GraphNode)=>({x:650+(node.x-50)*13,y:560+(node.y-50)*13});
      const nodes=graph.nodes.map(node=>{
        const p=point(node),color=groupColor(node.kind);
        const groupName=GROUPS.find(group=>group.kind===node.kind)?.title||node.kind;
        return '<g><rect x="'+(p.x-92)+'" y="'+(p.y-35)+'" width="184" height="70" rx="9" fill="#ffffff" stroke="'+color+'" stroke-width="2"/><rect x="'+(p.x-92)+'" y="'+(p.y-35)+'" width="5" height="70" rx="2" fill="'+color+'"/><text x="'+(p.x-78)+'" y="'+(p.y-7)+'" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#17334d">'+escapeXml(node.label.slice(0,27))+'</text><text x="'+(p.x-78)+'" y="'+(p.y+15)+'" font-family="Arial,sans-serif" font-size="10" fill="#4b6278">'+escapeXml(groupName+" · "+node.detail.slice(0,32))+'</text></g>';
      }).join("");
      const lines=graph.edges.map(edge=>{
        const from=graph.nodes.find(node=>node.id===edge.from),to=graph.nodes.find(node=>node.id===edge.to);
        if(!from||!to)return "";
        const a=point(from),b=point(to),color=groupColor(from.kind);
        return '<path d="M'+a.x+' '+a.y+' L'+b.x+' '+b.y+'" fill="none" stroke="'+color+'" stroke-width="2.2" opacity=".78" marker-end="url(#ax-arrow)"/>';
      }).join("");
      body='<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1120"><defs><marker id="ax-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#52708a"/></marker></defs><rect width="1300" height="1120" fill="#f1f6fb"/>'+lines+nodes+'<circle cx="650" cy="560" r="62" fill="#e5f2fb" stroke="#2875bd" stroke-width="3"/><text x="650" y="556" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="18" fill="#17618f">AXIMACH</text><text x="650" y="580" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#436781">MANUFACTURING OS</text></svg>';
      mime="image/svg+xml;charset=utf-8";
    }
    const blob=new Blob([body],{type:mime}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download="aximach-manufacturing-ecosystem."+extension;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1200);
  };
  return <section className="ax-ecosystem-graph" aria-label="Live manufacturing ecosystem graph">
    <header className="ax-ecosystem-graph-head">
      <div><span className="eyebrow">CROSS-MODULE RELATIONSHIP MAP</span><h3>Connected manufacturing ecosystem</h3><p>Live links are derived from saved company, PO, component, vendor, process, material, quality, dispatch and payment records. Missing references are not fabricated.</p></div>
      <div className="ax-ecosystem-graph-count"><Network size={15}/><strong>{graph.nodes.length}</strong><small>nodes shown</small><span>{graph.totalAvailable} saved records in these groups</span></div><div className="ax-ecosystem-export"><select aria-label="Ecosystem export format" value={exportFormat} onChange={event=>setExportFormat(event.target.value as typeof exportFormat)}><option value="svg">SVG</option><option value="csv">CSV</option><option value="json">JSON</option></select><button type="button" onClick={exportGraph}><FileDown size={13}/> Export graph</button></div>
    </header>
    <div className="ax-ecosystem-filters" aria-label="Show or hide entity groups">
      {graph.totals.map(group=><button type="button" key={group.kind} aria-pressed={visibleKinds.includes(group.kind)} onClick={()=>setGraphPreferences(current=>({...current,visibleKinds:current.visibleKinds.includes(group.kind)?current.visibleKinds.filter(kind=>kind!==group.kind):[...current.visibleKinds,group.kind]}))}><i style={{background:group.color}}/><span>{group.title}</span><b>{group.count}</b></button>)}
    </div>
    <div className="ax-ecosystem-search" role="search">
      <label>
        <Search size={15} aria-hidden="true"/>
        <input
          type="search"
          aria-label="Search all manufacturing ecosystem records"
          placeholder="Search all saved companies, orders, components, operations, vendors..."
          value={searchQuery}
          onChange={event=>{setSearchQuery(event.target.value);setSearchResultLimit(10);}}
        />
        {searchQuery&&<button type="button" aria-label="Clear graph search" onClick={()=>{setSearchQuery("");setSearchResultLimit(10);}}><X size={14}/></button>}
      </label>
      <span>{searchQuery.trim()?graph.searchResults.length+" matching saved records":"Search includes records outside the current graph sample"}</span>
    </div>
    {searchQuery.trim()&&<section className="ax-ecosystem-search-results" aria-label="All matching saved records">
      <header><strong>Search results</strong><span>{graph.searchResults.length} matches across all saved graph records</span></header>
      {graph.searchResults.length===0
        ? <p>No matching saved records. Check the spelling or search by an ID, name, status or detail.</p>
        : <>
          <div className="ax-ecosystem-search-result-list">
            {graph.searchResults.slice(0,searchResultLimit).map(node=>{
              const group=GROUPS.find(item=>item.kind===node.kind)!;
              return <button type="button" key={node.id} className={selectedId===node.id?"is-selected":""} onClick={()=>{
                setGraphPreferences(current=>({...current,visibleKinds:current.visibleKinds.includes(node.kind)?current.visibleKinds:[...current.visibleKinds,node.kind]}));
                setSelectedId(node.id);
              }}>
                <i style={{background:group.color}}/>
                <span><strong>{node.label}</strong><small>{group.title} · {node.detail}</small></span>
                <b>{selectedId===node.id?"Selected":"Select"}</b>
              </button>;
            })}
          </div>
          {graph.searchResults.length>searchResultLimit&&<button type="button" className="ax-ecosystem-search-more" onClick={()=>setSearchResultLimit(current=>Math.min(graph.searchResults.length,current+10))}>Show next {Math.min(10,graph.searchResults.length-searchResultLimit)} results</button>}
        </>}
    </section>}
    <div className="ax-ecosystem-expand-groups" aria-label="Progressively expand visible graph groups">
      <button type="button" className="ax-ecosystem-reset-view" onClick={resetGraphPreferences}>Reset graph view</button>
      {graph.totals.filter(group=>visibleKinds.includes(group.kind)&&group.count>group.renderedCount).map(group=><button type="button" key={group.kind} onClick={()=>setGraphPreferences(current=>({...current,visibleLimits:{...current.visibleLimits,[group.kind]:expandEcosystemGroupLimit(current.visibleLimits[group.kind]??INITIAL_VISIBLE_LIMITS[group.kind],group.count,4)}}))}>
        <span>Show more {group.title}</span><b>{group.renderedCount} / {group.count}</b>
      </button>)}
    </div>
    <div className="ax-ecosystem-connect-tools"><label>New operation connection<select aria-label="New operation connection type" value={relationshipType} onChange={event=>setRelationshipType(event.target.value)}>{["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"].map(kind=><option key={kind} value={kind}>{kind}</option>)}</select></label><small>Drag from one operation node handle to another. Other entity types remain read-only.</small></div>
    <div className="ax-ecosystem-edge-legend" aria-label="Relationship line colour legend">{EDGE_LEGEND.map(item=><span key={item.label}><i style={{background:item.color}}/>{item.label}</span>)}</div>
    <RouteConnectorLegend compact/>
    <div className="ax-ecosystem-flow-canvas" data-testid="ecosystem-flow-canvas" aria-label="Interactive manufacturing relationship canvas">
      <ManufacturingGraphCanvas
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={ECOSYSTEM_FLOW_NODE_TYPES}
        fitView
        fitViewOptions={{padding:.12,minZoom:.12,maxZoom:1.25}}
        minZoom={.1}
        maxZoom={1.8}
        nodesDraggable
        onNodesChange={handleGraphNodesChange}
        onNodeDragStop={persistGraphNodePosition}
        nodesFocusable
        onNodeClick={(_,node)=>{if(node.type==="ecosystem")setSelectedId(current=>current===node.id?"":node.id);}}
        onPaneClick={()=>setSelectedId("")}
        minimapNodeColor={node=>node.type==="ecosystem"?node.data.accent:"#8fc4e5"}
        className="ax-ecosystem-flow-layer"
        ariaLabel="Interactive manufacturing relationship canvas"
      />
    </div>
    <div className="ax-ecosystem-graph-foot"><span><i/> Solid lines show saved manufacturing relationships. All saved records in visible groups are included.</span>{selected&&<div className="ax-ecosystem-selected"><div><strong>{selected.label}</strong><small>{selected.detail}</small></div><button type="button" onClick={()=>onNavigate(selected.moduleId,selected.context)}>Open source record <Activity size={13}/></button></div>}</div>
    <p className="ax-ecosystem-help">Select a graph node or a search result to inspect it, then open its source record. Search covers every saved record in the graph model, including records outside the visible canvas sample. Drag entity nodes to arrange the canvas; their positions are saved on this device.</p><p className="ax-ecosystem-sample-note">All records in visible groups are shown by default. Hide entity groups to simplify the canvas; search still covers every saved record. Use Reset graph view to restore the automatic layout. Display controls never change source manufacturing data.</p>
  </section>;
}
