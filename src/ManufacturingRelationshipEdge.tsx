import { BaseEdge, getBezierPath, getSmoothStepPath } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";

type RelationshipPathOptions =
  | { mode:"bezier"; curvature:number }
  | { mode:"smoothstep"; offset:number; borderRadius:number };

type ManufacturingRelationshipData = {
  relationshipType?:string;
  routeLayout?:string;
  layout?:string;
  parallelIndex?:number;
  pathOptions?:RelationshipPathOptions;
  flowMotion?:boolean;
};

type ManufacturingRelationshipEdgeModel = Edge<ManufacturingRelationshipData,"manufacturing">;

/** Shared manufacturing connector with per-edge Bezier or rounded orthogonal routing. */
export function ManufacturingRelationshipEdge(props:EdgeProps<ManufacturingRelationshipEdgeModel>) {
  const options=props.data?.pathOptions;
  const [path,labelX,labelY]=options?.mode==="smoothstep"
    ? getSmoothStepPath({
        sourceX:props.sourceX,
        sourceY:props.sourceY,
        sourcePosition:props.sourcePosition,
        targetX:props.targetX,
        targetY:props.targetY,
        targetPosition:props.targetPosition,
        offset:options.offset,
        borderRadius:options.borderRadius
      })
    : getBezierPath({
        sourceX:props.sourceX,
        sourceY:props.sourceY,
        sourcePosition:props.sourcePosition,
        targetX:props.targetX,
        targetY:props.targetY,
        targetPosition:props.targetPosition,
        curvature:options?.mode==="bezier"?options.curvature:.25
      });

  const pulseColour=typeof props.style?.stroke==="string"?props.style.stroke:"#24c8df";
  return <g>
    <BaseEdge
      id={props.id}
      path={path}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      style={props.style}
      interactionWidth={props.interactionWidth??22}
      label={props.label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={props.labelStyle}
      labelShowBg={props.labelShowBg}
      labelBgStyle={props.labelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
    />
    {props.data?.flowMotion&&<circle className="ax-manufacturing-edge-pulse" r="3.7" fill={pulseColour}>
      <animateMotion dur="2.2s" repeatCount="indefinite" path={path}/>
    </circle>}
  </g>;
}
