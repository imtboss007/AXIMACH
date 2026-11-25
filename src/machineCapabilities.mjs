function hasProcessCapability(machine, processDefinitionId) {
  const capabilities = Array.isArray(machine?.processDefinitionIds) ? machine.processDefinitionIds : [];
  return !processDefinitionId || capabilities.length === 0 || capabilities.includes(processDefinitionId);
}

export function getEligibleMachineAssets(machines = [], scope = {}) {
  const rows = Array.isArray(machines) ? machines : [];
  const companyId = String(scope.companyId || "");
  const factoryId = String(scope.factoryId || "");
  const processDefinitionId = String(scope.processDefinitionId || "");
  const selectedMachineId = String(scope.selectedMachineId || "");
  if (!companyId || !factoryId) return [];
  return rows.filter(machine =>
    machine && !machine.deletedAt &&
    machine.companyId === companyId &&
    machine.factoryId === factoryId &&
    (machine.status === "Available" || (machine.id === selectedMachineId && machine.status === "Running")) &&
    hasProcessCapability(machine, processDefinitionId)
  ).sort((a,b)=>String(a.assetCode||"").localeCompare(String(b.assetCode||"")));
}

export function validateMachineAssignment(machine, scope = {}) {
  if (!scope.machineId) return { ok: true, reason: "" };
  if (scope.executionType === "Outsourced") return { ok: false, reason: "outsourced-operation" };
  if (!machine || machine.deletedAt || machine.id !== scope.machineId) return { ok: false, reason: "machine-not-found" };
  if (!scope.companyId || machine.companyId !== scope.companyId) return { ok: false, reason: "company-mismatch" };
  if (!scope.factoryId || machine.factoryId !== scope.factoryId) return { ok: false, reason: "factory-mismatch" };
  const existingAssignment = machine.id === scope.existingMachineId;
  if (machine.status !== "Available" && !(existingAssignment && machine.status === "Running")) {
    return { ok: false, reason: "machine-unavailable" };
  }
  if (!hasProcessCapability(machine, scope.processDefinitionId)) return { ok: false, reason: "process-capability-mismatch" };
  return { ok: true, reason: "" };
}
