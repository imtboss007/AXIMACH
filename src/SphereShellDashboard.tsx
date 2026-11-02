import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Maximize2, Pause, Play, RotateCcw, Sparkles, ZoomIn, ZoomOut } from "lucide-react";

type ModuleNavItem = { id: string; title: string; group: string; icon: LucideIcon };
type Counts = { companies: number; purchaseOrders: number; components: number; operations: number; vendors: number };
type ShapeMode = "sphere" | "cube" | "vortex" | "molecular" | "orbit" | "mesh" | "pyramid" | "torus";
type Props = {
  modules: ModuleNavItem[];
  counts: Counts;
  onSelectModule: (id: string) => void;
  onOpenModules: () => void;
};

const shapeOptions: { id: ShapeMode; label: string }[] = [
  { id: "sphere", label: "Sphere" },
  { id: "cube", label: "Cube" },
  { id: "vortex", label: "Vortex" },
  { id: "molecular", label: "Molecular" },
  { id: "orbit", label: "Orbit" },
  { id: "mesh", label: "Digital mesh" },
  { id: "pyramid", label: "Pyramid" },
  { id: "torus", label: "Torus" },
];

type Point = [number, number, number];
type Geometry = { positions: number[]; normals: number[] };

function geometryFor(mode: ShapeMode): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const add = (a: Point, b: Point, c: Point, flat?: Point) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = flat?.[0] ?? uy * vz - uz * vy;
    const ny = flat?.[1] ?? uz * vx - ux * vz;
    const nz = flat?.[2] ?? ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    const normal: Point = [nx / length, ny / length, nz / length];
    [a, b, c].forEach(point => {
      positions.push(point[0], point[1], point[2]);
      normals.push(normal[0], normal[1], normal[2]);
    });
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, normal: Point) => {
    add(a, b, c, normal);
    add(a, c, d, normal);
  };
  const spherePoint = (lat: number, lon: number): Point => [
    Math.cos(lat) * Math.cos(lon) * 1.12,
    Math.sin(lat) * 1.12,
    Math.cos(lat) * Math.sin(lon) * 1.12,
  ];
  if (mode === "cube") {
    const s = 1.03;
    quad([-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s],[0,0,1]);
    quad([s,-s,-s],[-s,-s,-s],[-s,s,-s],[s,s,-s],[0,0,-1]);
    quad([s,-s,s],[s,-s,-s],[s,s,-s],[s,s,s],[1,0,0]);
    quad([-s,-s,-s],[-s,-s,s],[-s,s,s],[-s,s,-s],[-1,0,0]);
    quad([-s,s,s],[s,s,s],[s,s,-s],[-s,s,-s],[0,1,0]);
    quad([-s,-s,-s],[s,-s,-s],[s,-s,s],[-s,-s,s],[0,-1,0]);
  } else if (mode === "pyramid") {
    const top: Point = [0,1.25,0], a: Point = [-1,-.8,1], b: Point = [1,-.8,1], c: Point = [1,-.8,-1], d: Point = [-1,-.8,-1];
    add(top,a,b); add(top,b,c); add(top,c,d); add(top,d,a);
    quad(a,d,c,b,[0,-1,0]);
  } else if (mode === "torus" || mode === "orbit") {
    const major = mode === "orbit" ? .72 : .82;
    const minor = mode === "orbit" ? .13 : .25;
    const around = 76, tube = 24;
    for (let i=0;i<around;i++) for (let j=0;j<tube;j++) {
      const u=i/around*Math.PI*2, un=(i+1)/around*Math.PI*2;
      const v=j/tube*Math.PI*2, vn=(j+1)/tube*Math.PI*2;
      const p=(a:number,b:number):Point => [(major+minor*Math.cos(b))*Math.cos(a),minor*Math.sin(b),(major+minor*Math.cos(b))*Math.sin(a)];
      add(p(u,v),p(un,v),p(un,vn)); add(p(u,v),p(un,vn),p(u,vn));
    }
  } else if (mode === "vortex") {
    const around=88, tube=28;
    for (let i=0;i<around;i++) for (let j=0;j<tube;j++) {
      const u=i/around, un=(i+1)/around, v=j/tube*Math.PI*2, vn=(j+1)/tube*Math.PI*2;
      const p=(t:number,w:number):Point => {
        const angle=t*Math.PI*8.5+w*.16;
        const radius=.12+t*.88+.12*Math.cos(w);
        return [radius*Math.cos(angle),(t-.5)*2.15+.12*Math.sin(w),radius*Math.sin(angle)];
      };
      add(p(u,v),p(un,v),p(un,vn)); add(p(u,v),p(un,vn),p(u,vn));
    }
  } else {
    const latitudes=42, longitudes=64;
    for (let i=0;i<latitudes;i++) for (let j=0;j<longitudes;j++) {
      const lat0=-Math.PI/2+i/latitudes*Math.PI, lat1=-Math.PI/2+(i+1)/latitudes*Math.PI;
      const lon0=j/longitudes*Math.PI*2, lon1=(j+1)/longitudes*Math.PI*2;
      const a=spherePoint(lat0,lon0), b=spherePoint(lat1,lon0), c=spherePoint(lat1,lon1), d=spherePoint(lat0,lon1);
      add(a,b,c,[a[0]+b[0]+c[0],a[1]+b[1]+c[1],a[2]+b[2]+c[2]]);
      add(a,c,d,[a[0]+c[0]+d[0],a[1]+c[1]+d[1],a[2]+c[2]+d[2]]);
    }
  }
  return { positions, normals };
}

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform float uYaw;
uniform float uPitch;
uniform float uZoom;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  float cy = cos(uYaw), sy = sin(uYaw);
  float cp = cos(uPitch), sp = sin(uPitch);
  float x = aPosition.x * cy + aPosition.z * sy;
  float z = -aPosition.x * sy + aPosition.z * cy;
  float y2 = aPosition.y * cp - z * sp;
  float z2 = aPosition.y * sp + z * cp;
  vec3 n;
  n.x = aNormal.x * cy + aNormal.z * sy;
  n.z = -aNormal.x * sy + aNormal.z * cy;
  n.y = aNormal.y * cp - n.z * sp;
  n.z = aNormal.y * sp + n.z * cp;
  vNormal = normalize(n);
  vPosition = vec3(x, y2, z2);
  float perspective = 2.25 / (3.1 - z2);
  gl_Position = vec4(x * perspective * uZoom * 0.78, y2 * perspective * uZoom * 0.78, z2 * 0.20, 1.0);
}
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform float uMode;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 n = normalize(vNormal);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  float latLine = 1.0 - smoothstep(0.015, 0.07, abs(sin(lat * 18.0)));
  float lonLine = 1.0 - smoothstep(0.015, 0.07, abs(sin(lon * 26.0)));
  float grid = max(latLine, lonLine * 0.72);
  float pulse = 0.5 + 0.5 * sin(lon * 9.0 - uTime * 0.7 + cos(lat * 6.0));
  float light = max(dot(n, normalize(vec3(-0.45, 0.68, 0.84))), 0.0);
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
  vec3 base = vec3(0.012, 0.075, 0.13);
  vec3 glow = vec3(0.08, 0.72, 0.91);
  if (uMode > 0.5 && uMode < 1.5) { base = vec3(0.025,0.10,0.16); glow = vec3(0.30,0.82,1.0); }
  if (uMode > 1.5 && uMode < 2.5) { base = vec3(0.11,0.025,0.17); glow = vec3(0.77,0.32,1.0); }
  if (uMode > 2.5 && uMode < 3.5) { base = vec3(0.015,0.10,0.09); glow = vec3(0.25,0.95,0.70); }
  if (uMode > 3.5 && uMode < 4.5) { base = vec3(0.04,0.06,0.16); glow = vec3(0.52,0.63,1.0); }
  if (uMode > 4.5 && uMode < 5.5) { base = vec3(0.02,0.10,0.13); glow = vec3(0.12,0.83,0.84); }
  if (uMode > 5.5 && uMode < 6.5) { base = vec3(0.10,0.07,0.015); glow = vec3(1.0,0.66,0.22); }
  if (uMode > 6.5) { base = vec3(0.08,0.035,0.12); glow = vec3(0.89,0.40,0.88); }
  vec3 colour = base * (0.62 + light * 0.9);
  colour += glow * (grid * 0.48 + pulse * 0.11 + rim * 0.48);
  float spark = pow(max(0.0, sin(lon * 31.0 + uTime * 1.3) * cos(lat * 23.0 - uTime)), 18.0);
  colour += vec3(0.55,0.90,1.0) * spark * 0.8;
  gl_FragColor = vec4(colour, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error("WebGL could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "AXIMACH sphere shader failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export default function SphereShellDashboard({ modules, counts, onSelectModule, onOpenModules }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(-0.42);
  const pitchRef = useRef(0.24);
  const zoomRef = useRef(1);
  const playRef = useRef(true);
  const speedRef = useRef(0.19);
  const [mode, setMode] = useState<ShapeMode>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("aximach.visualPreferences.v1") || "{}"); return shapeOptions.some(option => option.id === saved.mode) ? saved.mode as ShapeMode : "sphere"; }
    catch { return "sphere"; }
  });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("aximach.visualPreferences.v1") || "{}"); return saved.speed === "Slow" || saved.speed === "Fast" ? saved.speed : "Normal"; }
    catch { return "Normal"; }
  });
  const [sphereSize, setSphereSize] = useState(1);
  const [orbitIntensity, setOrbitIntensity] = useState(1);
  const [studioOpen, setStudioOpen] = useState(false);
  const [reduceMotionOverride, setReduceMotionOverride] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<"Balanced" | "Performance">("Balanced");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { playRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed === "Slow" ? 0.07 : speed === "Fast" ? 0.36 : 0.19; }, [speed]);
  useEffect(() => {
    try {
      window.localStorage.setItem("aximach.visualPreferences.v1", JSON.stringify({
        mode, speed, sphereSize, orbitIntensity, reduceMotionOverride, performanceMode
      }));
    } catch { /* Visual preferences remain usable when storage is unavailable. */ }
  }, [mode, speed, sphereSize, orbitIntensity, reduceMotionOverride, performanceMode]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "high-performance" });
      if (!gl) throw new Error("WebGL is not available.");
      const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      const program = gl.createProgram();
      if (!program) throw new Error("WebGL could not create the sphere program.");
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "WebGL program failed to link.");
      gl.useProgram(program);
      const geometry = geometryFor(mode);
      const positionBuffer = gl.createBuffer(), normalBuffer = gl.createBuffer();
      if (!positionBuffer || !normalBuffer) throw new Error("WebGL could not allocate geometry buffers.");
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(positionLocation); gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);
      const normalLocation = gl.getAttribLocation(program, "aNormal");
      gl.enableVertexAttribArray(normalLocation); gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
      const yawLocation = gl.getUniformLocation(program, "uYaw");
      const pitchLocation = gl.getUniformLocation(program, "uPitch");
      const zoomLocation = gl.getUniformLocation(program, "uZoom");
      const timeLocation = gl.getUniformLocation(program, "uTime");
      const modeLocation = gl.getUniformLocation(program, "uMode");
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      const numericMode = shapeOptions.findIndex(option => option.id === mode);
      let frame = 0, start = 0, last = 0, dragging = false, previousX = 0, previousY = 0;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, performanceMode === "Performance" ? 1.25 : 2);
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width; canvas.height = height; gl?.viewport(0, 0, width, height);
        }
      };
      const pointerDown = (event: PointerEvent) => {
        dragging = true; previousX = event.clientX; previousY = event.clientY;
        canvas.setPointerCapture?.(event.pointerId);
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - previousX, dy = event.clientY - previousY;
        previousX = event.clientX; previousY = event.clientY;
        yawRef.current += dx * 0.009;
        pitchRef.current = Math.max(-1.25, Math.min(1.25, pitchRef.current + dy * 0.009));
      };
      const pointerUp = () => { dragging = false; };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        zoomRef.current = Math.max(0.66, Math.min(1.5, zoomRef.current - event.deltaY * 0.001));
      };
      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("pointercancel", pointerUp);
      canvas.addEventListener("wheel", wheel, { passive: false });
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      observer?.observe(canvas);
      resize();
      const render = (now: number) => {
        if (!start) start = now;
        const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
        if (playRef.current && !reducedMotion && !reduceMotionOverride && !dragging) yawRef.current += dt * speedRef.current;
        gl?.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl?.useProgram(program);
        if (yawLocation) gl?.uniform1f(yawLocation, yawRef.current);
        if (pitchLocation) gl?.uniform1f(pitchLocation, pitchRef.current);
        if (zoomLocation) gl?.uniform1f(zoomLocation, zoomRef.current);
        if (timeLocation) gl?.uniform1f(timeLocation, reducedMotion ? 0 : (now - start) / 1000);
        if (modeLocation) gl?.uniform1f(modeLocation, numericMode);
        gl?.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3);
        frame = window.requestAnimationFrame(render);
      };
      frame = window.requestAnimationFrame(render);
      setWebglAvailable(true);
      return () => {
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("pointercancel", pointerUp);
        canvas.removeEventListener("wheel", wheel);
        gl?.deleteBuffer(positionBuffer); gl?.deleteBuffer(normalBuffer);
        gl?.deleteProgram(program); gl?.deleteShader(vs); gl?.deleteShader(fs);
      };
    } catch {
      setWebglAvailable(false);
    }
  }, [mode, reducedMotion, reduceMotionOverride, performanceMode]);
  const resetView = () => { yawRef.current = -0.42; pitchRef.current = 0.24; zoomRef.current = 1; };
  const scale = modules.length ? Math.min(1, 20 / modules.length) : 1;
  const nodes = modules.map((item, index) => {
    const Icon = item.icon;
    const angle = (index / Math.max(1, modules.length)) * Math.PI * 2 - Math.PI / 2;
    const radiusX = 45 * scale, radiusY = 43 * scale;
    const style = { left: (50 + Math.cos(angle) * radiusX) + "%", top: (50 + Math.sin(angle) * radiusY) + "%" } as CSSProperties;
    return <button type="button" key={item.id} className="axi-sphere-module-node" style={style} title={item.title} aria-label={"Open " + item.title} onClick={() => onSelectModule(item.id)}><Icon size={15}/><span>{item.title}</span></button>;
  });
  return <section className="axi-sphere-shell" aria-label="AXIMACH sphere command dashboard">
    <div className="axi-sphere-shell-heading">
      <div><div className="axi-sphere-kicker"><i/> SPATIAL COMMAND INTERFACE / AXIMACH</div><h2>One factory. <em>One command sphere.</em></h2><p>Choose an existing AXIMACH workspace from the orbital navigation. All figures are read from saved records.</p></div>
      <div className="axi-sphere-heading-actions"><button type="button" className="axi-sphere-open-all" onClick={onOpenModules}><Maximize2 size={14}/> All workspaces</button><span className="axi-sphere-live"><i/> RECORD-LINKED</span></div>
    </div>
    <div className="axi-sphere-layout">
      <div className="axi-sphere-side axi-sphere-side-left">
        <div className="axi-sphere-data-card"><span>COMPANIES</span><strong>{counts.companies.toLocaleString("en-IN")}</strong><small>Saved company records</small></div>
        <div className="axi-sphere-data-card"><span>PURCHASE ORDERS</span><strong>{counts.purchaseOrders.toLocaleString("en-IN")}</strong><small>Saved purchase orders</small></div>
      </div>
      <div className="axi-sphere-core-wrap" style={{ transform: "scale(" + sphereSize + ")" }}>
        <div className="axi-sphere-orbit axi-sphere-orbit-one" style={{ opacity: orbitIntensity }}/><div className="axi-sphere-orbit axi-sphere-orbit-two" style={{ opacity: orbitIntensity }}/><div className="axi-sphere-orbit axi-sphere-orbit-three" style={{ opacity: orbitIntensity }}/>
        <div className="axi-sphere-core">
          <canvas ref={canvasRef} className="axi-sphere-webgl" aria-label={"Interactive 3D " + mode + " visualisation. Drag to rotate and scroll to zoom."}/>
          {!webglAvailable && <div className="axi-sphere-fallback"><Sparkles size={34}/><strong>3D renderer unavailable</strong><span>Use the workspace navigation below.</span></div>}
          <div className="axi-sphere-center-label"><strong>AXIMACH</strong><small>MANUFACTURING OS</small></div>
          <div className="axi-sphere-module-orbit">{nodes}</div>
        </div>
        <div className="axi-sphere-bottom-note">DRAG TO ROTATE <b>·</b> SCROLL TO ZOOM <b>·</b> SELECT A NODE TO OPEN</div>
      </div>
      <div className="axi-sphere-side axi-sphere-side-right">
        <div className="axi-sphere-data-card"><span>COMPONENTS</span><strong>{counts.components.toLocaleString("en-IN")}</strong><small>Saved component records</small></div>
        <div className="axi-sphere-data-card"><span>OPERATIONS</span><strong>{counts.operations.toLocaleString("en-IN")}</strong><small>Saved process operations</small></div>
        <div className="axi-sphere-data-card"><span>VENDORS</span><strong>{counts.vendors.toLocaleString("en-IN")}</strong><small>Saved vendor records</small></div>
      </div>
    </div>
    <div className="axi-sphere-controls">
      <div className="axi-sphere-shape-picker" aria-label="3D visualisation shapes">{shapeOptions.map(option => <button type="button" key={option.id} className={mode===option.id?"is-selected":""} aria-pressed={mode===option.id} onClick={() => setMode(option.id)}>{option.label}</button>)}</div>
      <div className="axi-sphere-motion-tools"><button type="button" title="Rotate slower" onClick={() => setSpeed(value => value==="Fast"?"Normal":"Slow")}>−</button><span>{speed}</span><button type="button" title="Rotate faster" onClick={() => setSpeed(value => value==="Slow"?"Normal":"Fast")}>+</button><button type="button" title={playing?"Pause rotation":"Resume rotation"} onClick={() => setPlaying(value => !value)}>{playing?<Pause size={14}/>:<Play size={14}/>}</button><button type="button" title="Reset orientation and zoom" onClick={resetView}><RotateCcw size={14}/></button><button type="button" title="Zoom in" onClick={() => { zoomRef.current=Math.min(1.5,zoomRef.current+.1); }}><ZoomIn size={14}/></button><button type="button" title="Zoom out" onClick={() => { zoomRef.current=Math.max(.66,zoomRef.current-.1); }}><ZoomOut size={14}/></button></div>
    </div>
    <div className="axi-sphere-studio-row">
      <button type="button" className="axi-sphere-studio-toggle" aria-expanded={studioOpen} onClick={() => setStudioOpen(value => !value)}><Sparkles size={14}/> Visual Experience Studio <span>{studioOpen ? "Close" : "Customize"}</span></button>
    </div>
    {studioOpen && <div className="axi-sphere-studio-panel">
      <label>Sphere size <input type="range" min="0.8" max="1.12" step="0.01" value={sphereSize} onChange={event=>setSphereSize(Number(event.target.value))}/><small>{Math.round(sphereSize*100)}%</small></label>
      <label>Orbit intensity <input type="range" min="0" max="1" step="0.05" value={orbitIntensity} onChange={event=>setOrbitIntensity(Number(event.target.value))}/><small>{Math.round(orbitIntensity*100)}%</small></label>
      <label>Rendering quality <select value={performanceMode} onChange={event=>setPerformanceMode(event.target.value as "Balanced" | "Performance")}><option>Balanced</option><option>Performance</option></select></label>
      <label className="axi-sphere-motion-setting"><input type="checkbox" checked={reduceMotionOverride} onChange={event=>setReduceMotionOverride(event.target.checked)}/> Reduce motion and continuous movement</label>
      <button type="button" className="axi-sphere-reset-prefs" onClick={() => {setMode("sphere");setSpeed("Normal");setSphereSize(1);setOrbitIntensity(1);setReduceMotionOverride(false);setPerformanceMode("Balanced");resetView();}}>Reset visual preferences</button>
    </div>}
    <div className="axi-sphere-mobile-nav" aria-label="AXIMACH module navigation">{modules.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} onClick={()=>onSelectModule(item.id)}><Icon size={14}/><span>{item.title}</span></button>;})}</div>
  </section>;
}
