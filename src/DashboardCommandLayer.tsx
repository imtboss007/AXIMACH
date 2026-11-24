import { Activity, AlertTriangle, CheckCircle2, Cog, Factory, Gauge, Truck, Workflow, Wrench } from "lucide-react";
import type { CSSProperties } from "react";
import type { OperationRecord } from "./manufacturingData";

type Props = {
  operations: OperationRecord[];
  completedQuantity: number;
  plannedQuantity: number;
  completionPercent: number;
  inProduction: number;
  openOperations: number;
  completedOperations: number;
  qualityHolds: number;
  overdue: number;
  activeTransport: number;
  onSelectModule: (id: string) => void;
};

function formatCount(value: number) { return Math.max(0, Number(value || 0)).toLocaleString("en-IN"); }

export default function DashboardCommandLayer({
  operations, completedQuantity, plannedQuantity, completionPercent, inProduction,
  openOperations, completedOperations, qualityHolds, overdue, activeTransport, onSelectModule
}: Props) {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(completionPercent) ? completionPercent : 0));
  const statusCounts = [
    { id: "complete", label: "Complete", count: operations.filter(row => row.status === "Complete").length, tone: "complete" },
    { id: "running", label: "Running", count: operations.filter(row => row.status === "Running").length, tone: "running" },
    { id: "hold", label: "Quality hold", count: operations.filter(row => row.status === "Quality hold").length, tone: "hold" },
    { id: "other", label: "Queued / other", count: operations.filter(row => !["Complete", "Running", "Quality hold"].includes(row.status)).length, tone: "other" }
  ];
  const totalStatus = Math.max(1, statusCounts.reduce((sum, row) => sum + row.count, 0));
  const categories = [...operations.reduce((groups, operation) => {
    const label = (operation.category || "Unclassified process").trim() || "Unclassified process";
    groups.set(label, (groups.get(label) || 0) + 1);
    return groups;
  }, new Map<string, number>()).entries()]
    .map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 5);
  const maxCategory = Math.max(1, ...categories.map(row => row.count));
  const machineGroups = [...operations.reduce((groups, operation) => {
    const machine = (operation.machine || "").trim();
    if (machine) groups.set(machine, (groups.get(machine) || 0) + 1);
    return groups;
  }, new Map<string, number>()).entries()]
    .map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 4);
  const exceptions = qualityHolds + overdue;
  const progressStyle = { background: "conic-gradient(var(--ax-theme-accent) " + safePercent + "%, var(--ax-theme-border) " + safePercent + "%)" } as CSSProperties;
  const metrics = [
    { label: "Running now", value: inProduction, hint: "Saved operations", icon: Activity, module: "production", tone: "running" },
    { label: "Completed", value: completedOperations, hint: "Operation records", icon: CheckCircle2, module: "production", tone: "complete" },
    { label: "Open work", value: openOperations, hint: "Not marked complete", icon: Workflow, module: "production", tone: "neutral" },
    { label: "Exceptions", value: exceptions, hint: qualityHolds + " holds · " + overdue + " overdue", icon: AlertTriangle, module: qualityHolds ? "quality" : "production", tone: exceptions ? "warning" : "neutral" },
    { label: "In transport", value: activeTransport, hint: "Running or delayed legs", icon: Truck, module: "dispatch", tone: "neutral" }
  ];

  return <section className="dashboard-execution-command" data-testid="dashboard-command-graphics" aria-label="Shop-floor execution command layer">
    <div className="dashboard-execution-heading">
      <div><span className="dashboard-execution-eyebrow">EXECUTION OVERVIEW · SAVED AXIMACH RECORDS</span><h2>Shop-floor execution</h2><p>Production quantities, operation states and assigned workcentres — no estimated machine telemetry.</p></div>
      <button type="button" className="dashboard-execution-open" onClick={() => onSelectModule("production")}>Open production plan <span aria-hidden="true">↗</span></button>
    </div>
    <div className="dashboard-execution-grid">
      <article className="dashboard-execution-progress">
        <div className="dashboard-execution-progress-copy"><span>QUANTITY COMPLETION</span><strong>{safePercent}<small>%</small></strong><p>{formatCount(completedQuantity)} of {formatCount(plannedQuantity)} pieces recorded complete</p><button type="button" onClick={() => onSelectModule("reports")}>Review production analytics <span aria-hidden="true">→</span></button></div>
        <div className="dashboard-execution-ring" style={progressStyle} role="progressbar" aria-label="Completed quantity against planned quantity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safePercent}><div><strong>{safePercent}%</strong><small>COMPLETE</small></div></div>
      </article>
      <div className="dashboard-execution-metrics">{metrics.map(item => {const Icon=item.icon;return <button type="button" key={item.label} className={"dashboard-execution-metric tone-"+item.tone} onClick={()=>onSelectModule(item.module)}><span className="dashboard-execution-metric-icon"><Icon size={17}/></span><span className="dashboard-execution-metric-copy"><small>{item.label}</small><strong>{formatCount(item.value)}</strong><em>{item.hint}</em></span></button>;})}</div>
      <article className="dashboard-execution-panel dashboard-execution-state-panel">
        <div className="dashboard-execution-panel-heading"><span><Gauge size={15}/> Operation states</span><b>{formatCount(operations.length)} total</b></div>
        <div className="dashboard-execution-state-bar" role="img" aria-label={statusCounts.map(row=>row.label+" "+row.count).join(", ")}>{statusCounts.map(row=><i key={row.id} className={"state-"+row.tone} style={{width:(row.count/totalStatus*100)+"%"}/>)}</div>
        <div className="dashboard-execution-state-legend">{statusCounts.map(row=><div key={row.id}><i className={"state-"+row.tone}/><span>{row.label}</span><strong>{formatCount(row.count)}</strong></div>)}</div>
      </article>
      <article className="dashboard-execution-panel dashboard-execution-category-panel">
        <div className="dashboard-execution-panel-heading"><span><Factory size={15}/> Process mix</span><b>Top categories</b></div>
        {categories.length?<div className="dashboard-execution-category-list">{categories.map(row=><div className="dashboard-execution-category-row" key={row.label}><span title={row.label}>{row.label}</span><i><b style={{width:(row.count/maxCategory*100)+"%"}}/></i><strong>{formatCount(row.count)}</strong></div>)}</div>:<p className="dashboard-execution-empty">No saved process operations yet.</p>}
      </article>
      <article className="dashboard-execution-panel dashboard-execution-machine-panel">
        <div className="dashboard-execution-panel-heading"><span><Cog size={15}/> Assigned machinery</span><b>{machineGroups.length?machineGroups.length+" shown":"Not assigned"}</b></div>
        {machineGroups.length?<div className="dashboard-execution-machine-list">{machineGroups.map(row=><button key={row.label} type="button" onClick={()=>onSelectModule("production")}><Wrench size={14}/><span>{row.label}</span><strong>{formatCount(row.count)}</strong></button>)}</div>:<p className="dashboard-execution-empty">Machine assignments are not recorded in saved operations.</p>}
      </article>
    </div>
  </section>;
}
