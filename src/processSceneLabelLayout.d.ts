export type ProcessSceneLabelKind =
  | "operation"
  | "material"
  | "transport"
  | "transportLeg"
  | "catalogue"
  | "core";

export interface ProcessSceneLabelCandidate {
  id: string;
  kind: ProcessSceneLabelKind;
  screen: {
    x: number;
    y: number;
    z: number;
    scale?: number;
    collision?: boolean;
  };
}

export function relaxProcessSceneLabels<T extends ProcessSceneLabelCandidate>(
  items: T[],
  width: number,
  height: number,
  responsiveWidth?: number
): T[];

export function processSceneLabelBounds(kind: ProcessSceneLabelKind, viewportWidth: number): { width: number; height: number };
