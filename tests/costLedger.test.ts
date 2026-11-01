
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRouteCostTotals, componentBaselinePerPart, isTransportOperation } from '../src/costLedger.ts';
test('classifies dispatch and freight operations as transport, not machining', () => {
 assert.equal(isTransportOperation({name:'Inter-factory dispatch',category:'Logistics'}),true);
 assert.equal(isTransportOperation({name:'VMC milling',category:'Machining'}),false);
});
test('separates process, transport and actual processing and keeps both vendor links', () => {
 const totals=calculateRouteCostTotals([
  {name:'VMC Milling',category:'Machining',quantity:100,ratePerPart:12,actualRatePerPart:10,transportCost:250,vendorId:'vendor-machining',transportVendorId:'vendor-truck'},
  {name:'Transport / Dispatch',category:'Logistics',quantity:100,ratePerPart:3,actualRatePerPart:2.5,transportCost:0,vendorId:'vendor-freight',transportVendorId:''}
 ]);
 assert.deepEqual(totals,{processPlanned:1200,transportPlanned:550,processedActual:1000,transportActual:250,vendorIds:['vendor-machining','vendor-truck','vendor-freight']});
});
test('component plan includes process baselines but excludes legacy transport assumptions', () => {
 const total=componentBaselinePerPart({materialCostPerPart:100,directLabourCostPerPart:20,overheadCostPerPart:5,toolingCostPerPart:8,qualityCostPerPart:2,reworkScrapCostPerPart:3,packagingCostPerPart:4,otherCostPerPart:1},[
  {quantityPerPart:2,ratePerProcess:15,transportCostPerPart:999},{quantityPerPart:1,ratePerProcess:7,transportCostPerPart:888}
 ]);
 assert.equal(total,180);
});
