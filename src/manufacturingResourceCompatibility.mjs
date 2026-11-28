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
 return !capabilities.length||(Boolean(material)&&capabilities.includes(String(material).trim().toLowerCase()));
};
export function getEligibleToolingAssets(assets=[],scope={}){
 return asArray(assets).filter(asset=>
  asset&&!asset.deletedAt&&asset.companyId===scope.companyId&&asset.factoryId===scope.factoryId&&
  (asset.status==="Available"||((asset.id===scope.selectedId||asArray(scope.selectedIds).includes(asset.id))&&["In use","Needs regrind","Under maintenance"].includes(asset.status)))&&
  machineMatch(asset,scope.machineId,scope.machineType)&&hasProcess(asset,scope.processDefinitionId)&&materialMatch(asset,scope.material)&&
  ((asset.id===scope.selectedId||asArray(scope.selectedIds).includes(asset.id))||
   (!(Number(asset.toolLifeLimitMinutes)>0&&Number(asset.toolLifeUsedMinutes)>=Number(asset.toolLifeLimitMinutes))&&
    !(Number(asset.toolLifeLimitCycles)>0&&Number(asset.toolLifeUsedCycles)>=Number(asset.toolLifeLimitCycles))&&!dueIsPast(asset.inspectionDueAt)))
 ).sort((a,b)=>String(a.assetCode||"").localeCompare(String(b.assetCode||"")));
}
export function getEligibleFixtureAssets(assets=[],scope={}){
 return asArray(assets).filter(asset=>
  asset&&!asset.deletedAt&&asset.companyId===scope.companyId&&asset.factoryId===scope.factoryId&&
  (asset.status==="Available"||((asset.id===scope.selectedId||asArray(scope.selectedIds).includes(asset.id))&&["In use","Under maintenance"].includes(asset.status)))&&
  machineMatch(asset,scope.machineId,scope.machineType)&&hasProcess(asset,scope.processDefinitionId)&&
  (!asArray(asset.componentIds).length||asset.componentIds.includes(scope.componentId))&&
  ((asset.id===scope.selectedId||asArray(scope.selectedIds).includes(asset.id))||
   (!(Number(asset.maxUsageCycles)>0&&Number(asset.usageCycles)>=Number(asset.maxUsageCycles))&&!dueIsPast(asset.inspectionDueAt)))
 ).sort((a,b)=>String(a.assetCode||"").localeCompare(String(b.assetCode||"")));
}
export function validateOperationResourceAssignments({toolingIds=[],fixtureIds=[],toolingAssets=[],fixtureAssets=[],scope={}}={}){
 const unique=(values)=>Array.isArray(values)&&values.every(value=>typeof value==="string"&&value.trim())&&new Set(values).size===values.length;
 if(!unique(toolingIds)||!unique(fixtureIds))return {ok:false,reason:"duplicate-or-invalid-resource-id"};
 const tools=getEligibleToolingAssets(toolingAssets,{...scope,selectedIds:asArray(scope.existingToolingIds)});
 const fixtures=getEligibleFixtureAssets(fixtureAssets,{...scope,selectedIds:asArray(scope.existingFixtureIds)});
 if(toolingIds.some(id=>!tools.some(asset=>asset.id===id)))return {ok:false,reason:"tooling-unavailable-or-incompatible"};
 if(fixtureIds.some(id=>!fixtures.some(asset=>asset.id===id)))return {ok:false,reason:"fixture-unavailable-or-incompatible"};
 return {ok:true,reason:""};
}
export function applyResourceUsageEvent(asset,event,existingEvents=[]){
 if(!asset||!event||!Number.isFinite(Number(event.runtimeMinutes))||Number(event.runtimeMinutes)<0||!Number.isFinite(Number(event.cycles))||Number(event.cycles)<0)throw new Error("Invalid resource usage event.");
 if(!["tooling","fixture"].includes(event.resourceType))throw new Error("Invalid resource type.");
 if(event.resourceId&&event.resourceId!==asset.id)throw new Error("Resource usage event does not match the selected asset.");
 if(event.id&&asArray(existingEvents).some(row=>row?.id===event.id))throw new Error("This resource usage event has already been applied.");
 const isTooling=event.resourceType==="tooling";
 const allowed=isTooling?["Production use","Regrind","Inspection","Repair","Replacement"]:["Production use","Inspection","Repair","Replacement"];
 if(!allowed.includes(event.eventType))throw new Error("This event type is not valid for the selected resource.");
 if(asset.status==="Retired")throw new Error("Retired resources cannot be returned to service. Create a new asset record for a replacement.");
 const next={...asset,updatedAt:event.occurredAt||new Date().toISOString()};
 const lifeAlreadyExhausted=isTooling
  ?(Number(asset.toolLifeLimitMinutes)>0&&Number(asset.toolLifeUsedMinutes)>=Number(asset.toolLifeLimitMinutes))||(Number(asset.toolLifeLimitCycles)>0&&Number(asset.toolLifeUsedCycles)>=Number(asset.toolLifeLimitCycles))
  :(Number(asset.maxUsageCycles)>0&&Number(asset.usageCycles)>=Number(asset.maxUsageCycles));
 if(event.eventType==="Production use"){
  if(asset.status!=="Available"&&asset.status!=="In use")throw new Error("Resource is not available for production use.");
  if(lifeAlreadyExhausted)throw new Error(isTooling?"Tool life limit has already been reached; regrind or replace the tool before further use.":"Fixture usage limit has already been reached; inspect or replace the fixture before further use.");
  if(isTooling){
   if(Number(event.runtimeMinutes)===0&&Number(event.cycles)===0)throw new Error("Record positive runtime or production cycles for tooling use.");
   next.toolLifeUsedMinutes=Math.max(0,Number(asset.toolLifeUsedMinutes)||0)+Number(event.runtimeMinutes);
   next.toolLifeUsedCycles=Math.max(0,Number(asset.toolLifeUsedCycles)||0)+Number(event.cycles);
   if((Number(asset.toolLifeLimitMinutes)>0&&next.toolLifeUsedMinutes>=Number(asset.toolLifeLimitMinutes))||(Number(asset.toolLifeLimitCycles)>0&&next.toolLifeUsedCycles>=Number(asset.toolLifeLimitCycles)))next.status="Needs regrind";
  }else{
   if(Number(event.cycles)===0)throw new Error("Record positive production cycles for fixture use.");
   next.usageCycles=Math.max(0,Number(asset.usageCycles)||0)+Number(event.cycles);
   if(Number(asset.maxUsageCycles)>0&&next.usageCycles>=Number(asset.maxUsageCycles))next.status="Under maintenance";
  }
 }else if(event.eventType==="Regrind"&&isTooling){
  if(asset.status!=="Needs regrind")throw new Error("A regrind event can only be recorded for a tool flagged as Needs regrind.");
  if(Number(asset.regrindCount||0)>=Number(asset.maxRegrinds||0))throw new Error("Maximum regrind count has been reached.");
  next.regrindCount=Number(asset.regrindCount||0)+1;next.toolLifeUsedMinutes=0;next.toolLifeUsedCycles=0;next.status="Available";
 }else if(event.eventType==="Inspection"){
  next.lastInspectedAt=(event.occurredAt||new Date().toISOString()).slice(0,10);
  if(event.inspectionDueAt)next.inspectionDueAt=event.inspectionDueAt;
  if(event.inspectionResult==="Fail")next.status="Under maintenance";
  else if(event.inspectionResult==="Pass"&&asset.status==="Under maintenance")next.status=lifeAlreadyExhausted?(isTooling?"Needs regrind":"Under maintenance"):"Available";
 }else if(event.eventType==="Repair"){
  if(asset.status!=="Under maintenance")throw new Error("Repair can only release a resource that is under maintenance.");
  next.status=lifeAlreadyExhausted?(isTooling?"Needs regrind":"Under maintenance"):"Available";
 }else if(event.eventType==="Replacement"){
  if(asset.status!=="Under maintenance"&&asset.status!=="Needs regrind")throw new Error("Replacement can only be recorded for a quarantined or life-expired resource.");
  if(isTooling){next.toolLifeUsedMinutes=0;next.toolLifeUsedCycles=0;next.regrindCount=0;}else next.usageCycles=0;
  next.status="Available";
 }
 return next;
}
