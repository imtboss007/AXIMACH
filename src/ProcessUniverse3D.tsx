import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type CSSProperties } from "react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, ArrowRight, Boxes, ClipboardCheck, Cog, Cpu, Disc3, GitBranch, Scissors, Zap, Truck, Workflow, Wrench } from "lucide-react";
import type { MaterialProcessLinkRecord, MaterialRecord, OperationRecord, RouteRelationshipRecord } from "./manufacturingData";
import { ProcessIcon } from "./IconStudio";
import { MaterialFlowMarker } from "./MaterialFlowMarker";
import { VehicleIcon as VehicleTypeIcon } from "./TransportVehicle";
import { RouteConnectorLegend as MaterialRouteConnectorLegend } from "./RouteConnectorLegend";
import ProcessUniverseWebGLCore from "./ProcessUniverseWebGLCore";
import ProcessScene3D from "./ProcessScene3D";
import ImmersiveWorkspaceControls from "./ImmersiveWorkspaceControls";
import { RouteLayoutPicker, RouteConnectorLegend as RouteLayoutConnectorLegend, useRouteLayout, type RouteLayoutMode } from "./RouteLayoutPicker";

type ProcessDefinitionNode = { id: string; processType: string; category: string; subcategories?: string[]; subcategoryIds?: string[]; vendorIds?: string[]; displayColor?: string };
type MaterialRouteNode = {
  id:string; poLineId?:string; partLabel:string; partNumber?:string; partName?:string; materialLabel:string; dimensionsLabel?:string; companyLabel?:string; poLabel?:string; componentLabel?:string; densityKgM3?:number; anchorOperationId?:string; anchorOperationName?:string; quantity:number; weightKg:number;
  supplier:string; transporter:string; from:string; to:string; vehicle:string;
  materialGivenAt:string; materialDueAt:string; materialReceivedAt:string;
  pickupAt:string; deliveryAt:string; status:string; materialRate:number; priceUnit:"kg"|"lb";
  materialCost:number; cuttingType:string; cuttingBasis:string; cuttingRate:number; cuttingCost:number; transportCost:number;
};
ty
…[1 chars truncated — re-run with head/grep/tail for full output]…
itOperation.poLineId] || expandedOrbitOperation.poLineId || "Not assigned"}</strong></div>
          <div><small>CATEGORY</small><strong>{expandedOrbitOperation.category || "Not set"}</strong></div>
          <div><small>PROCESS / SUBCATEGORY</small><strong>{expandedOrbitOperation.name}{expandedOrbitOperation.subcategory ? " · " + expandedOrbitOperation.subcategory : ""}</strong></div>
          <div><small>VENDOR</small><strong>{vendors.find(vendor => vendor.id === expandedOrbitOperation.vendorId)?.company || "Vendor not assigned"}</strong></div>
          <div><small>PLANNED START · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.plannedStart)}</strong></div>
          <div><small>PLANNED DELIVERY · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.plannedEnd)}</strong></div>
          <div><small>ACTUAL START · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.actualStart)}</strong></div>
          <div><small>ACTUAL COMPLETION · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.actualEnd)}</strong></div>
          <div><small>PLANNED QUANTITY</small><strong>{expandedOrbitOperation.quantity.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>COMPLETED / ACCEPTED / REJECTED</small><strong>{expandedOrbitOperation.completed.toLocaleString("en-IN")} / {expandedOrbitOperation.accepted.toLocaleString("en-IN")} / {expandedOrbitOperation.rejected.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>PRICE / PART</small><strong>{moneyLabel(expandedOrbitOperation.actualRatePerPart > 0 ? expandedOrbitOperation.actualRatePerPart : expandedOrbitOperation.ratePerPart)}</strong></div>
          <div><small>PROCESS AMOUNT</small><strong>{moneyLabel(expandedOrbitOperation.quantity * (expandedOrbitOperation.actualRatePerPart > 0 ? expandedOrbitOperation.actualRatePerPart : expandedOrbitOperation.ratePerPart))}</strong></div>
          <div><small>STATUS</small><strong>{expandedOrbitOperation.status}</strong></div>
          <div><small>PAYMENT STATUS</small><strong>{expandedOrbitOperation.paymentStatus || "Unpaid"}</strong></div>
          <div><small>PAID AMOUNT</small><strong>{moneyLabel(expandedOrbitOperation.paidAmount || 0)}</strong></div>
          <div><small>EXECUTION</small><strong>{expandedOrbitOperation.executionType || "Outsourced"}</strong></div>
          <div><small>MACHINE / STATION</small><strong>{expandedOrbitOperation.machine || "Not assigned"}</strong></div>
          <div><small>TOLERANCE</small><strong>{expandedOrbitOperation.toleranceCategory || "Standard"}</strong></div>
          <div><small>TRANSPORT VENDOR</small><strong>{vendors.find(vendor => vendor.id === expandedOrbitOperation.transportVendorId)?.company || "Not assigned"}</strong></div>
          <div><small>TRANSPORT PICKUP → DELIVERY</small><strong>{[expandedOrbitOperation.transportPickup || expandedOrbitOperation.transportFrom, expandedOrbitOperation.transportDelivery || expandedOrbitOperation.transportTo].filter(Boolean).join(" → ") || "Not set"}</strong></div>
          <div><small>TRANSPORT COST</small><strong>{moneyLabel(operationTransportAmounts[expandedOrbitOperation.id] || expandedOrbitOperation.transportCost || 0)}</strong></div>
          <div><small>INSPECTION RESULT</small><strong>{expandedOrbitOperation.inspectionResult || "Not recorded"}</strong></div>
          <div><small>BRANCH / ROUTE</small><strong>{expandedOrbitOperation.branch || "Main route"}{expandedOrbitOperation.relationType ? " · " + expandedOrbitOperation.relationType : ""}</strong></div>
          <div className="process-orbit-selected-wide"><small>OPERATION NOTES / QUALITY NOTES</small><strong>{expandedOrbitOperation.notes || expandedOrbitOperation.qualityNotes || "No notes recorded"}</strong></div>
        </div>
        {(expandedOrbitSubprocesses.length > 0 || expandedOrbitBranches.length > 0 || onAddSubprocess || onAddAlternateRoute || onAddReworkRoute) && <div className="process-orbit-selected-links">
          {expandedOrbitSubprocesses.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(""); }}>Sub-process · {child.name} · {child.status}</button>)}
          {expandedOrbitBranches.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(child.id); }}>{child.relationType === "rework" ? "Rework" : "Alternate"} · {child.name} · {child.status}</button>)}
          {onAddSubprocess && <button type="button" className="process-orbit-add-subprocess" onClick={() => onAddSubprocess(expandedOrbitOperation.id)}>＋ Add sub-process</button>}
          {onAddAlternateRoute && <button type="button" className="process-orbit-add-alternate" onClick={() => onAddAlternateRoute(expandedOrbitOperation.id)}>＋ Create alternate route</button>}
          {onAddReworkRoute && <button type="button" className="process-orbit-add-rework" onClick={() => onAddReworkRoute(expandedOrbitOperation.id)}>＋ Create rework route</button>}
        </div>}
      </section>}
    </div>
    <div className="process-universe-viewport"><nav className="process-universe-index" aria-label="Jump to manufacturing operation"><strong>STEPS</strong>{displayOperations.length>0?displayOperations.map(operation=><button type="button" key={operation.id} onClick={()=>onSelectOperation(operation.id)} aria-label={"Go to operation "+operation.sequence+": "+operation.name}><b>{String(operation.sequence).padStart(2,"0")}</b><span>{operation.name}</span></button>):processDefinitions.map((definition,index)=><button type="button" key={definition.id} onClick={()=>onAddProcessDefinition?.(definition.id)}><b>{String(index+1).padStart(2,"0")}</b><span>{definition.processType}</span></button>)}</nav><div className="process-universe-stage" style={stageStyle}>
      {lanes.map((lane,laneIndex) => {
        const collapsed = collapsedLaneNames.includes(lane.key);
        const lanePanelId = "process-universe-lane-" + laneIndex;
        return <section className={"process-universe-lane" + (lane.alternate ? " is-branch " + (lane.branchRelation==="rework"?"is-rework":"is-alternate") : "")} key={lane.key}>
          <div className="process-universe-lane-label">
            <button type="button" className="process-universe-lane-toggle" aria-expanded={!collapsed} aria-controls={lanePanelId} onClick={() => setCollapsedLaneNames(current => current.includes(lane.key) ? current.filter(name => name !== lane.key) : [...current,lane.key])}>
              <span className="process-universe-branch-icon">{lane.alternate ? <GitBranch size={15}/> : <Workflow size={15}/>}</span>
              <span><strong>{lane.label}</strong><small>{lane.alternate ? (lane.branchRelation==="rework"?"Rework branch":"Alternate route") + (lane.parent ? " · connected from OP-" + String(lane.parent.sequence).padStart(3,"0") + " " + lane.parent.name : "") : "Primary manufacturing route"}</small></span>
              <span className="process-universe-lane-disclosure" aria-hidden="true">{collapsed ? "+" : "−"}</span>
            </button>
            <em>{lane.rows.length} STEP{lane.rows.length === 1 ? "" : "S"}</em>
          </div>
          <div id={lanePanelId} className="process-universe-lane-content" hidden={collapsed}>
            {lane.alternate && lane.branchRoot && <div className={"process-universe-branch-link " + (lane.branchRelation==="rework"?"is-rework":"is-alternate")} data-parent-id={lane.parent?.id||""} data-branch-root-id={lane.branchRoot?.id||""} aria-label={(lane.branchRelation==="rework"?"Rework":"Alternate")+" branch connection from "+(lane.parent?.name||"parent process")+" to "+(lane.branchRoot?.name||lane.name)}><span>OP-{String(lane.parent?.sequence||0).padStart(3,"0")} · {lane.parent?.name||"Parent operation"}</span>{showArrows && <ArrowRight size={16} style={{color:lane.branchRelation==="rework"?"#e38b45":"#4b95eb"}}/>}<strong>{lane.branchRoot?.name||lane.name}</strong><small>{lane.branchRelation==="rework"?"REWORK BRANCH":"ALTERNATE ROUTE"}</small></div>}
            <div className="process-universe-node-track">{lane.rows.map((operation,index) => {
              const globalIndex = displayOperations.findIndex(item => item.id === operation.id);
              const active = selectedOperationId === operation.id, current = simulationIndex === globalIndex, passed = simulationIndex > globalIndex;
              const childOperations = subprocessesFor(operation.id);
              const linkedBranches = branchesFor(operation.id);
              const expanded = expandedOperationId === operation.id;
              const state = operation.status.toLowerCase().replaceAll(" ","-");
              const processDefinition = processDefinitions.find(item=>item.id===operation.processDefinitionId);
              const accent = processDefinition?.displayColor || operation.processColor || "#6fa9e5";
              return <div className="process-universe-node-wrap" key={operation.id}>
                {transportAtStart(operation.id).map(renderTransportLeg)}
                {materialLinksAt(operation.id,"before").map(renderMaterialLink)}
                {transportFor(operation.id,"before").map(renderTransportLeg)}
                <button type="button" className={"process-universe-node status-" + state + (active ? " is-selected" : "") + (expanded ? " is-expanded" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} style={{"--process-accent":accent} as CSSProperties} onClick={() => { onSelectOperation(operation.id); setExpandedOperationId(operation.id); }} aria-pressed={active} aria-expanded={expanded} aria-controls={"process-universe-node-details-"+operation.id} title={"Open " + operation.name + " operation record"}>
                  <span className="process-universe-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><em>{operation.status}</em></span>
                  <span className="process-universe-node-icon"><ProcessIcon processId={operation.processDefinitionId} processName={operation.name} category={operation.category} subcategory={operation.subcategory} fallback={fallbackFor(operation.name)} /></span>
                  <strong>{operation.name}</strong>
                  <div className="process-universe-node-details"><small>{childOperations.length} linked sub-process(es) · {linkedBranches.length} alternate / rework step(s)</small><small>{expanded ? "− COLLAPSE DETAILS" : "+ EXPAND DETAILS"}</small></div>
                </button>
                {materialLinksAt(operation.id,"after").map(renderMaterialLink)}
                {transportFor(operation.id,"after").map(renderTransportLeg)}
                {expanded && <div id={"process-universe-node-details-"+operation.id} className="process-node-subprocess-dropdown">
                  <strong>{operation.name} · Linked steps</strong>
                  <div className="process-universe-node-details">
                    {fieldVisible("category") && <small>Category · {operation.category || "Not set"}</small>}
                    {fieldVisible("subcategory") && operation.subcategory && <small>Subcategory · {operation.subcategory}</small>}
                    {fieldVisible("vendor") && <small>Vendor · {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "Not assigned"}</small>}
                    {fieldVisible("plannedStart") && <small>Start · {dateLabel(operation.plannedStart)}</small>}
                    {fieldVisible("plannedEnd") && <small>Delivery · {dateLabel(operation.plannedEnd)}</small>}
                    {fieldVisible("actualStart") && <small>Actual start · {dateLabel(operation.actualStart)}</small>}
                    {fieldVisible("actualEnd") && <small>Actual completion · {dateLabel(operation.actualEnd)}</small>}
                    {fieldVisible("quantity") && <small>Quantity · {operation.quantity.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("completed") && <small>Completed · {operation.completed.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("accepted") && <small>Accepted / rejected · {operation.accepted.toLocaleString("en-IN")} / {operation.rejected.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("price") && <small>Price / part · ₹{(operation.actualRatePerPart || operation.ratePerPart).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("amount") && <small>Process amount · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("transportLegCost") && <small>Transport amount · ₹{(operationTransportAmounts[operation.id] || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("combinedAmount") && <small>Process + transport · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart) + (operationTransportAmounts[operation.id] || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("status") && <small>Status · {operation.status}</small>}
                    {fieldVisible("execution") && <small>Execution · {operation.executionType || "Outsourced"}</small>}
                    {fieldVisible("tolerance") && <small>Tolerance · {operation.toleranceCategory || "Standard"}</small>}
                    {fieldVisible("paymentStatus") && <small>Payment · {operation.paymentStatus || "Unpaid"}</small>}
                    {fieldVisible("paidAmount") && <small>Paid amount · ₹{(operation.paidAmount || 0).toLocaleString("en-IN",{maximumFractionDigits:2})}</small>}
                    {fieldVisible("machine") && <small>Machine · {operation.machine || "Not set"}</small>}
                    {fieldVisible("transportVendor") && <small>Transport vendor · {vendors.find(vendor=>vendor.id===operation.transportVendorId)?.company || "Not assigned"}</small>}
                    {fieldVisible("transportPickup") && <small>Transport pickup · {dateLabel(operation.transportPickup)}</small>}
                    {fieldVisible("transportDelivery") && <small>Transport delivery · {dateLabel(operation.transportDelivery)}</small>}
                    {fieldVisible("inspection") && <small>Inspection result · {operation.inspectionResult || "Not recorded"}</small>}
                    {fieldVisible("description") && <small>Operation details · {operation.notes || operation.qualityNotes || "Not set"}</small>}
                  </div>
                  {childOperations.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(""); }}><span>{child.name}</span><small>Sub-process · {child.status} · {child.machine || "Machine not set"}</small></button>)}
                  {linkedBranches.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(child.id); }}><span>{child.name}</span><small>{child.relationType === "rework" ? "Rework branch" : "Alternate route"} · {child.status}</small></button>)}
                  <button type="button" className="process-node-add-subprocess" onClick={() => onAddSubprocess?.(operation.id)}>＋ Add sub-process</button>{onAddAlternateRoute && <button type="button" className="process-node-add-alternate" onClick={() => onAddAlternateRoute(operation.id)}>＋ Create alternate route</button>}{onAddReworkRoute && <button type="button" className="process-node-add-rework" onClick={() => onAddReworkRoute(operation.id)}>＋ Create rework route</button>}
                </div>}
                {showArrows && index < lane.rows.length - 1 && <span className="process-universe-connector" style={{color:lane.branchRelation==="rework"?"#e38b45":lane.branchRelation==="alternate"?"#4b95eb":accent}} aria-hidden="true"><ArrowRight size={17}/></span>}
              </div>;
            })}</div>
            {lane.alternate && <div className="process-universe-branch-note">Branch retained with its parent operation and rework history.</div>}
          </div>
        </section>;
      })}
      {operations.length === 0 && processDefinitions.length > 0 && <section className="process-directory-map-catalog" aria-label="Available Process Directory stages">
        <div className="process-directory-map-heading"><span>PROCESS DIRECTORY</span><strong>{processDefinitions.length} AVAILABLE STAGES</strong><small>Library definitions only · not yet saved as production operations</small></div>
        <div className="process-directory-map-nodes">{processDefinitions.map(definition => <button type="button" className="process-directory-map-node" key={definition.id} onClick={() => onAddProcessDefinition?.(definition.id)} disabled={!onAddProcessDefinition}>
          <ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={fallbackFor(definition.processType)} />
          <strong>{definition.processType}</strong><span>{definition.category}</span><small>{(definition.subcategories || []).length} sub-process option(s)</small><em>＋ Add to selected PO line</em>
        </button>)}</div>
      </section>}
      {operations.length === 0 && processDefinitions.length === 0 && <div className="process-universe-empty">No saved operations or Process Directory definitions are available.</div>}
      <div className="process-universe-floor" aria-hidden="true"/>
    </div></div>
    <footer className="process-universe-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="process-universe-safe">Simulation is visual only. It never changes job, operation or quantity records.</span></footer>
  </section>;
}
