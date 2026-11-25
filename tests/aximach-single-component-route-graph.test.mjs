import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture=JSON.parse(readFileSync(new URL("../src/single-component-route-demo.json",import.meta.url),"utf8"));
const supported=["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];

test("one synthetic component demonstrates all eleven route relationship types together",()=>{
  assert.equal(fixture.component.id,"demo-component-ast-1001");
  assert.equal(fixture.component.partNumber,"AST-1001");
  assert.equal(new Set(fixture.nodes.map(node=>node.componentId)).size,1);
  assert.ok(fixture.edges.length>=19);
  const types=new Set(fixture.edges.map(edge=>edge.type));
  for(const type of supported)assert.ok(types.has(type),"missing relationship type: "+type);
  assert.ok(types.has("material"),"material movement must be visible");
  assert.ok(types.has("transport"),"transport movement must be visible");
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
  const relationships=fixture.edges.filter(edge=>edge.source==="op-007"&&edge.target==="rework-station");
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
