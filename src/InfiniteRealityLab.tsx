import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Activity, Boxes, Factory, Gauge, Network, RotateCcw, ShieldCheck, Workflow, X, Waves, Sparkles, Move3D, Plug, SlidersHorizontal } from "lucide-react";
import type { OrbCounts } from "./AXIMACHOrb";
import "./infinite-reality.css";

type Props = { counts: OrbCounts; onClose: () => void };
type Mode = "fluid" | "cloth" | "soft";
type Transition = "orbit" | "flythrough" | "dolly" | "roll" | "whip-pan" | "depth-shift";
type Protocol = "OPC UA" | "Modbus TCP" | "MTConnect" | "REST gateway";
type Scenario = { rate: number; hours: number; availability: number; downtime: number; scrap: number; orderQty: number };

const modes: Array<{ id: Mode; label: string; detail: string }> = [
  { id: "fluid", label: "Fluid field", detail: "Particle advection and flow-field interaction" },
  { id: "cloth", label: "Cloth dynamics", detail: "Verlet mesh, pinned constraints and pointer forces" },
  { id: "soft", label: "Soft body", detail: "Deformable surface and elastic recovery" },
];
const transitions: Array<{ id: Transition; label: string }> = [
  { id: "orbit", label: "Orbit sweep" }, { id: "flythrough", label: "Fly-through" },
  { id: "dolly", label: "Dolly zoom" }, { id: "roll", label: "Axial roll" },
  { id: "whip-pan", label: "Whip pan" }, { id: "depth-shift", label: "Depth shift" },
];

function createPanelTexture(title: string, value: string, caption: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, "#102b47"); gradient.addColorStop(1, "#071421");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 360);
    ctx.strokeStyle = "rgba(129,190,235,.32)"; ctx.lineWidth = 2; ctx.strokeRect(18, 18, 604, 324);
    ctx.fillStyle = accent; ctx.font = "600 20px Arial"; ctx.fillText("AXIMACH / SPATIAL WORKSPACE", 42, 65);
    ctx.fillStyle = "#e6f4ff"; ctx.font = "600 30px Arial"; ctx.fillText(title.toUpperCase(), 42, 128);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 62px Arial"; ctx.fillText(value, 42, 228);
    ctx.fillStyle = "#8aa9c4"; ctx.font = "18px Arial"; ctx.fillText(caption.toUpperCase(), 42, 278);
    ctx.fillStyle = accent; ctx.fillRect(42, 303, 556, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function calculateOutput(s: Scenario) {
  const productiveHours = Math.max(0, s.hours * s.availability / 100 - s.downtime);
  const goodPartsPerShift = Math.max(0, productiveHours * s.rate * (1 - s.scrap / 100));
  return { productiveHours, goodPartsPerShift, shiftsForOrder: goodPartsPerShift > 0 ? s.orderQty / goodPartsPerShift : Infinity };
}

export default function InfiniteRealityLab({ counts, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("fluid");
  const [transition, setTransition] = useState<Transition>("orbit");
  const [postFx, setPostFx] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [material, setMaterial] = useState("plasma");
  const [iconMotion, setIconMotion] = useState("orbit");
  const [protocol, setProtocol] = useState<Protocol>("OPC UA");
  const [machineName, setMachineName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [scenario, setScenario] = useState<Scenario>({ rate: 48, hours: 8, availability: 85, downtime: 0.5, scrap: 2, orderQty: 1200 });
  const output = useMemo(() => calculateOutput(scenario), [scenario]);
  const upside = useMemo(() => calculateOutput({ ...scenario, rate: scenario.rate * 1.1, availability: Math.min(100, scenario.availability + 5) }), [scenario]);
  const stress = useMemo(() => calculateOutput({ ...scenario, availability: Math.max(0, scenario.availability - 15), downtime: scenario.downtime + 1, scrap: Math.min(100, scenario.scrap + 3) }), [scenario]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false });
    } catch {
      host.innerHTML = '<div class="irl-no-webgl">WebGL is not available on this device. Enable hardware acceleration or use a supported graphics driver.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06111d);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.2, 9.5);
    scene.add(new THREE.HemisphereLight(0x9bdcff, 0x07111e, 1.6));
    const key = new THREE.PointLight(0x59c9ff, 180, 30, 2); key.position.set(-4, 5, 7); scene.add(key);
    const rim = new THREE.PointLight(0x986bff, 120, 24, 2); rim.position.set(4, -2, -4); scene.add(rim);
    const grid = new THREE.GridHelper(22, 44, 0x1b5b83, 0x102d45); grid.position.y = -2.05; scene.add(grid);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.92, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x0c5686, metalness: 0.6, roughness: 0.2, clearcoat: 1, emissive: 0x07365e, emissiveIntensity: 0.75 }));
    core.position.set(0, 0.1, 0); scene.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.018, 10, 160), new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.7 }));
    halo.rotation.set(0.8, 0.2, 0.1); scene.add(halo);

    // Fluid-field demonstration: advected particles, not a CFD solver.
    const fluidCount = 2400;
    const fluidStart = new Float32Array(fluidCount * 3);
    const fluidPositions = new Float32Array(fluidCount * 3);
    for (let i = 0; i < fluidCount; i++) {
      const angle = Math.random() * Math.PI * 2, radius = 1.15 + Math.random() * 1.7;
      fluidStart[i * 3] = Math.cos(angle) * radius;
      fluidStart[i * 3 + 1] = (Math.random() - 0.5) * 3.6;
      fluidStart[i * 3 + 2] = Math.sin(angle) * radius;
    }
    fluidPositions.set(fluidStart);
    const fluidGeometry = new THREE.BufferGeometry();
    const fluidAttribute = new THREE.BufferAttribute(fluidPositions, 3); fluidAttribute.setUsage(THREE.DynamicDrawUsage);
    fluidGeometry.setAttribute("position", fluidAttribute);
    const fluid = new THREE.Points(fluidGeometry, new THREE.PointsMaterial({ color: 0x68dfff, size: 0.026, transparent: true, opacity: 0.84, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(fluid);

    // Cloth demonstration: pinned top edge with Verlet integration and distance constraints.
    const columns = 26, rows = 18, clothCount = columns * rows;
    const clothPositions = new Float32Array(clothCount * 3);
    const clothPrevious = new Float32Array(clothCount * 3);
    const clothIndices: number[] = [];
    const clothIndex = (x: number, y: number) => y * columns + x;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const i = clothIndex(x, y), p = i * 3;
      clothPositions[p] = (x / (columns - 1) - 0.5) * 3.4;
      clothPositions[p + 1] = 1.65 - y / (rows - 1) * 3.1;
      clothPositions[p + 2] = 0;
      clothPrevious.set(clothPositions.subarray(p, p + 3), p);
      if (x < columns - 1 && y < rows - 1) {
        const a = clothIndex(x, y), b = clothIndex(x + 1, y), c = clothIndex(x, y + 1), d = clothIndex(x + 1, y + 1);
        clothIndices.push(a, c, b, b, c, d);
      }
    }
    const clothGeometry = new THREE.BufferGeometry();
    const clothAttribute = new THREE.BufferAttribute(clothPositions, 3); clothAttribute.setUsage(THREE.DynamicDrawUsage);
    clothGeometry.setAttribute("position", clothAttribute); clothGeometry.setIndex(clothIndices);
    const cloth = new THREE.Mesh(clothGeometry, new THREE.MeshPhysicalMaterial({ color: 0x257cb4, metalness: 0.28, roughness: 0.31, side: THREE.DoubleSide, clearcoat: 0.7, wireframe: false }));
    cloth.position.z = 0.35; scene.add(cloth);
    const pins = new THREE.Group(); scene.add(pins);
    for (let x = 0; x < columns; x++) {
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb2edff }));
      pin.position.set(clothPositions[x * 3], clothPositions[x * 3 + 1], 0.36); pins.add(pin);
    }

    // Soft-body demonstration: deform a closed surface and spring it back to its base shape.
    const softGeometry = new THREE.SphereGeometry(1.25, 52, 36);
    const softAttribute = softGeometry.getAttribute("position") as THREE.BufferAttribute;
    const softBase = new Float32Array(softAttribute.array as ArrayLike<number>);
    softAttribute.setUsage(THREE.DynamicDrawUsage);
    const softBody = new THREE.Mesh(softGeometry, new THREE.MeshPhysicalMaterial({ color: 0x8b78e8, metalness: 0.44, roughness: 0.22, clearcoat: 1, emissive: 0x21105e, emissiveIntensity: 0.42 }));
    softBody.position.set(0, 0.1, 0); scene.add(softBody);

    const dashboardPlanes = new THREE.Group(); scene.add(dashboardPlanes);
    const planeItems = [
      { title: "Factory nodes", value: counts.companies.toLocaleString("en-IN"), caption: "Saved company records", accent: "#71dcff", position: [-3.55, 1.05, 0.15] as [number, number, number] },
      { title: "Process steps", value: counts.processSteps.toLocaleString("en-IN"), caption: "Saved process operations", accent: "#a69cff", position: [3.55, 0.75, -0.2] as [number, number, number] },
      { title: "Stock events", value: counts.stockEvents.toLocaleString("en-IN"), caption: "Saved inventory transactions", accent: "#6de3bd", position: [-3.25, -1.1, -0.1] as [number, number, number] },
      { title: "Components", value: counts.components.toLocaleString("en-IN"), caption: "Saved component masters", accent: "#ffc879", position: [3.25, -1.25, 0.1] as [number, number, number] },
    ];
    const planeMeshes: THREE.Mesh[] = [];
    planeItems.forEach((item) => {
      const texture = createPanelTexture(item.title, item.value, item.caption, item.accent);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.32), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      mesh.position.set(...item.position); mesh.lookAt(0, 0, 0); dashboardPlanes.add(mesh); planeMeshes.push(mesh);
    });

    let composer: EffectComposer | undefined;
    let bloom: UnrealBloomPass | undefined;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth || 1, host.clientHeight || 1), 0.72, 0.48, 0.82);
      composer.addPass(bloom);
    } catch {
      composer = undefined; bloom = undefined;
    }

    const cameraTarget = new THREE.Vector3(0, 0.1, 0);
    let transitionStart: THREE.Vector3 | null = null;
    let transitionEnd: THREE.Vector3 | null = null;
    let transitionStarted = 0;
    let transitionRollStart = 0;
    let transitionRollEnd = 0;
    let transitionActive = false;
    const startTransition = (name: Transition) => {
      transitionStart = camera.position.clone();
      transitionRollStart = camera.rotation.z;
      const destinations: Record<Transition, { pos: [number, number, number]; roll: number }> = {
        orbit: { pos: [0, 1.1, 9.5], roll: 0 },
        flythrough: { pos: [0, 0.5, 4.2], roll: 0 },
        dolly: { pos: [0.3, 1.1, 7.2], roll: 0 },
        roll: { pos: [0, 1.3, 8.2], roll: Math.PI * 2 },
        "whip-pan": { pos: [3.1, 0.6, 7.1], roll: -0.18 },
        "depth-shift": { pos: [-1.1, 0.1, 5.4], roll: 0.08 },
      };
      const destination = destinations[name];
      transitionEnd = new THREE.Vector3(...destination.pos);
      transitionRollEnd = destination.roll;
      transitionStarted = performance.now();
      transitionActive = true;
      if (name === "whip-pan") dashboardPlanes.rotation.y += Math.PI * 0.28;
      if (name === "orbit") dashboardPlanes.rotation.y = 0;
    };
    startTransition("orbit");

    let pointerDown = false;
    const onPointerDown = () => { pointerDown = true; };
    const onPointerUp = () => { pointerDown = false; };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown || mode !== "cloth") return;
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      const x = Math.max(1, Math.min(columns - 2, Math.round(nx * (columns - 1))));
      const y = Math.max(1, Math.min(rows - 1, Math.round(ny * (rows - 1))));
      const index = clothIndex(x, y) * 3;
      clothPrevious[index + 2] -= 0.28;
      clothPrevious[index] += (Math.random() - 0.5) * 0.08;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      if (bloom) bloom.setSize(w, h);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0;
    const solveConstraint = (a: number, b: number, rest: number) => {
      const ai = a * 3, bi = b * 3;
      const dx = clothPositions[bi] - clothPositions[ai], dy = clothPositions[bi + 1] - clothPositions[ai + 1], dz = clothPositions[bi + 2] - clothPositions[ai + 2];
      const distance = Math.hypot(dx, dy, dz) || 0.0001;
      const correction = (distance - rest) / distance * 0.48;
      const aPinned = a < columns, bPinned = b < columns;
      if (!aPinned && !bPinned) {
        clothPositions[ai] += dx * correction * 0.5; clothPositions[ai + 1] += dy * correction * 0.5; clothPositions[ai + 2] += dz * correction * 0.5;
        clothPositions[bi] -= dx * correction * 0.5; clothPositions[bi + 1] -= dy * correction * 0.5; clothPositions[bi + 2] -= dz * correction * 0.5;
      } else if (aPinned) {
        clothPositions[bi] -= dx * correction; clothPositions[bi + 1] -= dy * correction; clothPositions[bi + 2] -= dz * correction;
      } else {
        clothPositions[ai] += dx * correction; clothPositions[ai + 1] += dy * correction; clothPositions[ai + 2] += dz * correction;
      }
    };
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.033, Math.max(0.001, (now - (last || now)) / 1000)); last = now;
      const t = now / 1000;
      if (!reduced && document.visibilityState === "visible") {
        core.rotation.y += dt * 0.18; halo.rotation.z += dt * 0.15; dashboardPlanes.rotation.y += dt * 0.075;
        for (let i = 0; i < fluidCount; i++) {
          const p = i * 3, x = fluidStart[p], y = fluidStart[p + 1], z = fluidStart[p + 2];
          fluidPositions[p] = x + Math.sin(t * 0.85 + y * 1.4 + z) * 0.25;
          fluidPositions[p + 1] = y + Math.sin(t * 1.15 + x * 1.2) * 0.19;
          fluidPositions[p + 2] = z + Math.cos(t * 0.72 + x * 1.1) * 0.23;
        }
        fluidAttribute.needsUpdate = true;
        for (let i = columns; i < clothCount; i++) {
          const p = i * 3;
          const x = clothPositions[p], y = clothPositions[p + 1], z = clothPositions[p + 2];
          const ax = clothPositions[p] - clothPrevious[p], ay = clothPositions[p + 1] - clothPrevious[p + 1], az = clothPositions[p + 2] - clothPrevious[p + 2];
          clothPrevious[p] = x; clothPrevious[p + 1] = y; clothPrevious[p + 2] = z;
          clothPositions[p] += ax;
          clothPositions[p + 1] += ay - 9.5 * dt * dt;
          clothPositions[p + 2] += az + Math.sin(t * 1.7 + x * 2.2) * 0.0017;
        }
        for (let iteration = 0; iteration < 4; iteration++) {
          for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
            const a = clothIndex(x, y);
            if (x < columns - 1) solveConstraint(a, clothIndex(x + 1, y), 3.4 / (columns - 1));
            if (y < rows - 1) solveConstraint(a, clothIndex(x, y + 1), 3.1 / (rows - 1));
          }
        }
        clothAttribute.needsUpdate = true; clothGeometry.computeVertexNormals();
        for (let i = 0; i < softAttribute.count; i++) {
          const p = i * 3, x = softBase[p], y = softBase[p + 1], z = softBase[p + 2];
          const len = Math.hypot(x, y, z) || 1;
          const ripple = Math.sin(t * 2.1 + x * 3.8 + y * 2.4) * 0.065 + Math.cos(t * 1.5 + z * 3.2) * 0.035;
          const recovery = 1 + ripple * Math.exp(-((t % 6) * 0.38));
          softAttribute.setXYZ(i, x * recovery, y * recovery, z * recovery);
        }
        softAttribute.needsUpdate = true; softGeometry.computeVertexNormals();
        if (transitionActive && transitionStart && transitionEnd) {
          const progress = Math.min(1, (now - transitionStarted) / 1500);
          const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          camera.position.lerpVectors(transitionStart, transitionEnd, eased);
          camera.lookAt(cameraTarget);
          camera.rotation.z = THREE.MathUtils.lerp(transitionRollStart, transitionRollEnd, eased);
          if (progress >= 1) transitionActive = false;
        } else {
          camera.lookAt(cameraTarget);
        }
      }
      fluid.visible = mode === "fluid";
      cloth.visible = mode === "cloth"; pins.visible = mode === "cloth";
      softBody.visible = mode === "soft";
      core.visible = mode !== "soft";
      if (postFx && composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((item) => item.dispose()); else if (m) m.dispose();
        if (obj instanceof THREE.Points) {
          const points = obj as THREE.Points;
          (points.material as THREE.Material).dispose();
        }
      });
      planeMeshes.forEach((mesh) => { const mat = mesh.material as THREE.MeshBasicMaterial; mat.map?.dispose(); });
      composer?.renderTarget1.dispose(); composer?.renderTarget2.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [counts, mode, postFx, reducedMotion, transition]);

  const saveMachineProfile = () => {
    const payload = { protocol, machineName: machineName.trim(), endpoint: endpoint.trim(), savedAt: new Date().toISOString(), status: "configuration-only" };
    try { localStorage.setItem("aximach.machine-link-profile.v1", JSON.stringify(payload)); setProfileSaved(true); }
    catch { setProfileSaved(false); }
  };

  return <div className="irl-overlay" role="dialog" aria-modal="true" aria-label="AXIMACH Infinite Reality Lab">
    <section className="irl-window">
      <header className="irl-header">
        <div className="irl-brand"><span className="irl-brand-orb"><Sparkles size={18}/></span><div><b>INFINITE REALITY LAB</b><small>AXIMACH / SPATIAL ENGINEERING ENVIRONMENT</small></div></div>
        <div className="irl-header-actions"><span className="irl-status"><i/> LOCAL RENDER · NO MACHINE LINK</span><button type="button" className="irl-close" onClick={onClose} aria-label="Close reality lab"><X size={19}/></button></div>
      </header>
      <div className="irl-scene-wrap">
        <div className="irl-scene" ref={hostRef}/>
        <div className="irl-scene-topline"><span>SPATIAL COMMAND ENVIRONMENT</span><span>THREE.JS · WEBGL · BLOOM POST-FX</span></div>
        <div className="irl-scene-caption">INTERACT WITH THE CLOTH SURFACE · DASHBOARD PLANES ROTATE IN 3D SPACE · COUNTS ARE SAVED AXIMACH RECORDS</div>
        <div className="irl-scene-actions"><button type="button" onClick={() => setPostFx(value => !value)} className={postFx ? "active" : ""}><Sparkles size={14}/> Post FX {postFx ? "ON" : "OFF"}</button><button type="button" onClick={() => setReducedMotion(value => !value)} className={reducedMotion ? "active" : ""}><Activity size={14}/> Reduced motion</button><button type="button" onClick={() => setTransition("orbit")}><RotateCcw size={14}/> Reset camera</button></div>
      </div>
      <div className="irl-controls">
        <section className="irl-card irl-physics">
          <div className="irl-section-heading"><div><small>01 / REALTIME DYNAMICS</small><h2>Physics playground</h2></div><Waves size={19}/></div>
          <div className="irl-mode-tabs">{modes.map(item => <button key={item.id} type="button" onClick={() => setMode(item.id)} className={mode === item.id ? "selected" : ""}>{item.label}</button>)}</div>
          <p>{modes.find(item => item.id === mode)?.detail}. This is an interactive visual simulation, not a validated engineering solver.</p>
          <div className="irl-transition-heading"><small>CAMERA / CINEMATIC TRANSITIONS</small><span>1.5s smooth easing</span></div>
          <div className="irl-transition-grid">{transitions.map(item => <button type="button" key={item.id} onClick={() => setTransition(item.id)} className={transition === item.id ? "selected" : ""}><Move3D size={13}/>{item.label}</button>)}</div>
        </section>
        <section className="irl-card irl-scenario">
          <div className="irl-section-heading"><div><small>02 / DECISION SIMULATION</small><h2>Predictive scenario lab</h2></div><Gauge size={19}/></div>
          <p>Deterministic what-if calculations from the assumptions below. Not connected to live production or a trained forecasting model.</p>
          <div className="irl-input-grid">
            <label>Cycle rate / hour <input type="number" min="1" max="500" value={scenario.rate} onChange={e => setScenario(v => ({...v, rate: Math.max(1, Math.min(500, Number(e.target.value)||1))}))}/></label>
            <label>Shift hours <input type="number" min="1" max="24" value={scenario.hours} onChange={e => setScenario(v => ({...v, hours: Math.max(1, Math.min(24, Number(e.target.value)||1))}))}/></label>
            <label>Availability % <input type="number" min="0" max="100" value={scenario.availability} onChange={e => setScenario(v => ({...v, availability: Math.max(0, Math.min(100, Number(e.target.value)||0))}))}/></label>
            <label>Downtime hours <input type="number" min="0" max="24" step="0.25" value={scenario.downtime} onChange={e => setScenario(v => ({...v, downtime: Math.max(0, Math.min(24, Number(e.target.value)||0))}))}/></label>
            <label>Scrap % <input type="number" min="0" max="100" step="0.1" value={scenario.scrap} onChange={e => setScenario(v => ({...v, scrap: Math.max(0, Math.min(100, Number(e.target.value)||0))}))}/></label>
            <label>Order quantity <input type="number" min="1" max="1000000" value={scenario.orderQty} onChange={e => setScenario(v => ({...v, orderQty: Math.max(1, Math.min(1000000, Number(e.target.value)||1))}))}/></label>
          </div>
          <div className="irl-scenario-results">
            <div><small>GOOD PARTS / SHIFT</small><b>{Math.round(output.goodPartsPerShift).toLocaleString("en-IN")}</b></div>
            <div><small>SHIFTS FOR ORDER</small><b>{Number.isFinite(output.shiftsForOrder) ? output.shiftsForOrder.toFixed(1) : "—"}</b></div>
          </div>
          <div className="irl-scenario-compare"><span>Upside case <b>{Math.round(upside.goodPartsPerShift).toLocaleString("en-IN")} / shift</b></span><span>Stress case <b>{Math.round(stress.goodPartsPerShift).toLocaleString("en-IN")} / shift</b></span></div>
          <small className="irl-assumption-note">Assumption: one shift per operating day. Validate cycle rates and availability against actual machine records before making commitments.</small>
        </section>
        <section className="irl-card irl-connection">
          <div className="irl-section-heading"><div><small>03 / INDUSTRIAL CONNECTIVITY</small><h2>Machine twin connection</h2></div><Plug size={19}/></div>
          <div className="irl-connection-status"><i/> NOT CONNECTED <span>Gateway integration required</span></div>
          <div className="irl-input-grid">
            <label>Protocol <select value={protocol} onChange={e => setProtocol(e.target.value as Protocol)}><option>OPC UA</option><option>Modbus TCP</option><option>MTConnect</option><option>REST gateway</option></select></label>
            <label>Machine / asset name <input value={machineName} onChange={e => setMachineName(e.target.value)} placeholder="e.g. VMC-01"/></label>
            <label className="irl-endpoint-label">Gateway endpoint <input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="e.g. opc.tcp://gateway:4840"/></label>
          </div>
          <button type="button" className="irl-save-profile" onClick={saveMachineProfile} disabled={!machineName.trim() || !endpoint.trim()}>{profileSaved ? "Connection profile saved" : "Save connection profile"}</button>
          <p className="irl-connection-note">Saving stores configuration only. No socket is opened and no PLC/CNC data is read. Live telemetry requires the actual machine protocol, approved gateway, network route and credentials; none are assumed or fabricated.</p>
        </section>
        <section className="irl-card irl-icon-forge">
          <div className="irl-section-heading"><div><small>04 / ICON STUDIO EXPANSION</small><h2>Material & motion forge</h2></div><SlidersHorizontal size={19}/></div>
          <div className="irl-icon-demo"><span className={`irl-icon-preview material-${material} motion-${iconMotion}`}><Factory size={30}/></span><div><b>Factory command icon</b><small>{material.toUpperCase()} · {iconMotion.toUpperCase()}</small></div></div>
          <div className="irl-option-row"><small>MATERIAL</small>{["glass","chrome","plasma","matte"].map(value => <button type="button" key={value} onClick={() => setMaterial(value)} className={material === value ? "selected" : ""}>{value}</button>)}</div>
          <div className="irl-option-row"><small>MOTION</small>{["orbit","float","pulse","scan"].map(value => <button type="button" key={value} onClick={() => setIconMotion(value)} className={iconMotion === value ? "selected" : ""}>{value}</button>)}</div>
          <div className="irl-asset-caption"><Network size={13}/> {counts.jobs.toLocaleString("en-IN")} saved job records · {counts.qualityFlags.toLocaleString("en-IN")} saved quality flags</div>
        </section>
      </div>
      <footer className="irl-footer"><span>AXIMACH INFINITE REALITY · VISUAL SIMULATION WORKSPACE</span><span>Hardware telemetry and real-machine validation remain separate integration steps.</span></footer>
    </section>
  </div>;
}
