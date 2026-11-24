import assert from "node:assert/strict";
import test from "node:test";
import {
  expandEcosystemGroupLimit,
  getVisibleEcosystemNodes,
  loadEcosystemGraphLayout,
  loadEcosystemGraphPreferences,
  searchEcosystemNodes,
  updateEcosystemGraphLayout
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


test("graph view preferences restore hidden groups and progressive expansion limits",()=>{
  const preferences=loadEcosystemGraphPreferences(JSON.stringify({
    version:2,
    visibleKinds:["vendor","operation","unknown","vendor"],
    visibleLimits:{vendor:14,operation:20,unknown:900}
  }),["company","vendor","operation"],{company:6,vendor:6,operation:8});
  assert.deepEqual(preferences.visibleKinds,["vendor","operation"]);
  assert.deepEqual(preferences.visibleLimits,{company:6,vendor:14,operation:20});
});

test("graph view preference loader falls back safely for malformed or inaccessible storage data",()=>{
  const defaults=loadEcosystemGraphPreferences("{not valid json",["company","vendor"],{company:6,vendor:6});
  assert.deepEqual(defaults,{version:2,visibleKinds:["company","vendor"],visibleLimits:{company:6,vendor:6}});
});

test("graph view preferences allow an intentionally hidden-all state and clamp unsafe limits",()=>{
  const preferences=loadEcosystemGraphPreferences(JSON.stringify({
    visibleKinds:[],
    visibleLimits:{company:-50,vendor:999999}
  }),["company","vendor"],{company:6,vendor:6});
  assert.deepEqual(preferences.visibleKinds,[]);
  assert.deepEqual(preferences.visibleLimits,{company:0,vendor:5000});
});


test("graph preference schema upgrade exposes newly added entity groups once",()=>{
 const migrated=loadEcosystemGraphPreferences(JSON.stringify({version:1,visibleKinds:["company","vendor"],visibleLimits:{company:6,vendor:10}}),["company","vendor","customer"],{company:6,vendor:6,customer:6});
 assert.equal(migrated.version,2);
 assert.deepEqual(migrated.visibleKinds,["company","vendor","customer"]);
 assert.equal(migrated.visibleLimits.customer,6);
 const next=loadEcosystemGraphPreferences(JSON.stringify({version:2,visibleKinds:["company","vendor"],visibleLimits:{}}),["company","vendor","customer"],{company:6,vendor:6,customer:6});
 assert.deepEqual(next.visibleKinds,["company","vendor"]);
});


test("ecosystem graph layouts restore saved node positions by stable record ID",()=>{
  const layout=loadEcosystemGraphLayout(JSON.stringify({
    "vendor:stable-1":{x:420,y:-180},
    "operation:stable-2":{x:12.5,y:90}
  }));
  assert.deepEqual(layout,{
    "vendor:stable-1":{x:420,y:-180},
    "operation:stable-2":{x:12.5,y:90}
  });
});

test("ecosystem graph layout updates one node without disturbing other saved positions",()=>{
  const first={"vendor:1":{x:10,y:20},"operation:2":{x:30,y:40}};
  const next=updateEcosystemGraphLayout(first,"vendor:1",{x:150,y:260});
  assert.deepEqual(next,{"operation:2":{x:30,y:40},"vendor:1":{x:150,y:260}});
  assert.deepEqual(first,{"vendor:1":{x:10,y:20},"operation:2":{x:30,y:40}});
});

test("ecosystem graph layout loader rejects corrupt entries and clamps unsafe coordinates",()=>{
  const layout=loadEcosystemGraphLayout(JSON.stringify({
    "vendor:valid":{x:999999,y:-999999},
    "operation:invalid":{x:"not-a-number",y:10},
    "":{x:1,y:2}
  }));
  assert.deepEqual(layout,{"vendor:valid":{x:100000,y:-100000}});
  assert.deepEqual(loadEcosystemGraphLayout("{broken"),{});
  assert.deepEqual(updateEcosystemGraphLayout(layout,"bad-id",{x:NaN,y:1}),layout);
});
