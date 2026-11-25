import type { Connection } from "@xyflow/react";
import {
  activeRows, makeId, nowIso,
  type ManufacturingData, type RouteRelationshipRecord, type RouteRelationshipType
} from "./manufacturingData";

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
  const sourceMaterialId=sourceInboundMaterialId?"":afterPrefix(source,["material:","material-"]);
  const targetMaterialId=targetInboundMaterialId?"":afterPrefix(target,["material:","material-"]);
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
  const transportId=sourceTransportId||targetTransportId;
  const transport=transportId?activeRows(data.transportLegs).find(row=>row.id===transportId&&inScope(row,scope)):undefined;
  const qualityId=sourceQualityId||targetQualityId;
  const quality=qualityId?activeRows(data.inspectionMeasurements).find(row=>row.id===qualityId&&inScope(row,scope)):undefined;
  const vendorId=sourceVendorId||targetVendorId;
  const vendor=vendorId?activeRows(data.vendors).find(row=>row.id===vendorId):undefined;
  const processId=sourceProcessId||targetProcessId;
  const process=processId?activeRows(data.processDefinitions).find(row=>row.id===processId):undefined;

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

  if(material&&vendor){
    update(current=>({...current,materialCostEntries:current.materialCostEntries.map(row=>
      row.id===material.id?{...row,vendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the material supplier for "+material.materialName+".");
    return;
  }

  if(transport&&vendor){
    update(current=>({...current,transportLegs:current.transportLegs.map(row=>
      row.id===transport.id?{...row,vendorId:vendor.id,updatedAt:nowIso()}:row
    )}));
    onNotice("Assigned "+vendor.company+" as the carrier for this transport leg.");
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

  onNotice("That connection is not valid for this manufacturing record type. Use process, material, transport, quality, vendor or Process Directory nodes.");
}
