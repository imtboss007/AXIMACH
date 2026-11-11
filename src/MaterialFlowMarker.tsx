import type { CSSProperties } from "react";
import { Boxes } from "lucide-react";
import type { MaterialProcessLinkRecord, MaterialRecord } from "./manufacturingData";

type Props = {
  link: MaterialProcessLinkRecord;
  material: MaterialRecord;
  componentQuantity: number;
  selected: boolean;
  onSelect: () => void;
};

const number = (value:number) => Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:4});

export function MaterialFlowMarker({link,material,componentQuantity,selected,onSelect}:Props) {
  return <span className={"material-flow-marker"+(selected?" is-selected":"")} style={{"--material-color":"#42C9D3"} as CSSProperties}>
    <button type="button" className="material-flow-marker-button" onClick={onSelect} aria-expanded={selected}
      aria-label={"Open material process link "+material.code+" for "+material.name}
      title={material.code+" · "+material.name+" → "+link.operationId}>
      <Boxes size={18} strokeWidth={2.1} aria-hidden="true"/>
    </button>
    {selected&&<span className="material-flow-popover" role="dialog" aria-label="Material to process link">
      <strong>MATERIAL → PROCESS LINK</strong>
      <span>{material.code} · {material.name}</span>
      <small>Grade: {material.grade||"Not specified"} · Unit: {link.unit||material.unit}</small>
      <small>BOM line: {link.bomLineId}</small>
      <small>Process operation: {link.operationId}</small>
      <small>{link.flowType} · {link.placement==="before"?"Before process":"After process"}</small>
      <b>{number(link.quantityPerPart)} {link.unit||material.unit} / part</b>
      <small>PO requirement: {number(link.quantityPerPart*componentQuantity)} {link.unit||material.unit} for {number(componentQuantity)} pcs</small>
      {link.notes&&<small>{link.notes}</small>}
    </span>}
  </span>;
}
