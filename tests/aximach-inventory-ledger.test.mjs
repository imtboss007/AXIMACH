import test from "node:test";
import assert from "node:assert/strict";
import {getInventoryStockBalance,buildBomMaterialIssuePlan,buildMaterialConsumptionPlan,validateMaterialConsumptionQuantities} from "../src/inventoryLedger.mjs";

const transactions=[
 {id:"s1",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:100,companyId:"c1",factoryId:"f1"},
 {id:"s2",itemType:"material",itemId:"mat-1",transactionType:"Issue to production",direction:"out",quantity:20,companyId:"c1",factoryId:"f1"},
 {id:"s3",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:70,companyId:"c1",factoryId:"f2"},
 {id:"s4",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:90,companyId:"c2",factoryId:"f1"},
 {id:"s5",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:50,companyId:"c1",factoryId:"f1",deletedAt:"2026-11-25T00:00:00.000Z"}
];
test("stock balances are isolated by company and factory and ignore archived transactions",()=>{
 assert.equal(getInventoryStockBalance(transactions,"material","mat-1",{companyId:"c1",factoryId:"f1"}),80);
 assert.equal(getInventoryStockBalance(transactions,"material","mat-1",{companyId:"c1",factoryId:"f2"}),70);
 assert.equal(getInventoryStockBalance(transactions,"material","mat-1",{companyId:"c2",factoryId:"f1"}),90);
 assert.equal(getInventoryStockBalance(transactions,"material","mat-1"),240);
});
test("BOM issue planning uses only stock from the PO owning company and factory",()=>{
 const po={id:"po-1",companyId:"c1",factoryId:"f1"};
 const line={id:"line-1",componentId:"component-1",partId:"part-1",quantity:10};
 const component={id:"component-1",revision:"B"};
 const bomLines=[
  {id:"bom-common",componentId:"component-1",materialId:"mat-1",revision:"B",quantityPerPart:2,scrapPercent:10},
  {id:"bom-part",componentId:"component-1",partId:"part-1",materialId:"mat-2",revision:"B",quantityPerPart:1,scrapPercent:0},
  {id:"bom-other-part",componentId:"component-1",partId:"part-2",materialId:"mat-3",revision:"B",quantityPerPart:9,scrapPercent:0},
  {id:"bom-old-revision",componentId:"component-1",materialId:"mat-4",revision:"A",quantityPerPart:9,scrapPercent:0},
  {id:"bom-other-component",componentId:"component-2",materialId:"mat-5",revision:"B",quantityPerPart:9,scrapPercent:0}
 ];
 const materials=[{id:"mat-1",code:"EN8"},{id:"mat-2",code:"AL6061"}];
 const stock=[
  {id:"a",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:529,companyId:"c1",factoryId:"f1"},
  {id:"b",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:1000,companyId:"c2",factoryId:"f1"},
  {id:"c",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:800,companyId:"c1",factoryId:"f2"},
  {id:"d",itemType:"material",itemId:"mat-2",transactionType:"Receipt",direction:"in",quantity:2,companyId:"c1",factoryId:"f1"},
  {id:"e",itemType:"material",itemId:"mat-1",transactionType:"Issue to production",direction:"out",quantity:5,poId:"po-1",poLineId:"line-1",companyId:"c1",factoryId:"f1"},
  {id:"f",itemType:"material",itemId:"mat-1",transactionType:"Return",direction:"in",quantity:1,poId:"po-1",poLineId:"line-1",companyId:"c1",factoryId:"f1"},
  {id:"g",itemType:"material",itemId:"mat-1",transactionType:"Issue to production",direction:"out",quantity:500,poId:"po-1",poLineId:"other-line",companyId:"c1",factoryId:"f1"}
 ];
 const plan=buildBomMaterialIssuePlan({bomLines,materials,transactions:stock,po,line,component});
 assert.equal(plan.length,2);
 const en8=plan.find(row=>row.materialId==="mat-1");
 const aluminium=plan.find(row=>row.materialId==="mat-2");
 assert.equal(en8.required,22);
 assert.equal(en8.issued,4);
 assert.equal(en8.pending,18);
 assert.equal(en8.available,25);
 assert.equal(en8.shortage,0);
 assert.equal(aluminium.required,10);
 assert.equal(aluminium.pending,10);
 assert.equal(aluminium.available,2);
 assert.equal(aluminium.shortage,8);
});
test("BOM issue plan refuses incomplete ownership and cannot borrow another factory stock",()=>{
 const plan=buildBomMaterialIssuePlan({
  bomLines:[{id:"b1",componentId:"component-1",materialId:"mat-1",quantityPerPart:1,scrapPercent:0}],
  materials:[{id:"mat-1",code:"EN8"}],
  transactions:[{id:"remote",itemType:"material",itemId:"mat-1",transactionType:"Receipt",direction:"in",quantity:500,companyId:"c2",factoryId:"f2"}],
  po:{id:"po",companyId:"c1",factoryId:"f1"},
  line:{id:"line",componentId:"component-1",quantity:5},
  component:{id:"component-1",revision:""}
 });
 assert.equal(plan[0].available,0);
 assert.equal(plan[0].shortage,5);
 assert.deepEqual(buildBomMaterialIssuePlan({bomLines:[],materials:[],transactions:[],po:{id:"po"},line:{id:"line"},component:{id:"component-1"}}),[]);
});

test("actual consumption uses operation-specific issues before the shared unassigned issue pool",()=>{
 const po={id:"po-consume",companyId:"c1",factoryId:"f1"};
 const line={id:"line-consume",componentId:"component-consume",partId:"part-consume",quantity:100};
 const component={id:"component-consume",revision:"C"};
 const operationA={id:"op-a",poId:po.id,poLineId:line.id,componentId:component.id};
 const operationB={id:"op-b",poId:po.id,poLineId:line.id,componentId:component.id};
 const material={id:"mat-a",unit:"kg"};
 const bomLine={id:"bom-a",componentId:component.id,partId:line.partId,materialId:material.id,quantityPerPart:1,scrapPercent:10};
 const transactions=[
  {id:"issue-a",itemType:"material",itemId:"mat-a",transactionType:"Issue to production",direction:"out",quantity:40,companyId:"c1",factoryId:"f1",poId:po.id,poLineId:line.id,operationId:"op-a"},
  {id:"issue-b",itemType:"material",itemId:"mat-a",transactionType:"Issue to production",direction:"out",quantity:20,companyId:"c1",factoryId:"f1",poId:po.id,poLineId:line.id,operationId:"op-b"},
  {id:"issue-shared",itemType:"material",itemId:"mat-a",transactionType:"Issue to production",direction:"out",quantity:50,companyId:"c1",factoryId:"f1",poId:po.id,poLineId:line.id,operationId:""},
  {id:"issue-other-company",itemType:"material",itemId:"mat-a",transactionType:"Issue to production",direction:"out",quantity:900,companyId:"c2",factoryId:"f1",poId:po.id,poLineId:line.id,operationId:"op-a"}
 ];
 const consumption=[
  {id:"use-a",companyId:"c1",factoryId:"f1",poId:po.id,poLineId:line.id,componentId:component.id,bomLineId:"bom-a",materialId:"mat-a",operationId:"op-a",consumedQuantity:20,scrapQuantity:2,returnedQuantity:5},
  {id:"use-b",companyId:"c1",factoryId:"f1",poId:po.id,poLineId:line.id,componentId:component.id,bomLineId:"bom-b",materialId:"mat-a",operationId:"op-b",consumedQuantity:20,scrapQuantity:1,returnedQuantity:5}
 ];
 const link={id:"mpl-a",companyId:"c1",poId:po.id,poLineId:line.id,componentId:component.id,bomLineId:bomLine.id,materialId:material.id,operationId:operationA.id,quantityPerPart:.8,flowType:"Material input"};
 const plan=buildMaterialConsumptionPlan({po,line,component,operation:operationA,bomLine,material,materialProcessLinks:[link],inventoryTransactions:transactions,materialConsumptions:consumption});
 assert.equal(plan.plannedQuantity,80);
 assert.equal(plan.issuedQuantityAtRecord,60);
 assert.equal(plan.availableToReconcile,60);
 assert.equal(plan.priorConsumed,20);
 assert.equal(plan.priorScrap,2);
 assert.equal(plan.priorReturned,5);
 assert.equal(plan.variance,-60);
 assert.deepEqual(plan.materialProcessLinkIds,["mpl-a"]);
});
test("actual consumption validation counts scrap within consumed quantity and prevents over-reconciliation",()=>{
 const plan={availableToReconcile:10};
 assert.deepEqual(validateMaterialConsumptionQuantities(plan,7,2,3),{ok:true,reason:""});
 assert.equal(validateMaterialConsumptionQuantities(plan,7,8,0).reason,"scrap-exceeds-consumption");
 assert.equal(validateMaterialConsumptionQuantities(plan,9,1,2).reason,"exceeds-issued-available");
 assert.equal(validateMaterialConsumptionQuantities(plan,0,0,0).reason,"empty-reconciliation");
});
test("actual consumption cannot borrow another factory's or another PO line's issue",()=>{
 const po={id:"po-c2",companyId:"c1",factoryId:"f1"},line={id:"line-c2",componentId:"cmp-c2",quantity:10},component={id:"cmp-c2",revision:"A"};
 const operation={id:"op-c2",poId:po.id,poLineId:line.id,componentId:component.id};
 const bomLine={id:"bom-c2",componentId:component.id,materialId:"mat-c2",quantityPerPart:1,scrapPercent:0};
 const material={id:"mat-c2",unit:"kg"};
 const plan=buildMaterialConsumptionPlan({po,line,component,operation,bomLine,material,inventoryTransactions:[
  {id:"other-factory",itemType:"material",itemId:"mat-c2",transactionType:"Issue to production",direction:"out",quantity:50,companyId:"c1",factoryId:"f2",poId:po.id,poLineId:line.id,operationId:operation.id},
  {id:"other-po-line",itemType:"material",itemId:"mat-c2",transactionType:"Issue to production",direction:"out",quantity:50,companyId:"c1",factoryId:"f1",poId:po.id,poLineId:"another-line",operationId:operation.id}
 ]});
 assert.equal(plan.availableToReconcile,0);
});
