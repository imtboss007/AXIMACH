import type { ReactNode } from "react";

type ToolGlyph =
  | "twist-drill" | "spot-drill" | "gun-drill" | "reamer" | "tap" | "thread-mill"
  | "boring-bar" | "counterbore" | "countersink" | "end-mill" | "face-mill"
  | "ball-mill" | "slot-mill" | "chamfer" | "turning-insert" | "grooving"
  | "threading-insert" | "parting" | "knurl" | "broach" | "hob" | "saw"
  | "grinding-wheel" | "honing" | "lapping" | "welding-torch" | "laser-head"
  | "edm-wire" | "press-tool" | "inspection";

const rules: Array<[RegExp, ToolGlyph]> = [
  [/gun drill|deep hole drill|gundrill/, "gun-drill"],
  [/spot drill|spot drilling|centre drill|center drill|centre drilling|centering/, "spot-drill"],
  [/drill|drilling|peck drilling|step drilling|core drilling/, "twist-drill"],
  [/ream|reaming/, "reamer"],
  [/tap|tapping|thread cutting internal/, "tap"],
  [/thread mill|thread milling/, "thread-mill"],
  [/boring|line bore|back boring/, "boring-bar"],
  [/counterbor|counter bore/, "counterbore"],
  [/countersink|counter sink/, "countersink"],
  [/face mill|face milling|facing mill/, "face-mill"],
  [/ball nose|ball end|ball milling/, "ball-mill"],
  [/slot mill|slotting mill|keyway milling/, "slot-mill"],
  [/chamfer|deburr bevel/, "chamfer"],
  [/end mill|end milling|pocket milling|profile milling|contour milling|helical milling/, "end-mill"],
  [/turn|facing|cnc lathe|profile turning/, "turning-insert"],
  [/groov|undercut/, "grooving"],
  [/threading|thread turning|external thread/, "threading-insert"],
  [/parting|cut.?off|groove cut.?off/, "parting"],
  [/knurl/, "knurl"],
  [/broach/, "broach"],
  [/gear hob|hobbing|spline hob/, "hob"],
  [/saw|band sawing|hacksaw|slitting/, "saw"],
  [/grind|grinding|abrasive cut/, "grinding-wheel"],
  [/hone|honing/, "honing"],
  [/lap|lapping|superfinish/, "lapping"],
  [/weld|braz|solder/, "welding-torch"],
  [/laser/, "laser-head"],
  [/wire edm|wire cut|spark erosion|edm/, "edm-wire"],
  [/punch|blank|stamp|press form|pierc|shear/, "press-tool"],
  [/inspect|measure|cmm|metrology|test|quality/, "inspection"]
];

export function mechanicalGlyphForOperation(operation: string): ToolGlyph | null {
  const value = operation.toLowerCase().replace(/[_-]+/g, " ");
  return rules.find(([pattern]) => pattern.test(value))?.[1] || null;
}

function GlyphShape({ glyph }: { glyph: ToolGlyph }): ReactNode {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (glyph) {
    case "twist-drill": return <><path {...common} d="M12 2v18M7 6l10 5-10 5M7 16l10 5M9 2h6M10 20l2 3 2-3" /></>;
    case "spot-drill": return <><path {...common} d="M12 2v12M6 4l6 10 6-10M9 2h6M10 16h4" /></>;
    case "gun-drill": return <><path {...common} d="M9 2h6v14l-3 6-3-6zM12 5v10M9 10l3 2 3-2M8 2h8" /></>;
    case "reamer": return <><path {...common} d="M9 2h6v5l2 3v11H7V10l2-3zM9 7h6M9 10l6 3M9 14l6 3M12 2v19" /></>;
    case "tap": return <><path {...common} d="M9 2h6v5l2 3v10l-5 3-5-3V10l2-3zM8 10h8M8 13h8M8 16h8M12 2v5" /></>;
    case "thread-mill": return <><path {...common} d="M10 2h4v7l3 3v9H7v-9l3-3zM8 13l8 2M8 17l8 2" /></>;
    case "boring-bar": return <><path {...common} d="M8 2h8v12l-4 7-4-7zM8 8h8M12 2v19M16 5l4-2" /></>;
    case "counterbore": return <><path {...common} d="M7 2h10v5l-2 2v12H9V9L7 7zM7 7h10M9 12h6" /></>;
    case "countersink": return <><path {...common} d="M12 2v6M4 8h16l-8 8zM9 16h6v5H9z" /></>;
    case "end-mill": return <><path {...common} d="M9 2h6v5l2 3v11H7V10l2-3zM9 8l6 4M9 13l6 4M12 2v19" /></>;
    case "face-mill": return <><circle {...common} cx="12" cy="11" r="8"/><path {...common} d="M12 3v16M4 11h16M7 5l10 12M17 5L7 17M12 19v4" /></>;
    case "ball-mill": return <><path {...common} d="M8 2h8v7a4 4 0 0 1-8 0zM8 9a4 4 0 0 0 8 0M12 13v9M9 22h6" /></>;
    case "slot-mill": return <><path {...common} d="M9 2h6v7l-2 3v10h-2V12L9 9zM9 7h6M8 15h8" /></>;
    case "chamfer": return <><path {...common} d="M5 20V8l7-6 7 6v12zM5 8h14M12 2v18" /></>;
    case "turning-insert": return <><path {...common} d="M4 18L18 4l3 3-14 14zM4 18l5 1-1 4M15 7l2 2" /></>;
    case "grooving": return <><path {...common} d="M4 5h16v5H4zM4 14h16v5H4zM10 5v14M14 5v14" /></>;
    case "threading-insert": return <><path {...common} d="M4 18L18 4l3 3-14 14zM7 15l3 3M10 12l3 3M13 9l3 3" /></>;
    case "parting": return <><path {...common} d="M3 6h18M3 18h18M12 6v12M9 10l3-4 3 4M9 14l3 4 3-4" /></>;
    case "knurl": return <><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M7 7l10 10M17 7L7 17M12 4v16M4 12h16" /></>;
    case "broach": return <><path {...common} d="M10 2h4l-1 4 2 3-2 3 2 3-2 3 1 4h-4l1-4-2-3 2-3-2-3 2-3z" /></>;
    case "hob": return <><path {...common} d="M4 6l16 12M4 18L20 6M7 4l10 16M17 4L7 20M12 2v20" /></>;
    case "saw": return <><path {...common} d="M3 7h18v10H3zM5 7l2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3" /></>;
    case "grinding-wheel": return <><circle {...common} cx="12" cy="12" r="9"/><circle {...common} cx="12" cy="12" r="3"/><path {...common} d="M12 3v6M21 12h-6M12 21v-6M3 12h6" /></>;
    case "honing": return <><path {...common} d="M7 2h10v20H7zM7 7h10M7 12h10M7 17h10M4 4v16M20 4v16" /></>;
    case "lapping": return <><path {...common} d="M3 9h18v5H3zM6 14v5h12v-5M8 5h8" /></>;
    case "welding-torch": return <><path {...common} d="M8 2l8 8-4 4-8-8zM12 14l-3 7M15 10l5 5M9 5l-4 4M17 16l3 3" /></>;
    case "laser-head": return <><path {...common} d="M7 2h10v6l-3 3v5h-4v-5L7 8zM12 16v6M9 19h6M4 12l3 2M20 12l-3 2" /></>;
    case "edm-wire": return <><path {...common} d="M7 2v5M17 2v5M7 7h10M7 7v10M17 7v10M7 17h10M12 17v5M9 11l6 2" /></>;
    case "press-tool": return <><path {...common} d="M4 3h16v5H4zM10 8h4v6h-4zM3 18h18M6 14h12v4H6zM12 1v2" /></>;
    case "inspection": return <><circle {...common} cx="10" cy="10" r="6"/><path {...common} d="M14.5 14.5L21 21M10 7v6M7 10h6" /></>;
  }
}

export function MechanicalOperationIcon({ operation, className = "" }: { operation: string; className?: string }) {
  const glyph = mechanicalGlyphForOperation(operation);
  if (!glyph) return null;
  return <span className={"ax-mechanical-tool-icon " + className} title={operation + " tool symbol"} aria-label={operation + " tool symbol"}>
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true"><GlyphShape glyph={glyph}/></svg>
  </span>;
}
