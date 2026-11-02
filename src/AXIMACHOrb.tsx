import { lazy, Suspense, useState } from "react";
import LegacyOrb from "./AXIMACHOrbLegacy";
const WebGLOrb = lazy(() => import("./AXIMACHOrbWebGL"));
export type OrbCounts = { companies: number; jobs: number; components: number; stockEvents: number; qualityFlags: number; processSteps: number };
type Props = { onSelectModule: (id: string) => void; counts: OrbCounts };
export default function AXIMACHOrb({ onSelectModule, counts }: Props) {
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  if (webglUnavailable) return <div className="ax-orb-webgl-fallback"><div className="ax-orb-fallback-note">WebGL is unavailable on this device. Interactive fallback mode is active.</div><LegacyOrb onSelectModule={onSelectModule} /></div>;
  return <Suspense fallback={<div className="axr-loading-core"><span className="axr-loading-ring" /><b>ASSEMBLING AXIMACH CORE</b><small>Preparing the 3D command environment…</small></div>}>
    <WebGLOrb onSelectModule={onSelectModule} counts={counts} onFailure={() => setWebglUnavailable(true)} />
  </Suspense>;
}