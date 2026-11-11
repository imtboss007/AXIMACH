import { Boxes, Truck } from "lucide-react";

export function RouteConnectorLegend() {
  return <div className="route-connector-legend" aria-label="Process route connector legend">
    <span><i className="route-legend-line route-legend-main"/> Main route</span>
    <span><i className="route-legend-line route-legend-alternate"/> Alternate route</span>
    <span><i className="route-legend-line route-legend-rework"/> Rework route</span>
    <span><i className="route-legend-line route-legend-material"/><Boxes size={13}/> Material → process</span>
    <span><i className="route-legend-line route-legend-transport"/><Truck size={13}/> Transport leg · vehicle colour</span>
  </div>;
}
