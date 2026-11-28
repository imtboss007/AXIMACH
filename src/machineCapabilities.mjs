function hasProcessCapability(machine, processDefinitionId) {
  const capabilities = Array.isArray(machine?.processDefinitionIds) ? machine.processDefinitionIds : [];
  return capabilities.length === 0 || Boolean(processDefinitionId && capabilities.includes(processDefinitionId));
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
  if (machine.deletedAt || (machine.status !== "Available" && !(existingAssignment && machine.status === "Running"))) {
    return { ok: false, reason: "machine-unavailable" };
  }
  if (!hasProcessCapability(machine, scope.processDefinitionId)) return { ok: false, reason: "process-capability-mismatch" };
  return { ok: true, reason: "" };
}

function scheduledRange(operation) {
  if (!operation?.plannedStart || !operation?.plannedEnd) return null;
  const start = Date.parse(operation.plannedStart);
  const end = Date.parse(operation.plannedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { invalid: true };
  return { start, end };
}

/** Check an internal machine reservation against all other active operations. */
export function validateMachineSchedule(candidate, operations = [], editingId = "") {
  if (!candidate?.machineId || candidate.executionType === "Outsourced" ||
      candidate.status === "Complete" || candidate.status === "Rejected" || candidate.deletedAt) {
    return { ok: true, reason: "" };
  }
  const range = scheduledRange(candidate);
  if (!range) return { ok: true, reason: "" };
  if (range.invalid) return { ok: false, reason: "invalid-time-window" };
  for (const other of Array.isArray(operations) ? operations : []) {
    if (!other || other.id === (editingId || candidate.id) || other.machineId !== candidate.machineId ||
        other.executionType === "Outsourced" || other.status === "Complete" || other.status === "Rejected" ||
        other.deletedAt) continue;
    const otherRange = scheduledRange(other);
    if (!otherRange || otherRange.invalid) continue;
    // Half-open intervals allow one operation to start exactly when the previous one ends.
    if (range.start < otherRange.end && otherRange.start < range.end) {
      return { ok: false, reason: "machine-time-conflict", conflictingOperationId: other.id };
    }
  }
  return { ok: true, reason: "" };
}
