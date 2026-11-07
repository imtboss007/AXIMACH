import type { ReactNode } from "react";

export type ToolGlyph =
  | "twist-drill" | "spot-drill" | "gun-drill" | "reamer" | "tap" | "thread-mill"
  | "boring-bar" | "counterbore" | "countersink" | "end-mill" | "face-mill"
  | "ball-mill" | "slot-mill" | "chamfer" | "turning-insert" | "grooving"
  | "threading-insert" | "parting" | "knurl" | "broach" | "hob" | "saw"
  | "grinding-wheel" | "honing" | "lapping" | "welding-torch" | "laser-head" | "component-block"
  | "edm-wire" | "press-tool" | "inspection" | "cnc-machine" | "vmc-machine" | "lathe-machine"
  | "edm-machine" | "grinding-machine" | "laser-cutter" | "welding-station" | "fixture-jig"
  | "cmm-machine" | "caliper";

const rules: Array<[RegExp, ToolGlyph]> = [
  [/cnc machining centre|cnc machining center|cnc machine|machining centre|machining center/, "cnc-machine"],
  [/vmc machine|vertical machining centre|vertical machining center/, "vmc-machine"],
  [/lathe machine|cnc lathe|turning centre|turning center/, "lathe-machine"],
  [/wire edm machine|edm machine|spark erosion machine/, "edm-machine"],
  [/grinding machine|cylindrical grinder|surface grinder/, "grinding-machine"],
  [/laser cutting machine|laser cutter|laser cutting system/, "laser-cutter"],
  [/welding station|welding cell|welding machine/, "welding-station"],
  [/cmm machine|coordinate measuring machine/, "cmm-machine"],
  [/vernier|caliper|micrometer|height gauge/, "caliper"],
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

export const MECHANICAL_ICON_INVENTORY: Array<{ glyph: ToolGlyph; label: string; application: string }> = [
  {glyph:"twist-drill",label:"Twist drill",application:"Drilling, peck drilling, step drilling, core drilling"},
  {glyph:"spot-drill",label:"Spot / centre drill",application:"Spotting, centre drilling and hole location"},
  {glyph:"gun-drill",label:"Gun drill",application:"Deep-hole drilling"},
  {glyph:"reamer",label:"Reamer",application:"Precision sizing and reaming"},
  {glyph:"tap",label:"Tap",application:"Internal thread cutting and tapping"},
  {glyph:"thread-mill",label:"Thread mill",application:"Internal and external thread milling"},
  {glyph:"boring-bar",label:"Boring bar",application:"Boring, line boring and back boring"},
  {glyph:"counterbore",label:"Counterbore",application:"Counterbore and spotface"},
  {glyph:"countersink",label:"Countersink",application:"Countersinking and deburring"},
  {glyph:"end-mill",label:"End mill",application:"Profile, pocket, contour and helical milling"},
  {glyph:"face-mill",label:"Face mill",application:"Facing, slab and surface milling"},
  {glyph:"ball-mill",label:"Ball-nose mill",application:"3D contour and radius machining"},
  {glyph:"slot-mill",label:"Slot mill",application:"Slot, keyway and groove milling"},
  {glyph:"chamfer",label:"Chamfer tool",application:"Chamfering and beveling"},
  {glyph:"turning-insert",label:"Turning insert",application:"CNC turning, facing and profiling"},
  {glyph:"grooving",label:"Grooving tool",application:"Grooves, recesses and undercuts"},
  {glyph:"threading-insert",label:"Threading insert",application:"External and internal thread turning"},
  {glyph:"parting",label:"Parting tool",application:"Parting-off and cut-off operations"},
  {glyph:"knurl",label:"Knurling tool",application:"Knurling and grip patterns"},
  {glyph:"broach",label:"Broach",application:"Broaching and internal keyways"},
  {glyph:"hob",label:"Gear hob",application:"Gear hobbing, splines and sprockets"},
  {glyph:"saw",label:"Saw / slitting blade",application:"Band sawing, slitting and cut-off"},
  {glyph:"grinding-wheel",label:"Grinding wheel",application:"Surface, cylindrical and tool grinding"},
  {glyph:"honing",label:"Honing tool",application:"Bore finishing and cross-hatch finishing"},
  {glyph:"lapping",label:"Lapping plate",application:"Lapping and superfinishing"},
  {glyph:"welding-torch",label:"Welding torch",application:"Welding, brazing and soldering"},
  {glyph:"laser-head",label:"Laser head",application:"Laser cutting and laser processing"},
  {glyph:"edm-wire",label:"Wire EDM",application:"Wire cut EDM and spark erosion"},
  {glyph:"press-tool",label:"Press tool",application:"Punching, blanking, stamping, piercing and shearing"},
  {glyph:"inspection",label:"Inspection / metrology",application:"CMM, measurement, testing and quality"},
  {glyph:"cnc-machine",label:"CNC machining centre",application:"CNC production centres, enclosed machining cells and multi-axis machining"},
  {glyph:"vmc-machine",label:"VMC machine",application:"Vertical machining centres, spindle stations and milling work centres"},
  {glyph:"lathe-machine",label:"CNC lathe / turning centre",application:"CNC turning machines, chucking lathes and turning cells"},
  {glyph:"edm-machine",label:"EDM machine",application:"Wire EDM, sinker EDM and spark-erosion machine stations"},
  {glyph:"grinding-machine",label:"Grinding machine",application:"Surface, cylindrical, internal and centreless grinding machines"},
  {glyph:"laser-cutter",label:"Laser cutting machine",application:"Laser cutting tables, sheet-metal cutting and laser processing cells"},
  {glyph:"welding-station",label:"Welding station",application:"MIG, TIG, arc welding and robotic welding cells"},
  {glyph:"fixture-jig",label:"Fixture / jig / workholding",application:"Jigs, fixtures, clamps, datum locators and production workholding"},
  {glyph:"cmm-machine",label:"CMM / inspection machine",application:"Bridge CMMs, probing systems and coordinate metrology"},
  {glyph:"caliper",label:"Caliper / dimensional gauge",application:"Vernier calipers, micrometers, height gauges and dimensional checks"},
  {glyph:"component-block",label:"Generic component",application:"Mechanical component fallback symbol"}
];

export function MechanicalIconGlyph({ glyph, label, className = "" }: { glyph: ToolGlyph; label?: string; className?: string }) {
  return <span className={"ax-mechanical-tool-icon " + className} title={label || glyph} aria-label={label || glyph}>
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true"><GlyphShape glyph={glyph}/></svg>
  </span>;
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
    case "component-block": return <><path {...common} d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M8 5l8 4" /></>;
    case "cnc-machine": return <><path {...common} d="M3 4h18v16H3zM7 7h10v9H7zM12 2v5M9 16v2M15 16v2M5 20v2M19 20v2M18 7h2M18 10h2M18 13h2" /><circle {...common} cx="12" cy="11" r="2" /></>;
    case "vmc-machine": return <><path {...common} d="M4 3h16v18H4zM8 6h8v8H8zM12 2v5M10 14h4v3h-4zM6 21v1M18 21v1" /><path {...common} d="M12 7v4M9 18h6" /></>;
    case "lathe-machine": return <><path {...common} d="M3 17h18v4H3zM5 7h5v10H5zM10 10h9v5h-9zM19 8v9M3 21v1M21 21v1" /><circle {...common} cx="7.5" cy="12" r="2" /></>;
    case "edm-machine": return <><path {...common} d="M4 3h16v18H4zM7 6h10v8H7zM12 2v4M12 6v8M9 17h6M7 21v1M17 21v1" /><path {...common} d="M10 9l4 2-4 2" /></>;
    case "grinding-machine": return <><path {...common} d="M3 18h18v3H3zM5 8h5v10H5zM14 7h7v7h-7zM10 12h4M3 21v1M21 21v1" /><circle {...common} cx="17.5" cy="10.5" r="2.5" /></>;
    case "laser-cutter": return <><path {...common} d="M3 5h18v14H3zM7 8h10v7H7zM12 2v6M10 15l2 3 2-3M12 18v3M5 21h14" /></>;
    case "welding-station": return <><path {...common} d="M4 18h16M6 18v3M18 18v3M8 3l7 7-3 3-7-7zM12 13l-2 5M15 10l4 4" /><path {...common} d="M17 4l1-2M20 7l2-1M18 9l2 1" /></>;
    case "fixture-jig": return <><path {...common} d="M3 17h18v4H3zM5 17V8h4v9M15 17V8h4v9M7 8V5h10v3M9 12h6M3 21v1M21 21v1" /><circle {...common} cx="12" cy="13" r="1.5" /></>;
    case "cmm-machine": return <><path {...common} d="M3 3h18v3H3zM5 6v15M19 6v15M5 21h14M12 6v7M10 13h4M12 13l3 4M15 17l-1 2" /><circle {...common} cx="15" cy="19" r="1" /></>;
    case "caliper": return <><path {...common} d="M3 5h18M5 5v14M5 9h4M9 5v5M18 5v8M18 13h-5M13 13v6M5 19h8M18 5v-2" /><path {...common} d="M9 10h9" /></>;
  }
}

const componentRules: Array<[RegExp, ToolGlyph]> = [
  [/fixture|jig|workholding|tooling plate|clamping fixture/, "fixture-jig"],
  [/shaft|spindle|axle|pinion shaft|drive shaft/, "turning-insert"],
  [/gear|sprocket|rack|worm wheel|splined/, "hob"],
  [/housing|body|casing|manifold|block|valve body/, "boring-bar"],
  [/flange|disc|hub|rotor|brake rotor/, "face-mill"],
  [/bush|bushing|sleeve|spacer|bearing|roller/, "reamer"],
  [/bracket|clamp|support|mount|fixture|jig/, "press-tool"],
  [/plate|panel|sheet|cover|guard|base plate/, "saw"],
  [/coupling|pulley|sheave|collar|ring/, "grooving"],
  [/bolt|screw|stud|nut|threaded/, "tap"],
  [/impeller|fan|propeller|blade/, "end-mill"],
  [/spring|wire form|formed wire/, "broach"],
  [/weldment|fabricated|welded assembly/, "welding-torch"]
];

export function mechanicalGlyphForComponentName(componentName: string): ToolGlyph | null {
  const value = componentName.toLowerCase().replace(/[_-]+/g, " ");
  return componentRules.find(([pattern]) => pattern.test(value))?.[1]
    || mechanicalGlyphForOperation(value) || "component-block";
}

export function MechanicalComponentIcon({ componentName, className = "" }: { componentName: string; className?: string }) {
  const glyph = mechanicalGlyphForComponentName(componentName);
  if (!glyph) return null;
  return <span className={"ax-mechanical-tool-icon ax-mechanical-component-icon " + className} title={componentName + " component icon"} aria-label={componentName + " component icon"}>
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true"><GlyphShape glyph={glyph}/></svg>
  </span>;
}

export function MechanicalOperationIcon({ operation, className = "" }: { operation: string; className?: string }) {
  const glyph = mechanicalGlyphForOperation(operation);
  if (!glyph) return null;
  return <span className={"ax-mechanical-tool-icon " + className} title={operation + " tool symbol"} aria-label={operation + " tool symbol"}>
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true"><GlyphShape glyph={glyph}/></svg>
  </span>;
}
