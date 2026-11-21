/**
 * Dependency-aware permanent deletion helpers for AXIMACH master records.
 * Keep shared masters (materials, vendors, process definitions and transport
 * rates) intact; remove only records that point to the deleted component/PO
 * or to one of its deleted route operations.
 */

const array = (value) => Array.isArray(value) ? value : [];

export function removeComponentDependents(data, componentIds) {
  const targets = new Set(array(componentIds).filter(Boolean));
  if (!targets.size) return data;

  const affectedLines = array(data.purchaseOrders).flatMap((po) =>
    array(po.lines)
      .filter((line) => targets.has(line.componentId))
      .map((line) => ({ poId: po.id, lineId: line.id }))
  );
  const lineIds = new Set(affectedLines.map((row) => row.lineId));
  const poIds = new Set(affectedLines.map((row) => row.poId));
  const removedOperationIds = new Set(
    array(data.operations)
      .filter((row) => targets.has(row.componentId) || lineIds.has(row.poLineId))
      .map((row) => row.id)
  );
  const removedQuoteIds = new Set(
    array(data.quotations)
      .filter((row) => targets.has(row.componentId) || lineIds.has(row.poLineId))
      .map((row) => row.id)
  );
  const removedTransportIds = new Set(
    array(data.transportLegs)
      .filter((row) => targets.has(row.componentId) || lineIds.has(row.poLineId))
      .map((row) => row.id)
  );
  const removedPaymentIds = new Set(
    array(data.paymentTransactions)
      .filter((row) => targets.has(row.componentId) || lineIds.has(row.poLineId))
      .map((row) => row.id)
  );
  const removedInspectionIds = new Set(
    array(data.inspectionMeasurements)
      .filter((row) => targets.has(row.componentId) || lineIds.has(row.poLineId))
      .map((row) => row.id)
  );
  const removedBomIds = new Set(
    array(data.bomLines).filter((row) => targets.has(row.componentId)).map((row) => row.id)
  );
  const removedPartIds = new Set(
    array(data.componentParts).filter((row) => targets.has(row.componentId)).map((row) => row.id)
  );
  const removedMaterialCostIds = new Set(
    array(data.materialCostEntries).filter((row) => targets.has(row.componentId)).map((row) => row.id)
  );

  // Legacy planned-cost rows without componentId are removed only when their
  // part number resolves uniquely. Ambiguous text-only rows are preserved.
  const components = array(data.components);
  const uniqueLegacyNumbers = new Set();
  for (const target of components.filter((row) => targets.has(row.id))) {
    const matches = components.filter((row) =>
      row.partNumber.trim().toLowerCase() === target.partNumber.trim().toLowerCase() &&
      (!target.companyId || row.companyId === target.companyId)
    );
    if (matches.length === 1) uniqueLegacyNumbers.add(target.partNumber.trim().toLowerCase());
  }

  const relatedIds = new Set([
    ...targets, ...poIds, ...lineIds, ...removedOperationIds, ...removedQuoteIds,
    ...removedTransportIds, ...removedPaymentIds, ...removedInspectionIds,
    ...removedBomIds, ...removedPartIds, ...removedMaterialCostIds
  ]);

  return {
    ...data,
    components: components.filter((row) => !targets.has(row.id)),
    purchaseOrders: array(data.purchaseOrders)
      .map((po) => ({
        ...po,
        lines: array(po.lines).filter((line) => !targets.has(line.componentId)),
        updatedAt: lineIds.size ? new Date().toISOString() : po.updatedAt
      }))
      .filter((po) => po.lines.length > 0),
    operations: array(data.operations).filter((row) => !removedOperationIds.has(row.id)),
    quotations: array(data.quotations).filter((row) => !removedQuoteIds.has(row.id)),
    transportLegs: array(data.transportLegs).filter((row) => !removedTransportIds.has(row.id)),
    paymentTransactions: array(data.paymentTransactions).filter((row) => !removedPaymentIds.has(row.id)),
    inspectionMeasurements: array(data.inspectionMeasurements).filter((row) => !removedInspectionIds.has(row.id)),
    bomLines: array(data.bomLines).filter((row) => !removedBomIds.has(row.id)),
    componentParts: array(data.componentParts).filter((row) => !removedPartIds.has(row.id)),
    materialCostEntries: array(data.materialCostEntries).filter((row) => !removedMaterialCostIds.has(row.id)),
    materialProcessLinks: array(data.materialProcessLinks).filter((row) =>
      !targets.has(row.componentId) && !lineIds.has(row.poLineId) && !removedOperationIds.has(row.operationId) && !removedBomIds.has(row.bomLineId)
    ),
    routeRelationships: array(data.routeRelationships).filter((row) =>
      !targets.has(row.componentId) && !lineIds.has(row.poLineId) &&
      !removedOperationIds.has(row.fromOperationId) && !removedOperationIds.has(row.toOperationId)
    ),
    inventoryTransactions: array(data.inventoryTransactions).filter((row) =>
      !(row.itemType === "component" && targets.has(row.itemId)) &&
      !lineIds.has(row.poLineId) && !removedOperationIds.has(row.operationId)
    ),
    plannedCosts: array(data.plannedCosts).filter((row) => {
      if (row.componentId) return !targets.has(row.componentId);
      const partNumber = (row.componentNumber || "").trim().toLowerCase();
      return !partNumber || !uniqueLegacyNumbers.has(partNumber);
    }),
    followUpAssignments: array(data.followUpAssignments).filter((row) => !relatedIds.has(row.recordId)),
  };
}

export function removePurchaseOrderDependents(data, purchaseOrderIds) {
  const targets = new Set(array(purchaseOrderIds).filter(Boolean));
  if (!targets.size) return data;

  const targetOrders = array(data.purchaseOrders).filter((po) => targets.has(po.id));
  const lineIds = new Set(targetOrders.flatMap((po) => array(po.lines).map((line) => line.id)));
  const operationIds = new Set(
    array(data.operations).filter((row) => targets.has(row.poId) || lineIds.has(row.poLineId)).map((row) => row.id)
  );
  const quoteIds = new Set(
    array(data.quotations).filter((row) => targets.has(row.poId) || lineIds.has(row.poLineId)).map((row) => row.id)
  );
  const transportIds = new Set(
    array(data.transportLegs).filter((row) => targets.has(row.poId) || lineIds.has(row.poLineId)).map((row) => row.id)
  );
  const paymentIds = new Set(
    array(data.paymentTransactions).filter((row) => targets.has(row.poId) || lineIds.has(row.poLineId)).map((row) => row.id)
  );
  const inspectionIds = new Set(
    array(data.inspectionMeasurements).filter((row) => targets.has(row.poId) || lineIds.has(row.poLineId)).map((row) => row.id)
  );
  const materialCostIds = new Set(
    array(data.materialCostEntries).filter((row) => targets.has(row.poId) || (row.poLineId && lineIds.has(row.poLineId))).map((row) => row.id)
  );

  const relatedIds = new Set([
    ...targets, ...lineIds, ...operationIds, ...quoteIds, ...transportIds,
    ...paymentIds, ...inspectionIds, ...materialCostIds
  ]);

  return {
    ...data,
    purchaseOrders: array(data.purchaseOrders).filter((row) => !targets.has(row.id)),
    operations: array(data.operations).filter((row) => !operationIds.has(row.id)),
    quotations: array(data.quotations).filter((row) => !quoteIds.has(row.id)),
    transportLegs: array(data.transportLegs).filter((row) => !transportIds.has(row.id)),
    paymentTransactions: array(data.paymentTransactions).filter((row) => !paymentIds.has(row.id)),
    inspectionMeasurements: array(data.inspectionMeasurements).filter((row) => !inspectionIds.has(row.id)),
    materialCostEntries: array(data.materialCostEntries).filter((row) => !materialCostIds.has(row.id)),
    materialProcessLinks: array(data.materialProcessLinks).filter((row) =>
      !targets.has(row.poId) && !lineIds.has(row.poLineId) &&
      !operationIds.has(row.operationId)
    ),
    routeRelationships: array(data.routeRelationships).filter((row) =>
      !targets.has(row.poId) && !lineIds.has(row.poLineId) &&
      !operationIds.has(row.fromOperationId) && !operationIds.has(row.toOperationId)
    ),
    inventoryTransactions: array(data.inventoryTransactions).filter((row) =>
      !targets.has(row.poId) && !lineIds.has(row.poLineId) && !operationIds.has(row.operationId)
    ),
    plannedCosts: array(data.plannedCosts).filter((row) =>
      !(row.poId && targets.has(row.poId)) && !(row.poLineId && lineIds.has(row.poLineId))
    ),
    followUpAssignments: array(data.followUpAssignments).filter((row) => !relatedIds.has(row.recordId)),
  };
}
