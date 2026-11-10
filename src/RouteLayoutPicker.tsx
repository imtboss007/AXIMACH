import { useEffect, useState } from "react";

export type RouteLayoutMode = "orthogonal" | "s-curve" | "horizontal" | "vertical" | "swimlane" | "timeline";

const STORAGE_KEY = "aximach.route-layout.v1";
const EVENT_NAME = "aximach-route-layout-change";
const DEFAULT_LAYOUT: RouteLayoutMode = "orthogonal";
const VALID_LAYOUTS: RouteLayoutMode[] = ["orthogonal", "s-curve", "horizontal", "vertical", "swimlane", "timeline"];

function readLayout(): RouteLayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  const saved = window.localStorage.getItem(STORAGE_KEY) as RouteLayoutMode | null;
  return saved && VALID_LAYOUTS.includes(saved) ? saved : DEFAULT_LAYOUT;
}

export function useRouteLayout() {
  const [layout, setLayoutState] = useState<RouteLayoutMode>(readLayout);
  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as RouteLayoutMode : undefined;
      setLayoutState(detail && VALID_LAYOUTS.includes(detail) ? detail : readLayout());
    };
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const setLayout = (next: RouteLayoutMode) => {
    setLayoutState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    }
  };
  return [layout, setLayout] as const;
}

export function RouteLayoutPicker({ value, onChange, compact = false }: { value: RouteLayoutMode; onChange: (value: RouteLayoutMode) => void; compact?: boolean }) {
  return <label className={"ax-route-layout-picker" + (compact ? " is-compact" : "")}>
    <span>FLOW LAYOUT</span>
    <select aria-label="Choose route flow layout" value={value} onChange={event => onChange(event.target.value as RouteLayoutMode)}>
      <option value="orthogonal">Orthogonal · right-angle connectors</option>
      <option value="s-curve">S-Curve · serpentine</option>
      <option value="horizontal">Horizontal · left to right</option>
      <option value="vertical">Vertical · top to bottom</option>
      <option value="swimlane">Swimlane · grouped route</option>
      <option value="timeline">Timeline · schedule order</option>
    </select>
  </label>;
}
