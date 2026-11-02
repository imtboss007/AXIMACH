import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronLeft, ChevronRight, Layers3, Maximize2, Pause, Play, RotateCcw,
  RotateCw, Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SphereModule = {
  id: string;
  title: string;
  group: string;
  icon: LucideIcon;
  quantity: number;
};

type Props = {
  modules: SphereModule[];
  onOpenModule: (id: string) => void;
  liveOperations: number;
  finishedJobs: number;
  attentionItems: number;
};

const PAGE_SIZE = 12;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const count = (value: number) => Math.max(0, Number(value) || 0).toLocaleString("en-IN");

export default function AxiCommandSphere({
  modules, onOpenModule, liveOperations, finishedJobs, attentionItems
}: Props) {
  const [page, setPage] = useState(0);
  const [dashboardIndex, setDashboardIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"orbit" | "cube">("orbit");
  const [yaw, setYaw] = useState(-9);
  const [pitch, setPitch] = useState(8);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zooming, setZooming] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const pageCount = Math.max(1, Math.ceil(modules.length / PAGE_SIZE));
  const findCount = (id: string) => modules.find(module => module.id === id)?.quantity || 0;
  const dashboardCards = [
    {
      id: "operations", title: "Operations", label: "LIVE PRODUCTION", metric: count(liveOperations),
      metricLabel: "saved operations", detailA: count(finishedJobs) + " finished jobs", detailB: count(attentionItems) + " attention items", target: "production"
    },
    {
      id: "supply", title: "Supply network", label: "VENDOR + PROCESS MASTERS", metric: count(findCount("vendors")),
      metricLabel: "saved vendors", detailA: count(findCount("process-master")) + " process types", detailB: count(findCount("purchasing")) + " open purchase orders", target: "vendors"
    },
    {
      id: "finance", title: "Finance", label: "COST + COMMERCIAL RECORDS", metric: count(findCount("costing")),
      metricLabel: "linked cost records", detailA: count(findCount("component-cost-planner")) + " component plans", detailB: count(findCount("purchasing")) + " purchase orders", target: "costing"
    }
  ];
  const visibleModules = useMemo(
    () => modules.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [modules, page]
  );
  const cubeFaces = useMemo(() => {
    const configs = [
      { id: "front", title: "ENGINEERING", groups: ["Engineering"] },
      { id: "right", title: "OPERATIONS", groups: ["Operations"] },
      { id: "back", title: "COMMERCIAL + SUPPLY", groups: ["Commercial", "Supply Network"] },
      { id: "left", title: "FINANCE", groups: ["Finance"] },
      { id: "top", title: "QUALITY + RELIABILITY", groups: ["Quality & Reliability"] },
      { id: "bottom", title: "CONTROL + INTELLIGENCE", groups: ["Command", "Governance", "Connections", "Insights", "Data & Platform"] }
    ];
    return configs.map(config => ({ ...config, items: modules.filter(module => config.groups.includes(module.group)) }));
  }, [modules]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setYaw(clamp(start.yaw + (event.clientX - start.x) * 0.34, -42, 42));
    setPitch(clamp(start.pitch - (event.clientY - start.y) * 0.2, -18, 26));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const turn = (direction: -1 | 1) => setYaw(value => clamp(value + direction * 12, -42, 42));
  const openWorkspace = (id: string) => {
    if (zooming) return;
    setZooming(true);
    window.setTimeout(() => onOpenModule(id), 250);
  };

  return <section className={"axi-command-universe" + (expanded ? " is-expanded" : "") + (viewMode === "cube" ? " is-cube" : "") + (zooming ? " is-zooming" : "")}>
    <div className="axi-universe-header">
      <div>
        <span className="axi-universe-eyebrow"><i/> LIVING INTELLIGENCE · RECORD-DRIVEN</span>
        <h2>AXIMACH <em>command universe</em></h2>
        <p>One connected manufacturing world. Select an orbital workspace or drag the sphere to explore.</p>
      </div>
      <div className="axi-universe-header-actions">
        <span className="axi-universe-module-count">{count(modules.length)} WORKSPACES</span>
        <button type="button" title={viewMode === "orbit" ? "Switch to 3D cube navigation" : "Switch to orbital navigation"} onClick={() => setViewMode(value => value === "orbit" ? "cube" : "orbit")}>
          <Layers3 size={14}/> {viewMode === "orbit" ? "Cube view" : "Orbital view"}
        </button>
        <button type="button" title={paused ? "Resume rotation" : "Pause rotation"} onClick={() => setPaused(value => !value)}>
          {paused ? <Play size={14}/> : <Pause size={14}/>} {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" title="Reset sphere view" onClick={() => {setYaw(-9);setPitch(8);setPage(0);}}>
          <RotateCcw size={14}/> Reset
        </button>
      </div>
    </div>

    <div className="axi-universe-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Interactive rotating AXIMACH module sphere. Drag to rotate.">
      <div className="axi-universe-ambient axi-ambient-one"/>
      <div className="axi-universe-ambient axi-ambient-two"/>
      <div className="axi-universe-grid"/>
      <div className="axi-universe-scene" style={{ transform: "perspective(1050px) rotateX(" + pitch + "deg) rotateY(" + yaw + "deg)" } as CSSProperties}>
        <div className={"axi-universe-orbit axi-orbit-outer" + (paused ? " is-paused" : "")}/>
        <div className={"axi-universe-orbit axi-orbit-middle" + (paused ? " is-paused" : "")}/>
        <div className={"axi-universe-orbit axi-orbit-inner" + (paused ? " is-paused" : "")}/>
        <div className="axi-universe-equator"/>
        <div className="axi-universe-core">
          <div className="axi-core-shell">
            <div className="axi-core-latitudes"/>
            <div className="axi-core-longitudes"/>
            <div className="axi-core-energy"/>
            <div className="axi-core-logo">AXI<span>MACH</span></div>
            <small>MANUFACTURING INTELLIGENCE</small>
          </div>
          <div className="axi-core-caption"><Sparkles size={12}/> LIVE DATA CORE</div>
        </div>

        <div className={"axi-universe-node-orbit" + (paused ? " is-paused" : "")}>
          {visibleModules.map((module, index) => {
            const angle = (360 / Math.max(1, visibleModules.length)) * index - 90;
            const radians = angle * Math.PI / 180;
            const orbitalRadius = expanded ? 46 : 40.2;
            const x = 50 + Math.cos(radians) * orbitalRadius;
            const y = 50 + Math.sin(radians) * orbitalRadius;
            const Icon = module.icon;
            return <button type="button" key={module.id}
              className={"axi-universe-module-node accent-" + (index % 6)}
              style={{ left: x + "%", top: y + "%", animationPlayState: paused ? "paused" : "running" } as CSSProperties}
              disabled={zooming}
              onClick={() => openWorkspace(module.id)}
              title={module.title + " · " + count(module.quantity) + " records"}
              aria-label={"Open " + module.title + ", " + count(module.quantity) + " records"}>
              <span className="axi-universe-node-icon"><Icon size={19}/></span>
              <strong>{count(module.quantity)}</strong>
              <span className="axi-universe-node-label">{module.title}</span>
            </button>;
          })}
        </div>
        <span className="axi-universe-coordinate coordinate-north">AX / 00</span>
        <span className="axi-universe-coordinate coordinate-east">LIVE / SYNC</span>
        <span className="axi-universe-coordinate coordinate-south">PRECISION · TRACEABLE · CONNECTED</span>
        <div className="axi-universe-cube" aria-label="Six-sided workspace cube">
          {cubeFaces.map(face => {
            const transform = face.id === "front" ? "translateZ(128px)" :
              face.id === "back" ? "rotateY(180deg) translateZ(128px)" :
              face.id === "right" ? "rotateY(90deg) translateZ(128px)" :
              face.id === "left" ? "rotateY(-90deg) translateZ(128px)" :
              face.id === "top" ? "rotateX(90deg) translateZ(128px)" :
              "rotateX(-90deg) translateZ(128px)";
            return <section className={"axi-universe-cube-face cube-" + face.id} key={face.id} style={{transform}}>
              <strong>{face.title}</strong>
              <div className="axi-cube-face-modules">
                {face.items.map(module => {
                  const Icon = module.icon;
                  return <button type="button" key={module.id} disabled={zooming} onClick={() => openWorkspace(module.id)} title={module.title}>
                    <Icon size={17}/><span>{module.title}</span><b>{count(module.quantity)}</b>
                  </button>;
                })}
                {!face.items.length && <small>No approved workspace in this area</small>}
              </div>
            </section>;
          })}
        </div>
      </div>
      <div className="axi-universe-stage-controls">
        <button type="button" title="Rotate left" onClick={() => turn(-1)}><RotateCcw size={14}/></button>
        <button type="button" title="Rotate right" onClick={() => turn(1)}><RotateCw size={14}/></button>
        <button type="button" title={expanded ? "Collapse orbital layout" : "Fan out orbital workspaces"} onClick={() => setExpanded(value => !value)}><Maximize2 size={14}/></button>
      </div>
      <span className="axi-universe-drag-hint">{viewMode === "orbit" ? (expanded ? "FAN-OUT · DRAG · TOUCH · SELECT ICON" : "DRAG · TOUCH · SELECT ORBITAL ICON") : "DRAG TO ROTATE THE SIX-SIDED WORKSPACE CUBE"}</span>
    </div>

    <div className="axi-dashboard-carousel" aria-label="3D live dashboard carousel">
      <div className="axi-dashboard-carousel-heading">
        <span><i/> FLOATING DASHBOARD DECK</span>
        <div><button type="button" aria-label="Previous dashboard" onClick={() => setDashboardIndex(value => (value + dashboardCards.length - 1) % dashboardCards.length)}><ChevronLeft size={14}/></button><button type="button" aria-label="Next dashboard" onClick={() => setDashboardIndex(value => (value + 1) % dashboardCards.length)}><ChevronRight size={14}/></button></div>
      </div>
      <div className="axi-dashboard-carousel-track">
        {dashboardCards.map((card,index) => {
          const relative = (index - dashboardIndex + dashboardCards.length) % dashboardCards.length;
          const position = relative === 0 ? "center" : relative === 1 ? "right" : "left";
          return <button type="button" key={card.id} className={"axi-dashboard-float-card deck-" + position + (relative === 0 ? " is-selected" : "")}
            style={{transform:relative===0?"translateX(0) translateZ(42px) rotateY(0deg)":relative===1?"translateX(59%) translateZ(-78px) rotateY(-24deg)":"translateX(-59%) translateZ(-78px) rotateY(24deg)",zIndex:relative===0?3:1,opacity:relative===0?1:.68}}
            onClick={() => relative===0 ? openWorkspace(card.target) : setDashboardIndex(index)}>
            <small>{card.label}</small><strong>{card.title}</strong><b>{card.metric}</b><span>{card.metricLabel}</span>
            <div><em>{card.detailA}</em><em>{card.detailB}</em></div>
            <i>OPEN LIVE VIEW <ChevronRight size={11}/></i>
          </button>;
        })}
      </div>
    </div>
    <div className="axi-universe-footer">
      <div className="axi-universe-signals">
        <div><small>ACTIVE OPERATIONS</small><strong>{count(liveOperations)}</strong></div>
        <div><small>FINISHED JOBS</small><strong>{count(finishedJobs)}</strong></div>
        <div><small>ATTENTION ITEMS</small><strong>{count(attentionItems)}</strong></div>
      </div>
      <div className="axi-universe-pager">
        <span>{String(page + 1).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}</span>
        <button type="button" aria-label="Previous orbital workspaces" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={15}/></button>
        <button type="button" aria-label="Next orbital workspaces" disabled={page >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight size={15}/></button>
      </div>
    </div>
  </section>;
}
