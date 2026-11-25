export function layoutManufacturingUniverseNodes(nodes:Array<{id:string;kind?:string}>, groupOrder:string[], options?:{nodeWidth?:number;nodeHeight?:number;columns?:number;innerColumns?:number;gapX?:number;gapY?:number;groupGapX?:number;groupGapY?:number}):Record<string,{x:number;y:number}>;
export function routeRelationshipHandles(type:string):[string,string];
export function manufacturingGraphEdgeKey(source:string,target:string,type:string):string;
