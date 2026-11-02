
import { Activity, Anvil, Box, Boxes, Cable, CheckCircle2, CircleDot, Cog, Cpu, Drill, Factory, Flame, Gauge, Hammer, Layers, Package, Paintbrush, Ruler, ScanLine, Scissors, ShieldCheck, Truck, Waves, Wrench, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProcessIcon } from "./IconStudio";
type Props={name:string;category?:string;size?:"sm"|"md"|"lg"};
const rules:[RegExp,LucideIcon][]=[
  [/5.?axis|3.?axis|vmc|hmc|cnc milling|milling|machining centre|machining center|face mill|end mill|slot mill|profile mill|pocket mill|gear cutting|keyway/,Cog],
  [/turn|lathe|boring|facing|grooving|thread turn|cnc turning|swiss turn|hard turn|contour turn/,CircleDot],
  [/drill|ream|tap|thread|counter.?sink|counter.?bore|deep hole|gun drill|spot drill|micro drill/,Drill],
  [/wire.?edm|sink.?edm|ram.?edm|spark erosion|edm drill|micro edm|electrical discharge/,Zap],
  [/laser|plasma|water.?jet|oxy.?fuel|shear|sawing|band.?saw|circular saw|blanking|slitting|profile cutting|flame cutting/,Scissors],
  [/tig|mig|mag|weld|braz|solder|spot join|resistance join|friction stir|ultrasonic join|seam weld|projection weld/,Anvil],
  [/forge|casting|foundry|mould|mold|die cast|investment cast|sand cast|centrifugal cast|gravity cast|shell mould/,Flame],
  [/cylindrical grind|surface grind|centerless|centreless|internal grind|creep feed|grind|polish|lapping|honing|superfinish|buffing/,Waves],
  [/heat.?treat|anneal|temper|quench|carbur|nitrid|induction harden|case harden|solution treat|age harden/,Flame],
  [/inspect|quality|cmm|measure|metrology|testing|ndt|nondestruct|ultrasonic test|mpi|dye penetrant|x.?ray|vision check|first article/,ScanLine],
  [/coat|paint|plating|anodiz|passivat|surface finish|powder coat|electroplate|galvaniz|black oxide|phosphat|electropolish/,Paintbrush],
  [/fabricat|assembly|fitment|sub.?assembly|riveting|staking|press.?fit|brazed assembly/,Factory],
  [/extrud|rolling|press|stamping|forming|deep draw|hydroform|roll form|swag|upset|coining|piercing|emboss/,Hammer],
  [/bend|fold|sheet metal|flange|hemming|panel forming|tube bend|press brake/,Layers],
  [/pack|dispatch|ship|transport|logistic|freight|courier|handover|pickup|delivery|shipment|forwarding/,Truck],
  [/clean|wash|degreas|ultrasonic clean|passivation clean|vapor blast|shot blast|sand blast/,Waves],
  [/deburr|chamfer|edge break|edge prep|scrape|hand finish/,Wrench],
  [/material|raw stock|inventory|incoming goods|goods receipt/,Boxes],
  [/electrical|wire harness|cable|crimp|connector|terminal assembly/,Cable],
  [/additive|3d print|sinter|sla|sls|slm|dmls|binder jet|fused filament|fused deposition/,Box],
  [/automation|robot|program|plc|robotic cell|fixture offset|tool path|post process/,Cpu],
  [/calibrat|gauge|setting master|height master|master ring|master plug/,Gauge],
  [/drain|fluid|hydraulic|pneumatic|pressure test|leak test|flow test/,Activity],
  [/protect|safety|compliance|certificate|traceability|material cert/,ShieldCheck],
  [/component|subassembly|part issue|kitting/,Package],
  [/tool|fixture|jig|workholding|clamp|collet|mandrel/,Wrench],
  [/surface|profile|roundness|flatness|concentricity|runout|roughness/,Ruler],
  [/balanc|vibration|dynamic test|spin test/,Activity],
  [/mark|engrave|laser etch|dot peen|serialise|serialization|label/,Zap],
  [/bond|adhesive|glue|laminat|potting|encapsulat/,Layers],
  [/vacuum|leak.?down|helium test|pressure vessel/,Gauge],
  [/thermal|temperature cycle|thermal shock|oven bake/,Flame],
  [/electro.?chemical|ecm|ecg|electro.?polish/,Zap],
  [/thread roll|thread form|knurl|broach|shave|shaper|planer/,Cog],
  [/gear hob|hobbing|gear shaping|gear grind|gear lap|spline roll/,Cog],
  [/tube|pipe|weld prep|bevel|orbital weld/,Cable],
  [/powder metallurgy|powder press|powder compact|metal injection/,Boxes],
  [/lamination|composite|carbon fibre|fiberglass|resin transfer/,Layers],
  [/water treat|chemical treat|etch|pickle|descale/,Waves],
  [/forklift|loading|unloading|material movement|warehouse|inbound|outbound/,Truck],
  [/documentation|review|approval|audit|control plan/,CheckCircle2],
  [/rework|repair|reclaim|recondition/,Wrench],
  [/packaging|pallet|strapping|crating|protective wrap/,Package],
  [/inspection report|fai|ppap|certificate of conformity/,CheckCircle2]
];
export default function ProcessVisualIcon({name,category="",size="md"}:Props){
 const text=(name+" "+category).toLowerCase();
 const Icon=rules.find(([pattern])=>pattern.test(text))?.[1]||Factory;
 return <span className={"process-visual-icon process-visual-icon-"+size} title={name+" · "+(category||"Process")} aria-label={name+" process icon"}><span className="process-visual-icon-face"><ProcessIcon processName={name} fallback={<Icon/>}/></span><span className="process-visual-icon-side"/></span>;
}
