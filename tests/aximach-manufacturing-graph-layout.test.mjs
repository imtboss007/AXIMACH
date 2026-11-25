import test from "node:test";
import assert from "node:assert/strict";
import { layoutManufacturingUniverseNodes, routeRelationshipHandles, manufacturingGraphEdgeKey } from "../src/manufacturingGraphLayout.mjs";

test("Manufacturing Universe layout places every visible record without card overlap", () => {
  const kinds=["company","customer","factory","order","component","vendor","process","operation","material","quality","transport","finance","contact"];
  const nodes=kinds.flatMap((kind,group)=>Array.from({length:group===7?26:group%4+1},(_,i)=>({id:kind+":"+i,kind})));
  const positions=layoutManufacturingUniverseNodes(nodes,kinds);
  assert.equal(Object.keys(positions).length,nodes.length);
  const boxes=nodes.map(node=>({id:node.id,...positions[node.id],w:190,h:92}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    const overlap=a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    assert.equal(overlap,false, a.id+" overlaps "+b.id);
  }
});

test("every route relationship type has distinct port semantics", () => {
  const types=["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor","transport"];
  const pairs=types.map(type=>routeRelationshipHandles(type).join("->"));
  assert.equal(new Set(pairs).size,types.length);
  assert.equal(manufacturingGraphEdgeKey("a","b","main"),"a::b::main");
  assert.notEqual(manufacturingGraphEdgeKey("a","b","main"),manufacturingGraphEdgeKey("a","b","parallel"));
});
