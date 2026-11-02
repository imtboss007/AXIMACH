import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, Boxes, Factory, ShieldCheck, Workflow } from "lucide-react";

type Props = { onSelectModule: (id: string) => void };

type OrbVisualMode = "sphere" | "cube" | "vortex" | "molecular" | "orbit" | "mesh";
type OrbSpeed = "Slow" | "Normal" | "Fast";
function readOrbPreferences(): Record<string, unknown> {
  try { return JSON.parse(window.localStorage.getItem("aximach.orb.preferences.v1") || "{}") as Record<string, unknown>; }
  catch { return {}; }
}

const satellites = [
  { id: "companies", label: "Factory", Icon: Factory, className: "factory" },
  { id: "process-map", label: "Process", Icon: Workflow, className: "process" },
  { id: "inventory", label: "Material", Icon: Boxes, className: "material" },
  { id: "quality", label: "Quality", Icon: ShieldCheck, className: "quality" },
  { id: "production", label: "Production", Icon: Activity, className: "production" },
];

export default function AXIMACHOrb({ onSelectModule }: Props) {
  const saved = useRef(readOrbPreferences());
  const [visualMode, setVisualMode] = useState<OrbVisualMode>(() => ["sphere","cube","vortex","molecular","orbit","mesh"].includes(String(saved.current.mode)) ? saved.current.mode as OrbVisualMode : "sphere");
  const [speed, setSpeed] = useState<OrbSpeed>(() => ["Slow","Normal","Fast"].includes(String(saved.current.speed)) ? saved.current.speed as OrbSpeed : "Normal");
  const [sphereSize, setSphereSize] = useState(() => Number.isFinite(Number(saved.current.sphereSize)) ? Math.max(.82,Math.min(1.12,Number(saved.current.sphereSize))) : 1);
  const [orbitIntensity, setOrbitIntensity] = useState(() => Number.isFinite(Number(saved.current.orbitIntensity)) ? Math.max(0,Math.min(1,Number(saved.current.orbitIntensity))) : 1);
  const [studioOpen, setStudioOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(saved.current.reduceMotion === true);
  useEffect(() => {
    try { window.localStorage.setItem("aximach.orb.preferences.v1", JSON.stringify({mode:visualMode,speed,sphereSize,orbitIntensity,reduceMotion})); } catch { /* Preferences are optional. */ }
  }, [visualMode,speed,sphereSize,orbitIntensity,reduceMotion]);
  const rotateX = useMotionValue(-15);
  const rotateY = useMotionValue(22);
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  // The globe keeps rotating gently at rest; direct pointer/touch rotation takes precedence.
  useAnimationFrame((_time, delta) => {
    if (!drag.current && !reducedMotion && !reduceMotion && !paused) rotateY.set(rotateY.get() + delta * (speed === "Slow" ? 0.0028 : speed === "Fast" ? 0.011 : 0.0065));
  });

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    rotateY.set(drag.current.ry + (event.clientX - drag.current.x) * 0.72);
    rotateX.set(Math.max(-48, Math.min(48, drag.current.rx - (event.clientY - drag.current.y) * 0.55)));
  };
  const endDrag = () => { drag.current = null; };

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
        <div className="ax-orb-depth">
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
            style={{ rotateX, rotateY, transformPerspective: 950, scale: sphereSize }}
            animate={reducedMotion || reduceMotion || paused ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="ax-orb-cube-geometry" aria-hidden="true">
              <i className="ax-orb-cube-face ax-cube-front"/><i className="ax-orb-cube-face ax-cube-back"/>
              <i className="ax-orb-cube-face ax-cube-right"/><i className="ax-orb-cube-face ax-cube-left"/>
              <i className="ax-orb-cube-face ax-cube-top"/><i className="ax-orb-cube-face ax-cube-bottom"/>
            </span>
            <span className="ax-orb-vortex-geometry" aria-hidden="true" style={{ animationPlayState: reducedMotion || reduceMotion || paused ? "paused" : "running" }}><i/><i/><i/><i/></span>
            <span className="ax-orb-molecular-geometry" aria-hidden="true">
              <svg viewBox="0 0 200 200">
                <g className="ax-network-links"><path d="M35 48L92 26L151 51L164 119L110 163L49 143L35 48M92 26L110 163M35 48L164 119M151 51L49 143M35 48L110 163M92 26L49 143"/></g>
                <g className="ax-network-nodes"><circle cx="35" cy="48" r="7"/><circle cx="92" cy="26" r="8"/><circle cx="151" cy="51" r="6"/><circle cx="164" cy="119" r="8"/><circle cx="110" cy="163" r="7"/><circle cx="49" cy="143" r="6"/></g>
              </svg>
            </span>
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
          {satellites.map(({ id, label, Icon, className }, index) => (
            <motion.button
              key={id}
              className={`ax-orb-satellite ax-orb-satellite-${className}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelectModule(id)}
              aria-label={`Open ${label} module`}
              title={`Open ${label}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + index * 0.09, type: "spring", stiffness: 130 }}
              whileHover={{ scale: 1.12, y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <span><Icon size={17} strokeWidth={1.8} /></span>
              <small>{label}</small>
            </motion.button>
          ))}
        </div>
      </motion.div>
      <div className="ax-orb-status ax-orb-status-bottom"><span className="ax-orb-grip">↔</span> DRAG THE SPHERE TO ROTATE <i /> SELECT AN ORBIT NODE TO OPEN A WORKSPACE</div>
      <div className="ax-orb-studio-actions">
        <button type="button" className="ax-orb-studio-toggle" aria-expanded={studioOpen} onClick={() => setStudioOpen(value => !value)}>✧ Visual Experience Studio <span>{studioOpen ? "Close" : "Customize"}</span></button>
        <button type="button" className="ax-orb-pause" onClick={() => setPaused(value => !value)}>{paused ? "Resume motion" : "Pause motion"}</button>
      </div>
      {studioOpen && <div className="ax-orb-studio-panel">
        <label>Sphere mode<select value={visualMode} onChange={event=>setVisualMode(event.target.value as OrbVisualMode)}><option value="sphere">Classic sphere</option><option value="cube">Geometric cube</option><option value="vortex">Vortex</option><option value="molecular">Molecular network</option><option value="orbit">Orbiting structure</option><option value="mesh">Digital mesh</option></select></label>
        <label>Rotation speed<select value={speed} onChange={event=>setSpeed(event.target.value as OrbSpeed)}><option>Slow</option><option>Normal</option><option>Fast</option></select></label>
        <label>Sphere size<input type="range" min=".82" max="1.12" step=".01" value={sphereSize} onChange={event=>setSphereSize(Number(event.target.value))}/><small>{Math.round(sphereSize*100)}%</small></label>
        <label>Orbit intensity<input type="range" min="0" max="1" step=".05" value={orbitIntensity} onChange={event=>setOrbitIntensity(Number(event.target.value))}/><small>{Math.round(orbitIntensity*100)}%</small></label>
        <label className="ax-orb-motion-setting"><input type="checkbox" checked={reduceMotion} onChange={event=>setReduceMotion(event.target.checked)}/> Reduce motion</label>
        <button type="button" className="ax-orb-reset" onClick={()=>{setVisualMode("sphere");setSpeed("Normal");setSphereSize(1);setOrbitIntensity(1);setReduceMotion(false);setPaused(false);}}>Reset preferences</button>
      </div>}
      <motion.div className="ax-orb-coordinate" animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }} transition={{ duration: 4.5, repeat: Infinity }}>AX / 360° / LIVE DATA SURFACE</motion.div>
    </div>
  );
}
