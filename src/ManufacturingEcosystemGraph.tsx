import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, FileDown, Network, Search, X } from "lucide-react";
import { activeRows, type ManufacturingData } from "./manufacturingData";
import { expandEcosystemGroupLimit, getVisibleEcosystemNodes, loadEcosystemGraphPreferences, searchEcosystemNodes, type EcosystemGraphPreferences } from "./manufacturingEcosystemGraphModel.mjs";

type Context = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string };
type Props = { data:ManufacturingData; onNavigate:(moduleId:string,context?:Context)=>void };
type NodeKind = "company"|"customer"|"factory"|"order"|"component"|"vendor"|"process"|"operation"|"material"|"quality"|"transport"|"finance"|"contact";
type GraphNode = { id:string; label:string; detail:string; kind:NodeKind; moduleId:string; context:Context; x:number; y:number };
type GraphEdge = { id:string; from:string; to:string; kind:string };

const EDGE_LEGEND = [
  {label:"Structure",color:"#2875bd"},
  {label:"Production",color:"#168d89"},
  {label:"Supply",color:"#b17a27"},
  {label:"Material flow",color:"#8b68c5"},
  {label:"Quality",color:"#b95665"},
  {label:"Logistics",color:"#397ea4"},
  {label:"Finance",color:"#7565b5"}
];

const edgeColor = (kind:string) => {
  if (/owns|belongs to|contact for/.test(kind)) return "#2875bd";
  if (/orders|placed by|makes|performed by|defined by/.test(kind)) return "#168d89";
  if (/capable vendor|supplied by|procured for|allocated to/.test(kind)) return "#b17a27";
  if (/feeds operation/.test(kind)) return "#8b68c5";
  if (/inspects/.test(kind)) return "#b95665";
  if (/moves between|carried by/.test(kind)) return "#397ea4";
  if (/serves|settles|paid to/.test(kind)) return "#7565b5";
  return "#7ba5c1";
};

const GROUPS: Array<{kind:NodeKind;title:string;moduleId:string;color:string}> = [
  {kind:"company",title:"Companies",moduleId:"companies",color:"#2875bd"},
  {kind:"customer",title:"Customers",moduleId:"customers",color:"#2f9b82"},
  {kind:"factory",title:"Factories",moduleId:"companies",color:"#4b8cbd"},
  {kind:"order",title:"Purchase orders",moduleId:"purchasing",color:"#8b68c5"},
  {kind:"component",title:"Components",moduleId:"components",color:"#168d89"},
  {kind:"vendor",title:"Vendors",moduleId:"vendors",color:"#c07a2b"},
  {kind:"process",title:"Process definitions",moduleId:"process-master",color:"#5b83cf"},
  {kind:"operation",title:"Operations",moduleId:"production",color:"#1a9b68"},
  {kind:"material",title:"Materials & allocations",moduleId:"inventory",color:"#b18a2d"},
  {kind:"quality",title:"Quality inspections",moduleId:"quality",color:"#b95665"},
  {kind:"transport",title:"Transport & dispatch",moduleId:"dispatch",color:"#397ea4"},
  {kind:"finance",title:"Payments",moduleId:"costing",color:"#8b69aa"},
  {kind:"contact",title:"Contacts",moduleId:"contact360",color:"#648b91"}
];

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
        version:1,
        visibleKinds:graphPreferences.visibleKinds,
        visibleLimits:graphPreferences.visibleLimits
      }));
    } catch { /* Persisted view preferences are optional when storage is unavailable. */ }
  },[graphPreferences]);
  const resetGraphPreferences=()=>setGraphPreferences({
    version:1,
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
      company:companies.length,factory:factories.length,order:orders.length,component:components.length,
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
    <div className="ax-ecosystem-stage">
      <svg className="ax-ecosystem-links" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="ax-ecosystem-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6489a5"/></marker></defs>
        {graph.edges.map(link=>{const from=byId.get(link.from),to=byId.get(link.to);if(!from||!to)return null;return <line key={link.id} className="ax-ecosystem-edge" x1={from.x*10} y1={from.y*7} x2={to.x*10} y2={to.y*7} style={{stroke:edgeColor(link.kind)}} markerEnd="url(#ax-ecosystem-arrow)" />;})}
        {graph.nodes.map(node=><line key={"hub:"+node.id} className="ax-ecosystem-hub-link" x1="500" y1="350" x2={node.x*10} y2={node.y*7}/> )}
      </svg>
      <div className="ax-ecosystem-hub"><Network size={23}/><strong>AXIMACH</strong><small>MANUFACTURING OS</small></div>
      {graph.nodes.map(node=>{const group=GROUPS.find(item=>item.kind===node.kind)!;return <button type="button" key={node.id} className={"ax-ecosystem-node kind-"+node.kind+(selectedId===node.id?" is-selected":"")} style={{left:node.x+"%",top:node.y+"%", "--node-accent":group.color} as CSSProperties} onClick={()=>setSelectedId(current=>current===node.id?"":node.id)} title={node.detail}><span>{node.label}</span><small>{group.title.replace(" & allocations","")}</small></button>;})}
    </div>
    <div className="ax-ecosystem-graph-foot"><span><i/> Solid lines represent saved ID relationships · dashed hub lines indicate membership in the live graph</span>{selected&&<div className="ax-ecosystem-selected"><div><strong>{selected.label}</strong><small>{selected.detail}</small></div><button type="button" onClick={()=>onNavigate(selected.moduleId,selected.context)}>Open source record <Activity size={13}/></button></div>}</div>
    <p className="ax-ecosystem-help">Select a graph node or a search result to inspect it, then open its source record. Search covers every saved record in the graph model, including records outside the visible canvas sample.</p><p className="ax-ecosystem-sample-note">Use “Show more” to progressively add records to each visible group. Search results can select records beyond the current canvas limit. Display controls never change source manufacturing data.</p>
  </section>;
}
