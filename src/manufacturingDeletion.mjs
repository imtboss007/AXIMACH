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
  const removedMaterialLinkIds = new Set(
    array(data.materialProcessLinks).filter((row) =>
      targets.has(row.componentId) || lineIds.has(row.poLineId) || removedOperationIds.has(row.operationId)
    ).map((row) => row.id)
  );
  const removedRouteRelationshipIds = new Set(
    array(data.routeRelationships).filter((row) =>
      targets.has(row.componentId) || lineIds.has(row.poLineId) ||
      removedOperationIds.has(row.fromOperationId) || removedOperationIds.has(row.toOperationId)
    ).map((row) => row.id)
  );
  // Legacy planned-cost rows without componentId are removed only when the
  // part number resolves uniquely in their known company scope (or globally
  // when the legacy row has no company reference).
  const components = array(data.components);
  const uniqueLegacyGlobalNumbers = new Set();
  const uniqueLegacyCompanyNumbers = new Set();
  for (const target of components.filter((row) => targets.has(row.id))) {
    const number = target.partNumber.trim().toLowerCase();
    if (components.filter((row) => row.partNumber.trim().toLowerCase() === number).length === 1) {
      uniqueLegacyGlobalNumbers.add(number);
    }
    if (target.companyId && components.filter((row) =>
      row.partNumber.trim().toLowerCase() === number && row.companyId === target.companyId
    ).length === 1) {
      uniqueLegacyCompanyNumbers.add(target.companyId + "::" + number);
    }
  }

  const relatedIds = new Set([
    ...targets, ...lineIds, ...removedOperationIds, ...removedQuoteIds,
    ...removedTransportIds, ...removedPaymentIds, ...removedInspectionIds,
    ...removedBomIds, ...removedPartIds, ...removedMaterialCostIds,
    ...removedMaterialLinkIds, ...removedRouteRelationshipIds
  ]);

  return {
    ...data,
    components: components.filter((row) => !targets.has(row.id)),
    purchaseOrders: array(data.purchaseOrders)
      .map((po) => {
        const originalLines = array(po.lines);
        const lines = originalLines.filter((line) => !targets.has(line.componentId));
        if (originalLines.length > 0 && lines.length === 0) return null;
        return lines.length === originalLines.length ? po : { ...po, lines, updatedAt: new Date().toISOString() };
      })
      .filter(Boolean),
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
    // Physical stock movements are accounting/quantity history, not disposable
    // master links. Keep every movement and clear only references that this
    // deletion actually removes. Old component IDs remain visible as archived
    // items in the ledger so the historical balance is not silently lost.
    inventoryTransactions: array(data.inventoryTransactions).map((row) => ({
      ...row,
      ...(lineIds.has(row.poLineId) ? { poLineId: "" } : {}),
      ...(removedOperationIds.has(row.operationId) ? { operationId: "" } : {}),
      ...(array(data.purchaseOrders).some(po => po.id === row.poId && array(po.lines).length > 0 && array(po.lines).every(line => targets.has(line.componentId)))
        ? { poId: "" }
        : {})
    })),
    plannedCosts: array(data.plannedCosts).filter((row) => {
      if (row.componentId) return !targets.has(row.componentId);
      const partNumber = (row.componentNumber || "").trim().toLowerCase();
      if (!partNumber) return true;
      return row.companyId
        ? !uniqueLegacyCompanyNumbers.has(row.companyId + "::" + partNumber)
        : !uniqueLegacyGlobalNumbers.has(partNumber);
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
    // Preserve posted stock movements after a PO is deleted. Remove only
    // obsolete document and operation references; retain the actual ledger row.
    inventoryTransactions: array(data.inventoryTransactions).map((row) => ({
      ...row,
      ...(targets.has(row.poId) ? { poId: "" } : {}),
      ...(lineIds.has(row.poLineId) ? { poLineId: "" } : {}),
      ...(operationIds.has(row.operationId) ? { operationId: "" } : {})
    })),
    plannedCosts: array(data.plannedCosts).filter((row) =>
      !(row.poId && targets.has(row.poId)) && !(row.poLineId && lineIds.has(row.poLineId))
    ),
    followUpAssignments: array(data.followUpAssignments).filter((row) => !relatedIds.has(row.recordId)),
  };
}
