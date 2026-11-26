import type {
  ProductionOperatorRecord,ProductionAssignmentRecord,PurchaseOrderRecord,
  ComponentRecord,OperationRecord,MachineRecord,MachineMaintenanceWorkOrderRecord,MachineDowntimeRecord
} from "./manufacturingData";
export function getEligibleProductionOperators(
 operators:ProductionOperatorRecord[],
 scope:{companyId:string;factoryId:string;processDefinitionId?:string;machineType?:string}
):ProductionOperatorRecord[];
export function validateProductionAssignment(
 candidate:ProductionAssignmentRecord,
 context:{
  purchaseOrders:PurchaseOrderRecord[];components:ComponentRecord[];operations:OperationRecord[];
  machines:MachineRecord[];operators:ProductionOperatorRecord[];assignments:ProductionAssignmentRecord[];
  maintenanceWorkOrders?:MachineMaintenanceWorkOrderRecord[];machineDowntime?:MachineDowntimeRecord[];
  editingId?:string;
 }
):{ok:boolean;reason:string};
export function getOperationAssignmentTotals(assignments:ProductionAssignmentRecord[],operationId:string):{
 assignedQuantity:number;assignmentCount:number;activeCount:number;runningCount:number;completedCount:number;
};
