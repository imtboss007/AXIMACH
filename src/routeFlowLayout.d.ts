export type RouteFlowLayoutName = "orthogonal"|"s-curve"|"horizontal"|"vertical"|"swimlane"|"timeline"|"radial"|"circular"|"organic";
export interface RouteFlowLayoutOperation {
  id:string;
  sequence?:number;
  branch?:string;
  relationType?:string;
  parentId?:string;
  plannedStart?:string;
  actualStart?:string;
  deletedAt?:string;
}
export interface RouteFlowPoint { x:number; y:number }
export function buildRouteFlowOperationPositions(
  operations:RouteFlowLayoutOperation[],
  layout?:RouteFlowLayoutName,
  compact?:boolean
):Record<string,RouteFlowPoint>;
