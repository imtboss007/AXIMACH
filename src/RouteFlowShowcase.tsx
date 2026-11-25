import { useId, useState } from "react";

type LinkKind = "main"|"alternate"|"rework"|"dependency"|"parallel"|"merge"|"split"|"follow-on"|"feedback"|"conditional"|"successor"|"material"|"transport";
type NodeKind = "material"|"process"|"quality"|"decision"|"transport"|"delivery";
type DemoNode = {id:string;label:string;x:number;y:number;kind?:NodeKind};
type DemoEdge = {from:string;to:string;kind:LinkKind;label?:string;path?:"curve"|"elbow"|"loop"};
type FlowExample = {id:string;title:string;category:string;description:string;nodes:DemoNode[];edges:DemoEdge[];lanes?:string[]};

const edgePalette:Record<LinkKind,{color:string;dash?:string;description:string}> = {
  main:{color:"#12a9a7",description:"Primary route"},
  alternate:{color:"#d49a25",dash:"9 5",description:"Alternative path"},
  rework:{color:"#d6535b",dash:"7 5",description:"Corrective return"},
  dependency:{color:"#367fd2",dash:"2 5",description:"Prerequisite link"},
  parallel:{color:"#9655ca",dash:"8 3",description:"Simultaneous work"},
  merge:{color:"#9b62be",description:"Converging routes"},
  split:{color:"#347dd5",dash:"5 3",description:"Diverging routes"},
  "follow-on":{color:"#31577e",description:"Follow-on activity"},
  feedback:{color:"#6064cf",dash:"3 4",description:"Feedback loop"},
  conditional:{color:"#a34ac1",dash:"10 4 2 4",description:"Decision-dependent"},
  successor:{color:"#398b62",description:"Successor operation"},
  material:{color:"#0d9f98",dash:"4 3",description:"Material movement"},
  transport:{color:"#2987c4",dash:"8 4",description:"Transport movement"}
};

const patterns:FlowExample[] = [
  {id:"end-to-end",title:"Complete manufacturing route",category:"End-to-end example",description:"Raw material, incoming inspection, CNC turning, parallel hardening and grinding, CMM inspection, rework feedback and dispatch transport in one connected example.",nodes:[
    {id:"raw",label:"Raw material",x:65,y:112,kind:"material"},{id:"iqc",label:"Incoming QC",x:170,y:112,kind:"quality"},{id:"turn",label:"CNC turning",x:278,y:112},{id:"heat",label:"Vacuum hardening",x:385,y:55},{id:"grind",label:"Cylindrical grinding",x:385,y:169},{id:"cmm",label:"CMM inspection",x:492,y:112,kind:"quality"},{id:"dispatch",label:"Dispatch",x:598,y:112,kind:"transport"}],
    edges:[{from:"raw",to:"iqc",kind:"material"},{from:"iqc",to:"turn",kind:"main"},{from:"turn",to:"heat",kind:"split"},{from:"turn",to:"grind",kind:"split"},{from:"heat",to:"cmm",kind:"parallel"},{from:"grind",to:"cmm",kind:"parallel"},{from:"cmm",to:"dispatch",kind:"transport"},{from:"cmm",to:"grind",kind:"feedback",path:"loop"}]},
  {id:"main",title:"Main sequential route",category:"Core relationship",description:"A single primary process path with an unambiguous operation order.",nodes:[{id:"a",label:"Cut blank",x:90,y:112},{id:"b",label:"Turning",x:300,y:112},{id:"c",label:"Milling",x:520,y:112}],edges:[{from:"a",to:"b",kind:"main"},{from:"b",to:"c",kind:"main"}]},
  {id:"alternate",title:"Alternate route",category:"Branching",description:"A qualified alternative operation or supplier route that rejoins the main manufacturing path.",nodes:[{id:"a",label:"CNC turning",x:80,y:112},{id:"b",label:"Internal grind",x:300,y:55},{id:"c",label:"External grind",x:300,y:169},{id:"d",label:"Finish inspect",x:535,y:112,kind:"quality"}],edges:[{from:"a",to:"b",kind:"main"},{from:"a",to:"c",kind:"alternate"},{from:"b",to:"d",kind:"main"},{from:"c",to:"d",kind:"alternate"}]},
  {id:"rework",title:"Rework / return loop",category:"Corrective route",description:"A failed inspection returns the component to a corrective process before another inspection.",nodes:[{id:"a",label:"Grinding",x:90,y:112},{id:"b",label:"Inspection",x:320,y:112,kind:"quality"},{id:"c",label:"Rework required",x:545,y:112,kind:"decision"}],edges:[{from:"a",to:"b",kind:"main"},{from:"b",to:"c",kind:"conditional"},{from:"c",to:"a",kind:"rework",path:"loop"}]},
  {id:"parallel",title:"Parallel processing",category:"Multi-workcell",description:"Two operations run independently or concurrently and both must complete before the next stage.",nodes:[{id:"a",label:"Release batch",x:75,y:112},{id:"b",label:"Heat treatment",x:295,y:55},{id:"c",label:"Grinding",x:295,y:169},{id:"d",label:"CMM inspection",x:535,y:112,kind:"quality"}],edges:[{from:"a",to:"b",kind:"parallel"},{from:"a",to:"c",kind:"parallel"},{from:"b",to:"d",kind:"merge"},{from:"c",to:"d",kind:"merge"}]},
  {id:"split",title:"Split / diverging route",category:"Branching",description:"One upstream operation sends work to multiple process branches, components or workcells.",nodes:[{id:"a",label:"Blank prep",x:90,y:112},{id:"b",label:"CNC machining",x:310,y:55},{id:"c",label:"Wire EDM",x:310,y:169},{id:"d",label:"Sub-assembly",x:535,y:112}],edges:[{from:"a",to:"b",kind:"split"},{from:"a",to:"c",kind:"split"},{from:"b",to:"d",kind:"follow-on"},{from:"c",to:"d",kind:"follow-on"}]},
  {id:"merge",title:"Merge / converging route",category:"Branching",description:"Separate completed routes converge into one assembly, inspection or finishing stage.",nodes:[{id:"a",label:"Turned part",x:90,y:55},{id:"b",label:"Housing prep",x:90,y:169},{id:"c",label:"Assembly",x:330,y:112},{id:"d",label:"Final QC",x:540,y:112,kind:"quality"}],edges:[{from:"a",to:"c",kind:"merge"},{from:"b",to:"c",kind:"merge"},{from:"c",to:"d",kind:"main"}]},
  {id:"conditional",title:"Conditional / decision route",category:"Decision logic",description:"The next step depends on a quality result, tolerance, material condition or approval rule.",nodes:[{id:"a",label:"Measure feature",x:95,y:112,kind:"quality"},{id:"b",label:"Within tolerance?",x:325,y:112,kind:"decision"},{id:"c",label:"Release",x:550,y:55,kind:"delivery"},{id:"d",label:"Correct / rework",x:550,y:169}],edges:[{from:"a",to:"b",kind:"dependency"},{from:"b",to:"c",kind:"conditional",label:"PASS"},{from:"b",to:"d",kind:"conditional",label:"FAIL"}]},
  {id:"dependency",title:"Dependency / prerequisite",category:"Execution control",description:"A downstream process is gated by a prerequisite such as material approval, fixture readiness or first-off approval.",nodes:[{id:"a",label:"Material approval",x:110,y:55,kind:"material"},{id:"b",label:"Fixture ready",x:110,y:169},{id:"c",label:"Production start",x:365,y:112},{id:"d",label:"In-process QC",x:555,y:112,kind:"quality"}],edges:[{from:"a",to:"c",kind:"dependency"},{from:"b",to:"c",kind:"dependency"},{from:"c",to:"d",kind:"main"}]},
  {id:"follow-on",title:"Follow-on operation chain",category:"Sequential control",description:"Explicit follow-on activities after the main process, such as deburr, wash, marking and packing.",nodes:[{id:"a",label:"Machining",x:75,y:112},{id:"b",label:"Deburr",x:255,y:112},{id:"c",label:"Wash",x:430,y:112},{id:"d",label:"Pack",x:590,y:112,kind:"delivery"}],edges:[{from:"a",to:"b",kind:"follow-on"},{from:"b",to:"c",kind:"follow-on"},{from:"c",to:"d",kind:"successor"}]},
  {id:"feedback",title:"Quality feedback route",category:"Quality control",description:"Inspection feedback returns to an upstream process to correct offsets, parameters, tooling or process capability.",nodes:[{id:"a",label:"CNC process",x:95,y:112},{id:"b",label:"CMM report",x:325,y:112,kind:"quality"},{id:"c",label:"Offset correction",x:555,y:112,kind:"decision"}],edges:[{from:"a",to:"b",kind:"main"},{from:"b",to:"c",kind:"feedback"},{from:"c",to:"a",kind:"feedback",path:"loop"}]},
  {id:"successor",title:"Successor / next operation",category:"Execution control",description:"Explicit predecessor-to-successor relationship used to sequence dependent operation records.",nodes:[{id:"a",label:"OP-010 · Turning",x:100,y:112},{id:"b",label:"OP-020 · Grinding",x:320,y:112},{id:"c",label:"OP-030 · Inspection",x:545,y:112,kind:"quality"}],edges:[{from:"a",to:"b",kind:"successor"},{from:"b",to:"c",kind:"successor"}]},
  {id:"material",title:"Material allocation & movement",category:"Supply flow",description:"Material source, incoming receipt, allocation to the PO component and feed into the first manufacturing operation.",nodes:[{id:"a",label:"Supplier stock",x:75,y:112,kind:"material"},{id:"b",label:"Inbound receipt",x:260,y:112,kind:"transport"},{id:"c",label:"PO allocation",x:445,y:112,kind:"material"},{id:"d",label:"First operation",x:595,y:112}],edges:[{from:"a",to:"b",kind:"transport"},{from:"b",to:"c",kind:"material"},{from:"c",to:"d",kind:"material"}]},
  {id:"transport",title:"Inter-vendor transport route",category:"Logistics flow",description:"Dispatch, vehicle movement, receiving supplier and return transport between manufacturing locations.",nodes:[{id:"a",label:"ASTER CNC",x:80,y:112},{id:"b",label:"Pickup / dispatch",x:265,y:112,kind:"transport"},{id:"c",label:"Heat treatment",x:445,y:112},{id:"d",label:"Return delivery",x:600,y:112,kind:"transport"}],edges:[{from:"a",to:"b",kind:"transport"},{from:"b",to:"c",kind:"transport"},{from:"c",to:"d",kind:"transport"}]}
];

type LayoutExample = {id:string;title:string;description:string;nodes:DemoNode[];edges:DemoEdge[];lanes?:string[]};
const layouts:LayoutExample[] = [
  {id:"orthogonal",title:"Orthogonal",description:"Right-angle connectors for clear engineering route maps.",nodes:[{id:"a",label:"Material",x:85,y:108,kind:"material"},{id:"b",label:"Turning",x:320,y:108},{id:"c",label:"Inspection",x:555,y:108,kind:"quality"}],edges:[{from:"a",to:"b",kind:"main",path:"elbow"},{from:"b",to:"c",kind:"main",path:"elbow"}]},
  {id:"s-curve",title:"S-Curve",description:"Serpentine links for branches and long route transitions.",nodes:[{id:"a",label:"Turning",x:85,y:160},{id:"b",label:"Hardening",x:320,y:55},{id:"c",label:"Grinding",x:555,y:160}],edges:[{from:"a",to:"b",kind:"alternate",path:"curve"},{from:"b",to:"c",kind:"main",path:"curve"}]},
  {id:"horizontal",title:"Horizontal",description:"Left-to-right sequence for a simple production route.",nodes:[{id:"a",label:"Cut",x:65,y:108},{id:"b",label:"Turn",x:235,y:108},{id:"c",label:"Mill",x:405,y:108},{id:"d",label:"Inspect",x:585,y:108,kind:"quality"}],edges:[{from:"a",to:"b",kind:"main"},{from:"b",to:"c",kind:"main"},{from:"c",to:"d",kind:"main"}]},
  {id:"vertical",title:"Vertical",description:"Top-to-bottom process routing for narrow mobile screens.",nodes:[{id:"a",label:"Material",x:325,y:30,kind:"material"},{id:"b",label:"Turning",x:325,y:85},{id:"c",label:"Grinding",x:325,y:145},{id:"d",label:"QC",x:325,y:200,kind:"quality"}],edges:[{from:"a",to:"b",kind:"material"},{from:"b",to:"c",kind:"main"},{from:"c",to:"d",kind:"main"}]},
  {id:"swimlane",title:"Swimlane",description:"Grouped supply, manufacturing, quality and logistics lanes.",lanes:["SUPPLY","MANUFACTURING","QUALITY / LOGISTICS"],nodes:[{id:"a",label:"Material receipt",x:105,y:52,kind:"material"},{id:"b",label:"Turning",x:255,y:112},{id:"c",label:"Grinding",x:405,y:112},{id:"d",label:"CMM",x:555,y:52,kind:"quality"},{id:"e",label:"Dispatch",x:555,y:175,kind:"transport"}],edges:[{from:"a",to:"b",kind:"material"},{from:"b",to:"c",kind:"main"},{from:"c",to:"d",kind:"main"},{from:"d",to:"e",kind:"transport"}]},
  {id:"timeline",title:"Timeline",description:"Schedule-oriented sequence showing planned order and hand-offs.",nodes:[{id:"a",label:"Day 1 · Cut",x:75,y:108},{id:"b",label:"Day 2 · Turn",x:245,y:108},{id:"c",label:"Day 3 · Heat",x:415,y:108},{id:"d",label:"Day 4 · QC",x:585,y:108,kind:"quality"}],edges:[{from:"a",to:"b",kind:"follow-on"},{from:"b",to:"c",kind:"follow-on"},{from:"c",to:"d",kind:"successor"}]},
  {id:"radial",title:"Radial",description:"A hub operation with connected downstream workcells or sub-processes.",nodes:[{id:"a",label:"Main hub",x:325,y:108},{id:"b",label:"Turning",x:120,y:45},{id:"c",label:"Grinding",x:530,y:45},{id:"d",label:"Heat treat",x:120,y:175},{id:"e",label:"Inspection",x:530,y:175,kind:"quality"}],edges:[{from:"a",to:"b",kind:"split"},{from:"a",to:"c",kind:"split"},{from:"a",to:"d",kind:"split"},{from:"a",to:"e",kind:"split"}]},
  {id:"circular",title:"Circular",description:"Closed-loop routing for recirculation, repeat cycles and feedback.",nodes:[{id:"a",label:"Machine",x:325,y:30},{id:"b",label:"Measure",x:540,y:108,kind:"quality"},{id:"c",label:"Adjust",x:325,y:190},{id:"d",label:"Re-run",x:110,y:108}],edges:[{from:"a",to:"b",kind:"main"},{from:"b",to:"c",kind:"feedback"},{from:"c",to:"d",kind:"rework"},{from:"d",to:"a",kind:"successor",path:"loop"}]},
  {id:"organic",title:"Organic",description:"Adaptive clustered routing for alternates, dependencies and converging operations.",nodes:[{id:"a",label:"Material",x:75,y:108,kind:"material"},{id:"b",label:"Turning",x:235,y:55},{id:"c",label:"Milling",x:235,y:165},{id:"d",label:"Grinding",x:425,y:55},{id:"e",label:"CMM",x:585,y:125,kind:"quality"}],edges:[{from:"a",to:"b",kind:"main",path:"curve"},{from:"a",to:"c",kind:"alternate",path:"curve"},{from:"b",to:"d",kind:"parallel",path:"curve"},{from:"c",to:"e",kind:"dependency",path:"curve"},{from:"d",to:"e",kind:"merge",path:"curve"}]}
];

function nodeColor(kind:NodeKind="process") {
  if(kind==="material")return "#0c9e98";
  if(kind==="quality")return "#8a60bd";
  if(kind==="decision")return "#bd8a24";
  if(kind==="transport")return "#2c87c6";
  if(kind==="delivery")return "#33865e";
  return "#3d79b7";
}
function nodeWidth(node:DemoNode) { return node.kind==="decision"?112:104; }
function edgePath(edge:DemoEdge,from:DemoNode,to:DemoNode) {
  const dx=to.x-from.x,dy=to.y-from.y,horizontal=Math.abs(dx)>=Math.abs(dy);
  const sx=from.x+(horizontal?(dx>=0?nodeWidth(from)/2:-nodeWidth(from)/2):0);
  const sy=from.y+(horizontal?0:(dy>=0?23:-23));
  const tx=to.x+(horizontal?(dx>=0?-nodeWidth(to)/2:nodeWidth(to)/2):0);
  const ty=to.y+(horizontal?0:(dy>=0?-23:23));
  if(edge.path==="loop"||edge.kind==="feedback"){
    const lift=dy>=0?-86:86,c1x=sx+(dx>=0?24:-24),c2x=tx+(dx>=0?-24:24);
    return {d:"M "+sx+" "+sy+" C "+c1x+" "+(sy+lift)+", "+c2x+" "+(ty+lift)+", "+tx+" "+ty,angle:Math.atan2(ty-(ty+lift),tx-c2x)};
  }
  if(edge.path==="elbow"||!horizontal){
    const mid=horizontal?(sx+tx)/2:(sy+ty)/2;
    const d=horizontal?"M "+sx+" "+sy+" L "+mid+" "+sy+" L "+mid+" "+ty+" L "+tx+" "+ty:"M "+sx+" "+sy+" L "+sx+" "+mid+" L "+tx+" "+mid+" L "+tx+" "+ty;
    return {d,angle:horizontal?Math.atan2(ty-sy,tx-mid):Math.atan2(ty-mid,tx-sx)};
  }
  if(edge.path==="curve"||Math.abs(dy)>24){
    const bend=edge.path==="curve"?Math.max(30,Math.abs(dx)*.28):Math.max(10,Math.abs(dy)*.26);
    const c1x=sx+dx*.42,c2x=tx-dx*.42,sign=dy===0?1:Math.sign(dy);
    return {d:"M "+sx+" "+sy+" C "+c1x+" "+(sy+sign*bend)+", "+c2x+" "+(ty-sign*bend)+", "+tx+" "+ty,angle:Math.atan2(ty-(ty-sign*bend),tx-c2x)};
  }
  return {d:"M "+sx+" "+sy+" L "+tx+" "+ty,angle:Math.atan2(ty-sy,tx-sx)};
}
function FlowDiagram({example,large=false}:{example:FlowExample|LayoutExample;large?:boolean}) {
  const markerId="route-showcase-arrow-"+useId().replace(/:/g,"");
  const nodeById=new Map<string,DemoNode>(example.nodes.map(node=>[node.id,node] as const));
  return <svg className={"route-flow-showcase-diagram"+(large?" is-large":"")} viewBox="0 0 650 220" role="img" aria-label={example.title+" route diagram"} preserveAspectRatio="xMidYMid meet">
    <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#607d98"/></marker></defs>
    {example.lanes?.map((label,index)=><g key={label}><rect x="8" y={14+index*65} width="634" height="61" rx="8" className="route-flow-showcase-lane"/><text x="18" y={28+index*65} className="route-flow-showcase-lane-label">{label}</text></g>)}
    {example.id==="timeline"&&<g className="route-flow-showcase-timeline"><path d="M30 177 H620"/>{[75,245,415,585].map(x=><path key={x} d={"M "+x+" 168 V186"}/>)}</g>}
    {example.edges.map((edge,index)=>{
      const from=nodeById.get(edge.from),to=nodeById.get(edge.to);
      if(!from||!to)return null;
      const style=edgePalette[edge.kind],path=edgePath(edge,from,to),midX=(from.x+to.x)/2,midY=(from.y+to.y)/2-(edge.kind==="feedback"?42:12);
      return <g key={edge.from+"-"+edge.to+"-"+index}>
        {edge.kind==="parallel"&&<path d={path.d} transform="translate(0 5)" fill="none" stroke={style.color} strokeWidth="2" opacity=".65"/>}
        <path d={path.d} fill="none" stroke={style.color} strokeWidth="3" strokeDasharray={style.dash} strokeLinecap="round" markerEnd={"url(#"+markerId+")"}/>
        {edge.label&&<g><rect x={midX-24} y={midY-10} width="48" height="18" rx="6" className="route-flow-showcase-edge-label"/><text x={midX} y={midY+3} textAnchor="middle" className="route-flow-showcase-edge-text">{edge.label}</text></g>}
      </g>;
    })}
    {example.nodes.map(node=>{
      const width=nodeWidth(node),height=46,color=nodeColor(node.kind);
      if(node.kind==="decision")return <g key={node.id} className="route-flow-showcase-node is-decision"><polygon points={node.x+","+(node.y-height/2)+" "+(node.x+width/2)+","+node.y+" "+node.x+","+(node.y+height/2)+" "+(node.x-width/2)+","+node.y} fill="#fff5df" stroke={color} strokeWidth="2"/><text x={node.x} y={node.y+4} textAnchor="middle">{node.label}</text></g>;
      return <g key={node.id} className="route-flow-showcase-node"><rect x={node.x-width/2} y={node.y-height/2} width={width} height={height} rx="9" fill="#fff" stroke={color} strokeWidth="2"/><rect x={node.x-width/2} y={node.y-height/2} width="5" height={height} rx="2" fill={color}/><text x={node.x} y={node.y+4} textAnchor="middle">{node.label}</text><text x={node.x} y={node.y+17} textAnchor="middle" className="route-flow-showcase-node-type">{(node.kind||"process").toUpperCase()}</text></g>;
    })}
  </svg>;
}

export function RouteFlowShowcase() {
  const [view,setView]=useState<"patterns"|"layouts">("patterns");
  const [selectedPattern,setSelectedPattern]=useState("end-to-end");
  const [selectedLayout,setSelectedLayout]=useState("orthogonal");
  const selected=patterns.find(item=>item.id===selectedPattern)||patterns[0];
  const selectedLayoutExample=layouts.find(item=>item.id===selectedLayout)||layouts[0];
  return <section className="route-flow-showcase" aria-label="Route flow patterns and layout showcase">
    <header className="route-flow-showcase-header">
      <div><span>AXIMACH · ROUTE FLOW PATTERN LIBRARY</span><h2>One component. Every route pattern.</h2><p>Manufacturing, quality, branching, supply and transport examples in one read-only showcase.</p></div>
      <div className="route-flow-showcase-counts"><strong>14</strong><small>FLOW PATTERNS</small><strong>9</strong><small>LAYOUT STYLES</small></div>
    </header>
    <div className="route-flow-showcase-tabs" role="tablist" aria-label="Showcase view">
      <button type="button" role="tab" aria-selected={view==="patterns"} className={view==="patterns"?"is-active":""} onClick={()=>setView("patterns")}>Relationship &amp; process patterns <b>13</b></button>
      <button type="button" role="tab" aria-selected={view==="layouts"} className={view==="layouts"?"is-active":""} onClick={()=>setView("layouts")}>Flow layout styles <b>9</b></button>
    </div>
    {view==="patterns"?<>
      <article className="route-flow-showcase-preview">
        <div className="route-flow-showcase-preview-head"><div><span>SELECTED COMPOSITE EXAMPLE</span><h3>{selected.title}</h3><p>{selected.description}</p></div><b>{selected.category}</b></div>
        <FlowDiagram example={selected} large/>
      </article>
      <div className="route-flow-showcase-grid">
        {patterns.map(pattern=><button type="button" key={pattern.id} className={"route-flow-showcase-card"+(selectedPattern===pattern.id?" is-selected":"")} aria-pressed={selectedPattern===pattern.id} onClick={()=>setSelectedPattern(pattern.id)}>
          <span className="route-flow-showcase-card-heading"><b>{pattern.title}</b><small>{pattern.category}</small></span>
          <FlowDiagram example={pattern}/>
          <span className="route-flow-showcase-card-description">{pattern.description}</span>
          <span className="route-flow-showcase-card-action">VIEW PATTERN ↗</span>
        </button>)}
      </div>
    </>:<>
      <article className="route-flow-showcase-preview">
        <div className="route-flow-showcase-preview-head"><div><span>SELECTED LAYOUT</span><h3>{selectedLayoutExample.title}</h3><p>{selectedLayoutExample.description}</p></div><b>{selectedLayoutExample.id.toUpperCase()}</b></div>
        <FlowDiagram example={selectedLayoutExample} large/>
      </article>
      <div className="route-flow-showcase-grid route-flow-showcase-layout-grid">
        {layouts.map(layout=><button type="button" key={layout.id} className={"route-flow-showcase-card"+(selectedLayout===layout.id?" is-selected":"")} aria-pressed={selectedLayout===layout.id} onClick={()=>setSelectedLayout(layout.id)}>
          <span className="route-flow-showcase-card-heading"><b>{layout.title}</b><small>LAYOUT MODE</small></span>
          <FlowDiagram example={layout}/>
          <span className="route-flow-showcase-card-description">{layout.description}</span>
          <span className="route-flow-showcase-card-action">VIEW LAYOUT ↗</span>
        </button>)}
      </div>
    </>}
    <div className="route-flow-showcase-legend">
      {Object.entries(edgePalette).map(([kind,style])=><span key={kind}><i style={{background:style.color}}/><b>{kind==="follow-on"?"FOLLOW-ON":kind.toUpperCase()}</b><small>{style.description}</small></span>)}
    </div>
    <footer className="route-flow-showcase-footer"><span>DEMONSTRATION ONLY · SAMPLE COMPONENTS · NO PO / OPERATION RECORDS MODIFIED</span><span>Pattern reference · 14 examples · 9 layouts</span></footer>
  </section>;
}
