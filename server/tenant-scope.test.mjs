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
