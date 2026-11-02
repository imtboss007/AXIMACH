export const PROCESS_MAP_GEOMETRY_MODES = [
  { id: "sphere", label: "Sphere", hint: "Stages distributed around a 3D globe" },
  { id: "cube", label: "Cube", hint: "Stages placed on six cube faces" },
  { id: "pyramid", label: "Pyramid", hint: "Stages arranged across ascending tiers" },
  { id: "helix", label: "Helix", hint: "Stages follow a double-spiral path" },
  { id: "orbit", label: "Orbit", hint: "Stages travel around a circular orbital path" },
  { id: "vortex", label: "Vortex", hint: "Stages spiral outward through depth" }
] as const;

export type ProcessMapGeometryMode = typeof PROCESS_MAP_GEOMETRY_MODES[number]["id"];
export type ProcessMapGeometryPoint = {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
};

const CENTER: ProcessMapGeometryPoint = { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const fract = (value: number) => value - Math.floor(value);

export function cycleProcessMapGeometryMode(
  current: ProcessMapGeometryMode,
  direction: -1 | 1
): ProcessMapGeometryMode {
  const index = PROCESS_MAP_GEOMETRY_MODES.findIndex(mode => mode.id === current);
  const safeIndex = index < 0 ? 0 : index;
  const next = (safeIndex + direction + PROCESS_MAP_GEOMETRY_MODES.length) % PROCESS_MAP_GEOMETRY_MODES.length;
  return PROCESS_MAP_GEOMETRY_MODES[next].id;
}

export function getProcessMapGeometryPoint(
  mode: ProcessMapGeometryMode,
  index: number,
  count: number
): ProcessMapGeometryPoint {
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(index)) return { ...CENTER };
  if (count === 1) return { ...CENTER };
  const safeCount = Math.max(1, Math.floor(count));
  const safeIndex = clamp(Math.floor(index), 0, safeCount - 1);
  const progress = (safeIndex + 0.5) / safeCount;
  const angle = safeIndex * 2.399963229728653;

  switch (mode) {
    case "sphere": {
      const latitude = 1 - 2 * progress;
      const radius = Math.sqrt(Math.max(0, 1 - latitude * latitude));
      return {
        x: Math.cos(angle) * radius,
        y: latitude,
        z: Math.sin(angle) * radius,
        rotateX: 0,
        rotateY: 0
      };
    }
    case "cube": {
      const face = safeIndex % 6;
      const slot = Math.floor(safeIndex / 6);
      const faceCount = Math.max(1, Math.ceil((safeCount - face) / 6));
      const u = faceCount === 1 ? 0 : (slot / (faceCount - 1)) * 1.2 - 0.6;
      const v = faceCount <= 2 ? (slot === 0 ? -0.18 : 0.18) : fract(slot * 0.61803398875) * 1.1 - 0.55;
      const facePoints: ProcessMapGeometryPoint[] = [
        { x: 0.55 + u * 0.18, y: v * 0.55, z: 0.92, rotateX: 0, rotateY: 0 },
        { x: 0.92, y: v * 0.55, z: 0.55 - u * 0.18, rotateX: 0, rotateY: 0 },
        { x: -0.55 - u * 0.18, y: v * 0.55, z: -0.92, rotateX: 0, rotateY: 0 },
        { x: -0.92, y: v * 0.55, z: -0.55 + u * 0.18, rotateX: 0, rotateY: 0 },
        { x: u * 0.72, y: 0.92, z: 0.55 + v * 0.2, rotateX: 0, rotateY: 0 },
        { x: u * 0.72, y: -0.92, z: -0.55 - v * 0.2, rotateX: 0, rotateY: 0 }
      ];
      return facePoints[face];
    }
    case "pyramid": {
      const tier = Math.floor((Math.sqrt(8 * safeIndex + 1) - 1) / 2);
      const firstInTier = tier * (tier + 1) / 2;
      const column = safeIndex - firstInTier;
      const tierCount = Math.max(1, Math.ceil((Math.sqrt(8 * safeCount + 1) - 1) / 2));
      const tierWidth = tierCount <= 1 ? 0 : tier / (tierCount - 1);
      const horizontal = tier === 0 ? 0 : (column / tier * 2 - 1) * (0.2 + tierWidth * 0.72);
      const vertical = tierCount <= 1 ? 0 : 0.68 - (tier / (tierCount - 1)) * 1.36;
      return {
        x: horizontal,
        y: vertical,
        z: 0.42 - tierWidth * 0.68,
        rotateX: 0,
        rotateY: horizontal * 18
      };
    }
    case "helix": {
      const phase = safeIndex * 1.42;
      return {
        x: Math.cos(phase) * 0.76,
        y: 0.78 - progress * 1.56,
        z: Math.sin(phase) * 0.76,
        rotateX: 0,
        rotateY: 0
      };
    }
    case "orbit": {
      const orbitAngle = (safeIndex / safeCount) * Math.PI * 2 - Math.PI / 2;
      return {
        x: Math.cos(orbitAngle) * 0.82,
        y: Math.sin(orbitAngle) * 0.57,
        z: Math.sin(orbitAngle * 2) * 0.16,
        rotateX: 0,
        rotateY: 0
      };
    }
    case "vortex": {
      const vortexRadius = 0.2 + progress * 0.76;
      const vortexAngle = safeIndex * 2.16;
      return {
        x: Math.cos(vortexAngle) * vortexRadius,
        y: Math.sin(vortexAngle) * vortexRadius * 0.68,
        z: 0.62 - progress * 1.24,
        rotateX: 0,
        rotateY: 0
      };
    }
    default:
      return { ...CENTER };
  }
}
