import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type CSSProperties } from "react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, ArrowRight, Bike, Boxes, Bus, CarFront, ClipboardCheck, Cog, Cpu, Disc3, GitBranch, Plane, Scissors, Ship, TrainFront, Zap, Truck, Workflow, Wrench } from "lucide-react";
import type { OperationRecord, RouteRelationshipRecord } from "./manufacturingData";
import { ProcessIcon } from "./IconStudio";
import ProcessUniverseWebGLCore from "./ProcessUniverseWebGLCore";
import ProcessScene3D from "./ProcessScene3D";
import ImmersiveWorkspaceControls from "./ImmersiveWorkspaceControls";
import { RouteLayoutPicker, RouteConnectorLegend, useRouteLayout, type RouteLayoutMode } from "./RouteLayoutPicker";

type ProcessDefinitionNode = { id: string; processType: string; category: string; subcategories?: string[]; subcategoryIds?: string[]; vendorIds?: string[]; displayColor?: string };
type MaterialRouteNode = {
  id:string; poLineId?:string; partLabel:string; partNumber?:string; partName?:string; materialLabel:string; dimensionsLabel?:string; companyLabel?:string; poLabel?:string; componentLabel?:string; densityKgM3?:number; anchorOperationId?:string; anchorOperationName?:string; quantity:number; weightKg:number;
  supplier:string; transporter:string; from:string; to:string; vehicle:string;
  materialGivenAt:string; materialDueAt:string; materialReceivedAt:string;
  pickupAt:string; deliveryAt:string; status:string; materialRate:number; priceUnit:"kg"|"lb";
  materialCost:number; cuttingType:string; cuttingBasis:string; cuttingRate:number; cuttingCost:number; transportCost:number;
};
type TransportLegRouteNode = { id:string; poLineId:string; anchorOperationId:string; targetOperationId?:string; materialEntryId?:string; placement:"start"|"before"|"after"; fromLocation:string; toLocation:string; vehicleType:string; vendorName:string; vendorContact?:string; vendorRole?:string; vendorPhone?:string; vendorWhatsapp?:string; vendorEmail?:string; vendorAddress?:string; vendorStatus?:string; vendorNotes?:string; directoryRouteNotes?:string; directoryRouteActive?:boolean; tripDirection:"One-way"|"Two-way"; tripCount:number; amount:number; pickupAt:string; deliveryAt:string; status:string; relation:"main"|"alternate"|"rework" };
type Props = { operations: OperationRecord[]; allOperations?: OperationRecord[]; routeLabels?: Record<string,string>; materialRoutes?: MaterialRouteNode[]; transportLegs?: TransportLegRouteNode[]; routeRelationships?: RouteRelationshipRecord[]; onSelectTransportLeg?: (id:string,anchor?:{x:number;y:number})=>void; onSelectMaterialTransport?: (id:string,anchor?:{x:number;y:number})=>void; processDefinitions?: ProcessDefinitionNode[]; vendors?: Array<{ id: string; company: string }>; visibleFields?: string[]; showArrows?: boolean; quantityUnit?: string; operationTransportAmounts?: Record<string, number>; selectedOperationId: string; simulationIndex: number; zoom: number; initialLayout?: ProcessLayoutMode; ganttScale?: "day"|"week"|"month"; onGanttScaleChange?: (scale:"day"|"week"|"month")=>void; onZoomChange?: (zoom:number)=>void; onSelectOperation: (id: string) => void; onEditOperation?: (id: string) => void; onChangeProcessColor?: (id: string, color: string) => void; onAddSubprocess?: (parentId: string) => void; onAddAlternateRoute?: (parentId: string) => void; onAddReworkRoute?: (parentId: string) => void; onAddProcessDefinition?: (definitionId: string) => void; onNotice?: (message:string)=>void };
function materialVehicleClassFor(value:string){const type=(value||"").toLowerCase();if(/bike|motorcycle|scooter|two.wheeler/.test(type))return "bike";if(/bus/.test(type))return "bus";if(/car|taxi|auto|three.wheeler/.test(type))return "car";if(/air|plane|flight/.test(type))return "air";if(/ship|boat|vessel/.test(type))return "ship";if(/train|rail/.test(type))return "rail";return "truck";}
function materialVehicleIconFor(value:string){const type=(value||"").toLowerCase();if(/bike|motorcycle|scooter|two.wheeler/.test(type))return Bike;if(/bus/.test(type))return Bus;if(/car|taxi|auto|three.wheeler/.test(type))return CarFront;if(/air|plane|flight/.test(type))return Plane;if(/ship|boat|vessel/.test(type))return Ship;if(/train|rail/.test(type))return TrainFront;return Truck;}
function MaterialRouteTransportMarker({route,onSelect}:{route:MaterialRouteNode;onSelect?:Props["onSelectMaterialTransport"]}){
 const VehicleIcon=materialVehicleIconFor(route.vehicle);
 return <button type="button" className={"ax-transport-icon-trigger process-orbit-material-transport vehicle-"+materialVehicleClassFor(route.vehicle)} aria-label={"Open "+(route.vehicle||"vehicle")+" transport record"} title={(route.vehicle||"Vehicle")+" · "+route.from+" → "+route.to} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onSelect?.(route.id,{x:rect.left,y:rect.top});}}><VehicleIcon size={19}/></button>;
}


function fallbackFor(name: string) {
  const value = name.toLowerCase();
  if (/transport|dispatch|ship|logistic|delivery/.test(value)) return <Truck size={20} />;
  if (/inspect|quality|measure|test|cmm/.test(value)) return <ClipboardCheck size={20} />;
  if (/cnc|vmc|hmc|machining centre|machining center/.test(value)) return <Cpu size={20} />;
  if (/turn|lathe|shaft/.test(value)) return <Disc3 size={20} />;
  if (/mill|drill|boring|tapping/.test(value)) return <Cog size={20} />;
  if (/wire edm|edm|spark erosion|laser/.test(value)) return <Zap size={20} />;
  if (/weld|fabricat|cutting|shear/.test(value)) return <Scissors size={20} />;
  if (/grind|honing|lapping|polish/.test(value)) return <Wrench size={20} />;
  if (/material|stock|store|warehouse/.test(value)) return <Boxes size={20} />;
  if (/production|assembly|pack/.test(value)) return <Activity size={20} />;
  return <Workflow size={20} />;
}

type ProcessLayoutMode = "sphere" | "cube" | "vortex" | "helix" | "orbit" | "network" | "grid" | "pipeline" | "layered" | "stacked" | "matrix" | "tree" | "route" | "molecular" | "digital-mesh" | "linear" | "horizontal" | "vertical" | "timeline" | "orthogonal" | "s-curve" | "swimlane" | "radial" | "circular" | "organic" | "gantt" | "nodes" | "branch" | "combined";
type Point3D = { x: number; y: number; z: number };
const routeGroupKey = (operation:OperationRecord) => (operation.poLineId || operation.componentId) + "::" + (operation.branch || "Main route");

function getLayoutPoint(index: number, operation: OperationRecord | undefined, mode: ProcessLayoutMode, count: number, source: OperationRecord[]): Point3D {
  const total = Math.max(1, count);
  const routeKey = (item:OperationRecord) => (item.poLineId || item.componentId) + "::" + (item.branch || "Main route");
  const branchNames = [...new Set(source.map(routeKey))];
  const branchName = operation ? routeKey(operation) : "Main route";
  const branchIndex = Math.max(0, branchNames.indexOf(branchName));
  const branchCount = Math.max(1, branchNames.length);
  const branchRows = source.filter(item => routeKey(item) === branchName).slice().sort((a,b) => a.sequence-b.sequence);
  const localIndex = operation ? Math.max(0, branchRows.findIndex(item => item.id === operation.id)) : index;
  const localCount = Math.max(1, branchRows.length || total);
  const center = (index - (total - 1) / 2);
  const branchOffset = branchIndex - (branchCount - 1) / 2;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const unitY = 1 - 2 * ((index + 0.5) / total);
  const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY));
  const angle = index * golden;
  const sphere: Point3D = { x: Math.cos(angle) * ringRadius * 188, y: -unitY * 188, z: Math.sin(angle) * ringRadius * 188 };
  if (mode === "vortex") {
    const spin = index * 0.92;
    const radius = 108 + (index % 4) * 17;
    return { x: Math.cos(spin) * radius, y: center * 34, z: Math.sin(spin) * radius };
  }
  if (mode === "helix") {
    const turn = index * 1.08;
    const radius = 78 + (index % 3) * 13;
    return { x: Math.cos(turn) * radius, y: (0.5 - (index + 0.5) / total) * 300, z: Math.sin(turn) * radius };
  }
  if (mode === "stacked") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(localCount)));
    const row = Math.floor(localIndex / columns), column = localIndex % columns;
    const layer = branchIndex;
    return { x: (column - (columns - 1) / 2) * 104, y: ((Math.ceil(localCount / columns) - 1) / 2 - row) * 82, z: (layer - (branchCount - 1) / 2) * 112 };
  }  if (mode === "layered") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(localCount)));
    const rows = Math.ceil(localCount / columns);
    const row = Math.floor(localIndex / columns), column = localIndex % columns;
    return { x: (column - (columns - 1) / 2) * 92, y: ((rows - 1) / 2 - row) * 76, z: (branchIndex - (branchCount - 1) / 2) * 118 + (row % 2 ? 26 : -26) };
  }
  if (mode === "matrix") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(total)));
    const rows = Math.ceil(total / columns), row = Math.floor(index / columns), column = index % columns;
    return { x: (column - (columns - 1) / 2) * 88, y: ((rows - 1) / 2 - row) * 78, z: branchOffset * 82 + (index % 3 - 1) * 18 };
  }
  if (mode === "circular") {
    const angle = (localIndex / localCount) * Math.PI * 2;
    const radius = Math.max(105, localCount * 20);
    return { x: Math.cos(angle) * radius, y: branchOffset * 76 + Math.sin(localIndex * 0.5) * 12, z: Math.sin(angle) * radius };
  }
  if (mode === "radial") {
    const ring = Math.floor(Math.sqrt(localIndex));
    const first = ring * ring;
    const slots = Math.max(1, 2 * ring + 1);
    const angle = ((localIndex - first) / slots) * Math.PI * 2;
    const radius = 76 + ring * 92;
    return { x: Math.cos(angle) * radius, y: branchOffset * 82 - ring * 26, z: Math.sin(angle) * radius };
  }
  if (mode === "organic") {
    const angle = localIndex * golden;
    const radius = 72 + Math.sqrt(localIndex + 1) * 48;
    return { x: Math.cos(angle) * radius + branchOffset * 26, y: branchOffset * 62 + Math.sin(localIndex * 1.31) * 48, z: Math.sin(angle) * radius };
  }
  if (mode === "orthogonal" || mode === "s-curve") {
    const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(localCount))));
    const rows = Math.ceil(localCount / columns);
    const row = Math.floor(localIndex / columns);
    const slot = localIndex % columns;
    const column = mode === "s-curve" && row % 2 === 1 ? columns - 1 - slot : slot;
    return { x: (column - (columns - 1) / 2) * 126, y: ((rows - 1) / 2 - row) * 104 + branchOffset * 42, z: branchOffset * 70 };
  }
  if (mode === "swimlane") {
    return { x: (localIndex - (localCount - 1) / 2) * 112, y: branchOffset * 122, z: branchOffset * 72 + Math.sin(localIndex * 0.45) * 14 };
  }
  if (mode === "tree") {
    const level = Math.floor(Math.log2(index + 1));
    const firstAtLevel = Math.pow(2, level) - 1;
    const slot = index - firstAtLevel, slots = Math.pow(2, level);
    return { x: ((slot + 0.5) / slots * 2 - 1) * Math.min(260, 104 + slots * 44), y: 150 - level * 104, z: branchOffset * 62 + (slot % 2 ? 26 : -26) };
  }
  if (mode === "pipeline" || mode === "linear" || mode === "route") {
    const lane = Math.floor(localIndex / 5);
    return { x: (localIndex % 5 - 2) * 112 + (lane % 2 ? 48 : -48), y: (1 - lane) * 105 + branchOffset * 38, z: (lane % 2 ? 1 : -1) * 52 };
  }
  if (mode === "cube") {
    const side = Math.ceil(Math.cbrt(total));
    const x = index % side, y = Math.floor(index / side) % side, z = Math.floor(index / (side * side));
    const half = (side - 1) / 2;
    return { x: (x-half)*112, y: (half-y)*112, z: (z-half)*112 };
  }
  if (mode === "digital-mesh" || mode === "grid") {
    // Ordered serpentine lattice: each successive operation sits beside the
    // previous one, so the 3D arrows read as a route rather than crossing chords.
    const columns = Math.max(2, Math.ceil(Math.sqrt(total)));
    const row = Math.floor(index / columns);
    const slot = index % columns;
    const column = row % 2 === 0 ? slot : columns - 1 - slot;
    const rows = Math.ceil(total / columns);
    return { x: (column - (columns - 1) / 2) * 92, y: ((rows - 1) / 2 - row) * 78, z: branchOffset * 76 + Math.sin(index * 0.42) * 12 };
  }
  if (mode === "nodes") {
    // A readable 3D hierarchy: route steps occupy staggered depth planes.
    const columns = Math.max(2, Math.ceil(Math.sqrt(localCount)));
    const row = Math.floor(localIndex / columns);
    const column = localIndex % columns;
    return { x: (column - (columns - 1) / 2) * 112, y: branchOffset * 104 + ((Math.ceil(localCount / columns) - 1) / 2 - row) * 94, z: (row % 2 ? 1 : -1) * 58 + branchOffset * 36 };
  }
  if (mode === "molecular" || mode === "network") {
    // Molecular clusters: each branch is a nucleus with linked process satellites.
    const clusterAngle = branchIndex * (Math.PI * 2 / branchCount);
    const satelliteAngle = localIndex * golden;
    const radius = 82 + (localIndex % 3) * 28;
    return { x: Math.cos(clusterAngle) * 72 + Math.cos(satelliteAngle) * radius, y: branchOffset * 54 + Math.sin(localIndex * 0.9) * 54, z: Math.sin(clusterAngle) * 72 + Math.sin(satelliteAngle) * radius };
  }
  if (mode === "orbit" || mode === "horizontal" || mode === "vertical") {
    if (mode === "horizontal") return { x: center * 116, y: branchOffset * 104 + Math.sin(index*0.7)*18, z: branchOffset * 58 + Math.cos(index*0.8)*34 };
    if (mode === "vertical") return { x: Math.cos(index*golden)*74, y: -center*112, z: Math.sin(index*golden)*74 };
    const orbitRing = Math.floor(Math.sqrt(index));
    const orbitPosition = index - orbitRing * orbitRing;
    const orbitCount = Math.max(1, 2 * orbitRing + 1);
    const orbitAngle = orbitPosition / orbitCount * Math.PI * 2;
    const orbitRadius = 72 + orbitRing * 58;
    return { x: Math.cos(orbitAngle) * orbitRadius, y: branchOffset * 54 + (orbitRing % 2 ? 42 : -42), z: Math.sin(orbitAngle) * orbitRadius };
  }
  if (mode === "timeline" || mode === "gantt") {
    const dates = source.map(item => Date.parse(item.plannedStart || item.actualStart || "")).filter(Number.isFinite);
    const minimum = dates.length ? Math.min(...dates) : 0;
    const maximum = dates.length ? Math.max(...dates) : 0;
    const timestamp = operation ? Date.parse(operation.plannedStart || operation.actualStart || "") : Number.NaN;
    const ratio = Number.isFinite(timestamp) && maximum > minimum ? (timestamp-minimum)/(maximum-minimum) : (index+0.5)/total;
    const span = mode === "gantt" ? 215 : 190;
    return { x: (ratio-0.5)*span*2, y: branchOffset*106 + (mode === "timeline" ? Math.sin(index*0.76)*22 : 0), z: branchOffset*82 + Math.cos(index*0.55)*28 };
  }
  if (mode === "branch") return { x: (localIndex-(localCount-1)/2)*102, y: branchOffset*74 + Math.sin(localIndex*0.7)*20, z: branchOffset*112 + Math.cos(localIndex*0.6)*26 };
  if (mode === "combined") {
    const spiral = index*0.82;
    const radius = 112 + (index%5)*19;
    return { x: Math.cos(spiral)*radius, y: sphere.y*0.56, z: Math.sin(spiral)*radius };
  }
  return sphere;
}

function transformStyle3d(point: Point3D) {
  const radius = Math.max(1, Math.hypot(point.x, point.y, point.z));
  const yaw = Math.atan2(point.x, point.z) * 180 / Math.PI;
  const pitch = -Math.asin(Math.max(-1, Math.min(1, point.y / radius))) * 180 / Math.PI;
  return `translate(-50%,-50%) translate3d(${point.x}px,${point.y}px,${point.z}px) rotateY(${yaw}deg) rotateX(${pitch}deg)`;
}

export default function ProcessUniverse3D({ operations, allOperations, routeLabels = {}, materialRoutes = [], transportLegs = [], routeRelationships = [], onSelectTransportLeg, onSelectMaterialTransport, processDefinitions = [], vendors = [], visibleFields = [], showArrows = true, quantityUnit = "pieces", operationTransportAmounts = {}, selectedOperationId, simulationIndex, zoom, initialLayout = "sphere", ganttScale = "week", onGanttScaleChange, onZoomChange, onSelectOperation, onEditOperation, onChangeProcessColor, onAddSubprocess, onAddAlternateRoute, onAddReworkRoute, onAddProcessDefinition, onNotice=()=>{} }: Props) {
  const [expandedOperationId, setExpandedOperationId] = useState("");
  const expandedDetailsRef = useRef<HTMLElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const [collapsedLaneNames, setCollapsedLaneNames] = useState<string[]>([]);
  // Export checkboxes must not hide fields from a selected operation's detail record.
  const fieldVisible = (field: string) => visibleFields.includes(field);
  const dateLabel = (value?: string) => { if (!value) return "Not scheduled"; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(value.includes("T") ? { hour: "2-digit", minute: "2-digit" } : {}) }) : value; };
  const moneyLabel = (value: number) => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const parentOperations = useMemo(() => operations.filter(operation => operation.relationType !== "subprocess"), [operations]);
  const displayOperations = parentOperations.length ? parentOperations : operations;
  const lookupOperations = allOperations || operations;
  const subprocessesFor = (parentId: string) => lookupOperations.filter(operation => operation.relationType === "subprocess" && operation.parentId === parentId);
  const branchesFor = (parentId: string) => lookupOperations.filter(operation => (operation.relationType === "alternate" || operation.relationType === "rework") && operation.parentId === parentId);
  const expandedOrbitOperation = lookupOperations.find(operation => operation.id === expandedOperationId) || displayOperations.find(operation => operation.id === expandedOperationId);
  const expandedOrbitSubprocesses = expandedOrbitOperation ? subprocessesFor(expandedOrbitOperation.id) : [];
  const expandedOrbitBranches = expandedOrbitOperation ? branchesFor(expandedOrbitOperation.id) : [];
  useEffect(() => {
    if (!expandedOperationId) return;
    const frame = window.requestAnimationFrame(() => expandedDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [expandedOperationId]);
  const [layoutMode, setLayoutMode] = useState<ProcessLayoutMode>(initialLayout);
  const [routeLayout,setRouteLayout]=useRouteLayout();
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => setLayoutMode(initialLayout), [initialLayout]);
  useEffect(() => setLayoutMode(routeLayout as ProcessLayoutMode), [routeLayout]);
  const rotateX = useMotionValue(-12);
  const rotateY = useMotionValue(18);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    rotateY.set(drag.current.ry + (event.clientX - drag.current.x) * 0.62);
    rotateX.set(Math.max(-55, Math.min(55, drag.current.rx - (event.clientY - drag.current.y) * 0.52)));
  };
  const endDrag = () => { drag.current = null; };
  useEffect(() => {
    if (!autoRotateEnabled || prefersReducedMotion) return;
    let frame = 0;
    let previousTime = 0;
    const tick = (time: number) => {
      if (previousTime > 0 && !drag.current) rotateY.set(rotateY.get() + Math.min(50, time - previousTime) * 0.0065);
      previousTime = time;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [autoRotateEnabled, prefersReducedMotion, rotateY]);

  // Coordinate all saved route nodes against the full PO-line route. A scoped
  // view therefore keeps stable globe positions and can still draw an origin
  // connection to a parent that is not part of the selected route scope.
  const coordinateOperations = useMemo(() => {
    const source = lookupOperations.length ? lookupOperations : displayOperations;
    return source.filter(operation => operation.relationType !== "subprocess").slice().sort((a,b) => a.sequence-b.sequence);
  }, [lookupOperations, displayOperations]);
  const orbitPointFor = (operation: OperationRecord) => {
    const index = coordinateOperations.findIndex(item => item.id === operation.id);
    if (index < 0) return { x: 0, y: 0, z: 0 };
    return getLayoutPoint(index, operation, layoutMode, coordinateOperations.length, coordinateOperations);
  };
  const orbitNodes = useMemo(() => displayOperations.map((operation, index) => {
    const globalIndex = coordinateOperations.findIndex(item => item.id === operation.id);
    const point = getLayoutPoint(globalIndex < 0 ? index : globalIndex, operation, layoutMode, coordinateOperations.length, coordinateOperations);
    return { operation, index, transform: transformStyle3d(point), point };
  }), [displayOperations, coordinateOperations, layoutMode]);

  // When a PO line has no saved operations yet, put the real Process Directory
  // definitions onto the interactive 3D orbit. These are catalogue actions,
  // not fabricated production operations; selecting one opens the PO-line
  // operation editor and only Save creates a production record.
  const catalogueOrbitNodes = useMemo(() => processDefinitions.map((definition, index) => {
    const count = Math.max(processDefinitions.length, 1);
    const point = getLayoutPoint(index, undefined, layoutMode, count, coordinateOperations);
    const transform = transformStyle3d(point);
    return { definition, index, transform };
  }), [processDefinitions, layoutMode, coordinateOperations]);
  const showCatalogueOrbit = operations.length === 0 && catalogueOrbitNodes.length > 0;
  const orbitCount = displayOperations.length || (showCatalogueOrbit ? catalogueOrbitNodes.length : 0);

  const lanes = useMemo(() => {
    const grouped = new Map<string, OperationRecord[]>();
    for (const operation of parentOperations) {
      const key = routeGroupKey(operation);
      const rows = grouped.get(key) || [];
      rows.push(operation);
      grouped.set(key, rows);
    }
    return [...grouped.entries()].map(([key, rows]) => {
      const ordered = rows.slice().sort((a,b) => a.sequence-b.sequence);
      const name = ordered[0]?.branch || "Main route";
      const poLineId = ordered[0]?.poLineId || "";
      let branchRoot: OperationRecord | undefined;
      let parent: OperationRecord | undefined;
      if (name !== "Main route") {
        for (const candidate of ordered) {
          if (candidate.relationType !== "alternate" && candidate.relationType !== "rework") continue;
          let current = candidate;
          let ancestor = lookupOperations.find(item => item.id === current.parentId);
          let guard = 0;
          while (ancestor && routeGroupKey(ancestor) === key && ancestor.parentId && guard++ < lookupOperations.length) {
            current = ancestor;
            ancestor = lookupOperations.find(item => item.id === current.parentId);
          }
          if (ancestor && routeGroupKey(ancestor) !== key) { branchRoot = current; parent = ancestor; break; }
        }
      }
      const label = routeLabels[poLineId] ? routeLabels[poLineId] + " · " + name : name;
      return { key, poLineId, name, label, rows: ordered, alternate: name !== "Main route", branchRoot, parent, branchRelation: branchRoot?.relationType };
    });
  }, [parentOperations, lookupOperations, routeLabels]);
  const orbitConnections = useMemo(() => {
    const visibleIds = new Set(displayOperations.map(operation => operation.id));
    const edges: Array<{id:string;from:OperationRecord;to:OperationRecord;relation:string;color:string}> = [];
    const byBranch = new Map<string, OperationRecord[]>();
    for (const operation of coordinateOperations) {
      const groupKey = routeGroupKey(operation);
      const rows = byBranch.get(groupKey) || [];
      rows.push(operation);
      byBranch.set(groupKey, rows);
    }
    const accentFor = (operation:OperationRecord) => processDefinitions.find(definition=>definition.id===operation.processDefinitionId)?.displayColor || operation.processColor || "#6fa9e5";
    for (const [groupKey, rows] of byBranch) {
      const ordered = rows.slice().sort((a,b)=>a.sequence-b.sequence);
      const lane = lanes.find(item=>item.key===groupKey);
      const branch = ordered[0]?.branch || "Main route";
      const relation = branch==="Main route" ? "main" : lane?.branchRelation==="rework" ? "rework" : "alternate";
      const color = relation==="rework" ? "#e38b45" : relation==="alternate" ? "#4b95eb" : undefined;
      for (let index=0; index<ordered.length-1; index++) {
        const from=ordered[index], to=ordered[index+1];
        if (!visibleIds.has(from.id) && !visibleIds.has(to.id)) continue;
        edges.push({id:from.id+"->"+to.id,from,to,relation,color:color||accentFor(to)});
      }
      if (branch!=="Main route" && lane?.branchRoot && lane.parent && displayOperations.some(operation=>routeGroupKey(operation)===groupKey)) {
        const from=lane.parent, to=lane.branchRoot;
        edges.push({id:from.id+"->"+to.id,from,to,relation:relation==="rework"?"rework":"alternate",color:relation==="rework"?"#e38b45":"#4b95eb"});
      }
    }
    const relationshipColors:Record<string,string>={main:"#12c7df",alternate:"#f1a42b",rework:"#ef4c50",dependency:"#2f7cff",parallel:"#9b48e9",merge:"#b24be7",split:"#3c7ee8","follow-on":"#163b68",feedback:"#3866ea",conditional:"#a45be8",successor:"#132d52"};
    for(const link of routeRelationships){
      if(link.deletedAt||link.status==="Disabled")continue;
      const from=lookupOperations.find(operation=>operation.id===link.fromOperationId);
      const to=lookupOperations.find(operation=>operation.id===link.toOperationId);
      if(!from||!to)continue;
      if((from.poLineId||from.componentId)!==(to.poLineId||to.componentId))continue;
      if(!visibleIds.has(from.id)&&!visibleIds.has(to.id))continue;
      edges.push({id:"relationship-"+link.id,from,to,relation:link.relationshipType,color:relationshipColors[link.relationshipType]||"#4b95eb"});
    }
    const anchors = new Map<string,{operation:OperationRecord;relation:string;color:string}>();
    for (const edge of edges) {
      if (!visibleIds.has(edge.from.id)) anchors.set(edge.from.id,{operation:edge.from,relation:edge.relation,color:edge.color});
      if (!visibleIds.has(edge.to.id)) anchors.set(edge.to.id,{operation:edge.to,relation:edge.relation,color:edge.color});
    }
    return { edges, anchors:[...anchors.values()] };
  }, [coordinateOperations, displayOperations, lanes, processDefinitions, routeRelationships, layoutMode]);
  const pinchStart=useRef<{distance:number;zoom:number}|null>(null);
  const touchDistance=(touches:ReactTouchEvent<HTMLElement>["touches"])=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  const onPinchStart=(event:ReactTouchEvent<HTMLElement>)=>{if(event.touches.length===2)pinchStart.current={distance:Math.max(1,touchDistance(event.touches)),zoom};};
  const onPinchMove=(event:ReactTouchEvent<HTMLElement>)=>{if(event.touches.length===2&&pinchStart.current){event.preventDefault();const ratio=touchDistance(event.touches)/pinchStart.current.distance;onZoomChange?.(Math.max(.55,Math.min(2.6,pinchStart.current.zoom*ratio)));}};
  const onPinchEnd=(event:ReactTouchEvent<HTMLElement>)=>{if(event.touches.length<2)pinchStart.current=null;};
  const stageStyle: CSSProperties = { transform: `scale(${zoom}) rotateX(2deg)`, transformOrigin: "top left", width: `${100 / zoom}%` };

  return <section className={"process-universe-3d mode-" + layoutMode} aria-label="Interactive 3D process route graph" onTouchStart={onPinchStart} onTouchMove={onPinchMove} onTouchEnd={onPinchEnd} onTouchCancel={onPinchEnd}>
    <header className="process-universe-head">
      <div><span className="process-universe-kicker"><span /> LIVE ROUTE / INTERACTIVE 3D</span><h3>Manufacturing process universe</h3><p>Drag the process sphere to rotate it. Select any saved process icon to open its real operation record; simulation highlights each step in sequence.</p></div>
      <div className="process-universe-count"><strong>{orbitCount}</strong><span>{displayOperations.length ? "SAVED PROCESS STEPS" : "AVAILABLE STAGES"}</span><button type="button" className="process-orbit-auto-toggle" aria-pressed={autoRotateEnabled} disabled={!!prefersReducedMotion} onClick={() => setAutoRotateEnabled(value => !value)}>{prefersReducedMotion ? "Reduced motion" : autoRotateEnabled ? "Pause rotation" : "Resume rotation"}</button></div>
    </header>
    <nav className="process-universe-layouts" aria-label="Process map visualisation modes"><RouteLayoutPicker value={routeLayout} onChange={setRouteLayout}/>
      {([{id:"sphere",label:"Sphere View",glyph:"◎"},{id:"cube",label:"Cube View",glyph:"⬡"},{id:"vortex",label:"Vortex View",glyph:"◉"},{id:"helix",label:"Helix View",glyph:"⌁"},{id:"orbit",label:"Orbit View",glyph:"⊙"},{id:"network",label:"Network View",glyph:"✣"},{id:"grid",label:"Grid View",glyph:"▦"},{id:"pipeline",label:"Pipeline View",glyph:"⇢"},{id:"layered",label:"Layered View",glyph:"▱"},{id:"stacked",label:"Stacked View",glyph:"▤"},{id:"matrix",label:"Matrix View",glyph:"▦"},{id:"tree",label:"Tree View",glyph:"♧"}, {id:"radial",label:"Radial View",glyph:"◎"}, {id:"circular",label:"Circular View",glyph:"◌"}, {id:"organic",label:"Organic View",glyph:"✣"}] as const).map(option=><button type="button" key={option.id} className={layoutMode===option.id?"active":""} aria-pressed={layoutMode===option.id} onClick={()=>{setLayoutMode(option.id);if((["orthogonal","s-curve","horizontal","vertical","swimlane","timeline","radial","circular","organic"] as string[]).includes(option.id))setRouteLayout(option.id as RouteLayoutMode);}}><span aria-hidden="true">{option.glyph}</span>{option.label}</button>)}
    </nav>
    <RouteConnectorLegend compact/>
    <div className="process-orbit-panel">
      <div className="process-orbit-meta"><span><i /> LIVE PO-LINE ROUTE</span><span>TRUE 3D GEOMETRY · TOUCH / MOUSE DRAG · AUTO-ROTATE</span></div>
      {materialRoutes.length>0 && <section className="process-orbit-material-routes" aria-label="Material procurement and inbound transport routes">
        <div className="process-orbit-material-routes-head"><strong>MATERIAL PROCUREMENT &amp; INBOUND TRANSPORT</strong><span>{materialRoutes.length} saved material movement(s) · material, cutting and transport costs separate</span></div>
        {materialRoutes.map(route=><article className="process-orbit-material-route" key={route.id}>
          <div className="process-orbit-material-ident"><small>{route.partLabel}</small><strong>{route.materialLabel}</strong><small>{route.dimensionsLabel||"Shape / dimensions not entered"}</small><small>{route.anchorOperationId?"PROCUREMENT AFTER · "+(route.anchorOperationName||"Selected process"):"PROCUREMENT · ROUTE START"}</small><span>Qty {route.quantity.toLocaleString("en-IN")} · {route.weightKg.toFixed(3)} kg · ₹{route.materialRate.toLocaleString("en-IN",{maximumFractionDigits:2})}/{route.priceUnit}</span></div>
          <div className="process-orbit-material-flow">
            <span><small>SUPPLIER</small><strong>{route.supplier}</strong><em>{route.from}</em></span><b aria-hidden="true">→</b>
            <span className="process-orbit-material-transport-slot"><MaterialRouteTransportMarker route={route} onSelect={onSelectMaterialTransport}/></span><b aria-hidden="true">→</b>
            <span><small>DELIVERY</small><strong>{route.to}</strong><em>{route.status}</em></span>
          </div>
          <div className="process-orbit-material-dates"><span>Given: {route.materialGivenAt||"—"}</span><span>Due: {route.materialDueAt||"—"}</span><span>Received: {route.materialReceivedAt||"—"}</span><span>Pickup: {route.pickupAt||"—"}</span><span>Transport delivery: {route.deliveryAt||"—"}</span><span>Material rate: ₹{route.materialRate.toLocaleString("en-IN",{maximumFractionDigits:2})} / {route.priceUnit}</span><span>Cutting: {route.cuttingType||"No cutting"} · ₹{route.cuttingRate.toLocaleString("en-IN",{maximumFractionDigits:2})} / {route.cuttingBasis||"—"}</span><strong>Material ₹{route.materialCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong><strong>Cutting ₹{route.cuttingCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong><strong>Transport ₹{route.transportCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div>
        </article>)}
      </section>}
      {layoutMode === "gantt" && <div className="process-gantt-toolbar process-gantt-3d-toolbar"><label>Time scale<select value={ganttScale} onChange={event => onGanttScaleChange?.(event.target.value as "day"|"week"|"month")}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label><span>3D SCHEDULE · {displayOperations.length} PROCESS STEPS · DRAG TO ROTATE</span></div>}
      {/* Branch-aware route connectors: orbitConnections.edges.map is rendered by the WebGL scene in shared camera space. */}
      <div ref={mapViewportRef} className="ax-map-fullscreen-shell ax-process-map-fullscreen"><ImmersiveWorkspaceControls targetRef={mapViewportRef} onNotice={onNotice}/>
      <div className="ax-map-zoom-toolbar" role="group" aria-label="Process map zoom controls">
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>onZoomChange?.(Math.max(.55,Number((zoom-.1).toFixed(2))))}>−</button>
        <output aria-live="polite">{Math.round(zoom*100)}%</output>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>onZoomChange?.(Math.min(2.6,Number((zoom+.1).toFixed(2))))}>+</button>
        <button type="button" className="ax-map-zoom-fit" onClick={()=>onZoomChange?.(.78)} title="Fit all process nodes">Fit</button>
      </div><div className="process-scene-zoom-viewport"><div className="process-scene-zoom-layer" style={{transform:`scale(${zoom})`,transformOrigin:"top center",width:`${100/zoom}%`}}><ProcessScene3D operations={displayOperations} materialRoutes={materialRoutes} transportLegs={transportLegs} onSelectTransportLeg={onSelectTransportLeg} onSelectMaterialTransport={onSelectMaterialTransport} visibleFields={visibleFields} autoRotate={autoRotateEnabled && !prefersReducedMotion} mode={layoutMode} simulationIndex={simulationIndex} selectedOperationId={selectedOperationId} expandedOperationId={expandedOperationId} onSelectOperation={onSelectOperation} onExpandOperation={(id)=>setExpandedOperationId(id)} onArrowSelect={(id)=>{onSelectOperation(id);setExpandedOperationId(id);}} edges={orbitConnections.edges} coordinateOperations={coordinateOperations} anchors={orbitConnections.anchors} catalogue={showCatalogueOrbit ? processDefinitions : undefined} onAddCatalogue={onAddProcessDefinition} showArrows={showArrows} vendors={vendors} quantityUnit={quantityUnit} ganttScale={ganttScale} /></div></div></div>
      
      <div className="process-orbit-help"><span>↔ DRAG TO ROTATE</span><span>{showCatalogueOrbit ? "SELECT A DIRECTORY NODE TO CREATE A PO-LINE OPERATION" : "SELECT A PROCESS NODE TO OPEN ITS RECORD"}</span><span>{simulationIndex>=0?`SIMULATION · STEP ${Math.min(simulationIndex+1,displayOperations.length)} / ${displayOperations.length}`:"SIMULATION IS VISUAL ONLY"} · VISUAL ONLY</span></div>
      {expandedOrbitOperation && <section ref={expandedDetailsRef} className="process-orbit-selected-details" id="process-orbit-selected-details" aria-label={"Expanded details for " + expandedOrbitOperation.name}>
        <div className="process-orbit-selected-heading"><div><small>SELECTED PROCESS / OP-{String(expandedOrbitOperation.sequence).padStart(3,"0")}</small><strong>{expandedOrbitOperation.name}</strong></div><div className="process-orbit-detail-actions"><label className="process-orbit-color-control">PROCESS COLOUR <input type="color" aria-label="Process colour" value={expandedOrbitOperation.relationType==="rework"?"#e66e20":expandedOrbitOperation.status==="Complete"?"#20a36b":expandedOrbitOperation.relationType==="alternate"?"#287bd0":expandedOrbitOperation.processColor||"#477fbd"} disabled={expandedOrbitOperation.status==="Complete"||expandedOrbitOperation.relationType==="rework"||expandedOrbitOperation.relationType==="alternate"} onChange={event=>onChangeProcessColor?.(expandedOrbitOperation.id,event.target.value)}/></label><button type="button" onClick={()=>onEditOperation?.(expandedOrbitOperation.id)} disabled={!onEditOperation}>Edit process ✎</button><button type="button" onClick={() => setExpandedOperationId("")}>Collapse details −</button></div></div>
        <div className="process-orbit-selected-grid">
          <div><small>PART / PO LINE</small><strong>{routeLabels[expandedOrbitOperation.poLineId] || expandedOrbitOperation.poLineId || "Not assigned"}</strong></div>
          <div><small>CATEGORY</small><strong>{expandedOrbitOperation.category || "Not set"}</strong></div>
          <div><small>PROCESS / SUBCATEGORY</small><strong>{expandedOrbitOperation.name}{expandedOrbitOperation.subcategory ? " · " + expandedOrbitOperation.subcategory : ""}</strong></div>
          <div><small>VENDOR</small><strong>{vendors.find(vendor => vendor.id === expandedOrbitOperation.vendorId)?.company || "Vendor not assigned"}</strong></div>
          <div><small>PLANNED START · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.plannedStart)}</strong></div>
          <div><small>PLANNED DELIVERY · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.plannedEnd)}</strong></div>
          <div><small>ACTUAL START · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.actualStart)}</strong></div>
          <div><small>ACTUAL COMPLETION · DATE &amp; TIME</small><strong>{dateLabel(expandedOrbitOperation.actualEnd)}</strong></div>
          <div><small>PLANNED QUANTITY</small><strong>{expandedOrbitOperation.quantity.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>COMPLETED / ACCEPTED / REJECTED</small><strong>{expandedOrbitOperation.completed.toLocaleString("en-IN")} / {expandedOrbitOperation.accepted.toLocaleString("en-IN")} / {expandedOrbitOperation.rejected.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>PRICE / PART</small><strong>{moneyLabel(expandedOrbitOperation.actualRatePerPart > 0 ? expandedOrbitOperation.actualRatePerPart : expandedOrbitOperation.ratePerPart)}</strong></div>
          <div><small>PROCESS AMOUNT</small><strong>{moneyLabel(expandedOrbitOperation.quantity * (expandedOrbitOperation.actualRatePerPart > 0 ? expandedOrbitOperation.actualRatePerPart : expandedOrbitOperation.ratePerPart))}</strong></div>
          <div><small>STATUS</small><strong>{expandedOrbitOperation.status}</strong></div>
          <div><small>PAYMENT STATUS</small><strong>{expandedOrbitOperation.paymentStatus || "Unpaid"}</strong></div>
          <div><small>PAID AMOUNT</small><strong>{moneyLabel(expandedOrbitOperation.paidAmount || 0)}</strong></div>
          <div><small>EXECUTION</small><strong>{expandedOrbitOperation.executionType || "Outsourced"}</strong></div>
          <div><small>MACHINE / STATION</small><strong>{expandedOrbitOperation.machine || "Not assigned"}</strong></div>
          <div><small>TOLERANCE</small><strong>{expandedOrbitOperation.toleranceCategory || "Standard"}</strong></div>
          <div><small>TRANSPORT VENDOR</small><strong>{vendors.find(vendor => vendor.id === expandedOrbitOperation.transportVendorId)?.company || "Not assigned"}</strong></div>
          <div><small>TRANSPORT PICKUP → DELIVERY</small><strong>{[expandedOrbitOperation.transportPickup || expandedOrbitOperation.transportFrom, expandedOrbitOperation.transportDelivery || expandedOrbitOperation.transportTo].filter(Boolean).join(" → ") || "Not set"}</strong></div>
          <div><small>TRANSPORT COST</small><strong>{moneyLabel(operationTransportAmounts[expandedOrbitOperation.id] || expandedOrbitOperation.transportCost || 0)}</strong></div>
          <div><small>INSPECTION RESULT</small><strong>{expandedOrbitOperation.inspectionResult || "Not recorded"}</strong></div>
          <div><small>BRANCH / ROUTE</small><strong>{expandedOrbitOperation.branch || "Main route"}{expandedOrbitOperation.relationType ? " · " + expandedOrbitOperation.relationType : ""}</strong></div>
          <div className="process-orbit-selected-wide"><small>OPERATION NOTES / QUALITY NOTES</small><strong>{expandedOrbitOperation.notes || expandedOrbitOperation.qualityNotes || "No notes recorded"}</strong></div>
        </div>
        {(expandedOrbitSubprocesses.length > 0 || expandedOrbitBranches.length > 0 || onAddSubprocess || onAddAlternateRoute || onAddReworkRoute) && <div className="process-orbit-selected-links">
          {expandedOrbitSubprocesses.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(""); }}>Sub-process · {child.name} · {child.status}</button>)}
          {expandedOrbitBranches.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(child.id); }}>{child.relationType === "rework" ? "Rework" : "Alternate"} · {child.name} · {child.status}</button>)}
          {onAddSubprocess && <button type="button" className="process-orbit-add-subprocess" onClick={() => onAddSubprocess(expandedOrbitOperation.id)}>＋ Add sub-process</button>}
          {onAddAlternateRoute && <button type="button" className="process-orbit-add-alternate" onClick={() => onAddAlternateRoute(expandedOrbitOperation.id)}>＋ Create alternate route</button>}
          {onAddReworkRoute && <button type="button" className="process-orbit-add-rework" onClick={() => onAddReworkRoute(expandedOrbitOperation.id)}>＋ Create rework route</button>}
        </div>}
      </section>}
    </div>
    <div className="process-universe-viewport"><div className="process-universe-stage" style={stageStyle}>
      {lanes.map((lane,laneIndex) => {
        const collapsed = collapsedLaneNames.includes(lane.key);
        const lanePanelId = "process-universe-lane-" + laneIndex;
        return <section className={"process-universe-lane" + (lane.alternate ? " is-branch " + (lane.branchRelation==="rework"?"is-rework":"is-alternate") : "")} key={lane.key}>
          <div className="process-universe-lane-label">
            <button type="button" className="process-universe-lane-toggle" aria-expanded={!collapsed} aria-controls={lanePanelId} onClick={() => setCollapsedLaneNames(current => current.includes(lane.key) ? current.filter(name => name !== lane.key) : [...current,lane.key])}>
              <span className="process-universe-branch-icon">{lane.alternate ? <GitBranch size={15}/> : <Workflow size={15}/>}</span>
              <span><strong>{lane.label}</strong><small>{lane.alternate ? (lane.branchRelation==="rework"?"Rework branch":"Alternate route") + (lane.parent ? " · connected from OP-" + String(lane.parent.sequence).padStart(3,"0") + " " + lane.parent.name : "") : "Primary manufacturing route"}</small></span>
              <span className="process-universe-lane-disclosure" aria-hidden="true">{collapsed ? "+" : "−"}</span>
            </button>
            <em>{lane.rows.length} STEP{lane.rows.length === 1 ? "" : "S"}</em>
          </div>
          <div id={lanePanelId} className="process-universe-lane-content" hidden={collapsed}>
            {lane.alternate && lane.branchRoot && <div className={"process-universe-branch-link " + (lane.branchRelation==="rework"?"is-rework":"is-alternate")} data-parent-id={lane.parent?.id||""} data-branch-root-id={lane.branchRoot?.id||""} aria-label={(lane.branchRelation==="rework"?"Rework":"Alternate")+" branch connection from "+(lane.parent?.name||"parent process")+" to "+(lane.branchRoot?.name||lane.name)}><span>OP-{String(lane.parent?.sequence||0).padStart(3,"0")} · {lane.parent?.name||"Parent operation"}</span>{showArrows && <ArrowRight size={16} style={{color:lane.branchRelation==="rework"?"#e38b45":"#4b95eb"}}/>}<strong>{lane.branchRoot?.name||lane.name}</strong><small>{lane.branchRelation==="rework"?"REWORK BRANCH":"ALTERNATE ROUTE"}</small></div>}
            <div className="process-universe-node-track">{lane.rows.map((operation,index) => {
              const globalIndex = displayOperations.findIndex(item => item.id === operation.id);
              const active = selectedOperationId === operation.id, current = simulationIndex === globalIndex, passed = simulationIndex > globalIndex;
              const childOperations = subprocessesFor(operation.id);
              const linkedBranches = branchesFor(operation.id);
              const expanded = expandedOperationId === operation.id;
              const state = operation.status.toLowerCase().replaceAll(" ","-");
              const processDefinition = processDefinitions.find(item=>item.id===operation.processDefinitionId);
              const accent = processDefinition?.displayColor || operation.processColor || "#6fa9e5";
              return <div className="process-universe-node-wrap" key={operation.id}>
                <button type="button" className={"process-universe-node status-" + state + (active ? " is-selected" : "") + (expanded ? " is-expanded" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} style={{"--process-accent":accent} as CSSProperties} onClick={() => { onSelectOperation(operation.id); setExpandedOperationId(operation.id); }} aria-pressed={active} aria-expanded={expanded} aria-controls={"process-universe-node-details-"+operation.id} title={"Open " + operation.name + " operation record"}>
                  <span className="process-universe-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><em>{operation.status}</em></span>
                  <span className="process-universe-node-icon"><ProcessIcon processId={operation.processDefinitionId} processName={operation.name} category={operation.category} subcategory={operation.subcategory} fallback={fallbackFor(operation.name)} /></span>
                  <strong>{operation.name}</strong>
                  <div className="process-universe-node-details"><small>{childOperations.length} linked sub-process(es) · {linkedBranches.length} alternate / rework step(s)</small><small>{expanded ? "− COLLAPSE DETAILS" : "+ EXPAND DETAILS"}</small></div>
                </button>
                {expanded && <div id={"process-universe-node-details-"+operation.id} className="process-node-subprocess-dropdown">
                  <strong>{operation.name} · Linked steps</strong>
                  <div className="process-universe-node-details">
                    {fieldVisible("category") && <small>Category · {operation.category || "Not set"}</small>}
                    {fieldVisible("subcategory") && operation.subcategory && <small>Subcategory · {operation.subcategory}</small>}
                    {fieldVisible("vendor") && <small>Vendor · {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "Not assigned"}</small>}
                    {fieldVisible("plannedStart") && <small>Start · {dateLabel(operation.plannedStart)}</small>}
                    {fieldVisible("plannedEnd") && <small>Delivery · {dateLabel(operation.plannedEnd)}</small>}
                    {fieldVisible("actualStart") && <small>Actual start · {dateLabel(operation.actualStart)}</small>}
                    {fieldVisible("actualEnd") && <small>Actual completion · {dateLabel(operation.actualEnd)}</small>}
                    {fieldVisible("quantity") && <small>Quantity · {operation.quantity.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("completed") && <small>Completed · {operation.completed.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("accepted") && <small>Accepted / rejected · {operation.accepted.toLocaleString("en-IN")} / {operation.rejected.toLocaleString("en-IN")} {quantityUnit}</small>}
                    {fieldVisible("price") && <small>Price / part · ₹{(operation.actualRatePerPart || operation.ratePerPart).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("amount") && <small>Process amount · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("transportLegCost") && <small>Transport amount · ₹{(operationTransportAmounts[operation.id] || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("combinedAmount") && <small>Process + transport · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart) + (operationTransportAmounts[operation.id] || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                    {fieldVisible("status") && <small>Status · {operation.status}</small>}
                    {fieldVisible("execution") && <small>Execution · {operation.executionType || "Outsourced"}</small>}
                    {fieldVisible("tolerance") && <small>Tolerance · {operation.toleranceCategory || "Standard"}</small>}
                    {fieldVisible("paymentStatus") && <small>Payment · {operation.paymentStatus || "Unpaid"}</small>}
                    {fieldVisible("paidAmount") && <small>Paid amount · ₹{(operation.paidAmount || 0).toLocaleString("en-IN",{maximumFractionDigits:2})}</small>}
                    {fieldVisible("machine") && <small>Machine · {operation.machine || "Not set"}</small>}
                    {fieldVisible("transportVendor") && <small>Transport vendor · {vendors.find(vendor=>vendor.id===operation.transportVendorId)?.company || "Not assigned"}</small>}
                    {fieldVisible("transportPickup") && <small>Transport pickup · {dateLabel(operation.transportPickup)}</small>}
                    {fieldVisible("transportDelivery") && <small>Transport delivery · {dateLabel(operation.transportDelivery)}</small>}
                    {fieldVisible("inspection") && <small>Inspection result · {operation.inspectionResult || "Not recorded"}</small>}
                    {fieldVisible("description") && <small>Operation details · {operation.notes || operation.qualityNotes || "Not set"}</small>}
                  </div>
                  {childOperations.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(""); }}><span>{child.name}</span><small>Sub-process · {child.status} · {child.machine || "Machine not set"}</small></button>)}
                  {linkedBranches.map(child => <button type="button" key={child.id} onClick={() => { onSelectOperation(child.id); setExpandedOperationId(child.id); }}><span>{child.name}</span><small>{child.relationType === "rework" ? "Rework branch" : "Alternate route"} · {child.status}</small></button>)}
                  <button type="button" className="process-node-add-subprocess" onClick={() => onAddSubprocess?.(operation.id)}>＋ Add sub-process</button>{onAddAlternateRoute && <button type="button" className="process-node-add-alternate" onClick={() => onAddAlternateRoute(operation.id)}>＋ Create alternate route</button>}{onAddReworkRoute && <button type="button" className="process-node-add-rework" onClick={() => onAddReworkRoute(operation.id)}>＋ Create rework route</button>}
                </div>}
                {showArrows && index < lane.rows.length - 1 && <span className="process-universe-connector" style={{color:lane.branchRelation==="rework"?"#e38b45":lane.branchRelation==="alternate"?"#4b95eb":accent}} aria-hidden="true"><ArrowRight size={17}/></span>}
              </div>;
            })}</div>
            {lane.alternate && <div className="process-universe-branch-note">Branch retained with its parent operation and rework history.</div>}
          </div>
        </section>;
      })}
      {operations.length === 0 && processDefinitions.length > 0 && <section className="process-directory-map-catalog" aria-label="Available Process Directory stages">
        <div className="process-directory-map-heading"><span>PROCESS DIRECTORY</span><strong>{processDefinitions.length} AVAILABLE STAGES</strong><small>Library definitions only · not yet saved as production operations</small></div>
        <div className="process-directory-map-nodes">{processDefinitions.map(definition => <button type="button" className="process-directory-map-node" key={definition.id} onClick={() => onAddProcessDefinition?.(definition.id)} disabled={!onAddProcessDefinition}>
          <ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={fallbackFor(definition.processType)} />
          <strong>{definition.processType}</strong><span>{definition.category}</span><small>{(definition.subcategories || []).length} sub-process option(s)</small><em>＋ Add to selected PO line</em>
        </button>)}</div>
      </section>}
      {operations.length === 0 && processDefinitions.length === 0 && <div className="process-universe-empty">No saved operations or Process Directory definitions are available.</div>}
      <div className="process-universe-floor" aria-hidden="true"/>
    </div></div>
    <footer className="process-universe-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="process-universe-safe">Simulation is visual only. It never changes job, operation or quantity records.</span></footer>
  </section>;
}
