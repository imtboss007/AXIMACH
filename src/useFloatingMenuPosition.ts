import { useLayoutEffect, useState, type RefObject } from "react";
import { getFloatingMenuPosition, type FloatingMenuPosition } from "./floatingMenuLayout.js";

/** Track an anchor while it scrolls and keep its popup inside the visible viewport. */
export function useFloatingMenuPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  maxHeight: number,
  minWidth = 0
): FloatingMenuPosition | null {
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchorElement = anchorRef.current;
      if (!anchorElement) {
        setPosition(null);
        return;
      }

      const rect = anchorElement.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const offsetLeft = visualViewport?.offsetLeft ?? 0;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const margin = 8;

      if (rect.bottom <= offsetTop + margin || rect.top >= offsetTop + viewportHeight - margin) {
        setPosition(null);
        return;
      }

      setPosition(getFloatingMenuPosition(
        {
          left: rect.left - offsetLeft,
          top: rect.top - offsetTop,
          right: rect.right - offsetLeft,
          bottom: rect.bottom - offsetTop,
          width: rect.width
        },
        { width: viewportWidth, height: viewportHeight },
        { maxHeight, minWidth, margin, gap: 6 }
      ));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchorRef, open, maxHeight, minWidth]);

  return position;
}
