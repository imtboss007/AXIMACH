import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform vec2 rotation;
uniform float geometryMode;

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
  return length(vec2(length(p.xz) - t.x, p.y)) - t.y;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
mat2 rotate2d(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}
vec3 rotate3d(vec3 p) {
  p.yz = rotate2d(rotation.x) * p.yz;
  p.xz = rotate2d(rotation.y) * p.xz;
  return p;
}
float sceneDistance(vec3 source) {
  vec3 p = rotate3d(source);
  float d = sdSphere(p, 0.64);
  if (geometryMode > 0.5 && geometryMode < 1.5) {
    vec3 q = p;
    q.xz = rotate2d(q.y * 2.6) * q.xz;
    d = min(sdTorus(q, vec2(0.48, 0.105)), sdTorus(q, vec2(0.24, 0.07)));
    d = min(d, sdSphere(p * vec3(1.0, 0.62, 1.0), 0.20));
  } else if (geometryMode > 1.5 && geometryMode < 2.5) {
    d = sdBox(p, vec3(0.53));
    d = max(d, -(sdBox(p, vec3(0.49)) + 0.025));
  } else if (geometryMode > 2.5 && geometryMode < 3.5) {
    d = sdSphere(p - vec3(-0.34, 0.0, 0.0), 0.20);
    d = min(d, sdSphere(p - vec3(0.34, 0.0, 0.0), 0.20));
    d = min(d, sdSphere(p - vec3(0.0, 0.36, 0.0), 0.19));
    d = min(d, sdSphere(p - vec3(0.0, -0.36, 0.0), 0.19));
    d = min(d, sdCapsule(p, vec3(-0.20,0.0,0.0), vec3(0.20,0.0,0.0), 0.045));
    d = min(d, sdCapsule(p, vec3(0.0,-0.21,0.0), vec3(0.0,0.21,0.0), 0.045));
  } else if (geometryMode > 3.5 && geometryMode < 4.5) {
    d = min(sdSphere(p, 0.22), sdTorus(p, vec2(0.69, 0.035)));
    vec3 side = p.yzx;
    d = min(d, sdTorus(side, vec2(0.69, 0.026)));
  } else if (geometryMode > 4.5 && geometryMode < 5.5) {
    d = sdSphere(p, 0.64);
  } else if (geometryMode > 5.5) {
    d = min(sdSphere(p, 0.42), sdTorus(p, vec2(0.68, 0.055)));
    d = min(d, sdBox(p * vec3(1.0, 1.0, 0.86), vec3(0.34)));
  }
  return d;
}
vec3 surfaceNormal(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    sceneDistance(p + e.xyy) - sceneDistance(p - e.xyy),
    sceneDistance(p + e.yxy) - sceneDistance(p - e.yxy),
    sceneDistance(p + e.yyx) - sceneDistance(p - e.yyx)
  ));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / min(resolution.x, resolution.y);
  vec3 ro = vec3(0.0, 0.0, 2.65);
  vec3 rd = normalize(vec3(uv * 1.95, -1.85));
  float travelled = 0.0;
  float hit = 0.0;
  vec3 point = ro;
  // WebGL raymarch loop: intersect the volumetric signed-distance geometry.
  // Sphere tracing over the actual 3D signed-distance geometry.
  for (int i = 0; i < 72; i++) {
    point = ro + rd * travelled;
    float distanceToSurface = sceneDistance(point);
    if (distanceToSurface < 0.0025) { hit = 1.0; break; }
    travelled += max(distanceToSurface * 0.78, 0.001);
    if (travelled > 5.0) break;
  }
  if (hit < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec3 normal = surfaceNormal(point);
  vec3 lightDir = normalize(vec3(-0.52, 0.78, 1.1));
  float diffuse = max(dot(normal, lightDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normal, -rd), 0.0), 2.25);
  float rim = pow(1.0 - abs(dot(normal, -rd)), 3.0);
  vec3 base = vec3(0.045, 0.22, 0.48);
  if (geometryMode > 0.5 && geometryMode < 1.5) base = vec3(0.30, 0.13, 0.63);
  else if (geometryMode > 1.5 && geometryMode < 2.5) base = vec3(0.10, 0.36, 0.62);
  else if (geometryMode > 2.5 && geometryMode < 3.5) base = vec3(0.08, 0.42, 0.48);
  else if (geometryMode > 3.5 && geometryMode < 4.5) base = vec3(0.10, 0.30, 0.62);
  else if (geometryMode > 4.5 && geometryMode < 5.5) base = vec3(0.05, 0.42, 0.48);
  else if (geometryMode > 5.5) base = vec3(0.22, 0.28, 0.62);
  float mesh = 0.0;
  if (geometryMode > 4.5 && geometryMode < 5.5) {
    vec3 n = normalize(rotate3d(point));
    float lat = asin(clamp(n.y, -1.0, 1.0));
    float lon = atan(n.z, n.x);
    float latitudeLine = 1.0 - smoothstep(0.018, 0.045, abs(sin(lat * 13.0)));
    float longitudeLine = 1.0 - smoothstep(0.018, 0.045, abs(sin(lon * 18.0)));
    mesh = max(latitudeLine, longitudeLine);
  }
  vec3 color = base * (0.22 + diffuse * 0.84);
  color += vec3(0.22, 0.62, 1.0) * (fresnel * 0.75 + rim * 0.18);
  color += vec3(0.22, 0.72, 0.95) * mesh * 0.52;
  color += vec3(0.68, 0.86, 1.0) * pow(max(dot(reflect(-lightDir, normal), -rd), 0.0), 30.0) * 0.36;
  gl_FragColor = vec4(color, 0.99);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function modeIndex(mode: string) {
  if (mode === "vortex") return 1;
  if (mode === "cube") return 2;
  if (mode === "molecular" || mode === "nodes" || mode === "branch") return 3;
  if (mode === "orbit" || mode === "horizontal" || mode === "vertical" || mode === "timeline" || mode === "gantt") return 4;
  if (mode === "digital-mesh" || mode === "linear" || mode === "route") return 5;
  if (mode === "combined") return 6;
  return 0;
}

export default function ProcessUniverseWebGLCore({
  mode,
  rotationX,
  rotationY
}: {
  mode: string;
  rotationX: MotionValue<number>;
  rotationY: MotionValue<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution");
    const rotation = gl.getUniformLocation(program, "rotation");
    const geometry = gl.getUniformLocation(program, "geometryMode");
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(rotation, rotationX.get() * Math.PI / 180, rotationY.get() * Math.PI / 180);
      gl.uniform1f(geometry, modeIndex(mode));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const stopX = rotationX.on("change", draw);
    const stopY = rotationY.on("change", draw);
    const resize = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      draw();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();
    return () => {
      disposed = true;
      observer?.disconnect();
      stopX();
      stopY();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [mode, rotationX, rotationY]);

  return <canvas ref={canvasRef} className="process-orbit-webgl-canvas" aria-hidden="true" />;
}
