import test from "node:test";
import assert from "node:assert/strict";
import { filterManufacturingData, validateManufacturingWrite } from "./tenant-scope.mjs";
const companyA={id:"company-a",name:"A"},companyB={id:"company-b",name:"B"};
const user={id:"user-a",role:"manager",companyIds:["company-a"],factoryIds:[]};
const customer=(id,ownerCompanyId)=>({id,ownerCompanyId,customerCode:id,legalName:id,displayName:id,currency:"INR",status:"Active"});
const prospect=(id,ownerCompanyId)=>({id,ownerCompanyId,businessName:id,stage:"New",evidence:[{
 id:"evidence-"+id,provider:"SearXNG",query:"industrial OEM buyers",sourceUrl:"https://example.com/"+id,
 sourceTitle:"Public company directory",snippet:"Public snippet",retrievedAt:"2026-11-22T08:00:00.000Z"
}]});
test("tenant-filtered manufacturing data returns only company-owned customers and prospects",()=>{
 const visible=filterManufacturingData({updatedAt:"2026-11-22T08:00:00.000Z",companies:[companyA,companyB],
  customers:[customer("customer-a","company-a"),customer("customer-b","company-b"),customer("legacy-customer",undefined)],
  prospects:[prospect("prospect-a","company-a"),prospect("prospect-b","company-b")]},user);
 assert.deepEqual(visible.customers.map(row=>row.id),["customer-a"]);
 assert.deepEqual(visible.prospects.map(row=>row.id),["prospect-a"]);
});
test("tenant user may add a prospect only for an assigned company",()=>{
 const data={companies:[companyA,companyB],customers:[],prospects:[]};
 assert.equal(validateManufacturingWrite(data,{customers:[],prospects:[prospect("prospect-a","company-a")]},user).ok,true);
 const denied=validateManufacturingWrite(data,{customers:[],prospects:[prospect("prospect-b","company-b")]},user);
 assert.equal(denied.ok,false);assert.match(denied.error,/prospects/);
});
test("tenant user may add customers only with an assigned owner company",()=>{
 const data={companies:[companyA,companyB],customers:[],prospects:[]};
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-a","company-a")],prospects:[]},user).ok,true);
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-b","company-b")],prospects:[]},user).ok,false);
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-legacy",undefined)],prospects:[]},user).ok,false);
});

const factoryA={id:"factory-a",companyId:"company-a",name:"A Factory"};
const factoryB={id:"factory-b",companyId:"company-b",name:"B Factory"};
const machineA={
 id:"machine-a",companyId:"company-a",factoryId:"factory-a",assetCode:"VMC-01",
 name:"Vertical machining centre 01",machineType:"VMC",manufacturer:"Example",
 model:"VMC-850",serialNumber:"SN-A1",controller:"Fanuc",axisCount:3,
 processDefinitionIds:["process-vmc"],materialCapabilities:["Aluminium","EN24"],
 status:"Available",notes:"Company A asset",createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const machineB={...machineA,id:"machine-b",companyId:"company-b",factoryId:"factory-b",assetCode:"VMC-01",name:"Company B VMC"};
const processDefinition={id:"process-vmc",processType:"VMC machining",category:"Machining",subcategories:[],vendorIds:[],notes:"Shared process master"};
test("tenant-filtered manufacturing data exposes only machine assets belonging to assigned company and factory",()=>{
 const visible=filterManufacturingData({
  companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,machineB]
 },user);
 assert.deepEqual(visible.machines.map(row=>row.id),["machine-a"]);
});
test("tenant user can add only machine assets in an assigned company and its own factory",()=>{
 const data={companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[],processDefinitions:[processDefinition]};
 assert.equal(validateManufacturingWrite(data,{machines:[machineA]},user).ok,true);
 assert.equal(validateManufacturingWrite(data,{machines:[machineB]},user).ok,false);
 assert.equal(validateManufacturingWrite(data,{machines:[{...machineA,id:"machine-wrong-factory",factoryId:"factory-b"}]},user).ok,false);
});
test("machine asset codes must be unique within a company",()=>{
 const duplicate={...machineA,id:"machine-a-duplicate"};
 const result=validateManufacturingWrite(
  {companies:[companyA],factories:[factoryA],machines:[],processDefinitions:[processDefinition]},
  {machines:[machineA,duplicate]},user
 );
 assert.equal(result.ok,false);
 assert.match(result.error,/machines/);
});
test("production operations can link only to a same-company same-factory machine with a matching process capability",()=>{
 const component={id:"component-a",companyId:"company-a",partNumber:"A-01"};
 const po={id:"po-a",number:"PO-A",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-a",componentId:"component-a"}]};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[]};
 const operation={id:"operation-a",poId:"po-a",poLineId:"line-a",componentId:"component-a",machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",vendorId:"",transportVendorId:"",status:"Planned"};
 assert.equal(validateManufacturingWrite(base,{operations:[operation]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,executionType:"Outsourced"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,processDefinitionId:"process-turning"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,machineId:"machine-b"}]},user).ok,false);
});
