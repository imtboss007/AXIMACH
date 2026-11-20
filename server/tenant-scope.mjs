const ARRAY_FIELDS = Object.freeze([
 "companies","factories","purchaseOrders","components","vendors","operations","quotations","materials",
 "componentParts","materialCostEntries","bomLines","materialProcessLinks","inventoryTransactions",
 "contactProfiles","processDefinitions","plannedCosts","transportRoutes","transportLegs",
 "paymentTransactions","inspectionMeasurements","routeRelationships","followUpAssignments"
]);
const MASTER_FIELDS = new Set(["vendors","materials","processDefinitions","transportRoutes"]);
const setOf = values => new Set(Array.isArray(values) ? values.filter(value => typeof value === "string" && value) : []);
const rows = (data, field) => Array.isArray(data?.[field]) ? data[field] : [];
const ids = (items, property = "id") => new Set(items.map(item => item?.[property]).filter(value => typeof value === "string" && value));

export function hasTenantScope(user) {
 return user?.legacy === true || user?.role === "admin" ||
   (Array.isArray(user?.companyIds) && user.companyIds.length > 0) ||
   (Array.isArray(user?.factoryIds) && user.factoryIds.length > 0);
}

function resolveAccess(data, user) {
 const assignedCompanies = setOf(user?.companyIds);
 const assignedFactories = setOf(user?.factoryIds);
 const factoryRows = rows(data,"factories");
 const companyIds = new Set(assignedCompanies);
 for (const factory of factoryRows) if (assignedFactories.has(factory.id) && factory.companyId) companyIds.add(factory.companyId);

 const factoryIds = new Set();
 for (const factory of factoryRows) {
  if (assignedFactories.size ? assignedFactories.has(factory.id) : companyIds.has(factory.companyId)) factoryIds.add(factory.id);
 }
 // Explicit factory scopes remain valid even when the factory master row is archived or missing.
 for (const id of assignedFactories) factoryIds.add(id);
 const factoryAllowed = id => Boolean(id) && factoryIds.has(id);
 const companyAllowed = id => Boolean(id) && companyIds.has(id);
 const candidatePurchaseOrders = rows(data,"purchaseOrders").filter(po =>
  companyAllowed(po.companyId) && factoryAllowed(po.factoryId)
 );
 const allComponentOwners = new Map();
 for (const po of rows(data,"purchaseOrders")) {
  for (const line of rows(po,"lines")) {
   if (!line?.componentId) continue;
   if (!allComponentOwners.has(line.componentId)) allComponentOwners.set(line.componentId,new Set());
   allComponentOwners.get(line.componentId).add(po.companyId);
  }
 }
 const candidateComponentIds = new Set(candidatePurchaseOrders.flatMap(po => rows(po,"lines").map(line => line.componentId).filter(Boolean)));
 const components = rows(data,"components").filter(component =>
  component.companyId ? companyAllowed(component.companyId) :
   candidateComponentIds.has(component.id) && [...(allComponentOwners.get(component.id)||[])].every(companyAllowed)
 );
 const componentIds = ids(components);
 const purchaseOrders = candidatePurchaseOrders.filter(po =>
  rows(po,"lines").every(line => componentIds.has(line.componentId))
 );
 const purchaseOrderIds = ids(purchaseOrders);
 const lineIds = new Set(purchaseOrders.flatMap(po => rows(po,"lines").map(line => line.id).filter(Boolean)));
 const operations = rows(data,"operations").filter(operation =>
  purchaseOrderIds.has(operation.poId) &&
  lineIds.has(operation.poLineId) &&
  componentIds.has(operation.componentId)
 );
 const operationIds = ids(operations);
 const quotations = rows(data,"quotations").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.operationId)
 );
 const transportLegs = rows(data,"transportLegs").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.anchorOperationId) && (!row.targetOperationId || operationIds.has(row.targetOperationId))
 );
 const routeRelationships = rows(data,"routeRelationships").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.fromOperationId) && operationIds.has(row.toOperationId)
 );
 const paymentTransactions = rows(data,"paymentTransactions").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.operationId)
 );
 const inspectionMeasurements = rows(data,"inspectionMeasurements").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.operationId)
 );
 const materialProcessLinks = rows(data,"materialProcessLinks").filter(row =>
  companyAllowed(row.companyId) && purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) &&
  componentIds.has(row.componentId) && operationIds.has(row.operationId)
 );
 const inventoryTransactions = rows(data,"inventoryTransactions").filter(row =>
  companyAllowed(row.companyId) && factoryAllowed(row.factoryId) &&
  (!row.poId || purchaseOrderIds.has(row.poId)) &&
  (!row.poLineId || lineIds.has(row.poLineId)) &&
  (!row.operationId || operationIds.has(row.operationId)) &&
  (row.itemType !== "component" || componentIds.has(row.itemId))
 );
 const componentParts = rows(data,"componentParts").filter(row =>
  componentIds.has(row.componentId) && (!row.companyId || companyAllowed(row.companyId))
 );
 const bomLines = rows(data,"bomLines").filter(row => componentIds.has(row.componentId));
 const componentPartIds = ids(componentParts);
 const materialCostEntries = rows(data,"materialCostEntries").filter(row =>
  (row.companyId ? companyAllowed(row.companyId) : row.poId ? purchaseOrderIds.has(row.poId) : componentIds.has(row.componentId)) &&
  (!row.poId || purchaseOrderIds.has(row.poId)) &&
  (!row.poLineId || lineIds.has(row.poLineId)) &&
  (!row.componentId || componentIds.has(row.componentId)) &&
  (!row.partId || componentPartIds.has(row.partId)) &&
  (!row.anchorOperationId || operationIds.has(row.anchorOperationId))
 );
 const materialIds = new Set([
  ...componentParts.flatMap(row => [...(Array.isArray(row.materialIds) ? row.materialIds : []),row.materialId].filter(Boolean)),
  ...bomLines.map(row => row.materialId).filter(Boolean),
  ...materialCostEntries.map(row => row.materialId).filter(Boolean),
  ...materialProcessLinks.map(row => row.materialId).filter(Boolean),
  ...inventoryTransactions.filter(row => row.itemType === "material").map(row => row.itemId)
 ]);
 const materials = rows(data,"materials").filter(row => materialIds.has(row.id));
 const vendorIds = new Set([
  ...operations.flatMap(row => [row.vendorId,row.transportVendorId]).filter(Boolean),
  ...quotations.map(row => row.vendorId).filter(Boolean),
  ...transportLegs.map(row => row.vendorId).filter(Boolean),
  ...inventoryTransactions.map(row => row.vendorId).filter(Boolean),
  ...materials.map(row => row.preferredVendorId).filter(Boolean)
 ]);
 const vendors = rows(data,"vendors").filter(row => vendorIds.has(row.id));
 const processDefinitionIds = ids(operations.map(row => ({id:row.processDefinitionId})).filter(row => row.id));
 const processDefinitions = rows(data,"processDefinitions").filter(row => processDefinitionIds.has(row.id));
 const transportRouteIds = ids(transportLegs.map(row => ({id:row.routeId})).filter(row => row.id));
 const transportRoutes = rows(data,"transportRoutes").filter(row => transportRouteIds.has(row.id));
 const companies = rows(data,"companies").filter(row => companyAllowed(row.id));
 const factories = factoryRows.filter(row => factoryIds.has(row.id) && companyAllowed(row.companyId));
 const plannedCosts = rows(data,"plannedCosts").filter(row =>
  (row.companyId ? companyAllowed(row.companyId) : row.poId ? purchaseOrderIds.has(row.poId) : componentIds.has(row.componentId)) &&
  (!row.poId || purchaseOrderIds.has(row.poId)) &&
  (!row.componentId || componentIds.has(row.componentId)) &&
  (!row.processDefinitionId || processDefinitionIds.has(row.processDefinitionId))
 );
 const contactProfiles = rows(data,"contactProfiles").filter(row =>
  (row.linkedType === "company" && companyAllowed(row.linkedId)) ||
  (row.linkedType === "vendor" && vendorIds.has(row.linkedId))
 );
 const entityIds = new Set([
  ...ids(companies),...ids(factories),...purchaseOrderIds,...lineIds,...componentIds,
  ...operationIds,...ids(quotations),...ids(transportLegs),...ids(routeRelationships),
  ...ids(paymentTransactions),...ids(inspectionMeasurements),...ids(materialProcessLinks),
  ...ids(inventoryTransactions),...ids(componentParts),...ids(bomLines),...ids(materialCostEntries),
  ...ids(contactProfiles),...ids(vendors),...ids(materials),...ids(processDefinitions),...ids(transportRoutes)
 ]);
 const contactProfileIds = ids(contactProfiles);
 const followUpAssignments = rows(data,"followUpAssignments").filter(row =>
  entityIds.has(row.recordId) && (!row.contactId || contactProfileIds.has(row.contactId))
 );
 return {
  companyIds, factoryIds, purchaseOrderIds, lineIds, componentIds, operationIds, vendorIds,
  materialIds, processDefinitionIds, transportRouteIds, entityIds,
  companies,factories,purchaseOrders,components,operations,quotations,transportLegs,routeRelationships,
  paymentTransactions,inspectionMeasurements,materialProcessLinks,inventoryTransactions,
  componentParts,bomLines,materialCostEntries,materials,vendors,processDefinitions,transportRoutes,
  plannedCosts,contactProfiles,followUpAssignments
 };
}

export function filterManufacturingData(data, user) {
 if (user?.legacy === true || user?.role === "admin") return data || null;
 const access = resolveAccess(data,user);
 return Object.fromEntries([
  ["updatedAt",String(data?.updatedAt || "")],
  ...ARRAY_FIELDS.map(field => [field,access[field] || []])
 ]);
}

function visibleIds(access, field) { return ids(access[field] || []); }
function allowedChild(row, poById, access, {requireOperation=false} = {}) {
 const po = poById.get(row.poId);
 if (!po || !access.purchaseOrderIds.has(po.id)) return false;
 if (!access.lineIds.has(row.poLineId)) return false;
 if (!access.componentIds.has(row.componentId)) return false;
 if (requireOperation && !access.operationIds.has(row.operationId)) return false;
 return true;
}

export function validateManufacturingWrite(currentData, incoming, user) {
 if (user?.legacy === true || user?.role === "admin") return {ok:true};
 if (!hasTenantScope(user)) return {ok:false,error:"This account has no company or factory scope assigned."};
 const access = resolveAccess(currentData,user);
 const companyIds = access.companyIds;
 const assignedFactories = setOf(user?.factoryIds);
 const incomingFactories = rows(incoming,"factories");
 const factoryById = new Map([...rows(currentData,"factories"),...incomingFactories].map(row => [row.id,row]));
 const factoryAllowed = id => {
  if (!id) return false;
  if (assignedFactories.size) return assignedFactories.has(id);
  return companyIds.has(factoryById.get(id)?.companyId);
 };
 const incomingComponents = rows(incoming,"components");
 const componentIds = new Set([
  ...access.componentIds,
  ...incomingComponents.filter(row => row.companyId && companyIds.has(row.companyId)).map(row => row.id)
 ]);
 const incomingPOs = rows(incoming,"purchaseOrders");
 const poById = new Map([...rows(currentData,"purchaseOrders"),...incomingPOs].map(po => [po.id,po]));
 const poAllowed = po => po && companyIds.has(po.companyId) && factoryAllowed(po.factoryId) &&
  rows(po,"lines").every(line => componentIds.has(line.componentId));
 const allowedPOIds = new Set([...rows(currentData,"purchaseOrders").filter(poAllowed),...incomingPOs.filter(poAllowed)].map(row => row.id));
 const allowedPOById = new Map([...poById].filter(([id,po]) => allowedPOIds.has(id)));
 const lines = new Set([...allowedPOById.values()].flatMap(po => rows(po,"lines").map(line=>line.id).filter(Boolean)));
 const currentVisibleComponents = access.componentIds;
 const currentOperationIds = access.operationIds;
 const incomingOperations = rows(incoming,"operations").filter(row =>
  allowedPOIds.has(row.poId) && lines.has(row.poLineId) && componentIds.has(row.componentId)
 );
 const operationIds = new Set([...currentOperationIds,...incomingOperations.map(row=>row.id)]);
 const vendorIds = access.vendorIds;
 const materialIds = access.materialIds;
 const processIds = access.processDefinitionIds;
 const transportRouteIds = access.transportRouteIds;
 const scopeIds = access.entityIds;
 const safeId = (collection,row) => {
  const prior = rows(currentData,collection).find(value=>value.id===row.id);
  if (!prior) return true;
  return visibleIds(access,collection).has(row.id);
 };
 const deny = collection => ({ok:false,error:collection+" contains a record outside this user's assigned company/factory scope."});
 for (const collection of ARRAY_FIELDS) {
  const values=rows(incoming,collection);
  if (MASTER_FIELDS.has(collection) && values.length) return {ok:false,error:collection+" is a shared master directory and can only be changed by an administrator."};
  for (const row of values) {
   if (!row || typeof row.id!=="string" || !row.id || !safeId(collection,row)) return deny(collection);
   let allowed=false;
   switch(collection) {
    case "companies": allowed=companyIds.has(row.id); break;
    case "factories": allowed=companyIds.has(row.companyId) && (!assignedFactories.size || assignedFactories.has(row.id)); break;
    case "purchaseOrders": allowed=Boolean(poAllowed(row)); break;
    case "components": allowed=(row.companyId && companyIds.has(row.companyId)) || currentVisibleComponents.has(row.id); break;
    case "operations": allowed=allowedPOIds.has(row.poId) && lines.has(row.poLineId) && componentIds.has(row.componentId) && (!row.vendorId || vendorIds.has(row.vendorId)) && (!row.transportVendorId || vendorIds.has(row.transportVendorId)) && (!row.processDefinitionId || processIds.has(row.processDefinitionId)) && (!row.transportRouteId || transportRouteIds.has(row.transportRouteId)); break;
    case "quotations": case "transportLegs": case "paymentTransactions": case "inspectionMeasurements":
     allowed=allowedChild(row,allowedPOById,{purchaseOrderIds:allowedPOIds,lineIds:lines,componentIds,operationIds},
       {requireOperation:collection==="quotations"||collection==="paymentTransactions"||collection==="inspectionMeasurements"}) &&
       (!row.vendorId || vendorIds.has(row.vendorId)) &&
       (collection!=="transportLegs" || (operationIds.has(row.anchorOperationId) && (!row.targetOperationId || operationIds.has(row.targetOperationId)) && transportRouteIds.has(row.routeId))); break;
    case "routeRelationships":
     allowed=allowedChild(row,allowedPOById,{purchaseOrderIds:allowedPOIds,lineIds:lines,componentIds,operationIds}) &&
       operationIds.has(row.fromOperationId) && operationIds.has(row.toOperationId); break;
    case "materialProcessLinks":
     allowed=companyIds.has(row.companyId) && allowedChild(row,allowedPOById,{purchaseOrderIds:allowedPOIds,lineIds:lines,componentIds,operationIds},{requireOperation:true}) &&
       materialIds.has(row.materialId); break;
    case "inventoryTransactions":
     allowed=companyIds.has(row.companyId) && factoryAllowed(row.factoryId) &&
       (!row.poId || allowedPOIds.has(row.poId)) && (!row.poLineId || lines.has(row.poLineId)) &&
       (!row.vendorId || vendorIds.has(row.vendorId)) &&
       (row.itemType==="component" ? componentIds.has(row.itemId) : materialIds.has(row.itemId)); break;
    case "componentParts": allowed=componentIds.has(row.componentId) && (!row.companyId || companyIds.has(row.companyId)) && (!row.materialId || materialIds.has(row.materialId)) && (Array.isArray(row.materialIds) ? row.materialIds.every(id=>materialIds.has(id)) : true) && (Array.isArray(row.vendorIds) ? row.vendorIds.every(id=>vendorIds.has(id)) : true); break;
    case "materialCostEntries":
     allowed=(row.companyId ? companyIds.has(row.companyId) : row.poId ? allowedPOIds.has(row.poId) : componentIds.has(row.componentId)) &&
      (!row.poId || allowedPOIds.has(row.poId)) && (!row.poLineId || lines.has(row.poLineId)) &&
      (!row.componentId || componentIds.has(row.componentId)) && (!row.partId || visibleIds(access,"componentParts").has(row.partId)) &&
      (!row.anchorOperationId || operationIds.has(row.anchorOperationId)) &&
      materialIds.has(row.materialId) && (!row.vendorId || vendorIds.has(row.vendorId)) && (!row.transportVendorId || vendorIds.has(row.transportVendorId)); break;
    case "bomLines": allowed=componentIds.has(row.componentId) && materialIds.has(row.materialId); break;
    case "contactProfiles":
     allowed=((row.linkedType==="company" && companyIds.has(row.linkedId)) || (row.linkedType==="vendor" && vendorIds.has(row.linkedId))) &&
      (Array.isArray(row.processDefinitionIds) ? row.processDefinitionIds.every(id=>processIds.has(id)) : true); break;
    case "plannedCosts":
     allowed=(row.companyId ? companyIds.has(row.companyId) : row.poId ? allowedPOIds.has(row.poId) : componentIds.has(row.componentId)) &&
      (!row.poId || allowedPOIds.has(row.poId)) && (!row.componentId || componentIds.has(row.componentId)) &&
      (!row.processDefinitionId || processIds.has(row.processDefinitionId)); break;
    case "followUpAssignments": allowed=scopeIds.has(row.recordId) || scopeIds.has(row.contactId); break;
    case "vendors": case "materials": case "processDefinitions": case "transportRoutes": allowed=false; break;
    default: allowed=false;
   }
   if (!allowed) return deny(collection);
  }
 }
 return {ok:true};
}

export function filterModuleRecords(records, user) {
 if (user?.legacy === true || user?.role === "admin") return records || {};
 // Generic module records have no dependable ownership fields in legacy records.
 // Keep them unavailable until their schema has explicit tenant ownership.
 return {};
}
