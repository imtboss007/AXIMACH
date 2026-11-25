import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Connection, Edge, EdgeTypes, Node, NodeMouseHandler, NodeTypes, OnNodesChange } from "@xyflow/react";
import { ManufacturingRelationshipEdge } from "./ManufacturingRelationshipEdge";
import "@xyflow/react/style.css";

const DEFAULT_MANUFACTURING_EDGE_TYPES = {
  manufacturing:ManufacturingRelationshipEdge
} satisfies EdgeTypes;

type Props<TNode extends Node = Node> = {
  nodes:TNode[];
  edges:Edge[];
  nodeTypes?:NodeTypes;
  edgeTypes?:EdgeTypes;
  fitView?:boolean;
  fitViewOptions?:{padding?:number;minZoom?:number;maxZoom?:number;duration?:number};
  minZoom?:number;
  maxZoom?:number;
  nodesDraggable?:boolean;
  nodesConnectable?:boolean;
  elementsSelectable?:boolean;
  nodesFocusable?:boolean;
  edgesFocusable?:boolean;
  panOnDrag?:boolean;
  zoomOnScroll?:boolean;
  zoomOnPinch?:boolean;
  zoomOnDoubleClick?:boolean;
  onNodesChange?:OnNodesChange<TNode>;
  onConnect?:(connection:Connection)=>void;
  onNodeDragStop?:(event:any,node:TNode)=>void;
  onNodeClick?:NodeMouseHandler<TNode>;
  onPaneClick?:()=>void;
  minimapNodeColor?:(node:TNode)=>string;
  children?:ReactNode;
  className?:string;
  style?:CSSProperties;
  testId?:string;
  ariaLabel?:string;
};

/** Shared React Flow canvas used by Route Flow, Process Map and Manufacturing Universe. */
export function ManufacturingGraphCanvas<TNode extends Node = Node>({
  nodes,edges,nodeTypes,edgeTypes=DEFAULT_MANUFACTURING_EDGE_TYPES,fitView=true,fitViewOptions,minZoom=.14,maxZoom=2,
  nodesDraggable=false,nodesConnectable=false,elementsSelectable=false,nodesFocusable=true,edgesFocusable=false,
  panOnDrag=true,zoomOnScroll=false,zoomOnPinch=true,zoomOnDoubleClick=false,
  onNodesChange,onConnect,onNodeDragStop,onNodeClick,onPaneClick,minimapNodeColor,children,className,style,testId,ariaLabel
}:Props<TNode>) {
  const [canvasNodes,setCanvasNodes]=useState<TNode[]>(nodes);
  const positionOverrides=useRef(new Map<string,{x:number;y:number}>());
  useEffect(()=>{
    setCanvasNodes(nodes.map(node=>({...node,position:positionOverrides.current.get(node.id)||node.position}) as TNode));
  },[nodes]);
  const handleNodesChange:OnNodesChange<TNode>=(changes)=>{
    setCanvasNodes(current=>changes.applyTo(current) as TNode[]);
    changes.getByType("position").forEach(change=>{
      if(change.position&&change.dragging===false)
        positionOverrides.current.set(change.id,change.position);
    });
    onNodesChange?.(changes);
  };
  return <ReactFlowProvider>
    <div className={className} style={style} data-testid={testId} aria-label={ariaLabel}>
      <ReactFlow<TNode,Edge>
        nodes={canvasNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={fitView}
        fitViewOptions={fitViewOptions}
        minZoom={minZoom}
        maxZoom={maxZoom}
        nodesDraggable={nodesDraggable}
        nodesConnectable={nodesConnectable}
        elementsSelectable={elementsSelectable}
        nodesFocusable={nodesFocusable}
        edgesFocusable={edgesFocusable}
        panOnDrag={panOnDrag}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch={zoomOnPinch}
        zoomOnDoubleClick={zoomOnDoubleClick}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        proOptions={{hideAttribution:false}}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#b5c9da"/>
        <Controls showInteractive={false}/>
        <MiniMap pannable zoomable nodeColor={(node:TNode)=>minimapNodeColor?.(node)||"#8fc4e5"}/>
        {children}
      </ReactFlow>
    </div>
  </ReactFlowProvider>;
}
