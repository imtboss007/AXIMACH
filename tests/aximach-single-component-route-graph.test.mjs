import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture=JSON.parse(readFileSync(new URL("../src/single-component-route-demo.json",import.meta.url),"utf8"));
const supported=["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];

test("one synthetic component demonstrates all eleven route relationship types together",()=>{
  assert.equal(fixture.company.id,"demo-company-aster-01");
  assert.equal(fixture.purchaseOrder.companyId,fixture.company.id);
  assert.equal(fixture.purchaseOrder.id,fixture.component.poId);
  assert.equal(fixture.component.companyId,fixture.company.id);
  assert.equal(fixture.component.id,"demo-component-ast-1001");
  assert.equal(fixture.component.partNumber,"AST-1001");
  assert.equal(new Set(fixture.nodes.map(node=>node.componentId)).size,1);
  assert.ok(fixture.edges.length>=19);
  const types=new Set(fixture.edges.map(edge=>edge.type));
  for(const type of supported)assert.ok(types.has(type),"missing relationship type: "+type);
  assert.ok(types.has("material"),"material movement must be visible");
  assert.ok(types.has("transport"),"transport movement must be visible");
  assert.equal(fixture.expected.companyCount,1);
  assert.equal(fixture.expected.purchaseOrderCount,1);
  assert.equal(fixture.expected.componentCount,1);
});

test("all demo edges resolve to real fixture nodes and have directional identities",()=>{
  const nodeIds=new Set(fixture.nodes.map(node=>node.id));
  for(const edge of fixture.edges){
    assert.ok(nodeIds.has(edge.source),"missing source node: "+edge.source);
    assert.ok(nodeIds.has(edge.target),"missing target node: "+edge.target);
    assert.notEqual(edge.source,edge.target);
  }
});

test("transport uses vehicle-specific identities and actual vehicle nodes",()=>{
  const transportNodes=fixture.nodes.filter(node=>node.kind==="transport");
  assert.ok(transportNodes.length>=2);
  assert.ok(transportNodes.every(node=>node.vehicleType&&node.vehicleType.trim()));
  assert.ok(new Set(transportNodes.map(node=>node.vehicleType)).size>=2);
  assert.ok(fixture.edges.filter(edge=>edge.type==="transport").length>=3);
});

test("same endpoint pair may preserve two different relationship types without collapsing",()=>{
  const relationships=fixture.edges.filter(edge=>edge.source==="op-022"&&edge.target==="op-026");
  assert.deepEqual(new Set(relationships.map(edge=>edge.type)),new Set(["conditional","feedback"]));
  assert.equal(new Set(relationships.map(edge=>edge.id)).size,relationships.length);
});

test("demo uses AXIMACH's shared React Flow canvas, process icons and adaptive edge geometry",()=>{
  const graph=readFileSync(new URL("../src/SingleComponentRouteGraphDemo.tsx",import.meta.url),"utf8");
  const demo=readFileSync(new URL("../src/TransportRoutingDemo.tsx",import.meta.url),"utf8");
  assert.ok(graph.includes("<ManufacturingGraphCanvas"));
  assert.ok(graph.includes("routeRelationshipEdgeGeometry"));
  assert.ok(graph.includes('type:"manufacturing"'));
  assert.ok(graph.includes("<VehicleIcon vehicleType={data.vehicleType"));
  assert.ok(graph.includes("<ProcessIcon processName="));
  assert.ok(demo.includes("<SingleComponentRouteGraphDemo/>"));
});


test("all catalogue manufacturing categories are represented on one PO component with operation rates",()=>{
  const categories=new Set(fixture.operations.map(row=>row.category));
  for(const category of ["Turning","Heat Treatment","Grinding","Metrology","Laser Cutting","Forming","Welding","Finishing","Quality","Gear Cutting","VMC Machining","Deburring","Sawing","Assembly","Packaging"])
    assert.ok(categories.has(category),"single component route missing process category: "+category);
  assert.ok(fixture.operations.every(row=>row.companyId===fixture.company.id&&row.poId===fixture.purchaseOrder.id&&row.poLineId===fixture.component.poLineId&&row.componentId===fixture.component.id));
  assert.ok(fixture.operations.every(row=>row.ratePerPartINR>0&&row.plannedCostINR===row.ratePerPartINR*row.quantity));
  assert.ok(fixture.component.processCostINR===fixture.expected.baseProcessCostINR);
});

test("graph nodes carry the same company / PO / component identity and rate metadata as the operation master",()=>{
  const ids=new Set(fixture.operations.map(row=>row.id));
  const processNodes=fixture.nodes.filter(node=>node.kind==="process"&&ids.has(node.id));
  assert.equal(processNodes.length,fixture.operations.length);
  assert.ok(fixture.nodes.every(node=>node.companyId===fixture.company.id&&node.poId===fixture.purchaseOrder.id&&node.componentId===fixture.component.id));
  assert.ok(processNodes.every(node=>node.ratePerPartINR>0&&node.plannedCostINR>0));
});

test("transport and material sources resolve to one company / one PO / one component",()=>{
  for(const row of [...fixture.transportLegs,...fixture.materialProcessLinks]){
    assert.equal(row.companyId,fixture.company.id);
    assert.equal(row.poId,fixture.purchaseOrder.id);
    assert.equal(row.componentId,fixture.component.id);
    assert.equal(row.poLineId,fixture.component.poLineId);
  }
});
