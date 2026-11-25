import type { ReactNode } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Edge, Node, NodeTypes } from "@xyflow/react";
import "@xyflow/react/style.css";

type GraphNode = Node<any,string>;
type Props = {
  nodes:GraphNode[];
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
  onNodesChange?:(changes:any[])=>void;
  onNodeDragStop?:(event:any,node:GraphNode)=>void;
  onNodeClick?:(event:any,node:GraphNode)=>void;
  onPaneClick?:()=>void;
  minimapNodeColor?:(node:GraphNode)=>string;
  children?:ReactNode;
  className?:string;
  style?:React.CSSProperties;
  testId?:string;
  ariaLabel?:string;
};

/** Shared React Flow canvas used by Route Flow, Process Map and Manufacturing Universe. */
export function ManufacturingGraphCanvas({
  nodes,edges,nodeTypes,fitView=true,fitViewOptions,minZoom=.14,maxZoom=2,
  nodesDraggable=false,nodesConnectable=false,elementsSelectable=false,nodesFocusable=true,edgesFocusable=false,
  panOnDrag=true,zoomOnScroll=false,zoomOnPinch=true,zoomOnDoubleClick=false,
  onNodesChange,onNodeDragStop,onNodeClick,onPaneClick,minimapNodeColor,children,className,style,testId,ariaLabel
}:Props) {
  return <ReactFlowProvider>
    <div className={className} style={style} data-testid={testId} aria-label={ariaLabel}>
      <ReactFlow<GraphNode,Edge>
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
        <MiniMap pannable zoomable nodeColor={(node:GraphNode)=>minimapNodeColor?.(node)||"#8fc4e5"}/>
        {children}
      </ReactFlow>
    </div>
  </ReactFlowProvider>;
}
