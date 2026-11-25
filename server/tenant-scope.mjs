const ARRAY_FIELDS = Object.freeze([
 "companies","customers","prospects","factories","machines","toolingAssets","fixtureAssets","resourceUsageEvents","maintenancePlans","maintenanceWorkOrders","machineDowntime","purchaseOrders","components","vendors","operations","quotations","materials",
 "componentParts","materialCostEntries","bomLines","materialProcessLinks","inventoryTransactions",
 "contactProfiles","processDefinitions","plannedCosts","transportRoutes","transportLegs",
 "paymentTransactions","inspectionMeasurements","supplierInvoices","supplierPayments","supplierFinanceApprovals","supplierPaymentAllocations","routeRelationships","followUpAssignments"
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
 const factoryById = new Map(factoryRows.map(factory=>[factory.id,factory]));
 const machines = rows(data,"machines").filter(machine =>
  companyAllowed(machine.companyId) && factoryAllowed(machine.factoryId) &&
  factoryById.get(machine.factoryId)?.companyId===machine.companyId
 );
 const machineIds = ids(machines);
 const machineById = new Map(machines.map(machine=>[machine.id,machine]));
 const toolingAssets=rows(data,"toolingAssets").filter(asset=>
  companyAllowed(asset.companyId)&&factoryAllowed(asset.factoryId)&&factoryById.get(asset.factoryId)?.companyId===asset.companyId
 );
 const fixtureAssets=rows(data,"fixtureAssets").filter(asset=>
  companyAllowed(asset.companyId)&&factoryAllowed(asset.factoryId)&&factoryById.get(asset.factoryId)?.companyId===asset.companyId
 );
 const toolingAssetIds=ids(toolingAssets),fixtureAssetIds=ids(fixtureAssets);
 const maintenancePlans=rows(data,"maintenancePlans").filter(row=>{
  const machine=machineById.get(row.machineId);
  return Boolean(machine&&machine.companyId===row.companyId&&machine.factoryId===row.factoryId);
 });
 const maintenancePlanIds=ids(maintenancePlans);
 const maintenanceWorkOrders=rows(data,"maintenanceWorkOrders").filter(row=>{
  const machine=machineById.get(row.machineId);
  return Boolean(machine&&machine.companyId===row.companyId&&machine.factoryId===row.factoryId&&(!row.planId||maintenancePlanIds.has(row.planId)));
 });
 const maintenanceWorkOrderIds=ids(maintenanceWorkOrders);
 const machineDowntime=rows(data,"machineDowntime").filter(row=>{
  const machine=machineById.get(row.machineId);
  return Boolean(machine&&machine.companyId===row.companyId&&machine.factoryId===row.factoryId&&(!row.workOrderId||maintenanceWorkOrderIds.has(row.workOrderId)));
 });
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
 const purchaseOrdersById = new Map(purchaseOrders.map(po=>[po.id,po]));
 const lineIds = new Set(purchaseOrders.flatMap(po => rows(po,"lines").map(line => line.id).filter(Boolean)));
 const allPurchaseOrdersById = new Map(rows(data,"purchaseOrders").map(po=>[po.id,po]));
 const allComponentsById = new Map(rows(data,"components").map(component=>[component.id,component]));
 const vendorOwners = new Map();
 const unknownVendorOwners = new Set();
 const addVendorReference = (vendorId,row) => {
  if(typeof vendorId!=="string"||!vendorId)return;
  const ownerCompanyId=row.companyId ||
   allPurchaseOrdersById.get(row.poId)?.companyId ||
   allComponentsById.get(row.componentId)?.companyId || "";
  if(!ownerCompanyId){unknownVendorOwners.add(vendorId);return;}
  if(!vendorOwners.has(vendorId))vendorOwners.set(vendorId,new Set());
  vendorOwners.get(vendorId).add(ownerCompanyId);
 };
 for(const field of ["operations","quotations","transportLegs","materialCostEntries","inventoryTransactions","componentParts","plannedCosts","supplierInvoices","supplierPayments"]){
  for(const row of rows(data,field)){
   addVendorReference(row.vendorId,row);
   addVendorReference(row.transportVendorId,row);
   if(Array.isArray(row.vendorIds))for(const vendorId of row.vendorIds)addVendorReference(vendorId,row);
  }
 }
 const vendorIds = new Set([...vendorOwners.entries()]
  .filter(([id,owners])=>!unknownVendorOwners.has(id)&&owners.size>0&&[...owners].every(companyAllowed))
  .map(([id])=>id));
 const operations = rows(data,"operations").filter(operation =>
  purchaseOrderIds.has(operation.poId) &&
  lineIds.has(operation.poLineId) &&
  componentIds.has(operation.componentId) &&
  (!operation.vendorId || vendorIds.has(operation.vendorId)) &&
  (!operation.transportVendorId || vendorIds.has(operation.transportVendorId)) &&
  (Array.isArray(operation.toolingAssetIds)?operation.toolingAssetIds.every(id=>toolingAssetIds.has(id)):true) &&
  (Array.isArray(operation.fixtureAssetIds)?operation.fixtureAssetIds.every(id=>fixtureAssetIds.has(id)):true) &&
  (!operation.machineId || (() => {
   const machine=machineById.get(operation.machineId);
   const po=purchaseOrdersById.get(operation.poId);
   const capabilities=Array.isArray(machine?.processDefinitionIds)?machine.processDefinitionIds:[];
   return Boolean(machine && po && machine.companyId===po.companyId && machine.factoryId===po.factoryId &&
    operation.executionType!=="Outsourced" && (!capabilities.length || Boolean(operation.processDefinitionId && capabilities.includes(operation.processDefinitionId))));
  })())
 );
 const operationIds = ids(operations);
 const resourceUsageEvents=rows(data,"resourceUsageEvents").filter(event=>
  (event.resourceType==="tooling"?toolingAssetIds.has(event.resourceId):event.resourceType==="fixture"&&fixtureAssetIds.has(event.resourceId))&&
  (!event.operationId||operationIds.has(event.operationId))&&
  (event.resourceType==="tooling"?toolingAssets.some(asset=>asset.id===event.resourceId&&asset.companyId===event.companyId&&asset.factoryId===event.factoryId):fixtureAssets.some(asset=>asset.id===event.resourceId&&asset.companyId===event.companyId&&asset.factoryId===event.factoryId))
 );
 const quotations = rows(data,"quotations").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.operationId) && (!row.vendorId || vendorIds.has(row.vendorId))
 );
 const transportLegs = rows(data,"transportLegs").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.anchorOperationId) && (!row.targetOperationId || operationIds.has(row.targetOperationId)) && vendorIds.has(row.vendorId)
 );
 const routeRelationships = rows(data,"routeRelationships").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.fromOperationId) && operationIds.has(row.toOperationId)
 );
 const paymentTransactions = rows(data,"paymentTransactions").filter(row =>
  purchaseOrderIds.has(row.poId) && lineIds.has(row.poLineId) && componentIds.has(row.componentId) &&
  operationIds.has(row.operationId) && (!row.vendorId || vendorIds.has(row.vendorId))
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
  componentIds.has(row.componentId) && (!row.companyId || companyAllowed(row.companyId)) &&
  (Array.isArray(row.vendorIds) ? row.vendorIds.every(id=>vendorIds.has(id)) : true)
 );
 const componentPartIds = ids(componentParts);
 const bomLines = rows(data,"bomLines").filter(row => componentIds.has(row.componentId) && (!row.partId || componentPartIds.has(row.partId)));
 const materialCostEntries = rows(data,"materialCostEntries").filter(row =>
  (row.companyId ? companyAllowed(row.companyId) : row.poId ? purchaseOrderIds.has(row.poId) : componentIds.has(row.componentId)) &&
  (!row.poId || purchaseOrderIds.has(row.poId)) &&
  (!row.poLineId || lineIds.has(row.poLineId)) &&
  (!row.componentId || componentIds.has(row.componentId)) &&
  (!row.partId || componentPartIds.has(row.partId)) &&
  (!row.anchorOperationId || operationIds.has(row.anchorOperationId)) &&
  (!row.vendorId || vendorIds.has(row.vendorId)) &&
  (!row.transportVendorId || vendorIds.has(row.transportVendorId))
 );
 const materialIds = new Set([
  ...componentParts.flatMap(row => [...(Array.isArray(row.materialIds) ? row.materialIds : []),row.materialId].filter(Boolean)),
  ...bomLines.map(row => row.materialId).filter(Boolean),
  ...materialCostEntries.map(row => row.materialId).filter(Boolean),
  ...materialProcessLinks.map(row => row.materialId).filter(Boolean),
  ...inventoryTransactions.filter(row => row.itemType === "material").map(row => row.itemId)
 ]);
 const materials = rows(data,"materials").filter(row => materialIds.has(row.id)).map(row => ({...row,preferredVendorId:vendorIds.has(row.preferredVendorId)?row.preferredVendorId:""}));
 const vendors = rows(data,"vendors").filter(row => vendorIds.has(row.id));
 const processDefinitionIds = new Set([
  ...ids(operations.map(row => ({id:row.processDefinitionId})).filter(row => row.id)),
  ...machines.flatMap(machine=>Array.isArray(machine.processDefinitionIds)?machine.processDefinitionIds:[]),
  ...toolingAssets.flatMap(asset=>Array.isArray(asset.processDefinitionIds)?asset.processDefinitionIds:[]),
  ...fixtureAssets.flatMap(asset=>Array.isArray(asset.processDefinitionIds)?asset.processDefinitionIds:[])
 ]);
 const processDefinitions = rows(data,"processDefinitions").filter(row => processDefinitionIds.has(row.id)).map(row => ({...row,vendorIds:(Array.isArray(row.vendorIds)?row.vendorIds:[]).filter(id=>vendorIds.has(id))}));
 const transportRouteIds = ids(transportLegs.map(row => ({id:row.routeId})).filter(row => row.id));
 const transportRoutes = rows(data,"transportRoutes").filter(row => transportRouteIds.has(row.id) && vendorIds.has(row.vendorId));
 const companies = rows(data,"companies").filter(row => companyAllowed(row.id));
 const customers = rows(data,"customers").filter(row => companyAllowed(row.ownerCompanyId));
 const prospects = rows(data,"prospects").filter(row => companyAllowed(row.ownerCompanyId));
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
 const vendorLinkedToCompany = (vendorId,companyId) => vendorIds.has(vendorId) && Boolean(vendorOwners.get(vendorId)?.has(companyId));
 const supplierInvoices = rows(data,"supplierInvoices").filter(row =>
  companyAllowed(row.companyId) && factoryAllowed(row.factoryId) && vendorLinkedToCompany(row.vendorId,row.companyId) &&
  (!row.poId || (purchaseOrderIds.has(row.poId) && rows(data,"purchaseOrders").some(po=>po.id===row.poId&&po.companyId===row.companyId&&po.factoryId===row.factoryId))) &&
  (!row.poLineId || lineIds.has(row.poLineId))
 );
 const supplierPayments = rows(data,"supplierPayments").filter(row =>
  companyAllowed(row.companyId) && factoryAllowed(row.factoryId) && vendorLinkedToCompany(row.vendorId,row.companyId)
 );
 const invoiceIds = ids(supplierInvoices), supplierPaymentIds = ids(supplierPayments);
 const supplierFinanceApprovals = rows(data,"supplierFinanceApprovals").filter(row =>
  row.targetType==="invoice" ? invoiceIds.has(row.targetId) : row.targetType==="payment" && supplierPaymentIds.has(row.targetId)
 );
 const supplierPaymentAllocations = rows(data,"supplierPaymentAllocations").filter(row =>
  invoiceIds.has(row.invoiceId) && supplierPaymentIds.has(row.paymentId)
 );
 const entityIds = new Set([
  ...ids(companies),...ids(customers),...ids(prospects),...ids(factories),...machineIds,...toolingAssetIds,...fixtureAssetIds,...ids(resourceUsageEvents),...ids(maintenancePlans),...ids(maintenanceWorkOrders),...ids(machineDowntime),...purchaseOrderIds,...lineIds,...componentIds,
  ...operationIds,...ids(quotations),...ids(transportLegs),...ids(routeRelationships),
  ...ids(paymentTransactions),...ids(inspectionMeasurements),...ids(materialProcessLinks),
  ...ids(inventoryTransactions),...ids(componentParts),...ids(bomLines),...ids(materialCostEntries),
  ...ids(contactProfiles),...ids(supplierInvoices),...ids(supplierPayments),...ids(supplierFinanceApprovals),...ids(supplierPaymentAllocations),
  ...ids(vendors),...ids(materials),...ids(processDefinitions),...ids(transportRoutes)
 ]);
 const contactProfileIds = ids(contactProfiles);
 const followUpAssignments = rows(data,"followUpAssignments").filter(row =>
  entityIds.has(row.recordId) && (!row.contactId || contactProfileIds.has(row.contactId))
 );
 return {
  companyIds, factoryIds, purchaseOrderIds, lineIds, componentIds, operationIds, vendorIds, vendorOwners,
  materialIds, processDefinitionIds, transportRouteIds, entityIds,
  companies,customers,prospects,factories,machines,toolingAssets,fixtureAssets,resourceUsageEvents,maintenancePlans,maintenanceWorkOrders,machineDowntime,purchaseOrders,components,operations,quotations,transportLegs,routeRelationships,
  paymentTransactions,inspectionMeasurements,materialProcessLinks,inventoryTransactions,
  componentParts,bomLines,materialCostEntries,materials,vendors,processDefinitions,transportRoutes,
  plannedCosts,contactProfiles,supplierInvoices,supplierPayments,supplierFinanceApprovals,supplierPaymentAllocations,followUpAssignments
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

function resolveFullAccess(data,incoming={}) {
 const all=field=>[...new Map([...rows(data,field),...rows(incoming,field)].filter(row=>row?.id).map(row=>[row.id,row])).values()];
 const purchaseOrders=all("purchaseOrders"),companies=all("companies"),factories=all("factories"),components=all("components"),operations=all("operations");
 const idsInRows=field=>ids(all(field));
 const purchaseOrderIds=ids(purchaseOrders),componentIds=ids(components);
 const lineIds=new Set(purchaseOrders.flatMap(po=>rows(po,"lines").map(line=>line.id).filter(Boolean)));
 const operationIds=ids(operations);
 const entityIds=new Set(ARRAY_FIELDS.flatMap(field=>[...idsInRows(field)]));
 return {
  ...Object.fromEntries(ARRAY_FIELDS.map(field=>[field,all(field)])),
  companyIds:ids(companies),factoryIds:ids(factories),purchaseOrderIds,lineIds,componentIds,operationIds,
  vendorIds:idsInRows("vendors"),machineIds:idsInRows("machines"),toolingAssetIds:idsInRows("toolingAssets"),fixtureAssetIds:idsInRows("fixtureAssets"),resourceUsageEventIds:idsInRows("resourceUsageEvents"),materialIds:idsInRows("materials"),processDefinitionIds:idsInRows("processDefinitions"),
  transportRouteIds:idsInRows("transportRoutes"),entityIds
 };
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
 const privileged = user?.legacy === true || user?.role === "admin";
 if (!privileged && !hasTenantScope(user)) return {ok:false,error:"This account has no company or factory scope assigned."};
 const access = privileged ? resolveFullAccess(currentData,incoming) : resolveAccess(currentData,user);
 const companyIds = access.companyIds;
 const assignedFactories = setOf(user?.factoryIds);
 const incomingFactories = rows(incoming,"factories");
 const factoryById = new Map([...rows(currentData,"factories"),...incomingFactories].map(row => [row.id,row]));
 const factoryAllowed = id => {
  if (!id) return false;
  if (privileged) return companyIds.has(factoryById.get(id)?.companyId);
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
 const combinedById = (collection) => new Map([...rows(currentData,collection),...rows(incoming,collection)].filter(row=>row?.id).map(row=>[row.id,row]));
 const allInvoices = combinedById("supplierInvoices");
 const allSupplierPayments = combinedById("supplierPayments");
 const allFinanceApprovals = [...rows(currentData,"supplierFinanceApprovals"),...rows(incoming,"supplierFinanceApprovals")];
 const latestApproval = (targetType,targetId) => allFinanceApprovals
  .filter(row=>row.targetType===targetType&&row.targetId===targetId&&!row.deletedAt)
  .sort((a,b)=>(Date.parse(b.decidedAt||"")||0)-(Date.parse(a.decidedAt||"")||0))[0];
 const approvalIsCurrent = (targetType,targetId) => {
  const target=targetType==="invoice"?allInvoices.get(targetId):allSupplierPayments.get(targetId);
  const approval=latestApproval(targetType,targetId);
  return approval?.decision==="Approved"&&Boolean(target)&&
   (!approval.targetUpdatedAt||approval.targetUpdatedAt===target.updatedAt);
 };
 const invoiceAllocations = [...combinedById("supplierPaymentAllocations").values()].filter(row=>!row.deletedAt);
 const validMoney = value => Number.isFinite(Number(value)) && Number(value)>=0;
 const vendorAllowedForCompany = (vendorId,companyId) => vendorIds.has(vendorId) &&
  (privileged || Boolean(access.vendorOwners?.get(vendorId)?.has(companyId)));
 const validIsoDate = value => typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value+"T00:00:00.000Z"))&&new Date(value+"T00:00:00.000Z").toISOString().slice(0,10)===value;

 const materialIds = access.materialIds;
 const processIds = new Set([
  ...access.processDefinitionIds,
  ...rows(currentData,"processDefinitions").map(row=>row.id).filter(Boolean),
  ...rows(currentData,"toolingAssets").flatMap(row=>Array.isArray(row.processDefinitionIds)?row.processDefinitionIds:[]),
  ...rows(currentData,"fixtureAssets").flatMap(row=>Array.isArray(row.processDefinitionIds)?row.processDefinitionIds:[]),
  ...rows(incoming,"toolingAssets").flatMap(row=>Array.isArray(row.processDefinitionIds)?row.processDefinitionIds:[]),
  ...rows(incoming,"fixtureAssets").flatMap(row=>Array.isArray(row.processDefinitionIds)?row.processDefinitionIds:[])
 ]);
 const machineById = new Map([...rows(currentData,"machines"),...rows(incoming,"machines")].filter(row=>row?.id).map(row=>[row.id,row]));
 const toolingById = new Map([...rows(currentData,"toolingAssets"),...rows(incoming,"toolingAssets")].filter(row=>row?.id).map(row=>[row.id,row]));
 const fixtureById = new Map([...rows(currentData,"fixtureAssets"),...rows(incoming,"fixtureAssets")].filter(row=>row?.id).map(row=>[row.id,row]));
 const operationRange = operation => {
  if(!operation?.plannedStart||!operation?.plannedEnd)return null;
  const start=Date.parse(operation.plannedStart),end=Date.parse(operation.plannedEnd);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {invalid:true};
  return {start,end};
 };
 const machineScheduleAllowed = operation => {
  if(!operation.machineId||operation.executionType==="Outsourced"||operation.deletedAt||
     operation.status==="Complete"||operation.status==="Rejected")return true;
  const prior=rows(currentData,"operations").find(existing=>existing.id===operation.id);
  const scheduleChanged=!prior||["machineId","plannedStart","plannedEnd","status","executionType"].some(field=>prior[field]!==operation[field]);
  if(!scheduleChanged)return true;
  const candidateRange=operationRange(operation);
  if(!candidateRange)return true;
  if(candidateRange.invalid)return false;
  const combined=new Map([...rows(currentData,"operations"),...rows(incoming,"operations")].filter(row=>row?.id).map(row=>[row.id,row]));
  for(const other of combined.values()){
   if(other.id===operation.id||other.machineId!==operation.machineId||other.executionType==="Outsourced"||
      other.deletedAt||other.status==="Complete"||other.status==="Rejected")continue;
   const otherRange=operationRange(other);
   if(!otherRange||otherRange.invalid)continue;
   if(candidateRange.start<otherRange.end&&otherRange.start<candidateRange.end)return false;
  }
  return true;
 };
 const timeRange=(startValue,endValue)=>{
  const start=Date.parse(startValue||""),end=Date.parse(endValue||"");
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start?{start,end}:null;
 };
 const overlaps=(left,right)=>left.start<right.end&&right.start<left.end;
 const machineMaintenanceScheduleAllowed=operation=>{
  if(!operation.machineId||operation.executionType==="Outsourced"||operation.deletedAt||["Complete","Rejected"].includes(operation.status))return true;
  const range=operationRange(operation);
  if(!range||range.invalid)return !range;
  for(const order of [...rows(currentData,"maintenanceWorkOrders"),...rows(incoming,"maintenanceWorkOrders")]){
   if(!order||order.machineId!==operation.machineId||order.deletedAt||!["Planned","In progress","Waiting parts"].includes(order.status))continue;
   const scheduled=timeRange(order.scheduledStart,order.scheduledEnd);
   if(scheduled&&overlaps(range,scheduled))return false;
   if(["In progress","Waiting parts"].includes(order.status)&&!scheduled&&order.actualStart){
    const start=Date.parse(order.actualStart);
    if(Number.isFinite(start)&&range.end>start)return false;
   }
  }
  for(const event of [...rows(currentData,"machineDowntime"),...rows(incoming,"machineDowntime")]){
   if(!event||event.machineId!==operation.machineId||event.deletedAt||!event.startedAt)continue;
   const start=Date.parse(event.startedAt),end=event.endedAt?Date.parse(event.endedAt):Number.POSITIVE_INFINITY;
   if(Number.isFinite(start)&&(!event.endedAt||Number.isFinite(end))&&overlaps(range,{start,end}))return false;
  }
  return true;
 };
 const maintenanceWorkOrderScheduleAllowed=order=>{
  if(!["Planned","In progress","Waiting parts"].includes(order.status))return true;
  const range=timeRange(order.scheduledStart,order.scheduledEnd)||
   (["In progress","Waiting parts"].includes(order.status)&&order.actualStart&&Number.isFinite(Date.parse(order.actualStart))?{start:Date.parse(order.actualStart),end:Number.POSITIVE_INFINITY}:null);
  if(!order.scheduledStart&&!order.scheduledEnd&&!range)return true;
  if(!range)return false;
  for(const operation of [...rows(currentData,"operations"),...rows(incoming,"operations")]){
   if(!operation||operation.machineId!==order.machineId||operation.executionType==="Outsourced"||operation.deletedAt||["Complete","Rejected"].includes(operation.status))continue;
   const scheduled=operationRange(operation);
   if(scheduled&&!scheduled.invalid&&overlaps(range,scheduled))return false;
  }
  for(const other of [...rows(currentData,"maintenanceWorkOrders"),...rows(incoming,"maintenanceWorkOrders")]){
   if(!other||other.id===order.id||other.machineId!==order.machineId||other.deletedAt||!["Planned","In progress","Waiting parts"].includes(other.status))continue;
   const scheduled=timeRange(other.scheduledStart,other.scheduledEnd);
   if(scheduled&&overlaps(range,scheduled))return false;
  }
  for(const event of [...rows(currentData,"machineDowntime"),...rows(incoming,"machineDowntime")]){
   if(!event||event.machineId!==order.machineId||event.workOrderId===order.id||event.deletedAt||!event.startedAt)continue;
   const start=Date.parse(event.startedAt),end=event.endedAt?Date.parse(event.endedAt):Number.POSITIVE_INFINITY;
   if(Number.isFinite(start)&&(!event.endedAt||Number.isFinite(end))&&overlaps(range,{start,end}))return false;
  }
  return true;
 };
 const resourceAssignmentsAllowed = operation => {
  const toolIds=Array.isArray(operation.toolingAssetIds)?operation.toolingAssetIds:[];
  const fixtureIds=Array.isArray(operation.fixtureAssetIds)?operation.fixtureAssetIds:[];
  if(toolIds.length>50||fixtureIds.length>50||new Set(toolIds).size!==toolIds.length||new Set(fixtureIds).size!==fixtureIds.length)return false;
  if(operation.executionType==="Outsourced"&&(toolIds.length||fixtureIds.length))return false;
  const po=allowedPOById.get(operation.poId);
  if((toolIds.length||fixtureIds.length)&&!operationRange(operation))return false;
  const component=[...rows(currentData,"components"),...rows(incoming,"components")].find(row=>row.id===operation.componentId);
  const machine=operation.machineId?machineById.get(operation.machineId):undefined;
  const prior=rows(currentData,"operations").find(row=>row.id===operation.id);
  const range=operationRange(operation);
  if(range?.invalid)return false;
  const hasOverlap=(type,id)=>{
   if(!range||range.invalid)return true;
   const field=type==="tooling"?"toolingAssetIds":"fixtureAssetIds";
   for(const other of [...rows(currentData,"operations"),...rows(incoming,"operations")]){
    if(!other||other.id===operation.id||other.deletedAt||["Complete","Rejected"].includes(other.status)||!Array.isArray(other[field])||!other[field].includes(id))continue;
    const otherRange=operationRange(other);
    if(!otherRange||otherRange.invalid||overlaps(range,otherRange))return true;
   }
   return false;
  };
  for(const id of toolIds){
   const asset=toolingById.get(id);
   if(!asset||asset.deletedAt||!po||asset.companyId!==po.companyId||asset.factoryId!==po.factoryId)return false;
   const previouslyAssigned=Array.isArray(prior?.toolingAssetIds)&&prior.toolingAssetIds.includes(id);
   if(asset.status!=="Available"&&!(previouslyAssigned&&["In use","Needs regrind","Under maintenance"].includes(asset.status)))return false;
   const machineIds=Array.isArray(asset.compatibleMachineIds)?asset.compatibleMachineIds:[];
   const machineTypes=Array.isArray(asset.machineTypeCapabilities)?asset.machineTypeCapabilities:[];
   const processIds=Array.isArray(asset.processDefinitionIds)?asset.processDefinitionIds:[];
   const materials=Array.isArray(asset.materialCapabilities)?asset.materialCapabilities:[];
   if(machineIds.length&&(!machine||!machineIds.includes(machine.id)))return false;
   if(machineTypes.length&&(!machine||!machineTypes.includes(machine.machineType)))return false;
   if(processIds.length&&(!operation.processDefinitionId||!processIds.includes(operation.processDefinitionId)))return false;
   if(materials.length&&(!component?.material||!materials.some(value=>String(value).toLowerCase()===String(component.material).toLowerCase())))return false;
   if((Number(asset.toolLifeLimitMinutes)>0&&Number(asset.toolLifeUsedMinutes)>=Number(asset.toolLifeLimitMinutes))||(Number(asset.toolLifeLimitCycles)>0&&Number(asset.toolLifeUsedCycles)>=Number(asset.toolLifeLimitCycles)))return false;
   if(asset.inspectionDueAt&&validIsoDate(asset.inspectionDueAt)&&asset.inspectionDueAt<new Date().toISOString().slice(0,10))return false;
   if(hasOverlap("tooling",id))return false;
  }
  for(const id of fixtureIds){
   const asset=fixtureById.get(id);
   if(!asset||asset.deletedAt||!po||asset.companyId!==po.companyId||asset.factoryId!==po.factoryId)return false;
   const previouslyAssigned=Array.isArray(prior?.fixtureAssetIds)&&prior.fixtureAssetIds.includes(id);
   if(asset.status!=="Available"&&!(previouslyAssigned&&asset.status==="Under maintenance"))return false;
   const machineIds=Array.isArray(asset.compatibleMachineIds)?asset.compatibleMachineIds:[];
   const machineTypes=Array.isArray(asset.machineTypeCapabilities)?asset.machineTypeCapabilities:[];
   const processIds=Array.isArray(asset.processDefinitionIds)?asset.processDefinitionIds:[];
   const componentIds=Array.isArray(asset.componentIds)?asset.componentIds:[];
   if(machineIds.length&&(!machine||!machineIds.includes(machine.id)))return false;
   if(machineTypes.length&&(!machine||!machineTypes.includes(machine.machineType)))return false;
   if(processIds.length&&(!operation.processDefinitionId||!processIds.includes(operation.processDefinitionId)))return false;
   if(componentIds.length&&!componentIds.includes(operation.componentId))return false;
   if(asset.inspectionDueAt&&validIsoDate(asset.inspectionDueAt)&&asset.inspectionDueAt<new Date().toISOString().slice(0,10))return false;
   if(Number(asset.maxUsageCycles)>0&&Number(asset.usageCycles)>=Number(asset.maxUsageCycles))return false;
   if(hasOverlap("fixture",id))return false;
  }
  return true;
 };
 const machineAssignmentAllowed = operation => {
  if(!operation.machineId)return true;
  const machine=machineById.get(operation.machineId);
  const po=allowedPOById.get(operation.poId);
  const capabilities=Array.isArray(machine?.processDefinitionIds)?machine.processDefinitionIds:[];
  const existingAssignment=rows(currentData,"operations").some(existing=>existing.id===operation.id&&existing.machineId===machine?.id);
  const statusAllowed=machine?.status==="Available"||(existingAssignment&&machine?.status==="Running");
  return Boolean(machine && !machine.deletedAt && po && companyIds.has(machine.companyId) && factoryAllowed(machine.factoryId) &&
   machine.companyId===po.companyId && machine.factoryId===po.factoryId &&
   operation.executionType!=="Outsourced" && statusAllowed &&
   (!capabilities.length || Boolean(operation.processDefinitionId && capabilities.includes(operation.processDefinitionId))) &&
   machineScheduleAllowed(operation) && machineMaintenanceScheduleAllowed(operation));
 };
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
  if (MASTER_FIELDS.has(collection) && values.length && !privileged) {
   const visibleMasterById=new Map(rows(access,collection).map(item=>[item.id,item]));
   if(values.some(row=>!visibleMasterById.has(row?.id)||JSON.stringify(visibleMasterById.get(row.id))!==JSON.stringify(row))) {
    return {ok:false,error:collection+" is a shared master directory and can only be changed by an administrator."};
   }
  }
  for (const row of values) {
   if (!row || typeof row.id!=="string" || !row.id || !safeId(collection,row)) return deny(collection);
   let allowed=false;
   switch(collection) {
    case "companies": allowed=companyIds.has(row.id); break;
    case "customers": allowed=privileged || companyIds.has(row.ownerCompanyId); break;
    case "prospects": {
     const validEvidence=Array.isArray(row.evidence)&&row.evidence.length<=20&&row.evidence.every(item=>{
      if(!item||item.provider!=="SearXNG"||typeof item.sourceUrl!=="string"||typeof item.sourceTitle!=="string"||typeof item.query!=="string"||typeof item.retrievedAt!=="string")return false;
      try { const source=new URL(item.sourceUrl); return (source.protocol==="https:"||source.protocol==="http:")&&!source.username&&!source.password; } catch { return false; }
     });
     allowed=companyIds.has(row.ownerCompanyId)&&typeof row.businessName==="string"&&row.businessName.trim().length>0&&row.businessName.length<=240&&
      ["New","Reviewed","Qualified","Disqualified","Converted"].includes(row.stage)&&validEvidence;
     break;
    }
    case "factories": allowed=companyIds.has(row.companyId) && (!assignedFactories.size || assignedFactories.has(row.id)); break;
    case "machines": {
     const duplicateAssetCode=[...rows(currentData,"machines"),...rows(incoming,"machines")].some(other=>
      other.id!==row.id && !other.deletedAt && other.companyId===row.companyId &&
      String(other.assetCode||"").trim().toLowerCase()===String(row.assetCode||"").trim().toLowerCase()
     );
     const status=["Available","Running","Planned maintenance","Under maintenance","Breakdown","Retired"].includes(row.status);
     const numericFields=["axisCount","workEnvelopeXmm","workEnvelopeYmm","workEnvelopeZmm","spindleMaxRpm","positioningAccuracyMicron","maxWorkpieceWeightKg"];
     const numericValid=numericFields.every(field=>row[field]===undefined||row[field]===null||(Number.isFinite(Number(row[field]))&&Number(row[field])>=0));
     allowed=companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&factoryById.get(row.factoryId)?.companyId===row.companyId&&
      typeof row.assetCode==="string"&&Boolean(row.assetCode.trim())&&row.assetCode.length<=80&&
      typeof row.name==="string"&&Boolean(row.name.trim())&&row.name.length<=180&&
      typeof row.machineType==="string"&&Boolean(row.machineType.trim())&&status&&numericValid&&!duplicateAssetCode&&
      Array.isArray(row.processDefinitionIds)&&row.processDefinitionIds.every(id=>processIds.has(id))&&
      Array.isArray(row.materialCapabilities)&&row.materialCapabilities.length<=100&&row.materialCapabilities.every(value=>typeof value==="string"&&value.length<=120)&&
      typeof row.notes==="string"&&row.notes.length<=4000;
     break;
    }
    case "toolingAssets": {
     const duplicate=[...rows(currentData,"toolingAssets"),...rows(incoming,"toolingAssets")].some(other=>other.id!==row.id&&!other.deletedAt&&other.companyId===row.companyId&&String(other.assetCode||"").trim().toLowerCase()===String(row.assetCode||"").trim().toLowerCase());
     const statuses=["Available","In use","Needs regrind","Under maintenance","Retired"];
     const numeric=["diameterMm","fluteCount","maxRpm","toolLifeLimitMinutes","toolLifeUsedMinutes","toolLifeLimitCycles","toolLifeUsedCycles","regrindCount","maxRegrinds"];
     const numericValid=numeric.every(key=>row[key]===undefined||row[key]===null||(Number.isFinite(Number(row[key]))&&Number(row[key])>=0));
     const machineList=Array.isArray(row.compatibleMachineIds)?row.compatibleMachineIds:[];
     const limitMinutes=Number(row.toolLifeLimitMinutes)||0,usedMinutes=Number(row.toolLifeUsedMinutes)||0;
     const limitCycles=Number(row.toolLifeLimitCycles)||0,usedCycles=Number(row.toolLifeUsedCycles)||0;
     allowed=companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&factoryById.get(row.factoryId)?.companyId===row.companyId&&
      typeof row.assetCode==="string"&&row.assetCode.trim().length>0&&row.assetCode.length<=80&&
      typeof row.name==="string"&&row.name.trim().length>0&&row.name.length<=180&&typeof row.toolType==="string"&&row.toolType.trim().length>0&&
      statuses.includes(row.status)&&numericValid&&!duplicate&&
      Array.isArray(row.machineTypeCapabilities)&&row.machineTypeCapabilities.length<=40&&row.machineTypeCapabilities.every(value=>typeof value==="string"&&value.trim().length>0&&value.length<=100)&&
      machineList.length<=100&&machineList.every(id=>{const machine=machineById.get(id);return Boolean(machine&&!machine.deletedAt&&machine.companyId===row.companyId&&machine.factoryId===row.factoryId);})&&
      Array.isArray(row.processDefinitionIds)&&row.processDefinitionIds.length<=100&&row.processDefinitionIds.every(id=>processIds.has(id))&&
      Array.isArray(row.materialCapabilities)&&row.materialCapabilities.length<=100&&row.materialCapabilities.every(value=>typeof value==="string"&&value.trim().length>0&&value.length<=120)&&
      (!limitMinutes||usedMinutes<=limitMinutes||row.status==="Needs regrind")&&(!limitCycles||usedCycles<=limitCycles||row.status==="Needs regrind")&&
      (!row.lastInspectedAt||validIsoDate(row.lastInspectedAt))&&(!row.inspectionDueAt||validIsoDate(row.inspectionDueAt))&&
      typeof row.storageLocation==="string"&&row.storageLocation.length<=180&&typeof row.notes==="string"&&row.notes.length<=4000;
     break;
    }
    case "fixtureAssets": {
     const duplicate=[...rows(currentData,"fixtureAssets"),...rows(incoming,"fixtureAssets")].some(other=>other.id!==row.id&&!other.deletedAt&&other.companyId===row.companyId&&String(other.assetCode||"").trim().toLowerCase()===String(row.assetCode||"").trim().toLowerCase());
     const statuses=["Available","In use","Under maintenance","Retired"];
     const numeric=["maxWorkpieceWeightKg","maxClampForceKn","repeatabilityMicron","usageCycles","maxUsageCycles"];
     const numericValid=numeric.every(key=>row[key]===undefined||row[key]===null||(Number.isFinite(Number(row[key]))&&Number(row[key])>=0));
     const machineList=Array.isArray(row.compatibleMachineIds)?row.compatibleMachineIds:[];
     allowed=companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&factoryById.get(row.factoryId)?.companyId===row.companyId&&
      typeof row.assetCode==="string"&&row.assetCode.trim().length>0&&row.assetCode.length<=80&&
      typeof row.name==="string"&&row.name.trim().length>0&&row.name.length<=180&&typeof row.fixtureType==="string"&&row.fixtureType.trim().length>0&&
      statuses.includes(row.status)&&numericValid&&!duplicate&&
      machineList.length<=100&&machineList.every(id=>{const machine=machineById.get(id);return Boolean(machine&&!machine.deletedAt&&machine.companyId===row.companyId&&machine.factoryId===row.factoryId);})&&
      Array.isArray(row.machineTypeCapabilities)&&row.machineTypeCapabilities.length<=40&&row.machineTypeCapabilities.every(value=>typeof value==="string"&&value.trim().length>0&&value.length<=100)&&
      Array.isArray(row.processDefinitionIds)&&row.processDefinitionIds.length<=100&&row.processDefinitionIds.every(id=>processIds.has(id))&&
      Array.isArray(row.componentIds)&&row.componentIds.length<=500&&row.componentIds.every(id=>componentIds.has(id))&&
      (!row.lastInspectedAt||validIsoDate(row.lastInspectedAt))&&(!row.inspectionDueAt||validIsoDate(row.inspectionDueAt))&&
      typeof row.storageLocation==="string"&&row.storageLocation.length<=180&&typeof row.setupNotes==="string"&&row.setupNotes.length<=4000&&typeof row.notes==="string"&&row.notes.length<=4000;
     break;
    }
    case "resourceUsageEvents": {
     const asset=row.resourceType==="tooling"?toolingById.get(row.resourceId):row.resourceType==="fixture"?fixtureById.get(row.resourceId):undefined;
     const operation=row.operationId?combinedById("operations").get(row.operationId):undefined;
     const eventTypes=["Production use","Regrind","Inspection","Repair","Replacement"];
     const inspectionResults=["Pass","Fail","Not assessed"];
     allowed=Boolean(asset&&!asset.deletedAt&&asset.companyId===row.companyId&&asset.factoryId===row.factoryId&&companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&
      eventTypes.includes(row.eventType)&&(row.eventType!=="Regrind"||row.resourceType==="tooling")&&
      Number.isFinite(Number(row.runtimeMinutes))&&Number(row.runtimeMinutes)>=0&&Number.isFinite(Number(row.cycles))&&Number(row.cycles)>=0&&
      (row.eventType!=="Inspection"||(inspectionResults.includes(row.inspectionResult)&&(!row.inspectionDueAt||validIsoDate(row.inspectionDueAt))))&&
      (!row.operationId||Boolean(operation&&allowedPOIds.has(operation.poId)&&(row.resourceType==="tooling"?(Array.isArray(operation.toolingAssetIds)&&operation.toolingAssetIds.includes(row.resourceId)):(Array.isArray(operation.fixtureAssetIds)&&operation.fixtureAssetIds.includes(row.resourceId)))))&&
      typeof row.occurredAt==="string"&&Number.isFinite(Date.parse(row.occurredAt))&&typeof row.notes==="string"&&row.notes.length<=4000);
     break;
    }
    case "maintenancePlans": {
     const machine=machineById.get(row.machineId);
     const frequencyUnits=["Days","Weeks","Months"];
     const planTypes=["Preventive","Lubrication","Calibration","Inspection"];
     allowed=Boolean(machine&&!machine.deletedAt&&companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&
      machine.companyId===row.companyId&&machine.factoryId===row.factoryId&&
      typeof row.planName==="string"&&row.planName.trim().length>0&&row.planName.length<=180&&
      planTypes.includes(row.maintenanceType)&&Number.isSafeInteger(row.frequencyValue)&&row.frequencyValue>0&&row.frequencyValue<=100000&&
      frequencyUnits.includes(row.frequencyUnit)&&validIsoDate(row.nextDueAt)&&
      (row.lastCompletedAt===undefined||row.lastCompletedAt===""||validIsoDate(row.lastCompletedAt))&&
      validMoney(row.estimatedDurationHours)&&Number(row.estimatedDurationHours)<=10000&&
      Array.isArray(row.checklist)&&row.checklist.length<=100&&row.checklist.every(item=>typeof item==="string"&&item.trim().length>0&&item.length<=300)&&
      typeof row.assignedTo==="string"&&row.assignedTo.length<=180&&typeof row.active==="boolean"&&typeof row.notes==="string"&&row.notes.length<=4000);
     break;
    }
    case "maintenanceWorkOrders": {
     const machine=machineById.get(row.machineId);
     const plan=row.planId?combinedById("maintenancePlans").get(row.planId):null;
     const workTypes=["Preventive","Breakdown","Corrective","Calibration","Inspection"];
     const priorities=["Low","Normal","High","Critical"];
     const statuses=["Planned","Open","In progress","Waiting parts","Completed","Cancelled"];
     const uniqueNumber=!([...rows(currentData,"maintenanceWorkOrders"),...rows(incoming,"maintenanceWorkOrders")].some(other=>other.id!==row.id&&!other.deletedAt&&other.companyId===row.companyId&&String(other.workOrderNumber||"").trim().toLowerCase()===String(row.workOrderNumber||"").trim().toLowerCase()));
     const scheduleDates=!row.scheduledStart&&!row.scheduledEnd ? ["Open","In progress","Waiting parts","Completed","Cancelled"].includes(row.status) : Boolean(timeRange(row.scheduledStart,row.scheduledEnd));
     const actualDates=(!row.actualStart&&!row.actualEnd)||(row.actualStart&&!row.actualEnd&&["In progress","Waiting parts"].includes(row.status)&&Number.isFinite(Date.parse(row.actualStart)))||(row.actualStart&&row.actualEnd&&Boolean(timeRange(row.actualStart,row.actualEnd)));
     allowed=Boolean(machine&&!machine.deletedAt&&companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&
      machine.companyId===row.companyId&&machine.factoryId===row.factoryId&&
      (!row.planId||(plan&&plan.machineId===machine.id&&plan.companyId===row.companyId))&&
      typeof row.workOrderNumber==="string"&&row.workOrderNumber.trim().length>0&&row.workOrderNumber.length<=80&&uniqueNumber&&
      typeof row.title==="string"&&row.title.trim().length>0&&row.title.length<=240&&
      workTypes.includes(row.workType)&&priorities.includes(row.priority)&&statuses.includes(row.status)&&
      typeof row.reportedAt==="string"&&Number.isFinite(Date.parse(row.reportedAt))&&scheduleDates&&actualDates&&
      ["symptom","rootCause","actionTaken","technician","notes"].every(field=>typeof row[field]==="string"&&row[field].length<=4000)&&
      validMoney(row.estimatedCost)&&validMoney(row.actualCost)&&maintenanceWorkOrderScheduleAllowed(row));
     break;
    }
    case "machineDowntime": {
     const machine=machineById.get(row.machineId);
     const workOrder=row.workOrderId?combinedById("maintenanceWorkOrders").get(row.workOrderId):null;
     const types=["Planned maintenance","Unplanned breakdown","Waiting for parts","Setup","Quality hold","Other"];
     const start=Date.parse(row.startedAt||""),end=row.endedAt?Date.parse(row.endedAt):null;
     allowed=Boolean(machine&&!machine.deletedAt&&companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&
      machine.companyId===row.companyId&&machine.factoryId===row.factoryId&&
      (!row.workOrderId||(workOrder&&workOrder.machineId===machine.id&&workOrder.companyId===row.companyId))&&
      types.includes(row.downtimeType)&&Number.isFinite(start)&&(!row.endedAt||(Number.isFinite(end)&&end>start))&&
      typeof row.reason==="string"&&row.reason.trim().length>0&&row.reason.length<=2000&&
      Number.isFinite(Number(row.productionImpactQty))&&Number(row.productionImpactQty)>=0&&
      typeof row.recordedBy==="string"&&row.recordedBy.length<=180&&typeof row.notes==="string"&&row.notes.length<=4000);
     break;
    }
    case "purchaseOrders": allowed=Boolean(poAllowed(row)); break;
    case "components": allowed=(row.companyId && companyIds.has(row.companyId)) || currentVisibleComponents.has(row.id); break;
    case "operations": allowed=allowedPOIds.has(row.poId) && lines.has(row.poLineId) && componentIds.has(row.componentId) && (!row.vendorId || vendorIds.has(row.vendorId)) && (!row.transportVendorId || vendorIds.has(row.transportVendorId)) && (!row.processDefinitionId || processIds.has(row.processDefinitionId)) && (!row.transportRouteId || transportRouteIds.has(row.transportRouteId)) && machineAssignmentAllowed(row) && resourceAssignmentsAllowed(row); break;
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
    case "supplierInvoices": {
     const linkedPO=row.poId?allowedPOById.get(row.poId):undefined;
     const duplicateNumber=[...rows(currentData,"supplierInvoices"),...rows(incoming,"supplierInvoices")]
      .some(other=>other.id!==row.id&&!other.deletedAt&&other.companyId===row.companyId&&other.vendorId===row.vendorId&&String(other.invoiceNumber||"").trim().toLowerCase()===String(row.invoiceNumber||"").trim().toLowerCase());
     const priorInvoice=rows(currentData,"supplierInvoices").find(other=>other.id===row.id);
     const isApproved=approvalIsCurrent("invoice",row.id);
     allowed=companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&vendorAllowedForCompany(row.vendorId,row.companyId)&&
      (!row.poId||(Boolean(linkedPO)&&linkedPO.companyId===row.companyId&&linkedPO.factoryId===row.factoryId))&&
      (!row.poLineId||(Boolean(linkedPO)&&lines.has(row.poLineId)&&rows(linkedPO,"lines").some(line=>line.id===row.poLineId)))&&
      typeof row.invoiceNumber==="string"&&Boolean(row.invoiceNumber.trim())&&row.invoiceNumber.trim().length<=128&&!duplicateNumber&&
      validIsoDate(row.invoiceDate)&&validIsoDate(row.dueDate)&&row.dueDate>=row.invoiceDate&&
      ["Draft","Submitted","Voided"].includes(row.status)&&row.currency==="INR"&&
      validMoney(row.subtotal)&&validMoney(row.taxAmount)&&Number(row.totalAmount)>0&&
      Math.abs(Number(row.totalAmount)-(Number(row.subtotal)+Number(row.taxAmount)))<=0.02&&
      typeof row.createdBy==="string"&&Boolean(row.createdBy)&&
      (!priorInvoice||!isApproved||JSON.stringify(priorInvoice)===JSON.stringify(row));
     break;
    }
    case "supplierPayments": {
     const priorPayment=rows(currentData,"supplierPayments").find(other=>other.id===row.id);
     const isApproved=approvalIsCurrent("payment",row.id);
     const duplicateReference=Boolean(String(row.bankReference||"").trim())&&
      [...rows(currentData,"supplierPayments"),...rows(incoming,"supplierPayments")].some(other=>
       other.id!==row.id&&!other.deletedAt&&other.status!=="Voided"&&other.companyId===row.companyId&&
       other.vendorId===row.vendorId&&String(other.bankReference||"").trim().toLowerCase()===String(row.bankReference||"").trim().toLowerCase()
      );
     allowed=companyIds.has(row.companyId)&&factoryAllowed(row.factoryId)&&vendorAllowedForCompany(row.vendorId,row.companyId)&&
      ["Draft","Submitted","Voided"].includes(row.status)&&validIsoDate(row.paymentDate)&&
      ["Bank transfer","UPI","Cheque","Cash","Other"].includes(row.method)&&row.currency==="INR"&&
      String(row.bankReference||"").length<=128&&
      (!["Bank transfer","UPI","Cheque"].includes(row.method)||Boolean(String(row.bankReference||"").trim()))&&
      Number.isFinite(Number(row.amount))&&Number(row.amount)>0&&!duplicateReference&&typeof row.createdBy==="string"&&Boolean(row.createdBy)&&
      (!priorPayment||!isApproved||JSON.stringify(priorPayment)===JSON.stringify(row));
     break;
    }
    case "supplierFinanceApprovals": {
     const target=row.targetType==="invoice"?allInvoices.get(row.targetId):row.targetType==="payment"?allSupplierPayments.get(row.targetId):undefined;
     const prior=rows(currentData,"supplierFinanceApprovals")
      .filter(value=>value.targetType===row.targetType&&value.targetId===row.targetId&&!value.deletedAt)
      .sort((a,b)=>(Date.parse(b.decidedAt||"")||0)-(Date.parse(a.decidedAt||"")||0))[0];
     const creator=target?.createdBy||"";
     const approver=String(user?.id||"");
     const creatorIsNamedUser=Array.isArray(user?.namedUserIds)&&user.namedUserIds.includes(creator);
     const oldApproval=rows(currentData,"supplierFinanceApprovals").find(value=>value.id===row.id);
     const unchangedApproval=Boolean(oldApproval&&JSON.stringify(oldApproval)===JSON.stringify(row));
     const isNewTargetVersion=prior?(
      prior.targetUpdatedAt!==undefined
       ? prior.targetUpdatedAt!==target?.updatedAt
       : (Date.parse(target?.updatedAt||"")||0)>(Date.parse(prior.decidedAt||"")||0)
     ):true;
     const mayCreateDecision=(!prior||prior.decision!=="Approved")&&isNewTargetVersion;
     allowed=!user?.legacy&&(privileged||user?.role==="manager")&&Boolean(target)&&target.status==="Submitted"&&
      typeof row.id==="string"&&["Approved","Rejected","Returned"].includes(row.decision)&&
      creatorIsNamedUser&&creator!==approver&&(unchangedApproval||mayCreateDecision)&&
      (!oldApproval||unchangedApproval);
     break;
    }
    case "supplierPaymentAllocations": {
     const payment=allSupplierPayments.get(row.paymentId),invoice=allInvoices.get(row.invoiceId);
     const duplicatePair=invoiceAllocations.some(other=>other.id!==row.id&&!other.deletedAt&&other.paymentId===row.paymentId&&other.invoiceId===row.invoiceId);
     const invoiceAllocated=invoiceAllocations.filter(other=>other.id!==row.id&&other.invoiceId===row.invoiceId).reduce((sum,other)=>sum+Number(other.amount||0),0);
     const paymentAllocated=invoiceAllocations.filter(other=>other.id!==row.id&&other.paymentId===row.paymentId).reduce((sum,other)=>sum+Number(other.amount||0),0);
     const immutable=rows(currentData,"supplierPaymentAllocations").find(other=>other.id===row.id);
     allowed=(!immutable||JSON.stringify(immutable)===JSON.stringify(row))&&Boolean(payment&&invoice)&&payment.status==="Submitted"&&invoice.status==="Submitted"&&
      approvalIsCurrent("payment",payment.id)&&approvalIsCurrent("invoice",invoice.id)&&
      payment.companyId===invoice.companyId&&payment.vendorId===invoice.vendorId&&
      Number.isFinite(Number(row.amount))&&Number(row.amount)>0&&
      invoiceAllocated+Number(row.amount)<=Number(invoice.totalAmount)+0.01&&
      paymentAllocated+Number(row.amount)<=Number(payment.amount)+0.01&&!duplicatePair&&
      typeof row.createdBy==="string"&&Boolean(row.createdBy);
     break;
    }
    case "followUpAssignments": allowed=scopeIds.has(row.recordId) || scopeIds.has(row.contactId); break;
    case "vendors": case "materials": case "processDefinitions": case "transportRoutes": {
     const visibleMaster=rows(access,collection).find(value=>value.id===row.id);
     allowed=privileged||Boolean(visibleMaster&&JSON.stringify(visibleMaster)===JSON.stringify(row));
     break;
    }
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
