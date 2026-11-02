import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, Boxes, Factory, ShieldCheck, Workflow } from "lucide-react";

type Props = { onSelectModule: (id: string) => void };

const satellites = [
  { id: "companies", label: "Factory", Icon: Factory, className: "factory" },
  { id: "process-map", label: "Process", Icon: Workflow, className: "process" },
  { id: "inventory", label: "Material", Icon: Boxes, className: "material" },
  { id: "quality", label: "Quality", Icon: ShieldCheck, className: "quality" },
  { id: "production", label: "Production", Icon: Activity, className: "production" },
];

export default function AXIMACHOrb({ onSelectModule }: Props) {
  const rotateX = useMotionValue(-15);
  const rotateY = useMotionValue(22);
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  // The globe keeps rotating gently at rest; direct pointer/touch rotation takes precedence.
  useAnimationFrame((_time, delta) => {
    if (!drag.current && !reducedMotion) rotateY.set(rotateY.get() + delta * 0.0065);
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
    <div className="ax-orb-stage">
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
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="ax-orb-ring ax-orb-ring-two"
            animate={reducedMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="ax-orb-core"
            style={{ rotateX, rotateY, transformPerspective: 950 }}
            animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
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
            animate={reducedMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 58, repeat: Infinity, ease: "linear" }}
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
      <motion.div className="ax-orb-coordinate" animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }} transition={{ duration: 4.5, repeat: Infinity }}>AX / 360° / LIVE DATA SURFACE</motion.div>
    </div>
  );
}
