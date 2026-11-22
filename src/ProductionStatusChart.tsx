import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { OperationRecord } from "./manufacturingData";

type Props = { operations: OperationRecord[] };

const statusOrder: OperationRecord["status"][] = [
  "Running", "Queued", "Planned", "Delayed", "Quality hold", "Rejected", "Complete"
];
const statusColors: Record<OperationRecord["status"], string> = {
  Running: "#2b80d8",
  Queued: "#55a6bd",
  Planned: "#8799ae",
  Delayed: "#c58a2d",
  "Quality hold": "#c65d66",
  Rejected: "#8f5365",
  Complete: "#249875"
};

export default function ProductionStatusChart({ operations }: Props) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const counts = useMemo(() => statusOrder.map(status => ({
    name: status,
    value: operations.filter(operation => operation.status === status).length
  })), [operations]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || operations.length === 0) return;
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption({
      animation: !prefersReducedMotion,
      animationDuration: 320,
      animationEasing: "cubicOut",
      grid: { left: 104, right: 28, top: 8, bottom: 24 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value: unknown) => String(value) + (Number(value) === 1 ? " operation" : " operations")
      },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "#7c8da4", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(133,157,187,.18)", type: "dashed" } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: counts.map(item => item.name),
        axisLabel: { color: "#506782", fontSize: 10, width: 88, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        name: "Saved operations",
        type: "bar",
        barMaxWidth: 16,
        showBackground: true,
        backgroundStyle: { color: "rgba(129,153,181,.10)", borderRadius: 5 },
        itemStyle: { borderRadius: [0, 5, 5, 0] },
        label: { show: true, position: "right", color: "#526982", fontSize: 10 },
        data: counts.map(item => ({
          value: item.value,
          itemStyle: { color: statusColors[item.name as OperationRecord["status"]] }
        }))
      }]
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [operations, counts]);

  if (operations.length === 0) {
    return <div className="production-status-empty" role="status">
      <span>No saved production operations yet.</span>
      <small>Create purchase orders and process routes to populate this chart. No sample values are shown.</small>
    </div>;
  }

  return <div className="production-status-chart-wrap">
    <div ref={chartRef} className="production-status-chart" role="img"
      aria-label={counts.map(item => item.name + ": " + item.value).join(", ") + " saved production operations"} />
    <div className="production-status-chart-summary" aria-label="Operation status totals">
      {counts.filter(item => item.value > 0).map(item => <span key={item.name}>
        <i style={{ background: statusColors[item.name] }} />
        <b>{item.value.toLocaleString("en-IN")}</b> {item.name}
      </span>)}
    </div>
  </div>;
}
