export interface FloatingMenuAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
}
export interface FloatingMenuViewport {
  width: number;
  height: number;
}
export interface FloatingMenuOptions {
  maxHeight?: number;
  minWidth?: number;
  margin?: number;
  gap?: number;
}
export interface FloatingMenuPosition {
  position: "fixed";
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}
export function getFloatingMenuPosition(
  anchor: FloatingMenuAnchor,
  viewport: FloatingMenuViewport,
  options?: FloatingMenuOptions
): FloatingMenuPosition;
