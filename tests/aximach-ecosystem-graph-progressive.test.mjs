import assert from "node:assert/strict";
import test from "node:test";
import {
  expandEcosystemGroupLimit,
  getVisibleEcosystemNodes,
  searchEcosystemNodes
} from "../src/manufacturingEcosystemGraphModel.mjs";

const node=(id,kind,label,detail="",context={})=>({id,kind,label,detail,moduleId:kind,context});

test("ecosystem search finds saved records beyond the initial graph sample",()=>{
  const records=Array.from({length:18},(_,index)=>node("vendor:"+index,"vendor","Vendor "+index,"Supplier capability"));
  const result=searchEcosystemNodes(records,"Vendor 17");
  assert.equal(result.length,1);
  assert.equal(result[0].id,"vendor:17");
});

test("ecosystem search matches record IDs, status/details and linked context identifiers",()=>{
  const records=[
    node("operation:1","operation","Turning","Quality hold",{poLineId:"line:AX-440"}),
    node("component:2","component","Bracket","Revision C")
  ];
  assert.equal(searchEcosystemNodes(records,"AX-440")[0].id,"operation:1");
  assert.equal(searchEcosystemNodes(records,"quality hold")[0].id,"operation:1");
  assert.equal(searchEcosystemNodes(records,"component:2")[0].id,"component:2");
});

test("progressive graph expansion reveals the next bounded batch only for the selected group",()=>{
  const records=[
    ...Array.from({length:13},(_,index)=>node("vendor:"+index,"vendor","Vendor "+index)),
    node("po:1","order","PO-1")
  ];
  const first=getVisibleEcosystemNodes(records,["vendor","order"],{vendor:6,order:6});
  assert.equal(first.filter(item=>item.kind==="vendor").length,6);
  assert.equal(first.filter(item=>item.kind==="order").length,1);
  const nextLimit=expandEcosystemGroupLimit(6,13,4);
  assert.equal(nextLimit,10);
  const second=getVisibleEcosystemNodes(records,["vendor","order"],{vendor:nextLimit,order:6});
  assert.equal(second.filter(item=>item.kind==="vendor").length,10);
  assert.equal(second.filter(item=>item.kind==="order").length,1);
});

test("a search-selected record outside the visible sample is injected into the graph",()=>{
  const records=Array.from({length:20},(_,index)=>node("operation:"+index,"operation","OP "+index));
  const searchHit=searchEcosystemNodes(records,"OP 19")[0];
  const visible=getVisibleEcosystemNodes(records,["operation"],{operation:8},searchHit.id);
  assert.equal(visible.length,9);
  assert.ok(visible.some(item=>item.id==="operation:19"));
});

test("hidden entity groups remain hidden even when a record is selected",()=>{
  const records=[node("vendor:1","vendor","Vendor 1"),node("order:1","order","PO-1")];
  const visible=getVisibleEcosystemNodes(records,["order"],{order:6},"vendor:1");
  assert.deepEqual(visible.map(item=>item.id),["order:1"]);
});

test("group expansion never exceeds the available record count",()=>{
  assert.equal(expandEcosystemGroupLimit(12,14,4),14);
  assert.equal(expandEcosystemGroupLimit(14,14,4),14);
  assert.equal(expandEcosystemGroupLimit(6,3,4),3);
});
