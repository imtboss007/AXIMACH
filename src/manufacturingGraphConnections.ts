import type { Connection } from "@xyflow/react";
import {
  activeRows, makeId, nowIso,
  type ManufacturingData, type RouteRelationshipRecord, type RouteRelationshipType
} from "./manufacturingData";
import { validateOperationResourceAssignments } from "./manufacturingResourceCompatibility.mjs";

export type ManufacturingGraphScope = {
  companyId?:string;
  poId:string;
  poLineId:string;
  componentId:string;
};
type UpdateData = (updater:(current:ManufacturingData)=>ManufacturingData)=>void;
type Options = {
  data:ManufacturingData;
  connection:Connection;
  relationshipType:string;
  scope:ManufacturingGraphScope;
  update:UpdateData;
  onNotice:(message:string)=>void;
};

const ROUTE_TYPES:RouteRelationshipType[]=[
  "main","alternate","rework","dependency","parallel","merge","split",
  "follow-on","feedback","conditional","successor"
];

function afterPrefix(value:string,prefixes:string[]):string{
  const prefix=prefixes.find(candidate=>value.startsWith(candidate));
  return prefix?value.slice(prefix.length):"";
}
function inScope(row:{poId?:string;poLineId?:string;componentId?:string},scope:ManufacturingGraphScope):boolean{
  return row.poId===scope.poId&&row.poLineId===scope.poLineId&&row.componentId===scope.componentId;
}

/**
 * Shared connection contract for Route Flow and Manufacturing Universe.
 * A graph line is persisted to the canonical manufacturing record that owns it:
 * operation links -> routeRelationships; material feeds -> anchorOperationId;
 * vehicle legs -> anchorOperationId/targetOperationId; inspections -> operationId;
 * vendor/process links -> the owning operation/material/transport record.
 */
export function connectManufacturingGraphNodes({
  data,connection,relationshipType,scope,update,onNotice
}:Options):void{
  const source=connection.source||"",target=connection.target||"";
  if(!source||!target||source===target){onNotice("Connect two different manufacturing records.");return;}
  if(!scope.poId||!scope.poLineId||!scope.componentId){
    onNotice("Select one company, purchase order and component line before editing its manufacturing graph.");
    return;
  }

  const sourceOperationId=afterPrefix(source,["operation:"])||source;
  const targetOperationId=afterPrefix(target,["operation:"])||target;
  const sourceOperation=activeRows(data.operations).find(row=>row.id===sourceOperationId&&inScope(row,scope));
  const targetOperation=activeRows(data.operations).find(row=>row.id===targetOperationId&&inScope(row,scope));
  const sourceInboundMaterialId=afterPrefix(source,["material-transport:","material-transport-"]);
  const targetInboundMaterialId=afterPrefix(target,["material-transport:","material-transport-"]);
  const sourceMaterialLinkId=afterPrefix(source,["material-link:"]);
  const targetMaterialLinkId=afterPrefix(target,["material-link:"]);
  const sourceMaterialId=sourceInboundMaterialId||sourceMaterialLinkId?"":afterPrefix(source,["material:","material-"]);
  const targetMaterialId=targetInboundMaterialId||targetMaterialLinkId?"":afterPrefix(target,["material:","material-"]);
  const sourceTransportId=afterPrefix(source,["transport:","transport-"]);
  const targetTransportId=afterPrefix(target,["transport:","transport-"]);
  const sourceQualityId=afterPrefix(source,["quality:"]);
  const targetQualityId=afterPrefix(target,["quality:"]);
  const sourceVendorId=afterPrefix(source,["vendor:"]);
  const targetVendorId=afterPrefix(target,["vendor:"]);
  const sourceProcessId=afterPrefix(source,["process:"]);
  const targetProcessId=afterPrefix(target,["process:"]);

  const materialId=sourceMaterialId||targetMaterialId||sourceInboundMaterialId||targetInboundMaterialId;
  const material=materialId?activeRows(data.materialCostEntries).find(row=>row.id===materialId&&inScope(row,scope)):undefined;
  const materialProcessLinkId=sourceMaterialLinkId||targetMaterialLinkId;
  const materialProcessLink=materialProcessLinkId?activeRows(data.materialProcessLinks||[]).find(row=>row.id===materialProcessLinkId&&inScope(row,scope)):undefined;
  const isInboundMaterialTransport=Boolean(sourceInboundMaterialId||targetInboundMaterialId);
  const transportId=sourceTransportId||targetTransportId;
  const transport=transportId?activeRows(data.transportLegs).find(row=>row.id===transportId&&inScope(row,scope)):undefined;
  const qualityId=sourceQualityId||targetQualityId;
  const quality=qualityId?activeRows(data.inspectionMeasurements).find(row=>row.id===qualityId&&inScope(row,scope)):undefined;
  const vendorId=sourceVendorId||targetVendorId;
  const vendor=vendorId?activeRows(data.vendors).find(row=>row.id===vendorId):undefined;
  const processId=sourceProcessId||targetProcessId;
  const process=processId?activeRows(data.processDefinitions).find(row=>row.id===processId):undefined;
  const sourceToolingId=afterPrefix(source,["tooling:"]);
  const targetToolingId=afterPrefix(target,["tooling:"]);
  const sourceFixtureId=afterPrefix(source,["fixture:"]);
  const targetFixtureId=afterPrefix(target,["fixture:"]);
  const toolingId=sourceToolingId||targetToolingId;
  const fixtureId=sourceFixtureId||targetFixtureId;
  const selectedPO=activeRows(data.purchaseOrders).find(row=>row.id===scope.poId);
  const tooling=toolingId?activeRows(data.toolingAssets||[]).find(row=>row.id===toolingId&&row.companyId===selectedPO?.companyId&&row.factoryId===selectedPO?.factoryId):undefined;
  const fixture=fixtureId?activeRows(data.fixtureAssets||[]).find(row=>row.id===fixtureId&&row.companyId===selectedPO?.companyId&&row.factoryId===selectedPO?.factoryId):undefined;
  const sourceMachineId=afterPrefix(source,["machine:"]);
  const targetMachineId=afterPrefix(target,["machine:"]);
  const machineId=sourceMachineId||targetMachineId;
  const machine=machineId?activeRows(data.machines||[]).find(row=>row.id===machineId&&row.companyId===selectedPO?.companyId&&row.factoryId===selectedPO?.factoryId):undefined;
  const sourceComponentId=afterPrefix(source,["component:"]);
  const targetComponentId=afterPrefix(target,["component:"]);
  const componentId=sourceComponentId||targetComponentId;
  const component=componentId?activeRows(data.components||[]).find(row=>row.id===componentId&&(!row.companyId||row.companyId===selectedPO?.companyId)):undefined;

  if(sourceOperation&&targetOperation){
    if(!ROUTE_TYPES.includes(relationshipType as RouteRelationshipType)){
      onNotice("Choose a route relationship type for operation-to-operation connections.");
      return;
    }
    const type=relationshipType as RouteRelationshipType;
    const duplicate=activeRows(data.routeRelationships||[]).some(row=>
      row.fromOperationId===sourceOperation.id&&row.toOperationId===targetOperation.id
      &&row.relationshipType===type&&row.status!=="Disabled"&&inScope(row,scope)
    );
    if(duplicate){onNotice("That typed route relationship already exists.");return;}
    const stamp=nowIso();
    const record:RouteRelationshipRecord={
      id:makeId("route-relationship"),poId:scope.poId,poLineId:scope.poLineId,componentId:scope.componentId,
      fromOperationId:sourceOperation.id,toOperationId:targetOperation.id,relationshipType:type,
      status:type==="rework"||type==="conditional"?"Conditional":"Active",
      condition:"",label:type.toUpperCase(),notes:"Created from the shared manufacturing graph connector.",
      createdAt:stamp,updatedAt:stamp
    };
    update(current=>({...current,routeRelationships:[...(current.routeRelationships||[]),record]}));
    onNotice("Saved "+type+" connection: "+sourceOperation.name+" → "+targetOperation.name+".");
    return;
  }

  if((tooling||fixture)&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    const po=activeRows(data.purchaseOrders).find(row=>row.id===operation.poId);
    const resource=tooling||fixture;
    const componentRecord=activeRows(data.components||[]).find(row=>row.id===operation.componentId);
    const operationMachine=operation.machineId?activeRows(data.machines||[]).find(row=>row.id===operation.machineId):undefined;
    if(operation.executionType==="Outsourced"){
      onNotice("Outsourced operations cannot reserve company-owned tooling or fixtures.");
      return;
    }
    if(!po||resource.companyId!==po.companyId||resource.factoryId!==po.factoryId){
      onNotice("The tooling or fixture must belong to the selected operation's company and factory.");
      return;
    }
    const nextToolingIds=[...new Set([...(operation.toolingAssetIds||[]),...(tooling?[tooling.id]:[])])];
    const nextFixtureIds=[...new Set([...(operation.fixtureAssetIds||[]),...(fixture?[fixture.id]:[])])];
    const resourceCheck=validateOperationResourceAssignments({
      toolingIds:nextToolingIds,fixtureIds:nextFixtureIds,
      toolingAssets:activeRows(data.toolingAssets||[]),fixtureAssets:activeRows(data.fixtureAssets||[]),
      scope:{
        companyId:po.companyId,factoryId:po.factoryId,machineId:operation.machineId||undefined,machineType:operationMachine?.machineType,
        processDefinitionId:operation.processDefinitionId,material:componentRecord?.material,componentId:operation.componentId,
        existingToolingIds:operation.toolingAssetIds||[],existingFixtureIds:operation.fixtureAssetIds||[]
      }
    });
    if(!resourceCheck.ok){
      onNotice("This tooling or fixture is unavailable, overdue, out of life or incompatible with the operation's machine, process, material or component.");
      return;
    }
    if(tooling){
      if((operation.toolingAssetIds||[]).includes(tooling.id)){onNotice(tooling.assetCode+" is already assigned to "+operation.name+".");return;}
      update(current=>({...current,operations:current.operations.map(row=>row.id===operation.id?{...row,toolingAssetIds:nextToolingIds,updatedAt:nowIso()}:row)}));
      onNotice("Reserved tooling "+tooling.assetCode+" for "+operation.name+". The operation record is updated.");
    }else{
      if((operation.fixtureAssetIds||[]).includes(fixture!.id)){onNotice(fixture!.assetCode+" is already assigned to "+operation.name+".");return;}
      update(current=>({...current,operations:current.operations.map(row=>row.id===operation.id?{...row,fixtureAssetIds:nextFixtureIds,updatedAt:nowIso()}:row)}));
      onNotice("Reserved fixture "+fixture!.assetCode+" for "+operation.name+". The operation record is updated.");
    }
    return;
  }

  if((tooling||fixture)&&machine){
    const resource=tooling||fixture;
    if(resource.companyId!==machine.companyId||resource.factoryId!==machine.factoryId){
      onNotice("A tooling or fixture asset and its compatible machine must belong to the same company and factory.");
      return;
    }
    if(tooling){
      if((tooling.compatibleMachineIds||[]).includes(machine.id)){onNotice(machine.assetCode+" is already compatible with "+tooling.assetCode+".");return;}
      update(current=>({...current,toolingAssets:(current.toolingAssets||[]).map(row=>row.id===tooling.id?{...row,compatibleMachineIds:[...new Set([...(row.compatibleMachineIds||[]),machine.id])],updatedAt:nowIso()}:row)}));
      onNotice("Linked "+machine.assetCode+" as a compatible machine for tooling "+tooling.assetCode+".");
    }else{
      if((fixture!.compatibleMachineIds||[]).includes(machine.id)){onNotice(machine.assetCode+" is already compatible with "+fixture!.assetCode+".");return;}
      update(current=>({...current,fixtureAssets:(current.fixtureAssets||[]).map(row=>row.id===fixture!.id?{...row,compatibleMachineIds:[...new Set([...(row.compatibleMachineIds||[]),machine.id])],updatedAt:nowIso()}:row)}));
      onNotice("Linked "+machine.assetCode+" as a compatible machine for fixture "+fixture!.assetCode+".");
    }
    return;
  }

  if((tooling||fixture)&&process){
    if(tooling){
      if((tooling.processDefinitionIds||[]).includes(process.id)){onNotice(process.processType+" is already linked to "+tooling.assetCode+".");return;}
      update(current=>({...current,toolingAssets:(current.toolingAssets||[]).map(row=>row.id===tooling.id?{...row,processDefinitionIds:[...new Set([...(row.processDefinitionIds||[]),process.id])],updatedAt:nowIso()}:row)}));
      onNotice("Linked Process Directory definition "+process.processType+" to tooling "+tooling.assetCode+".");
    }else{
      if((fixture!.processDefinitionIds||[]).includes(process.id)){onNotice(process.processType+" is already linked to "+fixture!.assetCode+".");return;}
      update(current=>({...current,fixtureAssets:(current.fixtureAssets||[]).map(row=>row.id===fixture!.id?{...row,processDefinitionIds:[...new Set([...(row.processDefinitionIds||[]),process.id])],updatedAt:nowIso()}:row)}));
      onNotice("Linked Process Directory definition "+process.processType+" to fixture "+fixture!.assetCode+".");
    }
    return;
  }

  if(fixture&&component){
    if(component.companyId&&component.companyId!==fixture.companyId){onNotice("This fixture and component belong to different companies.");return;}
    if((fixture.componentIds||[]).includes(component.id)){onNotice(component.partNumber+" is already linked to "+fixture.assetCode+".");return;}
    update(current=>({...current,fixtureAssets:(current.fixtureAssets||[]).map(row=>row.id===fixture.id?{...row,componentIds:[...new Set([...(row.componentIds||[]),component.id])],updatedAt:nowIso()}:row)}));
    onNotice("Linked component "+(component.partNumber||component.name)+" to fixture "+fixture.assetCode+".");
    return;
  }

  if(materialProcessLink&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    update(current=>({...current,materialProcessLinks:(current.materialProcessLinks||[]).map(row=>
      row.id===materialProcessLink.id?{...row,operationId:operation.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Linked BOM material "+materialProcessLink.materialId+" to "+operation.name+". The material-process link is saved.");
    return;
  }

  if(material&&(sourceOperation||targetOperation)&&(sourceMaterialId||targetMaterialId||sourceInboundMaterialId||targetInboundMaterialId)){
    const operation=sourceOperation||targetOperation!;
    const allocationId=material.id;
    update(current=>({...current,materialCostEntries:current.materialCostEntries.map(row=>
      row.id===allocationId?{...row,anchorOperationId:operation.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Linked material "+material.materialName+" to "+operation.name+". The material feed is saved on its allocation record.");
    return;
  }

  if(transport&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    const isSourceOperation=Boolean(sourceOperation);
    update(current=>({...current,transportLegs:current.transportLegs.map(row=>row.id===transport.id?{
      ...row,
      ...(isSourceOperation?{anchorOperationId:operation.id,placement:"after" as const}:{targetOperationId:operation.id}),
      updatedAt:nowIso()
    }:row)}));
    onNotice(isSourceOperation
      ?"Connected "+operation.name+" to the transport leg."
      :"Connected the transport leg to "+operation.name+".");
    return;
  }

  if(quality&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    update(current=>({...current,inspectionMeasurements:current.inspectionMeasurements.map(row=>
      row.id===quality.id?{...row,operationId:operation.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Linked quality inspection "+quality.characteristic+" to "+operation.name+".");
    return;
  }

  if(vendor&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    update(current=>({...current,operations:current.operations.map(row=>
      row.id===operation.id?{...row,vendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" to "+operation.name+".");
    return;
  }

  if(material&&vendor&&isInboundMaterialTransport){
    update(current=>({...current,materialCostEntries:current.materialCostEntries.map(row=>
      row.id===material.id?{...row,transportVendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the carrier for inbound material transport.");
    return;
  }

  if(material&&vendor){
    update(current=>({...current,materialCostEntries:current.materialCostEntries.map(row=>
      row.id===material.id?{...row,vendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the material supplier for "+material.materialName+".");
    return;
  }

  if(materialProcessLink&&vendor){
    const materialRecord=activeRows(data.materials||[]).find(row=>row.id===materialProcessLink.materialId);
    if(!materialRecord){onNotice("The BOM material master record is missing. Open Material Directory and repair the reference.");return;}
    update(current=>({...current,materials:(current.materials||[]).map(row=>
      row.id===materialRecord.id?{...row,preferredVendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the preferred supplier for "+materialRecord.name+".");
    return;
  }

  if(transport&&vendor){
    update(current=>({...current,transportLegs:current.transportLegs.map(row=>
      row.id===transport.id?{...row,vendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the carrier for this transport leg.");
    return;
  }

  if(process&&vendor){
    if(process.vendorIds.includes(vendor.id)){
      onNotice(vendor.company+" is already linked to "+process.processType+".");
      return;
    }
    update(current=>({...current,processDefinitions:current.processDefinitions.map(row=>
      row.id===process.id?{...row,vendorIds:[...row.vendorIds,vendor.id],updatedAt:nowIso()}:row
    )}));
    onNotice("Linked "+vendor.company+" as a capable vendor for "+process.processType+".");
    return;
  }

  if(process&&(sourceOperation||targetOperation)){
    const operation=sourceOperation||targetOperation!;
    if(process.vendorIds.length&&!process.vendorIds.includes(operation.vendorId)){
      onNotice("The operation's current vendor is not linked to this Process Directory definition. Update vendor capability first.");
      return;
    }
    const subcategory=process.subcategories[0]||"";
    update(current=>({...current,operations:current.operations.map(row=>row.id===operation.id?{
      ...row,processDefinitionId:process.id,name:process.processType,category:process.category,
      subcategory,processSubcategoryId:process.subcategoryIds?.[0]||"",
      processColor:process.displayColor||row.processColor,updatedAt:nowIso()
    }:row)}));
    onNotice("Linked "+process.processType+" definition to "+operation.name+".");
    return;
  }

  onNotice("That connection is not valid for this manufacturing record type. Use operation, tooling, fixture, machine, process, material, transport, quality or vendor nodes.");
}
