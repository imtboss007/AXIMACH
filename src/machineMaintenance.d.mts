export type MachineAvailability = {
  status:string; activeDowntime:MachineDowntimeRecord|any|null;
  activeWorkOrder:MachineMaintenanceWorkOrderRecord|any|null;
  plannedOrder:MachineMaintenanceWorkOrderRecord|any|null; blocksProduction:boolean;
};
export function getMachineAvailability(machine:MachineRecord,workOrders:MachineMaintenanceWorkOrderRecord[],downtimeRecords:MachineDowntimeRecord[],at?:string):MachineAvailability;
export function validateMachineMaintenanceWindow(machineId:string,startValue:string,endValue:string,operations:OperationRecord[],workOrders:MachineMaintenanceWorkOrderRecord[],downtimeRecords:MachineDowntimeRecord[],editingWorkOrderId?:string):{ok:boolean;reason:string;conflictingRecordId?:string};
export function validateMachineSchedule(candidate:Partial<OperationRecord>,operations:OperationRecord[],editingId?:string,maintenanceWorkOrders?:MachineMaintenanceWorkOrderRecord[],downtimeRecords?:MachineDowntimeRecord[]):{ok:boolean;reason:string;conflictingOperationId?:string;conflictingMaintenanceId?:string;conflictingDowntimeId?:string};
