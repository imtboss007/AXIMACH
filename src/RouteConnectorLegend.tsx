import { Boxes, Truck } from "lucide-react";

const CONNECTORS = [
  ["main","Main route","Primary manufacturing sequence"],
  ["alternate","Alternate route","Qualified alternative process"],
  ["rework","Rework route","Corrective return path"],
  ["dependency","Dependency","Prerequisite / gated step"],
  ["parallel","Parallel","Simultaneous workcells"],
  ["merge","Merge","Converging paths"],
  ["split","Split","Diverging paths"],
  ["follow-on","Follow-on","Downstream activity"],
  ["feedback","Feedback","Quality / process loop"],
  ["conditional","Conditional","Decision-dependent path"],
  ["successor","Successor","Predecessor relationship"],
  ["material","Material → process","Material allocation / process input"],
  ["transport","Transport leg · vehicle colour","Vehicle / inter-vendor movement"]
] as const;

export function RouteConnectorLegend({compact=false}:{compact?:boolean}={}) {
  return <div className={"route-connector-legend"+(compact?" is-compact":"")} aria-label="Complete manufacturing route connector legend">
    {CONNECTORS.map(([id,label,description])=><span key={id} className={"route-connector-legend-item route-flow-curve-"+id} title={description}>
      <i className={"route-legend-line route-legend-"+id} aria-hidden="true"/>
      {id==="material"?<Boxes size={12} aria-hidden="true"/>:id==="transport"?<Truck size={12} aria-hidden="true"/>:null}
      <b>{label}</b>
    </span>)}
  </div>;
}
