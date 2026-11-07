import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, BarChart3, Box, Boxes, Building2, CircleDollarSign, ClipboardCheck, FileDown, Layers3, MessageCircle, Package, Sparkles, Truck, Users, Wallet } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";
import AXIMACHWebGLSphere from "./AXIMACHWebGLSphere";

type Props = { onSelectModule: (id: string) => void };

type OrbVisualMode = "sphere" | "cube" | "vortex" | "molecular" | "orbit" | "mesh" | "holographic" | "radial" | "particle" | "industrial" | "kinetic" | "multi-core";
type OrbSpeed = "Slow" | "Normal" | "Fast";
function readOrbPreferences(): Record<string, unknown> {
  try { return JSON.parse(window.localStorage.getItem("aximach.orb.preferences.v1") || "{}") as Record<string, unknown>; }
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
  { id: "dispatch", label: "Dispatch", Icon: Truck },
  { id: "quality", label: "Quality", Icon: ClipboardCheck },
  { id: "costing", label: "Cost & Payment", Icon: Wallet },
  { id: "communications", label: "Follow-ups", Icon: MessageCircle },
  { id: "reports", label: "Reports", Icon: BarChart3 },
  { id: "ai-insights", label: "AI Insights", Icon: Sparkles },
  { id: "export", label: "Import / Export", Icon: FileDown },
];

export default function AXIMACHOrb({ onSelectModule }: Props) {
  const saved = useRef(readOrbPreferences());
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
  const [sphereSize, setSphereSize] = useState(() => Number.isFinite(Number(saved.current.sphereSize)) ? Math.max(.82,Math.min(1.12,Number(saved.current.sphereSize))) : 1);
  const [orbitIntensity, setOrbitIntensity] = useState(() => Number.isFinite(Number(saved.current.orbitIntensity)) ? Math.max(0,Math.min(1,Number(saved.current.orbitIntensity))) : 1);
  const [studioOpen, setStudioOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(saved.current.reduceMotion === true);
  const [zoomed, setZoomed] = useState(saved.current.zoomed === true);
  const dragMoved = useRef(false);
  const mobileFrameDelta = useRef(0);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 650px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 650px)");
    const updateCompact = () => setCompactViewport(query.matches);
    query.addEventListener("change", updateCompact);
    return () => query.removeEventListener("change", updateCompact);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("aximach.orb.preferences.v1", JSON.stringify({mode:visualMode,speed,sphereSize,orbitIntensity,reduceMotion,zoomed})); } catch { /* Preferences are optional. */ }
  }, [visualMode,speed,sphereSize,orbitIntensity,reduceMotion,zoomed]);
  const rotateX = useMotionValue(-15);
  const rotateY = useMotionValue(22);
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  // The globe keeps rotating gently at rest; direct pointer/touch rotation takes precedence.
  useAnimationFrame((_time, delta) => {
    if (drag.current || reducedMotion || reduceMotion || paused || document.visibilityState === "hidden") return;
    let frameDelta = delta;
    if (compactViewport) {
      mobileFrameDelta.current += delta;
      if (mobileFrameDelta.current < 32) return;
      frameDelta = mobileFrameDelta.current;
      mobileFrameDelta.current = 0;
    }
    rotateY.set(rotateY.get() + frameDelta * (speed === "Slow" ? 0.0028 : speed === "Fast" ? 0.011 : 0.0065));
  });

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragMoved.current = false;
    drag.current = { x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y) > 6) dragMoved.current = true;
    rotateY.set(drag.current.ry + (event.clientX - drag.current.x) * 0.72);
    rotateX.set(Math.max(-48, Math.min(48, drag.current.rx - (event.clientY - drag.current.y) * 0.55)));
  };
  const endDrag = () => {
    drag.current = null;
    window.setTimeout(() => { dragMoved.current = false; }, 0);
  };
  const toggleZoom = () => {
    if (dragMoved.current) return;
    setZoomed(value => !value);
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
        <motion.div className="ax-orb-depth" style={{transformStyle:"preserve-3d",transformPerspective:950}} animate={reducedMotion || reduceMotion || paused ? undefined : {rotateY:360}} transition={{duration:speed==="Fast"?32:speed==="Slow"?90:58,repeat:Infinity,ease:"linear"}}>
          <motion.div
            className="ax-orb-ring ax-orb-ring-one"
            style={{ opacity: orbitIntensity }}
            animate={reducedMotion || reduceMotion || paused ? undefined : { rotate: 360 }}
            transition={{ duration: speed === "Fast" ? 20 : speed === "Slow" ? 55 : 32, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="ax-orb-ring ax-orb-ring-two"
            style={{ opacity: orbitIntensity }}
            animate={reducedMotion || reduceMotion || paused ? undefined : { rotate: -360 }}
            transition={{ duration: speed === "Fast" ? 28 : speed === "Slow" ? 72 : 46, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="ax-orb-core"
            style={{ rotateX, rotateY, transformPerspective: 950, scale: sphereSize * (zoomed ? 1.2 : 1) }}
            role="button"
            tabIndex={0}
            aria-label={zoomed ? "Zoom out of AXIMACH sphere" : "Zoom in to AXIMACH sphere"}
            aria-pressed={zoomed}
            onClick={toggleZoom}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setZoomed(value => !value); } }}
            animate={reducedMotion || reduceMotion || paused ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <AXIMACHWebGLSphere paused={paused} reduceMotion={reduceMotion || reducedMotion === true} speed={speed} />
            <span className="ax-orb-gloss" />
            <span className="ax-orb-latitude ax-orb-latitude-one" />
            <span className="ax-orb-latitude ax-orb-latitude-two" />
            <span className="ax-orb-latitude ax-orb-latitude-three" />
            <span className="ax-orb-longitude ax-orb-longitude-one" />
            <span className="ax-orb-longitude ax-orb-longitude-two" />
            <span className="ax-orb-longitude ax-orb-longitude-three" />
            <span className="ax-orb-equator" />
            <span className="ax-orb-core-label"><b>AXI</b><strong>MACH</strong><small>MANUFACTURING INTELLIGENCE</small></span>
            <span className="ax-orb-node-dot ax-orb-node-dot-a" />
            <span className="ax-orb-node-dot ax-orb-node-dot-b" />
            <span className="ax-orb-node-dot ax-orb-node-dot-c" />
          </motion.div>
          <motion.div
            className="ax-orb-orbit-line"
            style={{ opacity: orbitIntensity }}
            animate={reducedMotion || reduceMotion || paused ? undefined : { rotate: -360 }}
            transition={{ duration: speed === "Fast" ? 34 : speed === "Slow" ? 90 : 58, repeat: Infinity, ease: "linear" }}
          />

        </motion.div>
        <div className="ax-orb-module-shell" aria-label="18 clickable AXIMACH modules">
          {satellites.map(({ id, label, Icon }, index) => {
            // Keep all 18 controls in the viewer-facing plane so none disappear
            // behind the rotating globe. The globe itself remains independently 3D.
            const angle = (Math.PI * 2 * index) / satellites.length - Math.PI / 2;
            const radiusX = compactViewport ? 145 : 184;
            const radiusY = compactViewport ? 128 : 158;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;
            return <motion.button key={id} type="button" className="ax-orb-satellite"
              style={{ left: "50%", top: "50%", transform: "translate(" + x + "px," + y + "px) translate(-50%,-50%)" }}
              onPointerDown={event => event.stopPropagation()} onClick={() => onSelectModule(id)}
              aria-label={"Open " + label + " module"} title={"Open " + label}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + index * 0.025, type: "spring", stiffness: 130 }} whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.95 }}>
              <span><Icon size={16} strokeWidth={1.8}/></span><small>{label}</small>
            </motion.button>;
          })}
        </div>
      </motion.div>
      <div className="ax-orb-lower-shell" aria-label="Separate live record summary shell">
        <motion.div className="ax-orb-lower-rotator" animate={reducedMotion || reduceMotion || paused ? undefined : { rotateY: 360 }} transition={{ duration: speed === "Fast" ? 24 : speed === "Slow" ? 60 : 38, repeat: Infinity, ease: "linear" }}>
          {shellStats.map(({ id, label, value, Icon }, index) => <button type="button" key={label} className="ax-orb-lower-node"
            style={{ transform: "translate(-50%,-50%) rotateY(" + (index * 60) + "deg) translateZ(" + (compactViewport ? 94 : 132) + "px) rotateY(-" + (index * 60) + "deg)" }}
            onClick={() => onSelectModule(id)} title={"Open " + label}>
            <Icon size={13}/><strong>{value.toLocaleString("en-IN")}</strong><small>{label}</small>
          </button>)}
        </motion.div>
      </div>
      <div className="ax-orb-status ax-orb-status-bottom"><span className="ax-orb-grip">↔</span> DRAG THE SPHERE TO ROTATE <i /> SELECT AN ORBIT NODE TO OPEN A WORKSPACE</div>
      <div className="ax-orb-studio-actions">
        <button type="button" className="ax-orb-studio-toggle" aria-expanded={studioOpen} onClick={() => setStudioOpen(value => !value)}>✧ Visual Experience Studio <span>{studioOpen ? "Close" : "Customize"}</span></button>
        <button type="button" className="ax-orb-pause" onClick={() => setPaused(value => !value)}>{paused ? "Resume motion" : "Pause motion"}</button>
        <button type="button" className="ax-orb-zoom" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "− Zoom out" : "+ Zoom in"}</button>
      </div>
      {studioOpen && <div className="ax-orb-studio-panel">
        <label>Sphere mode<select value={visualMode} onChange={event=>setVisualMode(event.target.value as OrbVisualMode)}><option value="sphere">Classic sphere</option><option value="holographic">Holographic</option><option value="cube">Geometric cube</option><option value="vortex">Vortex</option><option value="molecular">Molecular network</option><option value="orbit">Orbiting planetary</option><option value="radial">Radial command</option><option value="mesh">Digital mesh</option><option value="particle">Particle field</option><option value="industrial">Industrial network topology</option><option value="kinetic">Abstract kinetic geometry</option><option value="multi-core">Multi-layer rotating core</option></select></label>
        <label>Rotation speed<select value={speed} onChange={event=>setSpeed(event.target.value as OrbSpeed)}><option>Slow</option><option>Normal</option><option>Fast</option></select></label>
        <label>Sphere size<input type="range" min=".82" max="1.12" step=".01" value={sphereSize} onChange={event=>setSphereSize(Number(event.target.value))}/><small>{Math.round(sphereSize*100)}%</small></label>
        <label>Orbit intensity<input type="range" min="0" max="1" step=".05" value={orbitIntensity} onChange={event=>setOrbitIntensity(Number(event.target.value))}/><small>{Math.round(orbitIntensity*100)}%</small></label>
        <label className="ax-orb-motion-setting"><input type="checkbox" checked={reduceMotion} onChange={event=>setReduceMotion(event.target.checked)}/> Reduce motion</label>
        <button type="button" className="ax-orb-reset" onClick={()=>{setVisualMode("sphere");setSpeed("Normal");setSphereSize(1);setOrbitIntensity(1);setReduceMotion(false);setPaused(false);setZoomed(false);}}>Reset preferences</button>
      </div>}
      <motion.div className="ax-orb-coordinate" animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }} transition={{ duration: 4.5, repeat: Infinity }}>AX / 360° / LIVE DATA SURFACE</motion.div>
    </div>
  );
}
