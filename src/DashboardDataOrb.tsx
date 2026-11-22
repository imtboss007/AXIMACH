import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";

export type DashboardDataOrbItem = {
  id: string;
  label: string;
  value: string | number;
  moduleId: string;
  Icon?: LucideIcon;
};

type Props = {
  title: string;
  subtitle: string;
  items: DashboardDataOrbItem[];
  onSelectModule: (moduleId: string) => void;
};

/** Compact true-3D CSS/Motion data shell. Every satellite remains a real navigation button. */
export default function DashboardDataOrb({ title, subtitle, items, onSelectModule }: Props) {
  const reduceMotion = Boolean(useReducedMotion());
  const visibleItems = items.slice(0, 8);
  const count = Math.max(visibleItems.length, 1);

  return (
    <article className="dashboard-data-orb-card">
      <header className="dashboard-data-orb-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-mark" /> LIVE DATA SPHERE</div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="dashboard-data-orb-count">{visibleItems.length}</span>
      </header>
      <div className="dashboard-data-orb-scene" role="group" aria-label={title + " rotating 3D data sphere"}>
        <motion.div
          className="dashboard-data-orb-rotator"
          animate={reduceMotion ? undefined : { rotateY: 360, rotateX: 9 }}
          transition={reduceMotion ? undefined : { rotateY: { duration: 34, repeat: Infinity, ease: "linear" }, rotateX: { duration: 34, repeat: Infinity, ease: "linear" } }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="dashboard-data-orb-core" aria-hidden="true">
            <span className="dashboard-data-orb-core-glint" />
            <span className="dashboard-data-orb-latitude" />
            <span className="dashboard-data-orb-meridian" />
          </div>
          {visibleItems.map((item, index) => {
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
            const radius = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = goldenAngle * index;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            const yaw = Math.atan2(x, z) * 180 / Math.PI;
            const pitch = -Math.asin(y) * 180 / Math.PI;
            const Icon = item.Icon;
            return (
              <button
                type="button"
                key={item.id}
                className="dashboard-data-orb-node"
                style={{ transform: `translate(-50%,-50%) translate3d(${x * 69}px,${-y * 69}px,${z * 69}px) rotateY(${yaw}deg) rotateX(${pitch}deg)` }}
                onClick={() => onSelectModule(item.moduleId)}
                title={item.label + " · " + item.value}
                aria-label={"Open " + item.label + " in " + item.moduleId}
              >
                {Icon && <Icon size={13} aria-hidden="true" />}
                <strong>{String(item.value)}</strong>
                <small>{item.label}</small>
              </button>
            );
          })}
        </motion.div>
      </div>
      <footer className="dashboard-data-orb-footer">
        <span><i /> Derived from saved records</span>
        <button type="button" onClick={() => onSelectModule(visibleItems[0]?.moduleId || "reports")}>Open details <span aria-hidden="true">↗</span></button>
      </footer>
    </article>
  );
}
