import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export type ToolGlyph =
  | "twist-drill" | "spot-drill" | "gun-drill" | "reamer" | "tap" | "thread-mill"
  | "boring-bar" | "counterbore" | "countersink" | "end-mill" | "face-mill"
  | "ball-mill" | "slot-mill" | "chamfer" | "turning-insert" | "grooving"
  | "threading-insert" | "parting" | "knurl" | "broach" | "hob" | "saw"
  | "grinding-wheel" | "honing" | "lapping" | "welding-torch" | "laser-head" | "component-block"
  | "edm-wire" | "press-tool" | "inspection" | "heat-treatment-furnace" | "powder-coating-gun" | "assembly-tool" | "transport-truck" | "material-stock" | "cnc-machine" | "vmc-machine" | "lathe-machine"
  | "edm-machine" | "grinding-machine" | "laser-cutter" | "welding-station" | "fixture-jig"
  | "cmm-machine" | "caliper"
  | "robot-arm" | "hydraulic-press" | "injection-molding" | "sheet-metal-brake" | "plasma-cutter" | "waterjet-cutter" | "swiss-lathe" | "five-axis-cnc" | "hmc-machine" | "cnc-router" | "gear-grinder" | "cylindrical-grinder" | "surface-grinder" | "ultrasonic-cleaner" | "shot-blaster" | "anodizing-tank" | "plating-tank" | "paint-booth" | "quench-tank" | "laser-marker" | "additive-printer" | "foundry-casting" | "forging-press" | "stamping-press" | "riveter" | "torque-wrench" | "conveyor" | "forklift" | "sea-freight" | "air-freight" | "rail-freight" | "microscope" | "profilometer" | "spectrometer" | "hardness-tester" | "micrometer" | "height-gauge" | "gauge-block" | "packaging-box" | "warehouse-rack" | "coolant-pump" | "hydraulic-pump" | "compressor" | "chip-conveyor" | "bearing" | "gear" | "shaft" | "fastener" | "valve" | "industrial-pump" | "electric-motor";

const rules: Array<[RegExp, ToolGlyph]> = [
  [/robot arm|robotic tending|automation cell/, "robot-arm"],
  [/hydraulic press|press fitting|hydraulic forming/, "hydraulic-press"],
  [/injection mould|injection mold/, "injection-molding"],
  [/press brake|sheet metal bending|folding/, "sheet-metal-brake"],
  [/plasma cutting|plasma cutter/, "plasma-cutter"],
  [/waterjet|water jet/, "waterjet-cutter"],
  [/swiss type|sliding headstock/, "swiss-lathe"],
  [/five axis|5 axis|5-axis/, "five-axis-cnc"],
  [/horizontal machining centre|horizontal machining center|\\bhmc\\b/, "hmc-machine"],
  [/cnc router|routing operation/, "cnc-router"],
  [/gear grinding|gear grinder/, "gear-grinder"],
  [/cylindrical grind|cylindrical grinder|internal grinding/, "cylindrical-grinder"],
  [/surface grind|surface grinder/, "surface-grinder"],
  [/ultrasonic clean|ultrasonic cleaning/, "ultrasonic-cleaner"],
  [/shot blast|shot peen/, "shot-blaster"],
  [/anodiz/, "anodizing-tank"],
  [/electroplat/, "plating-tank"],
  [/paint booth|spray paint/, "paint-booth"],
  [/quench|quenching/, "quench-tank"],
  [/laser marking|laser engraving/, "laser-marker"],
  [/additive|3d print/, "additive-printer"],
  [/foundry|sand cast|investment cast|casting/, "foundry-casting"],
  [/forging|forge press/, "forging-press"],
  [/stamping|progressive die/, "stamping-press"],
  [/riveting|rivet|clinching/, "riveter"],
  [/torque wrench|torque tightening/, "torque-wrench"],
  [/conveyor|workpiece transfer/, "conveyor"],
  [/forklift/, "forklift"],
  [/sea freight|ocean freight/, "sea-freight"],
  [/air freight|air cargo/, "air-freight"],
  [/rail freight|rail cargo/, "rail-freight"],
  [/microscope|optical inspection/, "microscope"],
  [/profilometer|surface roughness|ra measurement/, "profilometer"],
  [/spectrometer|alloy identification/, "spectrometer"],
  [/hardness test|rockwell|brinell|vickers/, "hardness-tester"],
  [/micrometer/, "micrometer"],
  [/height gauge/, "height-gauge"],
  [/gauge block|slip gauge/, "gauge-block"],
  [/packaging|packing|carton/, "packaging-box"],
  [/warehouse|storage rack|fifo rack/, "warehouse-rack"],
  [/coolant system|coolant pump|through spindle coolant|tsc/, "coolant-pump"],
  [/hydraulic power|hydraulic pump|power pack/, "hydraulic-pump"],
  [/compressor|compressed air/, "compressor"],
  [/chip conveyor|swarf conveyor/, "chip-conveyor"],

  [/cnc machining centre|cnc machining center|cnc machine|machining centre|machining center/, "cnc-machine"],
  [/heat treat|heat treatment|hardening|tempering|anneal|carburis|vacuum harden|furnace/, "heat-treatment-furnace"],
  [/powder coat|powder coating|paint|coating|plating|surface treatment|anodiz/, "powder-coating-gun"],
  [/assembly|fitment|press fit|fastening|bolt assembly/, "assembly-tool"],
  [/transport|dispatch|shipping|logistics|delivery/, "transport-truck"],
  [/raw material|stock bar|sheet blank|material stock|bar stock/, "material-stock"],
  [/\bvmc\b|vertical machining centre|vertical machining center/, "vmc-machine"],
  [/\bhmc\b|horizontal machining centre|horizontal machining center/, "cnc-machine"],
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
  [/\bmilling\b|mill operation|milling operation/, "end-mill"],
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
  {glyph:"heat-treatment-furnace",label:"Heat-treatment furnace",application:"Hardening, tempering, annealing, carburising and vacuum heat treatment"},
  {glyph:"powder-coating-gun",label:"Coating / finishing gun",application:"Powder coating, painting and surface finishing"},
  {glyph:"assembly-tool",label:"Assembly tool",application:"Mechanical assembly, fastening and press-fit operations"},
  {glyph:"transport-truck",label:"Transport / dispatch",application:"Vendor collection, route movement, logistics and delivery"},
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
  {glyph:"robot-arm",label:"Industrial robot arm",application:"Robotic handling, CNC tending, welding and automated assembly"},
  {glyph:"hydraulic-press",label:"Hydraulic press",application:"Press fitting, forming and hydraulic pressing"},
  {glyph:"injection-molding",label:"Injection moulding machine",application:"Thermoplastic injection moulding and moulded components"},
  {glyph:"sheet-metal-brake",label:"Press brake",application:"Sheet-metal bending, folding and forming"},
  {glyph:"plasma-cutter",label:"Plasma cutting",application:"CNC plasma cutting and conductive plate profiling"},
  {glyph:"waterjet-cutter",label:"Waterjet cutting",application:"Abrasive and pure-waterjet precision cutting"},
  {glyph:"swiss-lathe",label:"Swiss-type lathe",application:"Sliding-headstock turning and long slender precision parts"},
  {glyph:"five-axis-cnc",label:"Five-axis machining centre",application:"Simultaneous five-axis machining and complex components"},
  {glyph:"hmc-machine",label:"Horizontal machining centre",application:"Palletised HMC production and horizontal milling"},
  {glyph:"cnc-router",label:"CNC router",application:"CNC routing of plastics, composites and sheet"},
  {glyph:"gear-grinder",label:"Gear grinding machine",application:"Precision gear profile grinding and finishing"},
  {glyph:"cylindrical-grinder",label:"Cylindrical grinder",application:"External and internal cylindrical grinding"},
  {glyph:"surface-grinder",label:"Surface grinder",application:"Flatness, parallelism and surface finishing"},
  {glyph:"ultrasonic-cleaner",label:"Ultrasonic cleaning tank",application:"Ultrasonic cleaning and degreasing"},
  {glyph:"shot-blaster",label:"Shot blasting machine",application:"Shot blasting, peening and surface preparation"},
  {glyph:"anodizing-tank",label:"Anodising tank",application:"Aluminium anodising and electrochemical treatment"},
  {glyph:"plating-tank",label:"Electroplating tank",application:"Nickel, chrome, zinc and other electroplating"},
  {glyph:"paint-booth",label:"Paint booth",application:"Industrial spray painting and curing"},
  {glyph:"quench-tank",label:"Quench tank",application:"Quenching and controlled heat-treatment cooling"},
  {glyph:"laser-marker",label:"Laser marking head",application:"Laser engraving, part marking and traceability"},
  {glyph:"additive-printer",label:"Additive manufacturing printer",application:"Metal and polymer 3D printing"},
  {glyph:"foundry-casting",label:"Foundry casting",application:"Sand casting, investment casting and pouring"},
  {glyph:"forging-press",label:"Forging press",application:"Hot, closed-die and upset forging"},
  {glyph:"stamping-press",label:"Stamping press",application:"Progressive-die stamping, blanking and forming"},
  {glyph:"riveter",label:"Riveting tool",application:"Riveting, clinching and permanent fastening"},
  {glyph:"torque-wrench",label:"Torque wrench",application:"Controlled bolt tightening and torque verification"},
  {glyph:"conveyor",label:"Conveyor system",application:"In-plant workpiece transfer and automated flow"},
  {glyph:"forklift",label:"Forklift",application:"Raw-stock, pallet and finished-goods handling"},
  {glyph:"sea-freight",label:"Sea freight container",application:"Ocean freight and export logistics"},
  {glyph:"air-freight",label:"Air freight",application:"Air cargo and urgent component shipments"},
  {glyph:"rail-freight",label:"Rail freight",application:"Rail cargo and intermodal freight movement"},
  {glyph:"microscope",label:"Inspection microscope",application:"Optical inspection and toolmaker microscopy"},
  {glyph:"profilometer",label:"Surface profilometer",application:"Surface roughness and profile measurement"},
  {glyph:"spectrometer",label:"Material spectrometer",application:"Alloy identification and composition verification"},
  {glyph:"hardness-tester",label:"Hardness tester",application:"Rockwell, Brinell and Vickers testing"},
  {glyph:"micrometer",label:"Micrometer",application:"Outside, inside and depth micrometers"},
  {glyph:"height-gauge",label:"Height gauge",application:"Surface-plate height measurement"},
  {glyph:"gauge-block",label:"Gauge block set",application:"Length standards and dimensional calibration"},
  {glyph:"packaging-box",label:"Packaging box",application:"Protective packing, labelling and dispatch"},
  {glyph:"warehouse-rack",label:"Warehouse rack",application:"FIFO storage and goods warehousing"},
  {glyph:"coolant-pump",label:"Coolant system",application:"Machine coolant circulation and TSC supply"},
  {glyph:"hydraulic-pump",label:"Hydraulic power unit",application:"Hydraulic power packs and pressure systems"},
  {glyph:"compressor",label:"Air compressor",application:"Compressed air generation and pneumatic supply"},
  {glyph:"chip-conveyor",label:"Chip conveyor",application:"CNC swarf collection and evacuation"},
  {glyph:"bearing",label:"Bearing",application:"Rolling-element and precision bearing components"},
  {glyph:"gear",label:"Precision gear",application:"Spur, helical, bevel and worm gears"},
  {glyph:"shaft",label:"Precision shaft",application:"Spindles, axles and turned cylindrical parts"},
  {glyph:"fastener",label:"Fastener",application:"Bolts, screws, studs, nuts and washers"},
  {glyph:"valve",label:"Industrial valve",application:"Control, isolation, check and pressure valves"},
  {glyph:"industrial-pump",label:"Industrial pump",application:"Centrifugal and process pumps"},
  {glyph:"electric-motor",label:"Electric motor",application:"Industrial motors and rotating equipment"},
  {glyph:"component-block",label:"Machined component block",application:"Machined housings, blocks, manifolds and finished part identity"},
  {glyph:"material-stock",label:"Raw material stock",application:"Raw bar, billet, plate, sheet and material issue identity"}
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
    case "heat-treatment-furnace": return <><path {...common} d="M5 21V8h14v13M8 8V4h8v4M8 13h8M8 17h8M12 2v2" /><path {...common} d="M10 15c-1-2 1-3 2-5 1 2 3 3 2 5a2 2 0 0 1-4 0z" /></>;
    case "powder-coating-gun": return <><path {...common} d="M3 7h10l3 3-3 3H9l-2 3H4l2-5H3zM16 10h3l2-2M19 10l2 2M7 16l-2 5M11 16l-1 5" /></>;
    case "assembly-tool": return <><path {...common} d="M14 4a5 5 0 0 0-6 6L3 15l6 6 5-5a5 5 0 0 0 6-6l-3 3-4-4zM4 4l4 4M16 16l4 4" /></>;
    case "transport-truck": return <><path {...common} d="M2 6h12v11H2zM14 10h5l3 4v3h-8zM5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></>;
    case "material-stock": return <><path {...common} d="M3 6l9-4 9 4-9 4zM3 6v12l9 4 9-4V6M12 10v12M6 8l12-4M6 13l12-4" /></>;
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
    case "robot-arm": return <><path {...common} d="M4 20h6l2-4-3-3 3-4 4 2 2-3-4-3-5 6 3 4-2 3H4zM16 5l3-2M17 9l3-1"/></>;
    case "hydraulic-press": return <><path {...common} d="M3 4h18v4H3zM6 8v5h12V8M9 13v4h6v-4M4 17h16v4H4zM12 2v3"/></>;
    case "injection-molding": return <><path {...common} d="M3 5h8v14H3zM11 9h5l5 3-5 3h-5M5 8h4M5 12h4M5 16h4M16 6V3h4v3"/></>;
    case "sheet-metal-brake": return <><path {...common} d="M3 6h18v4H3zM5 10v8h14v-8M5 18l7 3 7-3M8 3v3M16 3v3"/></>;
    case "plasma-cutter": return <><path {...common} d="M7 2h10v6l-3 3v4h-4v-4L7 8zM12 15l-3 6M12 15l3 6M5 19h4M15 19h4"/></>;
    case "waterjet-cutter": return <><path {...common} d="M4 3h16v4H4zM10 7h4v3l-2 3-2-3zM12 13l-3 4M12 13l3 4M12 17v5"/></>;
    case "swiss-lathe": return <><path {...common} d="M2 8h20v3H2zM4 11v7h4v-7M8 14h9v3H8M17 11v7h3v-7M4 18h16v3H4z"/></>;
    case "five-axis-cnc": return <><path {...common} d="M3 4h18v16H3zM7 7h10v8H7zM12 2v5M7 15l-3 4M17 15l3 4M9 18h6M12 11l3-3M12 11l-3 3"/></>;
    case "hmc-machine": return <><path {...common} d="M3 4h18v16H3zM6 7h8v10H6zM14 12h5M17 9v6M4 20v2M20 20v2"/></>;
    case "cnc-router": return <><path {...common} d="M3 4h18v3H3zM5 7v13M19 7v13M5 20h14M10 7h4v5h-4zM12 12v6M9 18h6"/></>;
    case "gear-grinder": return <><circle {...common} cx="12" cy="12" r="7"/><circle {...common} cx="12" cy="12" r="2"/><path {...common} d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>;
    case "cylindrical-grinder": return <><path {...common} d="M3 17h18v4H3zM5 6h4v11H5zM15 8h5v9h-5zM9 11h6M9 13h6"/></>;
    case "surface-grinder": return <><path {...common} d="M3 18h18v3H3zM5 14h14v4H5zM8 4h8v6H8zM12 10v4M6 3h12M4 11h16"/></>;
    case "ultrasonic-cleaner": return <><path {...common} d="M3 7h18v13H3zM6 7V4h12v3M7 12c2-2 3 2 5 0s3 2 5 0M7 16c2-2 3 2 5 0s3 2 5 0M12 2v2"/></>;
    case "shot-blaster": return <><path {...common} d="M3 4h18v5H3zM6 9v5M18 9v5M12 9v4M8 14l-2 4M12 13v6M16 14l2 4M4 21h16"/></>;
    case "anodizing-tank": return <><path {...common} d="M4 7h16v14H4zM7 7V4h10v3M7 11h10M8 14l2 2 2-2 2 2 2-2M12 2v2"/></>;
    case "plating-tank": return <><path {...common} d="M3 8h18v13H3zM6 8V4h4v4M14 8V4h4v4M6 12h12M8 16h8"/></>;
    case "paint-booth": return <><path {...common} d="M4 3h16v18H4zM8 7h8v6H8zM12 13v5M9 18h6M2 6l2 2M22 6l-2 2M2 12h2M22 12h-2"/></>;
    case "quench-tank": return <><path {...common} d="M3 9h18v12H3zM6 9V5h12v4M7 13c1-2 2-2 3 0s2 2 3 0 2-2 4 0M12 2v3"/></>;
    case "laser-marker": return <><path {...common} d="M6 3h12v6H6zM9 9v4h6V9M12 13v8M9 17h6M4 17l3-2M20 17l-3-2"/></>;
    case "additive-printer": return <><path {...common} d="M3 4h18v16H3zM6 7h12v6H6zM10 13h4v4h-4zM12 2v5M8 20v2M16 20v2"/></>;
    case "foundry-casting": return <><path {...common} d="M4 3h10v9H4zM14 8l6 3-2 4-6-3M8 12v5M8 17l-3 4M8 17l3 4M3 21h10"/></>;
    case "forging-press": return <><path {...common} d="M3 4h18v4H3zM7 8v5h10V8M10 13v4h4v-4M4 17h16v4H4zM12 2v2"/></>;
    case "stamping-press": return <><path {...common} d="M4 3h16v4H4zM8 7v5h8V7M8 12l4 4 4-4M3 18h18v3H3z"/></>;
    case "riveter": return <><path {...common} d="M4 4l7 7-3 3-7-7zM11 11l8-7 3 3-7 8M9 14l-3 7M14 12l5 8M3 21h7M14 21h7"/></>;
    case "torque-wrench": return <><path {...common} d="M4 20L17 7M14 4l3-3 5 5-3 3M4 20l-2 2M10 14l3 3M7 17l3 3"/></>;
    case "conveyor": return <><path {...common} d="M2 17h20M4 17v4M20 17v4M4 14l4-4h8l4 4zM7 10V6h10v4M5 21h14"/></>;
    case "forklift": return <><path {...common} d="M3 5h6v10H3zM9 11h6l3 4v3H9zM18 4v14M21 4v14M17 18h6M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></>;
    case "sea-freight": return <><path {...common} d="M2 7h20v10H2zM5 7v10M10 7v10M15 7v10M20 7v10M2 17l3 4 3-2 4 2 4-2 3 2 3-4M6 4h12"/></>;
    case "air-freight": return <><path {...common} d="M2 13l8-2 4-8 3 1-1 7 6 2v2l-7-1-3 6-2-1 1-6-9 2z"/></>;
    case "rail-freight": return <><path {...common} d="M6 3h12v13H6zM8 6h8v5H8zM8 16l-3 5M16 16l3 5M4 21h16M6 12h12"/></>;
    case "microscope": return <><path {...common} d="M9 3l6 6-3 3-6-6zM12 12l-2 4M10 16h8M15 9l3 3M18 12a5 5 0 0 1-5 5M6 21h14M9 18v3"/></>;
    case "profilometer": return <><path {...common} d="M3 17h18M4 17l2-4 2 4 2-6 2 6 2-3 2 3 2-5 2 5M12 2v8M9 5l3-3 3 3"/></>;
    case "spectrometer": return <><path {...common} d="M4 4h16v16H4zM7 7l10 10M7 17l10-10M12 4v16M4 12h16"/></>;
    case "hardness-tester": return <><path {...common} d="M4 18h16v3H4zM10 3h4v7h-4zM12 10v5M8 15h8M6 18l6-3 6 3"/></>;
    case "micrometer": return <><path {...common} d="M6 4a8 8 0 1 0 0 16h5v-4H7a4 4 0 1 1 0-8h4V4zM11 8h6v8h-6zM17 12h5M22 10v4M14 4V2"/></>;
    case "height-gauge": return <><path {...common} d="M5 3h3v18H5zM8 7h10v3H8M14 10v6M12 16h4M3 21h19M18 7V4"/></>;
    case "gauge-block": return <><path {...common} d="M3 6h18v5H3zM6 11v7M18 11v7M3 18h18v3H3zM8 8h8M10 14h4"/></>;
    case "packaging-box": return <><path {...common} d="M3 7l9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11M8 5l8 4M8 14h8"/></>;
    case "warehouse-rack": return <><path {...common} d="M4 3v18M20 3v18M4 8h16M4 14h16M4 20h16M7 5h4v3H7zM13 10h4v4h-4zM7 15h4v4H7z"/></>;
    case "coolant-pump": return <><path {...common} d="M4 8h16v9H4zM8 8V4h8v4M12 17v4M9 21h6M7 11h10M7 14h10"/></>;
    case "hydraulic-pump": return <><circle {...common} cx="12" cy="12" r="7"/><path {...common} d="M12 5v14M5 12h14M9 9l6 6M15 9l-6 6M12 2v3M12 19v3"/></>;
    case "compressor": return <><path {...common} d="M4 10h16v9H4zM7 10V5h10v5M8 19v3M16 19v3M7 14h10M12 2v3"/></>;
    case "chip-conveyor": return <><path {...common} d="M3 16h18M5 16v4M19 16v4M5 12l3-4 3 4 3-4 3 4 2-3M4 21h16"/></>;
    case "bearing": return <><circle {...common} cx="12" cy="12" r="9"/><circle {...common} cx="12" cy="12" r="5"/><circle {...common} cx="12" cy="12" r="2"/><path {...common} d="M12 3v4M12 17v4M3 12h4M17 12h4"/></>;
    case "gear": return <><circle {...common} cx="12" cy="12" r="5"/><circle {...common} cx="12" cy="12" r="2"/><path {...common} d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>;
    case "shaft": return <><path {...common} d="M3 10h4V7h4v3h6v4h-6v3H7v-3H3zM17 10h4v4h-4"/></>;
    case "fastener": return <><path {...common} d="M8 3h8v5H8zM10 8v12M14 8v12M7 13h10M7 17h10M6 3L3 6M18 3l3 3"/></>;
    case "valve": return <><path {...common} d="M3 12h18M7 7l5 5-5 5M17 7l-5 5 5 5M12 3v4M9 3h6M12 17v4"/></>;
    case "industrial-pump": return <><path {...common} d="M3 8h7l3 4-3 4H3zM13 12h8M17 8v8M3 18h18v3H3zM6 8V5h7"/></>;
    case "electric-motor": return <><path {...common} d="M5 5h14v14H5zM2 8h3M2 16h3M19 8h3M19 16h3M9 5V2h6v3M9 19v3h6v-3"/><circle {...common} cx="12" cy="12" r="4"/></>;
  }
}

const componentRules: Array<[RegExp, ToolGlyph]> = [
  [/bearing|ball bearing|roller bearing/, "bearing"],
  [/\\bgear\\b|sprocket|worm wheel|pinion/, "gear"],
  [/shaft|spindle|axle/, "shaft"],
  [/bolt|screw|stud|nut|washer|fastener/, "fastener"],
  [/valve/, "valve"],
  [/pump|impeller/, "industrial-pump"],
  [/motor|stator|rotor/, "electric-motor"],
  [/fixture|jig|workholding|tooling plate|clamping fixture/, "fixture-jig"],
  // Prefer the gear-specific identity when a component name contains both "gear" and "shaft".
  [/\b(?:gear|sprocket|rack|worm wheel|splined)\b/, "hob"],
  [/shaft|spindle|axle|pinion shaft|drive shaft/, "turning-insert"],
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

export function mechanicalComponentSvgForName(componentName: string): string {
  const glyph = mechanicalGlyphForComponentName(componentName) || "component-block";
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" style={{ color: "#2d6da9" }}>
      <g fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <GlyphShape glyph={glyph}/>
      </g>
    </svg>
  );
}

export function mechanicalOperationSvgForName(operationName: string): string {
  const glyph = mechanicalGlyphForOperation(operationName) || "component-block";
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" style={{ color: "#2d6da9" }}>
      <g fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <GlyphShape glyph={glyph}/>
      </g>
    </svg>
  );
}

export function MechanicalOperationIcon({ operation, className = "" }: { operation: string; className?: string }) {
  const glyph = mechanicalGlyphForOperation(operation) || "component-block";
  return <span className={"ax-mechanical-tool-icon " + className} title={operation + " tool symbol"} aria-label={operation + " tool symbol"}>
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-hidden="true"><GlyphShape glyph={glyph}/></svg>
  </span>;
}
