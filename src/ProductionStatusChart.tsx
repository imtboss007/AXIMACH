import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { OperationRecord } from "./manufacturingData";

type Props = { operations: OperationRecord[] };

const statusOrder: OperationRecord["status"][] = [
  "Running", "Queued", "Planned", "Delayed", "Quality hold", "Rejected", "Complete"
];
function readChartTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (name:string,fallback:string) => style.getPropertyValue(name).trim() || fallback;
  return {
    colours: Array.from({length:7},(_,index)=>get("--ax-theme-chart-"+(index+1),["#2b80d8","#55a6bd","#8799ae","#c58a2d","#c65d66","#8f5365","#249875"][index])),
    text:get("--ax-theme-text","#526982"),
    muted:get("--ax-theme-muted","#7c8da4"),
    border:get("--ax-theme-border","rgba(133,157,187,.18)"),
    panel:get("--ax-theme-panel","rgba(129,153,181,.10)")
  };
}


export default function ProductionStatusChart({ operations }: Props) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [themeRevision,setThemeRevision]=useState(0);
  useEffect(()=>{
    const refresh=()=>setThemeRevision(value=>value+1);
    window.addEventListener("aximach-theme-updated",refresh);
    return ()=>window.removeEventListener("aximach-theme-updated",refresh);
  },[]);

  const counts = useMemo(() => statusOrder.map(status => ({
    name: status,
    value: operations.filter(operation => operation.status === status).length
  })), [operations]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || operations.length === 0) return;
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const theme=readChartTheme();
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
        axisLabel: { color: theme.muted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: theme.border, type: "dashed" } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: counts.map(item => item.name),
        axisLabel: { color: theme.text, fontSize: 10, width: 88, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        name: "Saved operations",
        type: "bar",
        barMaxWidth: 16,
        showBackground: true,
        backgroundStyle: { color: theme.panel, borderRadius: 5 },
        itemStyle: { borderRadius: [0, 5, 5, 0] },
        label: { show: true, position: "right", color: theme.text, fontSize: 10 },
        data: counts.map(item => ({
          value: item.value,
          itemStyle: { color: theme.colours[statusOrder.indexOf(item.name as OperationRecord["status"])] }
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
  }, [operations, counts, themeRevision]);

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
        <i style={{ background: readChartTheme().colours[statusOrder.indexOf(item.name)] }} />
        <b>{item.value.toLocaleString("en-IN")}</b> {item.name}
      </span>)}
    </div>
  </div>;
}
