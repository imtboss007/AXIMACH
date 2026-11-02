import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Calculator, Check, CircleDollarSign, FileText, Package, Plus, Search, ShieldCheck, Truck, Users, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, vendorSupportsProcessType, type QuotationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import { calculateRouteCostTotals } from "./costLedger";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type ComponentLineRef = { key: string; poId: string; poNumber: string; lineId: string; quantity: number; targetDelivery: string; unitPrice: number; componentId: string; jobStatus?: string; jobFinishedAt?: string; jobFinishedProcessCost?: number; jobFinishedActualProcessCost?: number; jobFinishedMissingActualRates?: number; jobFinishedOperationCount?: number; materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number; overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number; rejectedQty?: number; gstRate?: number };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const stamp = () => new Date().toISOString().slice(0,10);

export default function LinkedCostingWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const components = activeRows(data.components);
  const companies = activeRows(data.companies);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const quotations = activeRows(data.quotations);
  const standaloneCostPlans = activeRows(data.standaloneCostPlans || []);
  const [componentId, setComponentId] = useState("");
  const [lineKey, setLineKey] = useState("");
  const [operationId, setOperationId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [quotedAt, setQuotedAt] = useState(stamp());
  const [validUntil, setValidUntil] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ratePerPart, setRatePerPart] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [leadDays, setLeadDays] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [rateSearch, setRateSearch] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [ledgerCompanyId, setLedgerCompanyId] = useState("");
  const [ledgerPoId, setLedgerPoId] = useState("");
  const [ledgerComponentId, setLedgerComponentId] = useState("");
  const [ledgerVendorId, setLedgerVendorId] = useState("");
  const [ledgerProcessTypeId, setLedgerProcessTypeId] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");

  const selectedComponent = components.find(c => c.id === componentId);
  const componentLines: ComponentLineRef[] = useMemo(() => orders.flatMap(po => po.lines.filter(line => line.componentId === selectedComponent?.id).map(line => ({
    key: po.id + "::" + line.id, poId: po.id, poNumber: po.number, lineId: line.id, quantity: line.quantity, targetDelivery: line.targetDelivery || po.targetDelivery, unitPrice: line.unitPrice, componentId: line.componentId, jobStatus: line.jobStatus, jobFinishedAt: line.jobFinishedAt, jobFinishedProcessCost: line.jobFinishedProcessCost, jobFinishedActualProcessCost: line.jobFinishedActualProcessCost, jobFinishedMissingActualRates: line.jobFinishedMissingActualRates, jobFinishedOperationCount: line.jobFinishedOperationCount, materialQty: line.materialQty, materialRate: line.materialRate, benchmarkMaterialRate: line.benchmarkMaterialRate, overhead: line.overhead, toolingCost: line.toolingCost, reworkCost: line.reworkCost, scrapCost: line.scrapCost, rejectedQty: line.rejectedQty, gstRate: line.gstRate
  }))), [orders, selectedComponent?.id]);
  const selectedLine = componentLines.find(line => line.key === lineKey) || componentLines[0];
  const normaliseManualKey = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
  const standalonePlanFor = (componentNumber: string, poNumber: string) =>
    standaloneCostPlans.find(plan => normaliseManualKey(plan.componentNumber) === normaliseManualKey(componentNumber) &&
      normaliseManualKey(plan.poNumber) === normaliseManualKey(poNumber));
  const planPerPart = (plan?: typeof standaloneCostPlans[number]) => plan ? (
    plan.materialCostPerPart + plan.directLabourCostPerPart + plan.overheadCostPerPart +
    plan.toolingCostPerPart + plan.qualityCostPerPart + plan.reworkScrapCostPerPart +
    plan.packagingCostPerPart + plan.otherCostPerPart +
    (plan.processRows || []).reduce((sum, row) => sum + row.quantityPerPart * row.ratePerUnit + row.transportPerPart, 0)
  ) : null;
  const standalonePlan = selectedComponent && selectedLine ? standalonePlanFor(selectedComponent.partNumber, selectedLine.poNumber) : undefined;
  const componentBasePlanPerPart = standalonePlan ? (
    standalonePlan.materialCostPerPart + standalonePlan.directLabourCostPerPart + standalonePlan.overheadCostPerPart +
    standalonePlan.toolingCostPerPart + standalonePlan.qualityCostPerPart + standalonePlan.reworkScrapCostPerPart +
    standalonePlan.packagingCostPerPart + standalonePlan.otherCostPerPart
  ) : null;
  const componentProcessPlanPerPart = standalonePlan ? (standalonePlan.processRows || []).reduce((sum, row) => sum + row.quantityPerPart * row.ratePerUnit + row.transportPerPart, 0) : 0;
  const componentPlanPerPart = planPerPart(standalonePlan);
  const componentPlanTotalForLine = componentPlanPerPart === null || !selectedLine ? null : componentPlanPerPart * selectedLine.quantity;
  const routeOperations = operations.filter(op => op.componentId === selectedComponent?.id && (!selectedLine || (op.poId === selectedLine.poId && op.poLineId === selectedLine.lineId)));
  const selectedOperation = routeOperations.find(op => op.id === operationId) || routeOperations[0];
  const selectedOperationProcessTypeId = selectedOperation?.processTypeId || "";
  const quoteVendors = selectedOperationProcessTypeId ? vendors.filter(vendor => vendorSupportsProcessType(vendor,selectedOperationProcessTypeId)) : [];
  const quoteRows = quotations.filter(q => q.componentId === selectedComponent?.id && (!selectedLine || (q.poId === selectedLine.poId && q.poLineId === selectedLine.lineId)) && (!selectedOperation || q.operationId === selectedOperation.id))
    .filter(q => (q.quoteReference + " " + (vendors.find(v=>v.id===q.vendorId)?.company||"") + " " + q.status + " " + (routeOperations.find(op=>op.id===q.operationId)?.name||"")).toLowerCase().includes(quoteSearch.toLowerCase().trim()))
    .sort((a,b) => (b.quotedAt || "").localeCompare(a.quotedAt || ""));
  // PO-line overrides isolate material/cost/rejection inputs between different orders for the same component.
  const componentBomLines = data.bomLines.filter(line => line.componentId === selectedComponent?.id && !line.deletedAt);
  const bomMaterialQtyPerPart = componentBomLines.reduce((sum,line) => sum + line.quantityPerPart * (1 + line.scrapPercent / 100), 0);
  const bomMaterialCostPerPart = componentBomLines.reduce((sum,line) => sum + line.quantityPerPart * (1 + line.scrapPercent / 100) * (data.materials.find(material => material.id === line.materialId)?.ratePerUnit || 0), 0);
  const bomWeightedMaterialRate = bomMaterialQtyPerPart > 0 ? bomMaterialCostPerPart / bomMaterialQtyPerPart : 0;
  const masterMaterialQty = selectedComponent?.materialQty || 0;
  const masterMaterialRate = selectedComponent?.materialRate || 0;
  const materialQty = selectedLine?.materialQty ?? (masterMaterialQty > 0 ? masterMaterialQty : bomMaterialQtyPerPart * (selectedLine?.quantity || 0));
  const materialRate = selectedLine?.materialRate ?? (masterMaterialRate > 0 ? masterMaterialRate : bomWeightedMaterialRate);
  const materialCostSource = selectedLine?.materialQty !== undefined || selectedLine?.materialRate !== undefined ? "PO-line cost override" : masterMaterialQty > 0 && masterMaterialRate > 0 ? "Component master default" : bomMaterialQtyPerPart > 0 ? "Linked BOM estimate" : "No material rate / BOM entered";
  const benchmarkMaterialRate = selectedLine?.benchmarkMaterialRate ?? selectedComponent?.benchmarkMaterialRate ?? 0;
  const overhead = selectedLine?.overhead ?? selectedComponent?.overhead ?? 0;
  const toolingCost = selectedLine?.toolingCost ?? selectedComponent?.toolingCost ?? 0;
  const reworkCost = selectedLine?.reworkCost ?? selectedComponent?.reworkCost ?? 0;
  const scrapCost = selectedLine?.scrapCost ?? selectedComponent?.scrapCost ?? 0;
  const rejectedQty = selectedLine?.rejectedQty ?? selectedComponent?.rejectedQty ?? 0;
  const gstRate = selectedLine?.gstRate ?? selectedComponent?.gstRate ?? 0;
  const materialCost = materialQty * materialRate;
  const benchmarkMaterialCost = materialQty * benchmarkMaterialRate;
  const materialVariance = materialCost - benchmarkMaterialCost;
  const operationPlanned = routeOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const operationActual = routeOperations.reduce((sum,op) => sum + op.quantity * (op.actualRatePerPart > 0 ? op.actualRatePerPart : 0) + op.transportCost, 0);
  const extraCharges = overhead + toolingCost + reworkCost + scrapCost;
  const plannedTotal = materialCost + operationPlanned + extraCharges;
  const actualTotal = materialCost + operationActual + extraCharges;
  const plannedBaselineForLine = (componentNumber: string, poNumber: string): number | null =>
    planPerPart(standalonePlanFor(componentNumber, poNumber));
  const routePlannedPerPart = selectedLine && selectedLine.quantity > 0 ? plannedTotal / selectedLine.quantity : null;
  const routeVsComponentPlan = componentPlanPerPart !== null && routePlannedPerPart !== null ? routePlannedPerPart - componentPlanPerPart : null;
  const componentProcessBenchmark = (operationName: string, operationCategory?: string) => {
    const row = standalonePlan?.processRows.find(item =>
      normaliseManualKey(item.processName) === normaliseManualKey(operationName) &&
      (!operationCategory || !item.category || normaliseManualKey(item.category) === normaliseManualKey(operationCategory))
    );
    return row ? row.quantityPerPart * row.ratePerUnit + row.transportPerPart : undefined;
  };
  const sellingRate = selectedLine ? selectedLine.unitPrice : (selectedComponent?.salePrice || 0);
  const revenue = (selectedLine?.quantity || 0) * sellingRate;
  const gstEstimate = revenue * gstRate / 100;
  const finalOperation = routeOperations[routeOperations.length - 1];
  const acceptedQty = selectedLine && finalOperation && finalOperation.completed > 0 ? Math.max(0, Number(finalOperation.accepted) || 0) : 0;
  const profit = revenue - plannedTotal;
  const materialInputsComplete = Number.isFinite(materialQty) && materialQty > 0 && Number.isFinite(materialRate) && materialRate > 0;
  const selectedCostComplete = materialInputsComplete && sellingRate > 0 && routeOperations.length > 0 && routeOperations.every(op => op.quantity > 0 && op.ratePerPart > 0);
  const costPerAccepted = selectedCostComplete && acceptedQty > 0 ? plannedTotal / acceptedQty : null;
  const missingActualRates = routeOperations.filter(op => !(op.actualRatePerPart > 0)).length;
  const componentCostRows = orders.flatMap(po => po.lines.filter(line => components.some(component => component.id === line.componentId)).map(line => {
    const component = components.find(item => item.id === line.componentId)!;
    const bomLines = data.bomLines.filter(bom => bom.componentId === component.id && !bom.deletedAt);
    const bomQtyPerPart = bomLines.reduce((sum,bom) => sum + bom.quantityPerPart * (1 + bom.scrapPercent / 100), 0);
    const bomCostPerPart = bomLines.reduce((sum,bom) => sum + bom.quantityPerPart * (1 + bom.scrapPercent / 100) * (data.materials.find(material => material.id === bom.materialId)?.ratePerUnit || 0), 0);
    const qty = line.materialQty ?? (component.materialQty > 0 ? component.materialQty : bomQtyPerPart * line.quantity);
    const rate = line.materialRate ?? (component.materialRate > 0 ? component.materialRate : bomQtyPerPart > 0 ? bomCostPerPart / bomQtyPerPart : 0);
    const materialSource = line.materialQty !== undefined || line.materialRate !== undefined ? "PO line" : component.materialQty > 0 && component.materialRate > 0 ? "Component master" : bomQtyPerPart > 0 ? "Linked BOM" : "Missing material rate";
    const materialInputsComplete = Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0;
    const lineOperations = operations.filter(op => op.componentId === component.id && op.poId === po.id && op.poLineId === line.id);
    const process = lineOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
    const extras = (line.overhead ?? component.overhead ?? 0) + (line.toolingCost ?? component.toolingCost ?? 0) + (line.reworkCost ?? component.reworkCost ?? 0) + (line.scrapCost ?? component.scrapCost ?? 0);
    const material = qty * rate;
    const total = material + process + extras;
    const componentPlanPerPart = plannedBaselineForLine(component.partNumber, po.number);
    const plannedBaseline = componentPlanPerPart === null ? null : componentPlanPerPart * line.quantity;
    const revenueValue = line.quantity * line.unitPrice;
    const complete = materialInputsComplete && line.unitPrice > 0 && lineOperations.length > 0 && lineOperations.every(op => op.quantity > 0 && op.ratePerPart > 0);
    return { key: po.id + "::" + line.id, component, po, line, material, process, extras, total, componentPlanPerPart, plannedBaseline, revenue: revenueValue, profit: complete ? revenueValue - total : null, complete, materialSource, operationCount: lineOperations.length };
  }));
  const componentsWithoutPO = components.filter(component => !orders.some(po => po.lines.some(line => line.componentId === component.id))).map(component => ({
    key: "master::" + component.id, component, po: null, line: null,
    material: component.materialQty * component.materialRate, process: 0,
    extras: component.overhead + component.toolingCost + component.reworkCost + component.scrapCost,
    total: component.materialQty * component.materialRate + component.overhead + component.toolingCost + component.reworkCost + component.scrapCost,
    componentPlanPerPart: null, plannedBaseline: null,
    revenue: 0, profit: null, complete: false, materialSource: component.materialQty > 0 && component.materialRate > 0 ? "Component master" : "Missing material rate",
    operationCount: 0
  }));

  const allComponentCostRows = [...componentCostRows, ...componentsWithoutPO];
  // One finance row per PO component line. Planned amounts come only from the standalone component-number + PO-number register.
  const costLedgerRows = orders.flatMap(po => po.lines.filter(line => !("deletedAt" in line && (line as typeof line & {deletedAt?:string}).deletedAt)).map(line => {
    const component = components.find(item => item.id === line.componentId);
    if (!component) return null;
    const linked = operations.filter(op => op.poId === po.id && op.poLineId === line.id && op.componentId === component.id);
    const routeCosts = calculateRouteCostTotals(linked.map(operation => {
      const type = data.processTypes.find(item => item.id === operation.processTypeId);
      const category = type ? data.processCategories.find(item => item.id === type.categoryId) : undefined;
      return {...operation, processTypeName: type?.name, processCategoryName: category?.name};
    }));
    const componentPlanPerPart = plannedBaselineForLine(component.partNumber, po.number) || 0;
    const vendorIds = [...new Set(routeCosts.vendorIds)];
    const jobFinishedProcessCost = line.jobStatus === "Finished" ? Number(line.jobFinishedProcessCost) || 0 : 0;
    return {key:po.id+"::"+line.id,companyId:po.companyId,poId:po.id,poNumber:po.number,componentId:component.id,componentName:component.partNumber+" · "+component.name,quantity:line.quantity,jobStatus:line.jobStatus||"In progress",jobFinishedProcessCost,componentPlan:componentPlanPerPart*line.quantity,processPlanned:routeCosts.processPlanned,transportPlanned:routeCosts.transportPlanned,processedActual:routeCosts.processedActual,transportActual:routeCosts.transportActual,poCost:line.quantity*line.unitPrice,vendorIds,linked};
  })).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const visibleLedgerRows = costLedgerRows.filter(row =>
    (!ledgerCompanyId || row.companyId === ledgerCompanyId) &&
    (!ledgerPoId || row.poId === ledgerPoId) &&
    (!ledgerComponentId || row.componentId === ledgerComponentId) &&
    (!ledgerVendorId || row.vendorIds.includes(ledgerVendorId)) &&
    (!ledgerProcessTypeId || row.linked.some(operation => operation.processTypeId === ledgerProcessTypeId)) &&
    (!ledgerStatus || row.linked.some(operation => operation.status === ledgerStatus))
  );
  const ledgerTotals = visibleLedgerRows.reduce((sum,row)=>({
    componentPlan:sum.componentPlan+row.componentPlan,
    process:sum.process+row.processPlanned,
    transport:sum.transport+row.transportPlanned,
    actual:sum.actual+row.processedActual,
    finishedProcess:sum.finishedProcess+row.jobFinishedProcessCost,
    transportActual:sum.transportActual+row.transportActual,
    po:sum.po+row.poCost
  }),{componentPlan:0,process:0,transport:0,actual:0,finishedProcess:0,transportActual:0,po:0});

  const rankedComponentRows = componentCostRows.filter(row => row.profit !== null).sort((a,b) => (b.profit || 0) - (a.profit || 0));
  const processCostRows = operations.filter(op => components.some(component => component.id === op.componentId)).map(op => ({
    operation: op, component: components.find(component => component.id === op.componentId)!,
    po: orders.find(po => po.id === op.poId),
    vendor: vendors.find(vendor => vendor.id === op.vendorId),
    plannedCost: op.quantity * op.ratePerPart + op.transportCost,
    processName: data.processTypes.find(type => type.id === op.processTypeId)?.name || op.name
  })).sort((a,b) => a.processName.localeCompare(b.processName) || a.component.partNumber.localeCompare(b.component.partNumber));
  const directoryVendorRateRows = data.processVendorRates.filter(rate => !rate.deletedAt).flatMap(rate => {
    const vendor = vendors.find(item => item.id === rate.vendorId);
    if (!vendor) return [];
    const processType = data.processTypes.find(item => item.id === rate.processTypeId);
    return [{
      id: rate.id, source: "Process Directory" as const, componentId: "", poId: "",
      vendor, quoteReference: rate.quoteReference, quotedAt: rate.quotedAt,
      validFrom: rate.validFrom, validUntil: rate.validUntil, quantity: null as number | null,
      ratePerPart: rate.ratePerPart, transportCost: 0, leadDays: rate.leadDays,
      status: rate.status, processName: processType?.name || "Archived process type",
      processKey: rate.processTypeId, landedRate: rate.ratePerPart
    }];
  });
  const operationVendorRateRows = quotations.filter(q => !q.deletedAt).flatMap(q => {
    const vendor = vendors.find(item => item.id === q.vendorId);
    if (!vendor) return [];
    const operation = operations.find(op => op.id === q.operationId);
    const processName = operation ? (data.processTypes.find(type => type.id === operation.processTypeId)?.name || operation.name) : "Archived operation";
    const processKey = operation?.processTypeId || (operation ? operation.category + "::" + operation.name : q.operationId);
    const landedRate = q.ratePerPart + (q.quantity > 0 ? q.transportCost / q.quantity : 0);
    return [{
      id: q.id, source: "PO operation" as const, componentId: q.componentId, poId: q.poId,
      vendor, quoteReference: q.quoteReference, quotedAt: q.quotedAt,
      validFrom: "", validUntil: q.validUntil, quantity: q.quantity,
      ratePerPart: q.ratePerPart, transportCost: q.transportCost, leadDays: q.leadDays,
      status: q.status, processName, processKey, landedRate
    }];
  });
  const vendorRateRows = [...directoryVendorRateRows, ...operationVendorRateRows];
  const lowestVendorRateByProcess = new Map<string,number>();
  vendorRateRows.forEach(row => lowestVendorRateByProcess.set(row.processKey, Math.min(lowestVendorRateByProcess.get(row.processKey) ?? Number.POSITIVE_INFINITY, row.landedRate)));
  const sortedVendorRateRows = vendorRateRows
    .filter(row => !rateSearch.trim() || [row.source,row.processName,row.vendor.company,row.componentId ? components.find(c=>c.id===row.componentId)?.partNumber : "",row.poId ? orders.find(po=>po.id===row.poId)?.number : "",row.quoteReference,row.status,row.validFrom,row.validUntil].join(" ").toLowerCase().includes(rateSearch.toLowerCase().trim()))
    .sort((a,b) => a.processName.localeCompare(b.processName) || a.landedRate - b.landedRate);

  const openQuote = (forOperationId?: string) => {
    if (!selectedComponent) { onNotice("Create a component master record first."); return; }
    if (!selectedLine) { onNotice("Link this component to a saved purchase-order line before entering a quote."); return; }
    if (!routeOperations.length) { onNotice("Add the required process operations in Process Map first, then enter each vendor quotation against the exact operation."); return; }
    const targetOperation = routeOperations.find(operation => operation.id === forOperationId) || routeOperations[0];
    if (!targetOperation?.processTypeId) { onNotice("Link this operation to a Process Directory process type before recording a vendor quotation."); return; }
    setQuoteReference(""); setQuotedAt(stamp()); setValidUntil(""); setQuantity(String(selectedLine.quantity)); setRatePerPart(""); setTransportCost("0"); setLeadDays(""); setQuoteNotes("");
    setOperationId(targetOperation.id); setVendorId(""); setShowQuoteForm(true);
  };
  const saveQuote = () => {
    if (!selectedComponent || !selectedLine || !selectedOperation || !vendorId) { onNotice("Choose a component, PO line, process operation and vendor."); return; }
    if (!selectedOperation.processTypeId) { onNotice("Link this operation to a Process Directory process type before recording a vendor quotation."); return; }
    const chosenVendor = vendors.find(vendor => vendor.id === vendorId);
    if (!chosenVendor || !vendorSupportsProcessType(chosenVendor,selectedOperation.processTypeId)) { onNotice("Select a Vendor Master record assigned to this operation’s exact Process Directory type."); return; }
    const rate = Number(ratePerPart);
    const qty = Number(quantity);
    const transport = Number(transportCost || 0);
    const lead = Number(leadDays || 0);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(transport) || transport < 0 || !Number.isFinite(lead) || lead < 0) { onNotice("Enter a valid non-negative rate, transport and lead time, with a positive quoted quantity."); return; }
    if (!quotedAt || (validUntil && validUntil < quotedAt)) { onNotice("Enter a quote date and ensure validity does not end before the quote date."); return; }
    const stampNow = nowIso(); const id = makeId("quote");
    const quote: QuotationRecord = {
      id, poId: selectedLine.poId, poLineId: selectedLine.lineId, componentId: selectedComponent.id, operationId: selectedOperation.id, vendorId,
      quoteReference: quoteReference.trim(), quotedAt: quotedAt || stamp(), validUntil, quantity: qty, ratePerPart: rate,
      transportCost: transport, leadDays: lead,
      status: "Received", notes: quoteNotes.trim(), createdAt: stampNow, updatedAt: stampNow
    };
    update(current => ({ ...current, quotations: [...current.quotations, quote] }));
    setShowQuoteForm(false); onNotice("Quotation saved with component ID, PO-line ID, operation ID and vendor ID. It is recorded as a received quote, not an actual purchase/invoice.");
  };
  const selectQuote = (quote: QuotationRecord) => {
    const targetOperation = operations.find(operation => operation.id === quote.operationId);
    const targetVendor = vendors.find(vendor => vendor.id === quote.vendorId);
    if (!targetOperation || !targetOperation.processTypeId || !targetVendor || !vendorSupportsProcessType(targetVendor,targetOperation.processTypeId)) {
      onNotice("This saved quotation’s vendor is not assigned to the operation’s current Process Directory type. It remains in history and has not been applied.");
      return;
    }
    const selectedStamp = nowIso();
    update(current => ({
      ...current,
      quotations: current.quotations.map(q => q.operationId === quote.operationId && q.poLineId === quote.poLineId && !q.deletedAt
        ? { ...q, status: q.id === quote.id ? "Selected" : q.status === "Selected" ? "Received" : q.status, updatedAt: selectedStamp }
        : q),
      operations: current.operations.map(op => op.id === quote.operationId
        ? { ...op, vendorId: quote.vendorId, ratePerPart: quote.ratePerPart, transportCost: quote.transportCost, vendorPaymentStatus: op.vendorId === quote.vendorId ? (op.vendorPaymentStatus || "Not Paid") : "Not Paid", updatedAt: selectedStamp }
        : op)
    }));
    onNotice("Selected quote rate/vendor applied to this operation's planned cost. The quote remains separate from actual invoice cost.");
  };
  const setExtra = (key: "overhead" | "toolingCost" | "reworkCost" | "scrapCost" | "materialRate" | "benchmarkMaterialRate" | "materialQty" | "salePrice" | "rejectedQty" | "gstRate", value: number) => {
    if (!selectedComponent) return;
    const amount = Math.max(0, value);
    const updatedAt = nowIso();
    if (selectedLine) {
      const lineKeyName = key === "salePrice" ? "unitPrice" : key;
      update(current => ({
        ...current,
        purchaseOrders: current.purchaseOrders.map(po => po.id !== selectedLine.poId ? po : {
          ...po, updatedAt,
          lines: po.lines.map(line => line.id === selectedLine.lineId ? { ...line, [lineKeyName]: amount } : line)
        })
      }));
      return;
    }
    const componentKey = key === "salePrice" ? "salePrice" : key;
    update(current => ({ ...current, components: current.components.map(component => component.id === selectedComponent.id ? { ...component, [componentKey]: amount, updatedAt } : component) }));
  };

  return <section className="workspace-page linked-costing-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / COMPONENT + PROCESS RATE HISTORY</div><h1>Costing & quotations<span>.</span></h1><p>Compare component budget, PO operation rates, supplier quotations and actual vendor cost without mixing their source records.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("component-cost-planner")}><Calculator size={15}/> Planned Cost Register</button><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendor directory</button><button className="button-primary" onClick={() => openQuote()} disabled={!selectedComponent}><Plus size={15}/> Add process quotation</button></div></div>
    {!components.length ? <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>No component master records yet</h3><p>There are no sample components. Add your actual part number once; then create a PO line, add the required operations and record supplier quotations per operation.</p><button className="button-primary" onClick={() => onSelectModule("components")}><Plus size={14}/> Create component master</button></div></section> : <>
      <div className="linked-master-selectors linked-cost-selectors">
        <SearchablePicker id="cost-component" label="Component / part number" value={selectedComponent?.id||""} placeholder="Type part number or name…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={id=>{setComponentId(id);setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po-line" label="Purchase order / component line" value={selectedLine?.key||""} placeholder="Type PO number or due date…" options={componentLines.map(line=>({id:line.key,label:line.poNumber+" · "+line.quantity+" pcs · "+(line.targetDelivery||"No delivery date")}))} onChange={key=>{setLineKey(key);setOperationId("");}}/>
        <SearchablePicker id="cost-operation" label="Process operation" value={selectedOperation?.id||""} placeholder="Type operation name…" options={routeOperations.map(op=>({id:op.id,label:op.name+" · OP-"+op.sequence}))} onChange={setOperationId}/>
      </div>
      {!componentLines.length && <div className="module-safety-note"><FileText size={14}/><span>This component is not yet linked to a PO line. Create or edit the actual order in Purchase Orders; quotes will then be stored against that order line.</span><button className="button-quiet compact-button" onClick={() => onSelectModule("purchasing")}>Open purchase orders</button></div>}
      <div className="linked-component-summary"><div><small>COMPONENT</small><strong>{selectedComponent?.partNumber} · {selectedComponent?.name}</strong><span>Revision {selectedComponent?.revision || "—"} · {selectedComponent?.material || "Material not entered"}</span></div><div><small>MATERIAL COST</small><strong>{money(materialCost)}</strong><span>{materialQty.toLocaleString("en-IN")} units × {money(materialRate)} · {materialCostSource}</span></div><div><small>PROCESS + TRANSPORT</small><strong>{money(operationPlanned)}</strong><span>Rates selected or entered per operation</span></div><div><small>PLANNED COST / ACCEPTED PART</small><strong>{costPerAccepted === null ? "Not recorded" : money(costPerAccepted)}</strong><span>{acceptedQty > 0 ? acceptedQty.toLocaleString("en-IN")+" accepted in the final saved operation" : "Awaiting recorded accepted quantity in Process Map"}</span></div><div><small>JOB STATUS · PROCESS MAP</small><strong className={selectedLine?.jobStatus === "Finished" ? "cost-positive" : ""}>{selectedLine?.jobStatus || "In progress"}</strong><span>{selectedLine?.jobFinishedAt ? "Finished " + new Date(selectedLine.jobFinishedAt).toLocaleString("en-IN") : "Use Finish Job in Process Map when complete"}</span></div><div><small>FINISHED JOB · TOTAL PROCESS COST</small><strong>{selectedLine?.jobStatus === "Finished" ? money(selectedLine.jobFinishedProcessCost || 0) : "Not finished"}</strong><span>{selectedLine?.jobStatus === "Finished" ? (selectedLine.jobFinishedOperationCount || routeOperations.length) + " operations · " + (selectedLine.jobFinishedMissingActualRates ? selectedLine.jobFinishedMissingActualRates + " actual rates missing" : "Actual rates entered") : "Saved when you press Finish Job"}</span></div></div>
      <div className="linked-kpis linked-cost-kpis"><div className="route-kpi kpi-cost"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>STANDALONE PLANNED COST / PC</small><strong>{componentPlanPerPart === null ? "Not set" : money(componentPlanPerPart)}</strong><em>{componentPlanPerPart === null || componentPlanTotalForLine === null ? "Enter a matching component number + PO number in the Planned Cost Register" : money(componentPlanPerPart) + " per piece · " + money(componentPlanTotalForLine) + " across " + selectedLine!.quantity.toLocaleString("en-IN") + " pcs"}</em></span></div><div className="route-kpi kpi-quality"><span className="kpi-icon"><Check size={19}/></span><span><small>RECORDED ACTUAL COST</small><strong>{money(actualTotal)}</strong><em>{missingActualRates ? missingActualRates + " operation rate(s) missing · partial actual, not final invoice cost" : "Actual rates entered for every operation"}</em></span></div><div className="route-kpi kpi-delivery"><span className="kpi-icon"><Package size={19}/></span><span><small>ORDER VALUE</small><strong>{money(revenue)}</strong><em>{selectedLine?.quantity || 0} pcs × {money(sellingRate)}</em></span></div><div className="route-kpi kpi-risk"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>PO ROUTE ESTIMATE</small><strong>{money(plannedTotal)}</strong><em>Material + planned operation + transport + entered extras · compare against the standalone planned cost below</em></span></div></div>
      <section className="surface-panel ccp-costing-compare">
        <div className="panel-heading"><div><div className="eyebrow">STANDALONE PLAN / LIVE ROUTE COMPARISON</div><h3>{selectedComponent?.partNumber || "Component"} · PO {selectedLine?.poNumber || "—"}</h3><p>The planned record is matched by component number + PO number only. Saving it does not change operational master records.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("component-cost-planner")}><Calculator size={13}/> Edit planned cost</button></div>
        <div className="ccp-costing-compare-grid">
          <div><small>STANDALONE PLANNED COST / PC</small><strong>{componentPlanPerPart === null ? "Not found" : money(componentPlanPerPart)}</strong><span>{standalonePlan ? standalonePlan.status + " · " + money(componentBasePlanPerPart || 0) + " other costs + " + money(componentProcessPlanPerPart) + " process costs" : "No matching component number + PO number record"}</span></div>
          <div><small>PLANNED TOTAL FOR THIS PO</small><strong>{componentPlanTotalForLine === null ? "Not available" : money(componentPlanTotalForLine)}</strong><span>{selectedLine ? selectedLine.quantity.toLocaleString("en-IN") + " pcs × planned cost per piece" : "Select a PO component line"}</span></div>
          <div className={routeVsComponentPlan === null ? "ccp-variance-missing" : routeVsComponentPlan > 0 ? "ccp-variance-over" : "ccp-variance-under"}><small>LIVE ROUTE VS PLAN / PC</small><strong>{routeVsComponentPlan === null ? "Not comparable" : (routeVsComponentPlan > 0 ? "+" : "") + money(routeVsComponentPlan)}</strong><span>{routeVsComponentPlan === null ? "A matching standalone plan is required" : routeVsComponentPlan > 0 ? "PO route is above standalone plan" : routeVsComponentPlan < 0 ? "PO route is below standalone plan" : "PO route matches the plan"}</span></div>
        </div>
      </section>
      {selectedLine?.jobStatus === "Finished" && <section className="surface-panel job-finished-cost-card"><div><div className="eyebrow">MANUALLY FINISHED IN PROCESS MAP</div><h3>Saved total process cost</h3><p>Captured when Finish Job was pressed. Entered route rates and actual-rate subtotal are shown separately.</p></div><div><small>TOTAL PROCESS MAP COST</small><strong>{money(selectedLine.jobFinishedProcessCost || 0)}</strong></div><div><small>RECORDED ACTUAL PROCESS COST</small><strong>{money(selectedLine.jobFinishedActualProcessCost || 0)}</strong><span>{selectedLine.jobFinishedMissingActualRates ? selectedLine.jobFinishedMissingActualRates + " actual rate(s) missing" : "All actual process rates recorded"}</span></div></section>}
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUOTE-TO-OPERATION LINK</div><h3>Process costs for {selectedComponent?.partNumber}</h3><p>Each row references a specific operation ID and PO component line.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><ArrowRight size={14}/> Manage operations</button></div>
        {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Operation</th><th>Vendor</th><th>Vendor payment</th><th>Qty</th><th>Selected quote / rate</th><th>Standalone planned process / pc</th><th>Actual rate / part</th><th>Transport</th><th>Planned process cost</th><th>Quotes</th></tr></thead><tbody>{routeOperations.map(op => {
          const quoteCount = quotations.filter(q => q.operationId === op.id && !q.deletedAt).length;
          const vendor = vendors.find(v => v.id === op.vendorId);
          return <tr key={op.id}><td><strong>{op.name}</strong><small>{op.category || "Type not entered"} · OP-{op.sequence}</small></td><td>{vendor?.company || "Not assigned"}</td><td>{vendor ? (op.vendorPaymentStatus || "Not Paid") : "—"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{componentProcessBenchmark(op.name,op.category) === undefined ? "Not set" : money(componentProcessBenchmark(op.name,op.category)!)}</td><td>{(op.actualRatePerPart || 0) > 0 ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.transportCost)}</td><td>{money(op.quantity * op.ratePerPart + op.transportCost)}</td><td><button className="button-quiet compact-button" onClick={() => {openQuote(op.id);}}><Plus size={12}/> {quoteCount} · Add quote</button></td></tr>;
        })}</tbody></table></div> : <div className="module-empty-state"><FileText size={25}/><h3>No process operations linked yet</h3><p>Add the actual operations in Process Map for this component and PO line before recording supplier quotations.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}><Plus size={14}/> Add operations</button></div>}
      </section>
      {showQuoteForm && <section className="surface-panel module-record-form-panel linked-quote-form"><div className="panel-heading"><div><h3>New supplier quotation</h3><p>Quote source and status stay separate from actual accepted invoice / job cost.</p></div><button className="icon-control" onClick={() => setShowQuoteForm(false)} aria-label="Close quote form"><X size={15}/></button></div>
        <div className="module-record-form">
          <label>PO / component line<select value={selectedLine?.key || ""} onChange={e => {setLineKey(e.target.value);setOperationId("");setVendorId("");}}><option value="">Select line…</option>{componentLines.map(l=><option key={l.key} value={l.key}>{l.poNumber} · {l.quantity} pcs</option>)}</select></label>
          <label>Process operation *<select value={selectedOperation?.id || operationId} onChange={e => {setOperationId(e.target.value);setVendorId("");}}><option value="">Select operation…</option>{routeOperations.map(op=><option key={op.id} value={op.id}>{op.name} · OP-{op.sequence}</option>)}</select></label>
          <label>Vendor / supplier *<select value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">Select actual vendor…</option>{quoteVendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.phone || "No phone"}{v.status.toLowerCase().includes("unverified") ? " · Unverified contact" : ""}</option>)}</select>{!selectedOperationProcessTypeId?<small className="field-hint">Select an operation linked to a Process Directory type first.</small>:!quoteVendors.length?<small className="field-hint">No vendors are registered for this operation’s process type. Add one in Vendor Master under that process.</small>:null}</label>
          <label>Quotation reference<input value={quoteReference} onChange={e=>setQuoteReference(e.target.value)} placeholder="Supplier quote / email / RFQ reference"/></label>
          <label>Quote date<input type="date" value={quotedAt} onChange={e=>setQuotedAt(e.target.value)}/></label>
          <label>Valid until<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
          <label>Quantity quoted<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
          <label>Rate per part (₹) *<input type="number" min="0" step="0.01" value={ratePerPart} onChange={e=>setRatePerPart(e.target.value)} placeholder="Enter quote received"/></label>
          <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={transportCost} onChange={e=>setTransportCost(e.target.value)}/></label>
          <label>Lead time (calendar days)<input type="number" min="0" value={leadDays} onChange={e=>setLeadDays(e.target.value)} placeholder="Supplier's committed lead time"/></label>
          <label className="module-form-wide">Quote notes<input value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)} placeholder="Scope, exclusions, taxes, delivery terms, validity…"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveQuote}><Check size={14}/> Save quotation</button><button className="button-quiet" onClick={()=>setShowQuoteForm(false)}>Cancel</button></div>
        </div>
      </section>}
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLIER QUOTATION HISTORY</div><h3>Quotes received ({quoteRows.length})</h3><p>Compare real quotations supplied by vendors; missing rates stay blank rather than being guessed.</p></div><label className="module-record-search"><Search size={14}/><input value={quoteSearch} onChange={e=>setQuoteSearch(e.target.value)} placeholder="Search quote, vendor, process…"/></label></div>
        {quoteRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Quote reference</th><th>Quote date</th><th>Validity</th><th>Qty</th><th>Rate / part</th><th>Transport</th><th>Lead days</th><th>Status</th><th>Action</th></tr></thead><tbody>{quoteRows.map(q => <tr key={q.id}><td>{routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"}</td><td>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</td><td>{q.quoteReference || "Not entered"}</td><td>{q.quotedAt || "—"}</td><td>{q.validUntil || "—"}</td><td>{q.quantity.toLocaleString("en-IN")}</td><td>{money(q.ratePerPart)}</td><td>{money(q.transportCost)}</td><td>{q.leadDays || "—"}</td><td><span className={"record-state state-" + q.status.toLowerCase()}>{q.status}</span></td><td>{q.status === "Selected" ? <span>Applied to operation</span> : <button className="button-primary compact-button" onClick={() => selectQuote(q)}><Check size={12}/> Use this rate</button>}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No quotations saved for this component/PO line/process yet.</div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPONENT OTHER COSTS</div><h3>Material, overhead and other entered costs</h3><p>When a PO line is selected, edits are saved to that line only so this order’s costs and rejects do not affect another order for the same part. Blank material defaults are estimated from linked BOM lines and their entered material rates; this is an estimate, not a supplier invoice.</p></div></div>
        <div className="module-record-form">
          <label>Material quantity<input type="number" min="0" step="0.001" value={materialQty} onChange={e=>setExtra("materialQty",Number(e.target.value)||0)}/></label>
          <label>Material rate per unit (₹)<input type="number" min="0" step="0.01" value={materialRate} onChange={e=>setExtra("materialRate",Number(e.target.value)||0)}/></label>
          <label>Benchmark material rate (₹)<input type="number" min="0" step="0.01" value={benchmarkMaterialRate} onChange={e=>setExtra("benchmarkMaterialRate",Number(e.target.value)||0)}/></label>
          <label>Selling rate per part (₹)<input type="number" min="0" step="0.01" value={sellingRate} onChange={e=>setExtra("salePrice",Number(e.target.value)||0)}/></label>
          <label>Overhead (₹)<input type="number" min="0" step="0.01" value={overhead} onChange={e=>setExtra("overhead",Number(e.target.value)||0)}/></label>
          <label>Tooling / fixture (₹)<input type="number" min="0" step="0.01" value={toolingCost} onChange={e=>setExtra("toolingCost",Number(e.target.value)||0)}/></label>
          <label>Rework cost (₹)<input type="number" min="0" step="0.01" value={reworkCost} onChange={e=>setExtra("reworkCost",Number(e.target.value)||0)}/></label>
          <label>Scrap / rejection loss (₹)<input type="number" min="0" step="0.01" value={scrapCost} onChange={e=>setExtra("scrapCost",Number(e.target.value)||0)}/></label>
          <label>Rejected quantity (pcs)<input type="number" min="0" value={rejectedQty} onChange={e=>setExtra("rejectedQty",Number(e.target.value)||0)}/></label>
          <label>GST rate (%)<input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={e=>setExtra("gstRate",Math.min(100,Number(e.target.value)||0))}/></label>
        </div>
        <div className="linked-cost-summary-lines"><div><span>Entered material cost</span><strong>{money(materialCost)}</strong></div><div><span>Material cost source</span><strong>{materialCostSource}</strong></div><div><span>Entered benchmark material value (not live market data)</span><strong>{money(benchmarkMaterialCost)}</strong></div><div><span>Material variance vs entered benchmark</span><strong>{money(materialVariance)}</strong></div><div><span>Planned process + transport</span><strong>{money(operationPlanned)}</strong></div><div><span>Entered overhead / tooling / rework / scrap</span><strong>{money(extraCharges)}</strong></div><div><span>Planned total before GST</span><strong>{money(plannedTotal)}</strong></div><div><span>Recorded actual cost (partial where actual operation rates are missing)</span><strong>{money(actualTotal)}</strong></div><div><span>Estimated P/L before GST</span><strong>{selectedCostComplete ? money(profit) : "Incomplete inputs"}</strong></div><div><span>Entered GST rate / illustrative GST on order value</span><strong>{gstRate}% · {money(gstEstimate)}</strong></div></div>
      </section>

      <section className="surface-panel axi-cost-ledger">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> MULTI-COMPANY COST CONTROL</div><h3>Consolidated component / PO cost ledger</h3><p>One row per company + PO + component line. Standalone planned cost is matched by the manually entered component number and PO number. Finished process cost is the snapshot saved when Finish Job was pressed in Process Map.</p></div><span className="module-number">{visibleLedgerRows.length} LINES</span></div>
        <div className="axi-cost-ledger-filters">
          <label>Company<select value={ledgerCompanyId} onChange={e=>setLedgerCompanyId(e.target.value)}><option value="">All companies</option>{companies.filter(company=>orders.some(po=>po.companyId===company.id)).map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label>Purchase order<select value={ledgerPoId} onChange={e=>setLedgerPoId(e.target.value)}><option value="">All POs</option>{orders.filter(po=>!ledgerCompanyId||po.companyId===ledgerCompanyId).map(po=><option key={po.id} value={po.id}>{po.number}</option>)}</select></label>
          <label>Component<select value={ledgerComponentId} onChange={e=>setLedgerComponentId(e.target.value)}><option value="">All components</option>{components.map(item=><option key={item.id} value={item.id}>{item.partNumber} · {item.name}</option>)}</select></label>
          <label>Vendor involved<select value={ledgerVendorId} onChange={e=>setLedgerVendorId(e.target.value)}><option value="">All vendors</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company}</option>)}</select></label>
          <label>Process<select value={ledgerProcessTypeId} onChange={e=>setLedgerProcessTypeId(e.target.value)}><option value="">All processes</option>{data.processTypes.filter(type=>!type.deletedAt).map(type=><option key={type.id} value={type.id}>{data.processCategories.find(category=>category.id===type.categoryId)?.name || "Process"} · {type.name}</option>)}</select></label>
          <label>Operation status<select value={ledgerStatus} onChange={e=>setLedgerStatus(e.target.value)}><option value="">All statuses</option>{["Queued","Running","Complete","Quality hold"].map(status=><option key={status} value={status}>{status}</option>)}</select></label>
          <button type="button" className="button-quiet compact-button" onClick={()=>{setLedgerCompanyId("");setLedgerPoId("");setLedgerComponentId("");setLedgerVendorId("");setLedgerProcessTypeId("");setLedgerStatus("");}}>Clear filters</button>
        </div>
        <div className="axi-cost-ledger-totals">
          <div><small>STANDALONE PLAN</small><strong>{money(ledgerTotals.componentPlan)}</strong></div><div><small>FINISHED JOB PROCESS COST</small><strong>{money(ledgerTotals.finishedProcess)}</strong></div>
          <div><small>PLANNED PROCESS</small><strong>{money(ledgerTotals.process)}</strong></div>
          <div><small>TRANSPORT / DISPATCH</small><strong>{money(ledgerTotals.transport)}</strong></div>
          <div><small>ACTUAL PROCESSED</small><strong>{money(ledgerTotals.actual)}</strong></div>
          <div><small>TRANSPORT ACTUAL</small><strong>{money(ledgerTotals.transportActual)}</strong></div>
          <div><small>PO VALUE</small><strong>{money(ledgerTotals.po)}</strong></div>
        </div>
        {visibleLedgerRows.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Company</th><th>PO</th><th>Component</th><th>PO Qty</th><th>Standalone plan</th><th>Job status</th><th>Finished process cost</th><th>Planned process</th><th>Transport / dispatch planned</th><th>Actual processed</th><th>Transport actual</th><th>PO cost</th><th>Linked vendors</th></tr></thead><tbody>{visibleLedgerRows.map(row=><tr key={row.key}><td>{companies.find(x=>x.id===row.companyId)?.name||"—"}</td><td>{row.poNumber}</td><td><strong>{row.componentName}</strong></td><td>{row.quantity.toLocaleString("en-IN")}</td><td>{money(row.componentPlan)}</td><td>{row.jobStatus}</td><td>{row.jobStatus === "Finished" ? money(row.jobFinishedProcessCost) : "Not finished"}</td><td>{money(row.processPlanned)}</td><td>{money(row.transportPlanned)}</td><td>{money(row.processedActual)}</td><td>{money(row.transportActual)}</td><td><strong>{money(row.poCost)}</strong></td><td>{row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company).filter(Boolean).join(", ")||"Not assigned"}</td></tr>)}</tbody></table></div>:<div className="vendor-empty">No PO component rows match these filters.</div>}
        <div className="module-safety-note"><Truck size={14}/><span>Transport / dispatch process rates and per-operation transport charges are split from manufacturing rates. Both the process vendor and transport vendor are included in vendor filters and the component/PO ledger.</span></div>
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPONENT PROFITABILITY</div><h3>All-component cost and selling-price comparison</h3><p>One row per PO component line. Profit/loss is ranked only where material, selling price and all planned operation rates are entered; master-only components remain visible but are not assigned invented revenue.</p></div><span className="module-number">{allComponentCostRows.length} ROWS</span></div>
        {allComponentCostRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Rank</th><th>Component</th><th>PO / line</th><th>Qty</th><th>Planner baseline</th><th>Material cost</th><th>Process cost</th><th>Other costs</th><th>PO route estimate</th><th>Route vs plan</th><th>Selling value</th><th>Profit / loss</th><th>Coverage</th></tr></thead><tbody>{allComponentCostRows.map(row => {const rank=rankedComponentRows.findIndex(item=>item.key===row.key);const planVariance=row.plannedBaseline===null?null:row.total-row.plannedBaseline;return <tr key={row.key}><td>{rank>=0 ? "#" + (rank+1) : "—"}</td><td><strong>{row.component.partNumber}</strong><small>{row.component.name}</small></td><td>{row.po?.number || "No PO line"}</td><td>{row.line?.quantity.toLocaleString("en-IN") || "—"}</td><td>{row.plannedBaseline===null?(row.componentPlanPerPart===null?"Not set":money(row.componentPlanPerPart)+" / pc"):money(row.plannedBaseline)}</td><td>{money(row.material)}</td><td>{money(row.process)}</td><td>{money(row.extras)}</td><td><strong>{money(row.total)}</strong></td><td className={planVariance===null?"cost-incomplete":planVariance>0?"cost-negative":"cost-positive"}>{planVariance===null?"Not comparable":(planVariance>0?"+":"")+money(planVariance)}</td><td>{row.line ? money(row.revenue) : "—"}</td><td>{row.profit === null ? "Incomplete" : <strong>{money(row.profit)}</strong>}</td><td>{row.complete ? "Complete inputs" : row.materialSource === "Missing material rate" ? "Material rate missing" : row.operationCount === 0 ? "No operations" : "Rate / selling inputs missing"}</td></tr>;})}</tbody></table></div> : <div className="vendor-empty">No component cost rows are linked to purchase orders yet.</div>}
        {rankedComponentRows.length > 0 && <div className="linked-cost-summary-lines"><div><span>Ranked components</span><strong>{rankedComponentRows.length}</strong></div><div><span>Loss-making components</span><strong>{rankedComponentRows.filter(row=>(row.profit||0)<0).length}</strong></div><div><span>Highest estimated profit</span><strong>{money(rankedComponentRows[0].profit || 0)} · {rankedComponentRows[0].component.partNumber}</strong></div><div><span>Lowest ranked profit</span><strong>{money(rankedComponentRows[rankedComponentRows.length-1].profit || 0)} · {rankedComponentRows[rankedComponentRows.length-1].component.partNumber}</strong></div></div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PROCESS-WISE COST COMPARISON</div><h3>Process costs across components</h3><p>Actual Process Map operation quantities, planned rates, transport costs and vendor payment statuses; operations are not multiplied by PO quantity a second time.</p></div></div>
        {processCostRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Component</th><th>PO</th><th>Vendor</th><th>Qty processed</th><th>Rate / part</th><th>Transport</th><th>Planned process cost</th><th>Vendor payment</th></tr></thead><tbody>{processCostRows.map(row=><tr key={row.operation.id}><td>{row.processName}</td><td>{row.component.partNumber}</td><td>{row.po?.number || "Archived PO"}</td><td>{row.vendor?.company || "Not assigned"}</td><td>{row.operation.quantity.toLocaleString("en-IN")}</td><td>{money(row.operation.ratePerPart)}</td><td>{money(row.operation.transportCost)}</td><td>{money(row.plannedCost)}</td><td>{row.vendor ? (row.operation.vendorPaymentStatus || "Not Paid") : "—"}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No saved Process Map operations to compare.</div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> VENDOR RATE COMPARISON</div><h3>Supplier rates for the same process</h3><p>Includes reusable Process Directory rates and PO-operation quotations. The source is labelled; PO quotation landed rates include transport per quoted unit, while Process Directory rates use the entered process rate because no transport field is recorded there.</p></div><label className="module-record-search"><Search size={14}/><input value={rateSearch} onChange={e=>setRateSearch(e.target.value)} placeholder="Search process, vendor, quote or PO…"/></label></div>
         {sortedVendorRateRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Source</th><th>Process</th><th>Component</th><th>PO</th><th>Vendor</th><th>Quote reference</th><th>Quote date</th><th>Valid from</th><th>Valid until</th><th>Qty</th><th>Rate / part</th><th>Transport</th><th>Landed / part</th><th>Difference vs lowest</th><th>Status</th></tr></thead><tbody>{sortedVendorRateRows.map(row=>{const lowest=lowestVendorRateByProcess.get(row.processKey) ?? row.landedRate;return <tr key={row.source+":"+row.id}><td>{row.source}</td><td>{row.processName}</td><td>{row.componentId ? components.find(c=>c.id===row.componentId)?.partNumber || "Archived" : "—"}</td><td>{row.poId ? orders.find(po=>po.id===row.poId)?.number || "Archived PO" : "—"}</td><td>{row.vendor.company}</td><td>{row.quoteReference || "Not entered"}</td><td>{row.quotedAt || "—"}</td><td>{row.validFrom || "—"}</td><td>{row.validUntil || "Not recorded"}</td><td>{row.quantity === null ? "—" : row.quantity.toLocaleString("en-IN")}</td><td>{money(row.ratePerPart)}</td><td>{money(row.transportCost)}</td><td><strong>{money(row.landedRate)}</strong></td><td>{row.landedRate === lowest ? "Lowest entered" : money(row.landedRate-lowest)}</td><td>{row.status}</td></tr>;})}</tbody></table></div> : <div className="vendor-empty">No Process Directory rates or PO-operation quotations match this comparison.</div>}
       </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Quotation amounts are supplier inputs, not live market benchmarks. Selecting a quote updates the operation's planned vendor/rate; it does not mark it as an invoice or actual expense.</span></div>
  </section>;
}
