import { useMemo } from "react";
import { Activity, ArrowRight, Boxes, ClipboardCheck, GitBranch, Truck, Workflow, Wrench } from "lucide-react";
import type { CSSProperties } from "react";
import type { OperationRecord } from "./manufacturingData";
import { ProcessIcon } from "./IconStudio";

type Props = {
  operations: OperationRecord[];
  selectedOperationId: string;
  simulationIndex: number;
  zoom: number;
  onSelectOperation: (id: string) => void;
};

function fallbackFor(name: string) {
  const value = name.toLowerCase();
  if (/transport|dispatch|ship|logistic|delivery/.test(value)) return <Truck size={20} />;
  if (/inspect|quality|measure|test|cmm/.test(value)) return <ClipboardCheck size={20} />;
  if (/grind|honing|lapping|polish/.test(value)) return <Wrench size={20} />;
  if (/material|stock|store|warehouse/.test(value)) return <Boxes size={20} />;
  if (/production|assembly|pack/.test(value)) return <Activity size={20} />;
  return <Workflow size={20} />;
}

export default function ProcessUniverse3D({
  operations, selectedOperationId, simulationIndex, zoom, onSelectOperation
}: Props) {
  const lanes = useMemo(() => {
    const grouped = new Map<string, OperationRecord[]>();
    for (const operation of operations) {
      const branch = operation.branch || "Main route";
      const rows = grouped.get(branch) || [];
      rows.push(operation);
      grouped.set(branch, rows);
    }
    return [...grouped.entries()].map(([name, rows]) => ({
      name,
      rows: rows.slice().sort((a, b) => a.sequence - b.sequence),
      alternate: name !== "Main route"
    }));
  }, [operations]);

  const stageStyle: CSSProperties = { transform: `scale(${zoom}) rotateX(2deg)`, transformOrigin: "top left", width: `${100 / zoom}%` };

  return (
    <section className="process-universe-3d" aria-label="Interactive 3D process route graph">
      <header className="process-universe-head">
        <div>
          <span className="process-universe-kicker"><span /> LIVE ROUTE / 3D GRAPH</span>
          <h3>Manufacturing process universe</h3>
          <p>Every node is a saved operation for the selected purchase-order component line. Select a node to open its real record.</p>
        </div>
        <div className="process-universe-count"><strong>{operations.length}</strong><span>OPERATIONS</span></div>
      </header>
      <div className="process-universe-viewport">
        <div className="process-universe-stage" style={stageStyle}>
          {lanes.map((lane, laneIndex) => (
            <section className={"process-universe-lane" + (lane.alternate ? " is-branch" : "")} key={lane.name}>
              <div className="process-universe-lane-label">
                <span className="process-universe-branch-icon">{lane.alternate ? <GitBranch size={15} /> : <Workflow size={15} />}</span>
                <span><strong>{lane.name}</strong><small>{lane.alternate ? "Alternate / rework branch" : "Primary manufacturing route"}</small></span>
                <em>{lane.rows.length} STEP{lane.rows.length === 1 ? "" : "S"}</em>
              </div>
              <div className="process-universe-node-track">
                {lane.rows.map((operation, index) => {
                  const globalIndex = operations.findIndex(item => item.id === operation.id);
                  const active = selectedOperationId === operation.id;
                  const current = simulationIndex === globalIndex;
                  const passed = simulationIndex > globalIndex;
                  const state = operation.status.toLowerCase().replaceAll(" ", "-");
                  return (
                    <div className="process-universe-node-wrap" key={operation.id}>
                      <button
                        type="button"
                        className={"process-universe-node status-" + state
                          + (active ? " is-selected" : "")
                          + (current ? " simulation-current" : "")
                          + (passed ? " simulation-passed" : "")}
                        onClick={() => onSelectOperation(operation.id)}
                        aria-pressed={active}
                        title={"Open " + operation.name + " operation record"}
                      >
                        <span className="process-universe-node-top">
                          <small>OP-{String(operation.sequence).padStart(3, "0")}</small>
                          <em>{operation.status}</em>
                        </span>
                        <span className="process-universe-node-icon"><ProcessIcon processName={operation.name} fallback={fallbackFor(operation.name)} /></span>
                        <strong>{operation.name}</strong>
                        <small className="process-universe-node-category">{operation.category || operation.machine || "Manufacturing operation"}</small>
                        <span className="process-universe-qty"><b>{operation.completed.toLocaleString("en-IN")}</b> / {operation.quantity.toLocaleString("en-IN")} pcs</span>
                        {operation.machine && <span className="process-universe-machine">{operation.machine}</span>}
                      </button>
                      {index < lane.rows.length - 1 && <span className="process-universe-connector" aria-hidden="true"><ArrowRight size={17} /></span>}
                    </div>
                  );
                })}
              </div>
              {lane.alternate && <div className="process-universe-branch-note">Branch retained with its parent operation and rework history.</div>}
            </section>
          ))}
          {operations.length === 0 && <div className="process-universe-empty">No saved operations are available for this PO line.</div>}
          <div className="process-universe-floor" aria-hidden="true" />
        </div>
      </div>
      <footer className="process-universe-legend">
        <span><i className="legend-done" /> Complete</span>
        <span><i className="legend-live" /> Running</span>
        <span><i className="legend-queued" /> Queued</span>
        <span><i className="legend-hold" /> Quality hold</span>
        <span className="process-universe-safe">Simulation is visual only. It never changes job, operation or quantity records.</span>
      </footer>
    </section>
  );
}
