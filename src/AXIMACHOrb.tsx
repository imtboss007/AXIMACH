import { lazy, Suspense, useState } from "react";
import { Sparkles } from "lucide-react";
import LegacyOrb from "./AXIMACHOrbLegacy";
const WebGLOrb = lazy(() => import("./AXIMACHOrbWebGL"));
const InfiniteRealityLab = lazy(() => import("./InfiniteRealityLab"));
export type OrbCounts = { companies: number; jobs: number; components: number; stockEvents: number; qualityFlags: number; processSteps: number };
type Props = { onSelectModule: (id: string) => void; counts: OrbCounts };
export default function AXIMACHOrb({ onSelectModule, counts }: Props) {
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [realityLabOpen, setRealityLabOpen] = useState(false);
  return <>
    {webglUnavailable
      ? <div className="ax-orb-webgl-fallback"><div className="ax-orb-fallback-note">WebGL is unavailable on this device. Interactive fallback mode is active.</div><LegacyOrb onSelectModule={onSelectModule} /></div>
      : <Suspense fallback={<div className="axr-loading-core"><span className="axr-loading-ring" /><b>ASSEMBLING AXIMACH CORE</b><small>Preparing the 3D command environment…</small></div>}>
          <WebGLOrb onSelectModule={onSelectModule} counts={counts} onFailure={() => setWebglUnavailable(true)} />
        </Suspense>}
    <div className="axr-orb-reality-launcher"><button type="button" onClick={() => setRealityLabOpen(true)}><Sparkles size={14}/> INFINITE REALITY LAB <span>OPEN</span></button></div>
    {realityLabOpen && <Suspense fallback={<div className="irl-loading">Opening spatial environment…</div>}><InfiniteRealityLab counts={counts} onClose={() => setRealityLabOpen(false)} /></Suspense>}
  </>;
}