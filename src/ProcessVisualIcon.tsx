import { Activity, Anvil, Box, Boxes, Cable, CheckCircle2, CircleDot, Cog, Cpu, Drill, Factory, Flame, Gauge, Hammer, Layers, Package, Paintbrush, Ruler, ScanLine, Scissors, ShieldCheck, Truck, Waves, Wrench, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
type Props={name:string;category?:string;size?:"sm"|"md"|"lg"};
const rules:[RegExp,LucideIcon][]=[
[/mill|vmc|hmc|cnc|machin|milling/,Cog],[/turn|lathe|boring|facing/,CircleDot],[/drill|ream|tap|thread/,Drill],
[/wire.?edm|edm|spark erosion/,Zap],[/laser|plasma|water.?jet|cutting|shear/,Scissors],[/weld|braz|solder/,Anvil],
[/forge|casting|foundry|mould|mold/,Flame],[/grind|polish|lapping|honing/,Waves],[/heat.?treat|anneal|temper/,Flame],
[/inspect|quality|cmm|measure|metrology|testing/,ScanLine],[/coat|paint|plating|anodiz|surface finish/,Paintbrush],
[/fabricat|assembly|fitment/,Factory],[/extrud|rolling|press|stamping|forming/,Hammer],
[/bend|fold|sheet metal/,Layers],[/pack|dispatch|ship|transport|logistic|handover/,Truck],
[/clean|wash|degreas/,Waves],[/deburr|chamfer|edge/,Wrench],[/material|raw stock|inventory/,Boxes],
[/electrical|wire harness|cable/,Cable],[/additive|3d print|sinter/,Box],[/automation|robot|program/,Cpu],
[/calibrat|gauge/,Gauge],[/drain|fluid|hydraulic/,Activity],[/protect|safety|compliance/,ShieldCheck],
[/component|subassembly/,Package],[/tool|fixture|jig/,Wrench],[/surface|profile/,Ruler]
];
export default function ProcessVisualIcon({name,category="",size="md"}:Props){
 const text=(name+" "+category).toLowerCase();const Icon=rules.find(([pattern])=>pattern.test(text))?.[1]||Factory;
 return <span className={"process-visual-icon process-visual-icon-"+size} title={name+" · "+(category||"Process")} aria-label={name+" process icon"}><span className="process-visual-icon-face"><Icon/></span><span className="process-visual-icon-side"/></span>;
}
