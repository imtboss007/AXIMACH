import type { CSSProperties, ReactNode } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Edge, Node, NodeMouseHandler, NodeTypes, NodeDragHandler, OnNodesChange } from "@xyflow/react";
import "@xyflow/react/style.css";

type Props<TNode extends Node = Node> = {
  nodes:TNode[];
  edges:Edge[];
  nodeTypes?:NodeTypes;
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
  onNodeDragStop?:NodeDragHandler<TNode>;
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
  nodes,edges,nodeTypes,fitView=true,fitViewOptions,minZoom=.14,maxZoom=2,
  nodesDraggable=false,nodesConnectable=false,elementsSelectable=false,nodesFocusable=true,edgesFocusable=false,
  panOnDrag=true,zoomOnScroll=false,zoomOnPinch=true,zoomOnDoubleClick=false,
  onNodesChange,onNodeDragStop,onNodeClick,onPaneClick,minimapNodeColor,children,className,style,testId,ariaLabel
}:Props<TNode>) {
  return <ReactFlowProvider>
    <div className={className} style={style} data-testid={testId} aria-label={ariaLabel}>
      <ReactFlow<TNode,Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        onNodesChange={onNodesChange}
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
