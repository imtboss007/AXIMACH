export function layoutManufacturingUniverseNodes(nodes:Array<{id:string;kind?:string}>, groupOrder:string[], options?:{nodeWidth?:number;nodeHeight?:number;columns?:number;innerColumns?:number;gapX?:number;gapY?:number;groupGapX?:number;groupGapY?:number}):Record<string,{x:number;y:number}>;
type GraphPoint = {x:number;y:number};
export function routeRelationshipHandles(type:string, sourcePoint?:GraphPoint, targetPoint?:GraphPoint):[string,string];
export function routeRelationshipEdgeGeometry(type:string, sourcePoint:GraphPoint, targetPoint:GraphPoint, layout?:string, parallelIndex?:number):{sourceHandle:string;targetHandle:string;edgeType:"manufacturing";pathOptions:{mode:"bezier";curvature:number}|{mode:"smoothstep";offset:number;borderRadius:number}};
export function manufacturingGraphEdgeKey(source:string,target:string,type:string):string;
