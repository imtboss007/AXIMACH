const asArray=value=>Array.isArray(value)?value:[];
const dueIsPast=value=>Boolean(value)&&Number.isFinite(Date.parse(value+"T00:00:00.000Z"))&&value<new Date().toISOString().slice(0,10);
const hasProcess=(asset,processDefinitionId)=>{
 const ids=asArray(asset?.processDefinitionIds);
 return !processDefinitionId||!ids.length||ids.includes(processDefinitionId);
};
const machineMatch=(asset,machineId,machineType)=>{
 const ids=asArray(asset?.compatibleMachineIds),types=asArray(asset?.machineTypeCapabilities);
 return (!ids.length||Boolean(machineId&&ids.includes(machineId)))&&(!types.length||Boolean(machineType&&types.includes(machineType)));
};
const materialMatch=(asset,material)=>{
 const capabilities=asArray(asset?.materialCapabilities).map(value=>String(value).trim().toLowerCase());
 return !capabilities.length||!material||capabilities.includes(String(material).trim().toLowerCase());
};
export function getEligibleToolingAssets(assets=[],scope={}){
 return asArray(assets).filter(asset=>
  asset&&!asset.deletedAt&&asset.companyId===scope.companyId&&asset.factoryId===scope.factoryId&&
  (asset.status==="Available"||asset.id===scope.selectedId&&asset.status==="In use")&&
  machineMatch(asset,scope.machineId,scope.machineType)&&hasProcess(asset,scope.processDefinitionId)&&materialMatch(asset,scope.material)&&
  !(Number(asset.toolLifeLimitMinutes)>0&&Number(asset.toolLifeUsedMinutes)>=Number(asset.toolLifeLimitMinutes))&&
  !(Number(asset.toolLifeLimitCycles)>0&&Number(asset.toolLifeUsedCycles)>=Number(asset.toolLifeLimitCycles))&&
  !dueIsPast(asset.inspectionDueAt)
 ).sort((a,b)=>String(a.assetCode||"").localeCompare(String(b.assetCode||"")));
}
export function getEligibleFixtureAssets(assets=[],scope={}){
 return asArray(assets).filter(asset=>
  asset&&!asset.deletedAt&&asset.companyId===scope.companyId&&asset.factoryId===scope.factoryId&&
  (asset.status==="Available"||asset.id===scope.selectedId&&asset.status==="In use")&&
  machineMatch(asset,scope.machineId,scope.machineType)&&hasProcess(asset,scope.processDefinitionId)&&
  (!asArray(asset.componentIds).length||asset.componentIds.includes(scope.componentId))&&
  !(Number(asset.maxUsageCycles)>0&&Number(asset.usageCycles)>=Number(asset.maxUsageCycles))&&
  !dueIsPast(asset.inspectionDueAt)
 ).sort((a,b)=>String(a.assetCode||"").localeCompare(String(b.assetCode||"")));
}
export function validateOperationResourceAssignments({toolingIds=[],fixtureIds=[],toolingAssets=[],fixtureAssets=[],scope={}}={}){
 const unique=(values)=>Array.isArray(values)&&values.every(value=>typeof value==="string"&&value.trim())&&new Set(values).size===values.length;
 if(!unique(toolingIds)||!unique(fixtureIds))return {ok:false,reason:"duplicate-or-invalid-resource-id"};
 const tools=getEligibleToolingAssets(toolingAssets,{...scope,selectedId:""});
 const fixtures=getEligibleFixtureAssets(fixtureAssets,{...scope,selectedId:""});
 if(toolingIds.some(id=>!tools.some(asset=>asset.id===id)&&!asArray(scope.existingToolingIds).includes(id)))return {ok:false,reason:"tooling-unavailable-or-incompatible"};
 if(fixtureIds.some(id=>!fixtures.some(asset=>asset.id===id)&&!asArray(scope.existingFixtureIds).includes(id)))return {ok:false,reason:"fixture-unavailable-or-incompatible"};
 return {ok:true,reason:""};
}
export function applyResourceUsageEvent(asset,event){
 if(!asset||!event||!Number.isFinite(Number(event.runtimeMinutes))||Number(event.runtimeMinutes)<0||!Number.isFinite(Number(event.cycles))||Number(event.cycles)<0)throw new Error("Invalid resource usage event.");
 const next={...asset,updatedAt:event.occurredAt||new Date().toISOString()};
 if(event.eventType==="Production use"){
  if(asset.id===undefined)throw new Error("Resource ID is missing.");
  if(asset.status!=="Available"&&asset.status!=="In use")throw new Error("Resource is not available for production use.");
  if(asset.id&&event.resourceType==="tooling"){
   next.toolLifeUsedMinutes=Math.max(0,Number(asset.toolLifeUsedMinutes)||0)+Number(event.runtimeMinutes);
   next.toolLifeUsedCycles=Math.max(0,Number(asset.toolLifeUsedCycles)||0)+Number(event.cycles);
   if((Number(asset.toolLifeLimitMinutes)>0&&next.toolLifeUsedMinutes>=Number(asset.toolLifeLimitMinutes))||(Number(asset.toolLifeLimitCycles)>0&&next.toolLifeUsedCycles>=Number(asset.toolLifeLimitCycles)))next.status="Needs regrind";
  }else{
   next.usageCycles=Math.max(0,Number(asset.usageCycles)||0)+Number(event.cycles);
   if(Number(asset.maxUsageCycles)>0&&next.usageCycles>=Number(asset.maxUsageCycles))next.status="Under maintenance";
  }
 }else if(event.eventType==="Regrind"&&event.resourceType==="tooling"){
  if(Number(asset.regrindCount||0)>=Number(asset.maxRegrinds||0))throw new Error("Maximum regrind count has been reached.");
  next.regrindCount=Number(asset.regrindCount||0)+1;next.toolLifeUsedMinutes=0;next.toolLifeUsedCycles=0;next.status="Available";
 }else if(event.eventType==="Inspection"){
  next.lastInspectedAt=(event.occurredAt||new Date().toISOString()).slice(0,10);
  if(event.inspectionDueAt)next.inspectionDueAt=event.inspectionDueAt;
  if(event.inspectionResult==="Fail")next.status="Under maintenance";
  else if(event.inspectionResult==="Pass"&&asset.status==="Under maintenance")next.status="Available";
 }else if(event.eventType==="Repair"){
  next.status="Available";
 }else if(event.eventType==="Replacement"){
  if(event.resourceType==="tooling"){next.toolLifeUsedMinutes=0;next.toolLifeUsedCycles=0;next.regrindCount=0;}
  else next.usageCycles=0;
  next.status="Available";
 }
 return next;
}
