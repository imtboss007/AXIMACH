import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, FileDown, Network, Search, X } from "lucide-react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from "@xyflow/react";
import type { Edge, Node, NodeProps, NodeTypes } from "@xyflow/react";
import "@xyflow/react/style.css";
import { activeRows, type ManufacturingData } from "./manufacturingData";
import { expandEcosystemGroupLimit, getVisibleEcosystemNodes, loadEcosystemGraphPreferences, searchEcosystemNodes, type EcosystemGraphPreferences } from "./manufacturingEcosystemGraphModel.mjs";

type Context = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string };
type Props = { data:ManufacturingData; onNavigate:(moduleId:string,context?:Context)=>void };
type NodeKind = "company"|"customer"|"factory"|"order"|"component"|"vendor"|"process"|"operation"|"material"|"quality"|"transport"|"finance"|"contact";
type GraphNode = { id:string; label:string; detail:string; kind:NodeKind; moduleId:string; context:Context; x:number; y:number };
type GraphEdge = { id:string; from:string; to:string; kind:string };
type EcosystemEntityNodeData = { label:string; detail:string; group:string; accent:string };
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
  if (/owns|belongs to|contact for/.test(kind)) return "var(--ax-theme-graph-1,#2875bd)";
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
  return <div className="ax-ecosystem-flow-node" style={{"--node-accent":data.accent} as CSSProperties}>
    <Handle type="target" position={Position.Top} isConnectable={false}/>
    <span>{data.group}</span>
    <strong title={data.label}>{data.label}</strong>
    <small title={data.detail}>{data.detail}</small>
    <Handle type="source" position={Position.Bottom} isConnectable={false}/>
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

const INITIAL_VISIBLE_LIMITS = Object.fromEntries(
  GROUPS.map(group => [group.kind, group.kind === "operation" ? 8 : 6])
) as Record<NodeKind, number>;

const GRAPH_PREFERENCES_KEY = "aximach.manufacturing-ecosystem-graph.preferences.v1";
const VALID_GROUP_KINDS = GROUPS.map(group => group.kind);

export default function ManufacturingEcosystemGraph({data,onNavigate}:Props) {
  const [graphPreferences,setGraphPreferences]=useState<EcosystemGraphPreferences<NodeKind>>(() => {
    try {
      return loadEcosystemGraphPreferences(
        typeof window === "undefined" ? null : window.localStorage.getItem(GRAPH_PREFERENCES_KEY),
        VALID_GROUP_KINDS,
        INITIAL_VISIBLE_LIMITS
      );
    } catch {
      return loadEcosystemGraphPreferences(null,VALID_GROUP_KINDS,INITIAL_VISIBLE_LIMITS);
    }
  });
  const visibleKinds=graphPreferences.visibleKinds;
  const visibleLimits=graphPreferences.visibleLimits;
  const [selectedId,setSelectedId]=useState("");
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResultLimit,setSearchResultLimit]=useState(10);
  const [exportFormat,setExportFormat]=useState<"svg"|"csv"|"json">("svg");
  useEffect(()=>{
    try {
      window.localStorage.setItem(GRAPH_PREFERENCES_KEY,JSON.stringify({
        version:2,
        visibleKinds:graphPreferences.visibleKinds,
        visibleLimits:graphPreferences.visibleLimits
      }));
    } catch { /* Persisted view preferences are optional when storage is unavailable. */ }
  },[graphPreferences]);
  const resetGraphPreferences=()=>setGraphPreferences({
    version:2,
    visibleKinds:[...VALID_GROUP_KINDS],
    visibleLimits:{...INITIAL_VISIBLE_LIMITS}
  });
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
    const nodeIds=new Set<string>();
    const edge=(from:string,to:string,kind:string)=>{if(from&&to&&from!==to)edges.push({id:from+"|"+to+"|"+kind,from,to,kind});};
    companies.forEach(row=>{add("company:"+row.id,row.name,"Company · "+(row.gstin||"GSTIN not recorded"),"company","companies",{companyId:row.id});nodeIds.add(row.id);});
    customers.forEach(row=>add("customer:"+row.id,row.displayName||row.legalName,"Customer · "+row.customerCode+" · "+row.status,"customer","customers"));
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
    allocations.forEach(row=>{
      const context={companyId:row.companyId,poId:row.poId,poLineId:row.poLineId,componentId:row.componentId};
      add("material:"+row.id,row.materialName||"Material allocation","Material · "+(row.materialGrade||"Grade not set")+" · "+(row.totalWeightKg||0)+" kg","material","inventory",context);
      edge("material:"+row.id,"order:"+row.poId,"procured for");
      edge("material:"+row.id,"component:"+row.componentId,"allocated to");
      edge("material:"+row.id,"vendor:"+row.vendorId,"supplied by");
      edge("material:"+row.id,"operation:"+row.anchorOperationId,"feeds operation");
    });
    inspections.forEach(row=>{
      const context={poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.operationId};
      add("quality:"+row.id,row.characteristic,"Inspection · "+row.result+" · "+row.measuredValue+" "+row.unit,"quality","quality",context);
      edge("quality:"+row.id,"operation:"+row.operationId,"inspects");
    });
    legs.forEach(row=>{
      const context={poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.anchorOperationId};
      add("transport:"+row.id,(row.fromLocation||"Origin")+" → "+(row.toLocation||"Destination"),"Dispatch leg · "+(row.status||"Planned")+" · "+row.vehicleType,"transport","dispatch",context);
      edge("transport:"+row.id,"operation:"+row.anchorOperationId,"moves between");
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
    inventory.slice(0,8).forEach(row=>{
      const target=(row.itemType==="material"?"material:":"component:")+row.itemId;
      if(nodeIds.has(row.itemId)||nodes.some(node=>node.id===target))edge(target,"order:"+row.poId,row.transactionType);
    });
    const byId=new Map(nodes.map(node=>[node.id,node]));
    const filteredEdges=edges.filter(item=>byId.has(item.from)&&byId.has(item.to));
    const visibleNodes=getVisibleEcosystemNodes(nodes,visibleKinds,visibleLimits,selectedId);
    const visibleIds=new Set(visibleNodes.map(node=>node.id));
    const visibleEdges=filteredEdges.filter(item=>visibleIds.has(item.from)&&visibleIds.has(item.to));
    const groupIndex=new Map(GROUPS.map((group,index)=>[group.kind,index]));
    const availableCounts:Record<NodeKind,number>={
      company:companies.length,customer:customers.length,factory:factories.length,order:orders.length,component:components.length,
      vendor:vendors.length,process:definitions.length,operation:operations.length,material:allocations.length,
      quality:inspections.length,transport:legs.length,finance:payments.length,contact:contacts.length
    };
    const totals=GROUPS.map(group=>({...group,count:availableCounts[group.kind]||0,renderedCount:visibleNodes.filter(node=>node.kind===group.kind).length}));
    const totalAvailable=Object.values(availableCounts).reduce((sum,count)=>sum+count,0);
    const visible=visibleNodes.map(node=>{
      const index=groupIndex.get(node.kind)||0;
      const same=visibleNodes.filter(item=>item.kind===node.kind);
      const local=same.findIndex(item=>item.id===node.id);
      const angle=(index/GROUPS.length)*Math.PI*2+(local-(same.length-1)/2)*.16-Math.PI/2;
      const radius=34+(local%2)*5;
      return {...node,x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius};
    });
    const searchResults=searchEcosystemNodes(nodes,searchQuery);
    return {nodes:visible,allNodes:nodes,edges:visibleEdges,totals,totalAvailable,searchResults};
  },[data,visibleKinds,visibleLimits,selectedId,searchQuery]);
  const flowNodes=useMemo<EcosystemFlowNode[]>(()=>{
    const hub:EcosystemHubNode={
      id:"aximach-hub",
      type:"hub",
      position:{x:0,y:0},
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
        position:{x:(node.x-50)*16,y:(node.y-50)*12},
        data:{label:node.label,detail:node.detail,group:group.title,accent:group.color},
        draggable:false,
        selectable:false,
        focusable:true,
        style:{width:190}
      };
    });
    return [hub,...entities];
  },[graph.nodes]);
  const flowEdges=useMemo<Edge[]>(()=>{
    const membership:Edge[]=graph.nodes.map(node=>({
      id:"hub:"+node.id,
      source:"aximach-hub",
      target:node.id,
      type:"straight",
      selectable:false,
      focusable:false,
      style:{stroke:"#9dbbd0",strokeWidth:1.15,strokeDasharray:"4 7",opacity:.58}
    }));
    const relationships:Edge[]=graph.edges.map(link=>{
      const color=edgeColor(link.kind);
      return {
        id:link.id,
        source:link.from,
        target:link.to,
        type:"smoothstep",
        selectable:false,
        focusable:false,
        style:{stroke:color,strokeWidth:1.8,opacity:.86},
        markerEnd:{type:MarkerType.ArrowClosed,color}
      };
    });
    return [...membership,...relationships];
  },[graph.nodes,graph.edges]);
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
      const lines=graph.edges.map(edge=>{const from=graph.nodes.find(node=>node.id===edge.from),to=graph.nodes.find(node=>node.id===edge.to);return from&&to?'<line x1="'+(from.x*10)+'" y1="'+(from.y*7)+'" x2="'+(to.x*10)+'" y2="'+(to.y*7)+'"/>':"";}).join("");
      const nodes=graph.nodes.map(node=>'<g><rect x="'+(node.x*10-72)+'" y="'+(node.y*7-20)+'" width="144" height="40" rx="7" fill="#fff" stroke="'+(GROUPS.find(group=>group.kind===node.kind)?.color||"#789")+'"/><text x="'+(node.x*10)+'" y="'+(node.y*7+4)+'" text-anchor="middle" font-family="Arial" font-size="12" fill="#24445f">'+escapeXml(node.label.slice(0,24))+'</text></g>').join("");
      body='<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#edf4fb"/>'+lines+nodes+'<circle cx="500" cy="350" r="54" fill="#cce7f7" stroke="#2875bd"/><text x="500" y="354" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="17" fill="#17618f">AXIMACH</text></svg>';
      mime="image/svg+xml;charset=utf-8";
    }
    const blob=new Blob([body],{type:mime}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download="aximach-manufacturing-ecosystem."+extension;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
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
    <div className="ax-ecosystem-edge-legend" aria-label="Relationship line colour legend">{EDGE_LEGEND.map(item=><span key={item.label}><i style={{background:item.color}}/>{item.label}</span>)}</div>
    <div className="ax-ecosystem-flow-canvas" data-testid="ecosystem-flow-canvas" aria-label="Interactive manufacturing relationship canvas">
      <ReactFlow<EcosystemFlowNode,Edge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={ECOSYSTEM_FLOW_NODE_TYPES}
        fitView
        fitViewOptions={{padding:0.22,minZoom:0.18,maxZoom:1.15}}
        minZoom={0.18}
        maxZoom={1.8}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable
        edgesFocusable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        onNodeClick={(_,node)=>{if(node.type==="ecosystem")setSelectedId(current=>current===node.id?"":node.id);}}
        onPaneClick={()=>setSelectedId("")}
        proOptions={{hideAttribution:false}}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#b5c9da"/>
        <Controls showInteractive={false}/>
        <MiniMap<EcosystemFlowNode> pannable zoomable nodeColor={(node:EcosystemFlowNode):string=>node.type==="ecosystem"?node.data.accent:"#8fc4e5"}/>
      </ReactFlow>
    </div>
    <div className="ax-ecosystem-graph-foot"><span><i/> Solid lines represent saved ID relationships · dashed hub lines indicate membership in the live graph</span>{selected&&<div className="ax-ecosystem-selected"><div><strong>{selected.label}</strong><small>{selected.detail}</small></div><button type="button" onClick={()=>onNavigate(selected.moduleId,selected.context)}>Open source record <Activity size={13}/></button></div>}</div>
    <p className="ax-ecosystem-help">Select a graph node or a search result to inspect it, then open its source record. Search covers every saved record in the graph model, including records outside the visible canvas sample.</p><p className="ax-ecosystem-sample-note">Use “Show more” to progressively add records to each visible group. Search results can select records beyond the current canvas limit. Display controls never change source manufacturing data.</p>
  </section>;
}
