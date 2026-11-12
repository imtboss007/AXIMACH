import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, BarChart3, Box, Boxes, Building2, CircleDollarSign, ClipboardCheck, FileDown, GitBranch, Layers3, MessageCircle, Network, Package, Sparkles, Truck, Users, Wallet } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";
import AXIMACHWebGLSphere from "./AXIMACHWebGLSphere";

type Props = { onSelectModule: (id: string) => void; surface: "dashboard" | "command-centre" };

type OrbVisualMode = "sphere" | "cube" | "vortex" | "molecular" | "orbit" | "mesh" | "holographic" | "radial" | "particle" | "industrial" | "kinetic" | "multi-core";
type OrbSpeed = "Slow" | "Normal" | "Fast";
function readOrbPreferences(storageKey: string): Record<string, unknown> {
  try { return JSON.parse(window.localStorage.getItem(storageKey) || "{}") as Record<string, unknown>; }
  catch { return {}; }
}

const satellites = [
  { id: "companies", label: "Company", Icon: Building2 },
  { id: "components", label: "Components", Icon: Box },
  { id: "purchasing", label: "Purchase Orders", Icon: Package },
  { id: "vendors", label: "Vendors", Icon: Users },
  { id: "transport-master", label: "Transport Directory", Icon: Truck },
  { id: "contact360", label: "Contact 360", Icon: Users },
  { id: "process-master", label: "Process Directory", Icon: Layers3 },
  { id: "planned-cost", label: "Planned Cost", Icon: CircleDollarSign },
  { id: "vendor-capability", label: "Vendor Network", Icon: Users },
  { id: "inventory", label: "BOM & Inventory", Icon: Boxes },
  { id: "production", label: "Production Plan", Icon: Activity },
  { id: "route-flow", label: "Route Flow", Icon: GitBranch },
  { id: "manufacturing-universe", label: "Manufacturing Universe", Icon: Network },
  { id: "dispatch", label: "Dispatch", Icon: Truck },
  { id: "quality", label: "Quality", Icon: ClipboardCheck },
  { id: "costing", label: "Cost & Payment", Icon: Wallet },
  { id: "communications", label: "Follow-ups", Icon: MessageCircle },
  { id: "reports", label: "Reports", Icon: BarChart3 },
  { id: "ai-insights", label: "AI Insights", Icon: Sparkles },
  { id: "export", label: "Import / Export", Icon: FileDown },
];

export default function AXIMACHOrb({ onSelectModule, surface }: Props) {
  const preferenceKey = surface === "command-centre" ? "aximach.command-centre.orb.preferences.v1" : "aximach.orb.preferences.v1";
  const saved = useRef(readOrbPreferences(preferenceKey));
  const { data } = useManufacturingData();
  const shellStats = [
    { id: "companies", label: "Companies", value: activeRows(data.companies).length, Icon: Building2 },
    { id: "purchasing", label: "Purchase orders", value: activeRows(data.purchaseOrders).length, Icon: Package },
    { id: "purchasing", label: "PO component lines", value: activeRows(data.purchaseOrders).reduce((total, po) => total + po.lines.filter(line => !line.deletedAt).length, 0), Icon: Boxes },
    { id: "components", label: "Components", value: activeRows(data.components).length, Icon: Box },
    { id: "vendors", label: "Vendors", value: activeRows(data.vendors).length, Icon: Users },
    { id: "production", label: "Open operations", value: activeRows(data.operations).filter(operation => operation.status !== "Complete").length, Icon: Activity }
  ];
  const [visualMode, setVisualMode] = useState<OrbVisualMode>(() => ["sphere","cube","vortex","molecular","orbit","mesh","holographic","radial","particle","industrial","kinetic","multi-core"].includes(String(saved.current.mode)) ? saved.current.mode as OrbVisualMode : "sphere");
  const [speed, setSpeed] = useState<OrbSpeed>(() => ["Slow","Normal","Fast"].includes(String(saved.current.speed)) ? saved.current.speed as OrbSpeed : "Normal");
  const [sphereSize, setSphereSize] = useState(() => Number.isFinite(Number(saved.current.sphereSize)) ? Math.max(.60,Math.min(1.12,Number(saved.current.sphereSize))) : 1);
  const [orbitIntensity, setOrbitIntensity] = useState(() => Number.isFinite(Number(saved.current.orbitIntensity)) ? Math.max(0,Math.min(1,Number(saved.current.orbitIntensity))) : 1);
  const [studioOpen, setStudioOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(saved.current.reduceMotion === true);
  const [autoRotate, setAutoRotate] = useState(saved.current.autoRotate !== false);
  // Both shells auto-rotate while idle. Manual pointer/touch drag takes over
  // immediately and the frame loop resumes after the pointer is released.
  const [moduleRotationEnabled, setModuleRotationEnabled] = useState(saved.current.moduleRotationEnabled !== false);
  const [recordRotationEnabled, setRecordRotationEnabled] = useState(saved.current.recordRotationEnabled !== false);
  const [zoomed, setZoomed] = useState(saved.current.zoomed === true);
  const dragMoved = useRef(false);
  const lowerDragMoved = useRef(false);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 650px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 650px)");
    const updateCompact = () => setCompactViewport(query.matches);
    query.addEventListener("change", updateCompact);
    return () => query.removeEventListener("change", updateCompact);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(preferenceKey, JSON.stringify({mode:visualMode,speed,sphereSize,orbitIntensity,reduceMotion,autoRotate,zoomed,moduleRotationEnabled,recordRotationEnabled})); } catch { /* Preferences are optional. */ }
  }, [visualMode,speed,sphereSize,orbitIntensity,reduceMotion,autoRotate,zoomed,moduleRotationEnabled,recordRotationEnabled,preferenceKey]);
  // Both shells auto-rotate while idle; direct pointer/touch drag takes over
  // immediately, then idle rotation resumes after release. A front-facing
  // starting angle keeps the full 3D shell legible on narrow phone viewports.
  const rotateX = useMotionValue(compactViewport ? -7 : -15);
  const rotateY = useMotionValue(compactViewport ? 0 : 22);
  const lowerRotateX = useMotionValue(compactViewport ? -5 : -8);
  const lowerRotateY = useMotionValue(compactViewport ? 0 : 12);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const lowerDrag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const dragSensitivity = speed === "Slow" ? 0.45 : speed === "Fast" ? 0.95 : 0.72;
  useEffect(() => {
    if (!autoRotate || reduceMotion || reducedMotion) return;
    let frame = 0;
    let previousTime = 0;
    const degreesPerSecond = speed === "Slow" ? 3.5 : speed === "Fast" ? 11 : 7;
    const tick = (time: number) => {
      if (previousTime > 0) {
        const delta = Math.min(50, time - previousTime) / 1000;
        if (!drag.current) rotateY.set(rotateY.get() + delta * degreesPerSecond);
        if (!lowerDrag.current) lowerRotateY.set(lowerRotateY.get() + delta * degreesPerSecond * 0.72);
      }
      previousTime = time;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [autoRotate, reduceMotion, reducedMotion, speed, rotateY, lowerRotateY]);
  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    dragMoved.current = false;
    if (!moduleRotationEnabled) return;
    // Interactive descendants must receive their own press/click sequence.
    // Capturing their pointer on the surrounding drag surface can retarget
    // pointerup/click and make module buttons appear unselectable.
    const interactiveTarget = event.target instanceof Element
      ? event.target.closest("button, a, input, select, textarea")
      : null;
    if (interactiveTarget) return;
    drag.current = { x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get() };
    const captureTarget = event.target instanceof HTMLElement ? event.target : event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    if (Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y) > 6) dragMoved.current = true;
    rotateY.set(drag.current.ry + (event.clientX - drag.current.x) * dragSensitivity);
    rotateX.set(Math.max(-48, Math.min(48, drag.current.rx - (event.clientY - drag.current.y) * dragSensitivity * 0.76)));
  };
  const endDrag = () => {
    drag.current = null;
    window.setTimeout(() => { dragMoved.current = false; }, 0);
  };
  const toggleZoom = () => {
    if (dragMoved.current) return;
    setZoomed(value => !value);
  };
  const startLowerDrag = (event: ReactPointerEvent<HTMLElement>) => {
    lowerDragMoved.current = false;
    if (!recordRotationEnabled) return;
    lowerDrag.current = { x: event.clientX, y: event.clientY, rx: lowerRotateX.get(), ry: lowerRotateY.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveLowerDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!lowerDrag.current) return;
    if (Math.abs(event.clientX-lowerDrag.current.x)+Math.abs(event.clientY-lowerDrag.current.y)>6) lowerDragMoved.current = true;
    lowerRotateY.set(lowerDrag.current.ry+(event.clientX-lowerDrag.current.x)*dragSensitivity);
    lowerRotateX.set(Math.max(-42,Math.min(42,lowerDrag.current.rx-(event.clientY-lowerDrag.current.y)*dragSensitivity*0.72)));
  };
  const endLowerDrag = () => {
    lowerDrag.current = null;
    window.setTimeout(()=>{lowerDragMoved.current=false;},0);
  };

  return (
    <div className={"ax-orb-stage ax-orb-mode-" + visualMode}>
      <div className="ax-orb-stage-grid" />
      <div className="ax-orb-status ax-orb-status-top"><span /> AXIMACH / CONNECTED OPERATIONS</div>
      <motion.div
        className="ax-orb-drag-zone"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
        initial={{ opacity: 0, scale: 0.82, y: 22 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 85, damping: 18, delay: 0.12 }}
      >
        <motion.div
          className="ax-orb-core"
          style={{ transformStyle: "preserve-3d", scale: sphereSize * (compactViewport ? 0.78 : 1) * (zoomed ? 1.2 : 1) }}
          role="button"
          tabIndex={0}
          aria-label={zoomed ? "Zoom out of AXIMACH sphere" : "Zoom in to AXIMACH sphere"}
          aria-pressed={zoomed}
          onClick={() => { if (!dragMoved.current) toggleZoom(); }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setZoomed(value => !value); } }}
        >
          <AXIMACHWebGLSphere rotationX={rotateX} rotationY={rotateY} />
          <span className="ax-orb-gloss" />
          <span className="ax-orb-core-label"><b>AXI</b><strong>MACH</strong><small>MANUFACTURING INTELLIGENCE</small></span>
        </motion.div>
        <motion.div className="ax-orb-depth" style={{rotateX,rotateY,transformStyle:"preserve-3d",transformPerspective:950}}>
          <motion.div
            className="ax-orb-ring ax-orb-ring-one"
            style={{ opacity: orbitIntensity }}
          />
          <motion.div
            className="ax-orb-ring ax-orb-ring-two"
            style={{ opacity: orbitIntensity }}
          />
          <motion.div
            className="ax-orb-orbit-line"
            style={{ opacity: orbitIntensity }}
          />

        <motion.div
          className="ax-orb-module-shell"
          style={{ transformStyle: "preserve-3d", scale: sphereSize * (compactViewport ? 0.78 : 1) * (zoomed ? 1.2 : 1) }}
          aria-label={`${satellites.length} clickable AXIMACH modules`}
        >
          {satellites.map(({ id, label, Icon }, index) => {
            // Fibonacci-sphere placement distributes all module controls
            // over the complete spherical surface, not only a front-facing
            // ellipse. Each control's local face points out from the sphere;
            // backface-visibility hides nodes on the far side until the user
            // manually rotates them into view.
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const unitY = 1 - 2 * ((index + 0.5) / satellites.length);
            const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY));
            const angle = index * goldenAngle;
            const unitX = Math.cos(angle) * ringRadius;
            const unitZ = Math.sin(angle) * ringRadius;
            const radius = compactViewport ? 116 : 132;
            const x = unitX * radius;
            const y = unitY * radius;
            const z = unitZ * radius;
            const yaw = Math.atan2(unitX, unitZ) * 180 / Math.PI;
            const pitch = -Math.asin(unitY) * 180 / Math.PI;
            return <button key={id} type="button" className="ax-orb-satellite ax-orb-satellite-3d"
              style={{ left: "50%", top: "50%", transform: "translate3d(" + x + "px," + y + "px," + z + "px) translate(-50%,-50%) rotateY(" + yaw + "deg) rotateX(" + pitch + "deg)" }}
              onClick={() => { if (!dragMoved.current) onSelectModule(id); }}
              aria-label={"Open " + label + " module"} title={"Open " + label}>
              <span><Icon size={15} strokeWidth={1.8}/></span><small>{label}</small>
            </button>;
          })}
        </motion.div>
        </motion.div>
      </motion.div>
      {compactViewport ? <div className="ax-orb-lower-summary-grid" aria-label="Live record summaries">{shellStats.map(({id,label,value,Icon})=><button type="button" key={id} className="ax-orb-lower-summary-card" onClick={()=>onSelectModule(id)}><Icon size={16}/><strong>{value.toLocaleString("en-IN")}</strong><small>{label}</small></button>)}</div> : <div className="ax-orb-lower-shell" aria-label="Separate live record summary shell" onPointerDown={startLowerDrag} onPointerMove={moveLowerDrag} onPointerUp={endLowerDrag} onPointerCancel={endLowerDrag} style={{touchAction:"none"}}>
        <motion.div className="ax-orb-lower-rotator" style={{rotateX:lowerRotateX,rotateY:lowerRotateY,transformStyle:"preserve-3d"}}>
          {shellStats.map(({ id, label, value, Icon }, index) => <button type="button" key={label} className="ax-orb-lower-node"
            style={{ transform: "translate(-50%,-50%) rotateY(" + (index * 60) + "deg) translateZ(" + (compactViewport ? 94 : 132) + "px) rotateY(-" + (index * 60) + "deg)" }}
            onPointerDown={event=>{event.stopPropagation();startLowerDrag(event);}}
            onPointerMove={event=>{event.stopPropagation();moveLowerDrag(event);}}
            onPointerUp={event=>{event.stopPropagation();endLowerDrag();}}
            onPointerCancel={event=>{event.stopPropagation();endLowerDrag();}}
            onClick={() => { if (!lowerDragMoved.current) onSelectModule(id); }} title={"Open " + label}>
            <Icon size={13}/><strong>{value.toLocaleString("en-IN")}</strong><small>{label}</small>
          </button>)}
        </motion.div>
      </div>}
      <div className="ax-orb-status ax-orb-status-bottom"><span className="ax-orb-grip">↔</span> AUTO ROTATION · {autoRotate && !reduceMotion && !reducedMotion ? "ON" : "PAUSED"} <i/> MODULE SHELL · {moduleRotationEnabled ? "DRAG ENABLED" : "LOCKED"} <i/> RECORD SHELL · {recordRotationEnabled ? "DRAG ENABLED" : "LOCKED"}</div>
      <div className="ax-orb-studio-actions">
        <button type="button" className="ax-orb-pause" aria-pressed={!autoRotate} onClick={() => setAutoRotate(value => !value)}>{autoRotate ? "Ⅱ Pause auto-rotation" : "▶ Resume auto-rotation"}</button>
        <button type="button" className="ax-orb-studio-toggle" aria-expanded={studioOpen} onClick={() => setStudioOpen(value => !value)}>✧ Visual Experience Studio <span>{studioOpen ? "Close" : "Customize"}</span></button>
        <button type="button" className="ax-orb-pause" aria-pressed={!moduleRotationEnabled} onClick={() => setModuleRotationEnabled(value => !value)}>{moduleRotationEnabled ? "Ⅱ Lock modules" : "▶ Enable module drag"}</button>
        <button type="button" className="ax-orb-pause ax-orb-record-pause" aria-pressed={!recordRotationEnabled} onClick={() => setRecordRotationEnabled(value => !value)}>{recordRotationEnabled ? "Ⅱ Lock records" : "▶ Enable record drag"}</button>
        <button type="button" className="ax-orb-zoom" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "− Zoom out" : "+ Zoom in"}</button>
      </div>
      {studioOpen && <div className="ax-orb-studio-panel">
        <label>Sphere mode<select value={visualMode} onChange={event=>setVisualMode(event.target.value as OrbVisualMode)}><option value="sphere">Classic sphere</option><option value="holographic">Holographic</option><option value="cube">Geometric cube</option><option value="vortex">Vortex</option><option value="molecular">Molecular network</option><option value="orbit">Orbiting planetary</option><option value="radial">Radial command</option><option value="mesh">Digital mesh</option><option value="particle">Particle field</option><option value="industrial">Industrial network topology</option><option value="kinetic">Abstract kinetic geometry</option><option value="multi-core">Multi-layer rotating core</option></select></label>
        <label>Drag sensitivity<select value={speed} onChange={event=>setSpeed(event.target.value as OrbSpeed)}><option>Slow</option><option>Normal</option><option>Fast</option></select></label>
        <label>Sphere size<input type="range" min=".60" max="1.12" step=".01" value={sphereSize} onChange={event=>setSphereSize(Number(event.target.value))}/><small>{Math.round(sphereSize*100)}%</small></label>
        <label>Orbit intensity<input type="range" min="0" max="1" step=".05" value={orbitIntensity} onChange={event=>setOrbitIntensity(Number(event.target.value))}/><small>{Math.round(orbitIntensity*100)}%</small></label>
        <label className="ax-orb-motion-setting"><input type="checkbox" checked={reduceMotion} onChange={event=>setReduceMotion(event.target.checked)}/> Reduce motion</label>
        <button type="button" className="ax-orb-reset" onClick={()=>{setVisualMode("sphere");setSpeed("Normal");setSphereSize(1);setOrbitIntensity(1);setReduceMotion(false);setAutoRotate(true);setModuleRotationEnabled(true);setRecordRotationEnabled(true);setZoomed(false);}}>Reset preferences</button>
      </div>}
      <motion.div className="ax-orb-coordinate" animate={reducedMotion || reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }} transition={{ duration: 4.5, repeat: Infinity }}>AX / 360° / LIVE DATA SURFACE</motion.div>
    </div>
  );
}
