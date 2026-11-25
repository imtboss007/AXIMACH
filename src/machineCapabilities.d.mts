export type MachineCapabilityAsset = {
  id:string; companyId:string; factoryId:string; assetCode:string; name:string; machineType:string;
  processDefinitionIds?:string[]; status:string; deletedAt?:string;
};
export type MachineAssignmentScope = {
  companyId?:string; factoryId?:string; processDefinitionId?:string;
  machineId?:string; selectedMachineId?:string; existingMachineId?:string;
  executionType?:"Internal"|"Outsourced";
};
export function getEligibleMachineAssets<T extends MachineCapabilityAsset>(
  machines:T[],
  scope:MachineAssignmentScope
):T[];
export function validateMachineAssignment(
  machine:MachineCapabilityAsset|undefined,
  scope:MachineAssignmentScope
):{ok:boolean;reason:string};
