import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";

const vertexShader = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;
varying vec2 uv;
uniform vec2 resolution;
uniform vec2 globeRotation;
const float PI = 3.141592653589793;

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / min(resolution.x, resolution.y);
  float radius = length(p);
  if (radius > 0.49) { gl_FragColor = vec4(0.0); return; }

  vec3 ro = vec3(0.0, 0.0, 2.35);
  vec3 rd = normalize(vec3(p * 2.04, -1.85));
  float b = dot(ro, rd);
  float h = b*b - (dot(ro,ro) - 1.0);
  if (h < 0.0) { gl_FragColor = vec4(0.0); return; }
  float t = -b - sqrt(h);
  vec3 hit = ro + rd * t;
  // User drag changes the surface-coordinate orientation through globeRotation.
  // The parent drives this true spherical surface during idle rotation and drag.
  vec3 q = hit;
  float cx = cos(globeRotation.x), sx = sin(globeRotation.x);
  float cy = cos(globeRotation.y), sy = sin(globeRotation.y);
  mat3 rotateX = mat3(1.0,0.0,0.0, 0.0,cx,sx, 0.0,-sx,cx);
  mat3 rotateY = mat3(cy,0.0,-sy, 0.0,1.0,0.0, sy,0.0,cy);
  // Rotate the surface coordinates, not the canvas plane: the silhouette
  // stays spherical while the latitude/longitude texture follows user drag.
  vec3 normal = normalize(rotateY * rotateX * normalize(q));
  float lat = asin(clamp(normal.y, -1.0, 1.0));
  float lon = atan(normal.z, normal.x);

  float latLine = 1.0 - smoothstep(0.008, 0.023, abs(sin(lat * 9.0)));
  float lonLine = 1.0 - smoothstep(0.009, 0.025, abs(sin(lon * 14.0)));
  float grid = max(latLine * 0.42, lonLine * 0.62);
  float equator = 1.0 - smoothstep(0.008, 0.018, abs(lat));
  float meridian = 1.0 - smoothstep(0.008, 0.018, abs(lon));
  vec3 lightDir = normalize(vec3(-0.55, 0.72, 1.1));
  float diffuse = max(dot(normal, lightDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normal, normalize(ro-hit)), 0.0), 2.2);
  float night = smoothstep(-0.55, 0.55, dot(normal, lightDir));
  vec3 deep = vec3(0.012, 0.055, 0.15);
  vec3 ocean = vec3(0.035, 0.23, 0.49);
  vec3 lit = mix(deep, ocean, 0.28 + 0.58*night + 0.14*diffuse);
  lit += vec3(0.12, 0.48, 0.88) * grid * (0.38 + 0.62*night);
  lit += vec3(0.28, 0.72, 1.0) * equator * 0.24;
  lit += vec3(0.34, 0.78, 1.0) * meridian * 0.10;
  lit += vec3(0.10, 0.48, 0.95) * fresnel * 0.8;
  float spec = pow(max(dot(reflect(-lightDir, normal), normalize(ro-hit)), 0.0), 28.0);
  lit += vec3(0.65, 0.84, 1.0) * spec * 0.48;
  float alpha = 1.0 - smoothstep(0.475, 0.49, radius);
  gl_FragColor = vec4(lit, alpha);
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

export default function AXIMACHWebGLSphere({ rotationX, rotationY }: { rotationX: MotionValue<number>; rotationY: MotionValue<number> }) {
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
    const globeRotation = gl.getUniformLocation(program, "globeRotation");
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const applyRotation = () => {
      if (disposed) return;
      gl.uniform2f(globeRotation, rotationX.get() * Math.PI / 180, rotationY.get() * Math.PI / 180);
      draw();
    };
    const stopRotateX = rotationX.on("change", applyRotation);
    const stopRotateY = rotationY.on("change", applyRotation);
    const resize = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      applyRotation();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();
    return () => {
      disposed = true;
      observer?.disconnect();
      stopRotateX();
      stopRotateY();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={canvasRef} className="ax-orb-webgl-sphere" aria-hidden="true" />;
}
