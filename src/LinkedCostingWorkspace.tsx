import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarClock, Check, CircleDollarSign, FileText, Gauge, Package, Plus, Recycle, RotateCcw, Search, ShieldCheck, Truck, Users, Wallet, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type QuotationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { ComponentIcon, ProcessIcon } from "./IconStudio";

type LinkedNavigationContext = { companyId?: string; poId?: string; poLineId?: string; componentId?: string; operationId?: string; vendorId?: string };
type Props = { initialContext?: LinkedNavigationContext; onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string, context?: LinkedNavigationContext) => void };
type ComponentLineRef = { key: string; poId: string; poNumber: string; lineId: string; quantity: number; targetDelivery: string; unitPrice: number; componentId: string; materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number; overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number; rejectedQty?: number; gstRate?: number };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const stamp = () => new Date().toISOString().slice(0,10);

export default function LinkedCostingWorkspace({ initialContext, onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const components = activeRows(data.components);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const quotations = activeRows(data.quotations);
  const [companyId, setCompanyId] = useState("");
  const [rollupCompanyIds, setRollupCompanyIds] = useState<string[]>([]);
  const [rollupPoIds, setRollupPoIds] = useState<string[]>([]);
  const [rollupComponentIds, setRollupComponentIds] = useState<string[]>([]);
  const [rollupQuantities, setRollupQuantities] = useState<number[]>([]);
  const [rollupVendorIds, setRollupVendorIds] = useState<string[]>([]);
  const [poValueWarningPercent, setPoValueWarningPercent] = useState(90);
  const [poId, setPoId] = useState("");
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
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  const preferredCompanyId = orders.find(po => po.lines.some(line => !("deletedAt" in line && (line as any).deletedAt)))?.companyId || companies[0]?.id || "";
  useEffect(() => {
    if (!companies.some(company => company.id === companyId) && preferredCompanyId) { setCompanyId(preferredCompanyId); setPoId(""); setLineKey(""); }
    if (!preferredCompanyId && companyId) { setCompanyId(""); setPoId(""); setLineKey(""); }
  }, [companies, companyId, preferredCompanyId]);
  const companyOrders = orders.filter(po => po.companyId === companyId);
  const selectedCompany = companies.find(company => company.id === companyId);
  const paymentTransactionsForCompany = activeRows(data.paymentTransactions||[]);
  const companyRollupRows = orders.flatMap(po => po.lines.filter(line=>!("deletedAt" in line && (line as any).deletedAt)).map(line=>{
    const component=components.find(item=>item.id===line.componentId);
    const linkedOperations=operations.filter(op=>op.poId===po.id&&op.poLineId===line.id&&op.componentId===line.componentId);
    const costedLinkedOperations=linkedOperations.filter(op=>op.costIncluded!==false);
    const revenue=line.quantity*(Number(line.unitPrice)>0?line.unitPrice:(component?.salePrice||0));
    const processCost=costedLinkedOperations.reduce((sum,op)=>sum+op.quantity*(op.actualRatePerPart||0),0);
    const includedTransportLegs=(data.transportLegs||[]).filter(leg=>!leg.deletedAt&&leg.poId===po.id&&leg.poLineId===line.id&&leg.componentId===line.componentId&&(!leg.anchorOperationId||linkedOperations.find(op=>op.id===leg.anchorOperationId)?.costIncluded!==false));
    // A legacy operation transport entry and a new transport leg can represent the same saved route.
    // Exclude the legacy amount only when route ID, anchor operation and total snapshot amount match exactly.
    const isDuplicateLegacyTransport=(op:typeof costedLinkedOperations[number])=>includedTransportLegs.some(leg=>leg.anchorOperationId===op.id&&Boolean(op.transportRouteId)&&leg.routeId===op.transportRouteId&&Math.abs((Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0))-Math.max(0,Number(op.transportCost)||0))<0.01);
    const legacyTransport=costedLinkedOperations.reduce((sum,op)=>sum+(isDuplicateLegacyTransport(op)?0:Math.max(0,Number(op.transportCost)||0)),0);
    const routeTransport=includedTransportLegs.reduce((sum,leg)=>sum+Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0),0);
    const transportCost=legacyTransport+routeTransport;
    const plannedRows=activeRows(data.plannedCosts).filter(row=>{
      const componentMatches=row.componentId
        ? row.componentId===line.componentId
        : (row.componentNumber.trim().toLowerCase()===(component?.partNumber||"").trim().toLowerCase()
          || row.componentName.trim().toLowerCase()===(component?.name||"").trim().toLowerCase());
      const companyMatches=row.companyId
        ? row.companyId===po.companyId
        : (!row.companyName || row.companyName.trim().toLowerCase()===((companies.find(item=>item.id===po.companyId)?.name)||"").trim().toLowerCase());
      const poMatches=row.poId
        ? row.poId===po.id
        : (!row.poNumber || row.poNumber.trim().toLowerCase()===po.number.trim().toLowerCase());
      return componentMatches && companyMatches && poMatches;
    });
    const plannedProcess=costedLinkedOperations.reduce((sum,op)=>sum+op.quantity*Math.max(0,Number(op.ratePerPart)||0),0);
    const plannedProcessCost=plannedRows.length?plannedRows.reduce((sum,row)=>sum+row.plannedQty*row.plannedRate,0):plannedProcess;
    const bomLines=data.bomLines.filter(bom=>bom.componentId===line.componentId&&!bom.deletedAt);
    const bomMaterialQtyPerPart=bomLines.reduce((sum,bom)=>sum+bom.quantityPerPart*(1+bom.scrapPercent/100),0);
    const bomMaterialRate=bomMaterialQtyPerPart>0?bomLines.reduce((sum,bom)=>sum+bom.quantityPerPart*(1+bom.scrapPercent/100)*(data.materials.find(material=>material.id===bom.materialId)?.ratePerUnit||0),0)/bomMaterialQtyPerPart:0;
    const materialQty=line.materialQty??((component?.materialQty||0)>0?(component?.materialQty||0)*line.quantity:bomMaterialQtyPerPart*line.quantity);
    const materialRate=line.materialRate??((component?.materialRate||0)>0?(component?.materialRate||0):bomMaterialRate);
    const materialCost=materialQty*materialRate;
    const extras=(line.overhead??component?.overhead??0)+(line.toolingCost??component?.toolingCost??0)+(line.reworkCost??component?.reworkCost??0)+(line.scrapCost??component?.scrapCost??0);
    const actualExtras=(line.overhead??0)+(line.toolingCost??0)+(line.reworkCost??0)+(line.scrapCost??0);
    const materialCostExplicitlyEntered=line.materialQty!==undefined&&line.materialRate!==undefined;
    const actualMaterialCost=materialCostExplicitlyEntered?materialCost:0;
    const estimatedMaterialCost=materialCostExplicitlyEntered?0:materialCost;
    const plannedCost=materialCost+plannedProcessCost+transportCost+extras;
    const recordedCost=actualMaterialCost+processCost+transportCost+actualExtras;
    const paymentForOperation=(op:(typeof costedLinkedOperations)[number])=>{
      const txns=paymentTransactionsForCompany.filter(txn=>txn.operationId===op.id);
      return txns.length?txns.reduce((sub,txn)=>sub+Math.max(0,Number(txn.amount)||0),0):Math.max(0,Number(op.paidAmount)||0);
    };
    const paid=costedLinkedOperations.reduce((sum,op)=>sum+paymentForOperation(op),0);
    const unpaidProcess=Math.max(0,processCost-paid);
    const processOverpayment=Math.max(0,paid-processCost);
    const processVariance=processCost-plannedProcessCost;
    const vendorCostMap=new Map<string,{vendorId:string;processCost:number;plannedProcessCost:number;transportCost:number;paid:number}>();
    const vendorBucket=(vendorId:string)=>{
      if(!vendorId)return undefined;
      if(!vendorCostMap.has(vendorId))vendorCostMap.set(vendorId,{vendorId,processCost:0,plannedProcessCost:0,transportCost:0,paid:0});
      return vendorCostMap.get(vendorId)!;
    };
    const duplicateLegacyTransportIds=new Set(costedLinkedOperations.filter(op=>includedTransportLegs.some(leg=>leg.anchorOperationId===op.id&&Boolean(op.transportRouteId)&&leg.routeId===op.transportRouteId&&Math.abs((Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0))-Math.max(0,Number(op.transportCost)||0))<0.01)).map(op=>op.id));
    costedLinkedOperations.forEach(op=>{
      const processVendor=vendorBucket(op.vendorId);
      if(processVendor){processVendor.processCost+=op.quantity*(op.actualRatePerPart||0);processVendor.plannedProcessCost+=op.quantity*Math.max(0,Number(op.ratePerPart)||0);processVendor.paid+=paymentForOperation(op);}
      const transportVendor=vendorBucket(op.transportVendorId||op.vendorId);
      if(transportVendor&&!duplicateLegacyTransportIds.has(op.id))transportVendor.transportCost+=Math.max(0,Number(op.transportCost)||0);
    });
    includedTransportLegs.forEach(leg=>{
      const transportVendor=vendorBucket(leg.vendorId);
      if(transportVendor)transportVendor.transportCost+=Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0);
    });
    const vendorBreakdown=[...vendorCostMap.values()].map(item=>({...item,recordedDirectCost:item.processCost+item.transportCost,unpaidProcess:Math.max(0,item.processCost-item.paid)}));
    const vendorIds=vendorBreakdown.map(item=>item.vendorId);
    const budgetEntered=plannedRows.length>0||plannedProcessCost>0||materialCost>0||transportCost>0||extras>0;
    // Component-master and BOM material rates are planning estimates, not evidence of actual material spend.
    // Only a complete PO-line override is counted as an explicitly entered material cost.
    const lineExtrasExplicitlyEntered=[line.overhead,line.toolingCost,line.reworkCost,line.scrapCost].some(value=>value!==undefined);
    const actualCostEntered=costedLinkedOperations.some(op=>Number(op.actualRatePerPart)>0)||materialCostExplicitlyEntered||transportCost>0||lineExtrasExplicitlyEntered;
    return {po,line,component,linkedOperations,revenue,processCost,transportCost,plannedCost,plannedProcessCost,materialCost,actualMaterialCost,estimatedMaterialCost,extras,actualExtras,paid,unpaidProcess,processOverpayment,recordedCost,processVariance,profitLoss:revenue-recordedCost,vendorIds,vendorBreakdown,budgetEntered,actualCostEntered};
  }));
  const rollupCompanyOptions = [...new Map(companyRollupRows.map(row=>[row.po.companyId,{id:row.po.companyId,label:companies.find(company=>company.id===row.po.companyId)?.name||"Archived company"}])).values()];
  const rollupPOOptions = [...new Map(companyRollupRows.map(row=>[row.po.id,row.po])).values()];
  const rollupVendorOptions = [...new Set(companyRollupRows.flatMap(row=>row.vendorIds))].map(id=>({id,label:vendors.find(v=>v.id===id)?.company||"Archived vendor"}));
  const rollupComponentOptions = [...new Map(companyRollupRows.filter(row=>row.component).map(row=>[row.component!.id,{id:row.component!.id,label:(row.component!.partNumber||"")+" · "+row.component!.name}])).values()];
  const rollupQuantityOptions = [...new Set(companyRollupRows.map(row=>row.line.quantity))].sort((a,b)=>a-b);
  const visibleCompanyRollup = companyRollupRows.filter(row=>
    (!rollupCompanyIds.length||rollupCompanyIds.includes(row.po.companyId)) &&
    (!rollupPoIds.length||rollupPoIds.includes(row.po.id)) &&
    (!rollupComponentIds.length||rollupComponentIds.includes(row.component?.id||"")) &&
    (!rollupQuantities.length||rollupQuantities.includes(row.line.quantity)) &&
    (!rollupVendorIds.length||row.vendorIds.some(id=>rollupVendorIds.includes(id)))
  );
  const toggleRollupFilter = (value: string|number, selected: (string|number)[], setter: (next: any[])=>void) =>
    setter(selected.includes(value) ? selected.filter(item=>item!==value) : [...selected,value]);
  const clearRollupFilters = () => { setRollupCompanyIds([]); setRollupPoIds([]); setRollupComponentIds([]); setRollupQuantities([]); setRollupVendorIds([]); };
  const companyRollupTotals = visibleCompanyRollup.reduce((sum,row)=>({
    revenue:sum.revenue+row.revenue,planned:sum.planned+row.plannedCost,plannedProcess:sum.plannedProcess+row.plannedProcessCost,
    material:sum.material+row.materialCost,actualMaterial:sum.actualMaterial+row.actualMaterialCost,estimatedMaterial:sum.estimatedMaterial+row.estimatedMaterialCost,extras:sum.extras+row.extras,actualExtras:sum.actualExtras+row.actualExtras,process:sum.process+row.processCost,
    transport:sum.transport+row.transportCost,recorded:sum.recorded+row.recordedCost,paid:sum.paid+row.paid,
    unpaidProcess:sum.unpaidProcess+row.unpaidProcess,processOverpayment:sum.processOverpayment+row.processOverpayment,processVariance:sum.processVariance+row.processVariance,profitLoss:sum.profitLoss+row.profitLoss,
    budgetsMissing:sum.budgetsMissing+(row.budgetEntered?0:1),actualCostsMissing:sum.actualCostsMissing+(row.actualCostEntered?0:1)
  }),{revenue:0,planned:0,plannedProcess:0,material:0,actualMaterial:0,estimatedMaterial:0,extras:0,actualExtras:0,process:0,transport:0,recorded:0,paid:0,unpaidProcess:0,processOverpayment:0,processVariance:0,profitLoss:0,budgetsMissing:0,actualCostsMissing:0});
  const vendorRollupRows = visibleCompanyRollup.flatMap(row=>row.vendorBreakdown.map(item=>({
    ...item,companyName:companies.find(company=>company.id===row.po.companyId)?.name||"Archived company",
    poNumber:row.po.number,componentName:row.component?.name||"Missing component",
    partNumber:row.component?.partNumber||"—",quantity:row.line.quantity
  })));

  useEffect(() => {
    if (initialContext?.companyId && companies.some(company => company.id === initialContext.companyId)) {
      setCompanyId(initialContext.companyId);
    }
    if (initialContext?.poId && orders.some(po => po.id === initialContext.poId)) {
      const targetPO = orders.find(po => po.id === initialContext.poId)!;
      setCompanyId(targetPO.companyId);
      setPoId(targetPO.id);
    } else if (!companyOrders.some(po => po.id === poId)) {
      setPoId(companyOrders[0]?.id || "");
      setLineKey("");
      setOperationId("");
    }
  }, [initialContext?.companyId, initialContext?.poId, companies, orders, companyOrders, poId]);

  const selectedPO = companyOrders.find(po => po.id === poId);
  const componentLines: ComponentLineRef[] = useMemo(() => (selectedPO?.lines || []).filter(line => !("deletedAt" in line && (line as any).deletedAt)).map(line => ({
    key: selectedPO!.id + "::" + line.id, poId: selectedPO!.id, poNumber: selectedPO!.number, lineId: line.id, quantity: line.quantity,
    targetDelivery: line.targetDelivery || selectedPO!.targetDelivery, unitPrice: line.unitPrice, componentId: line.componentId, materialQty: line.materialQty,
    materialRate: line.materialRate, benchmarkMaterialRate: line.benchmarkMaterialRate, overhead: line.overhead, toolingCost: line.toolingCost,
    reworkCost: line.reworkCost, scrapCost: line.scrapCost, rejectedQty: line.rejectedQty, gstRate: line.gstRate
  })), [selectedPO]);
  const preferredLine = componentLines.find(line => quotations.some(q => !q.deletedAt && q.poLineId === line.lineId)) || componentLines[0];
  useEffect(() => {
    const currentLine = componentLines.find(line => line.key === lineKey);
    const nextLine = currentLine || preferredLine;
    if ((nextLine?.key || "") !== lineKey) setLineKey(nextLine?.key || "");
  }, [componentLines, lineKey, preferredLine?.key]);
  useEffect(() => {
    if (!initialContext?.poLineId && !initialContext?.componentId) return;
    const targetLine = componentLines.find(line => line.lineId === initialContext.poLineId)
      || componentLines.find(line => line.componentId === initialContext.componentId);
    if (targetLine && targetLine.key !== lineKey) setLineKey(targetLine.key);
  }, [initialContext?.poLineId, initialContext?.componentId, componentLines, lineKey]);
  const selectedLine = componentLines.find(line => line.key === lineKey) || preferredLine;
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const routeOperations = operations.filter(op => op.componentId === selectedComponent?.id && (!selectedLine || (op.poId === selectedLine.poId && op.poLineId === selectedLine.lineId)));
  const paymentTransactions = activeRows(data.paymentTransactions || []);
  const paymentTotalFor = (operation: typeof routeOperations[number]) => {
    const rows=paymentTransactions.filter(payment=>payment.operationId===operation.id);
    return rows.length?rows.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amount)||0),0):Math.max(0,Number(operation.paidAmount)||0);
  };
  const preferredOperation = routeOperations.find(op => quotations.some(q => !q.deletedAt && q.operationId === op.id)) || routeOperations[0];
  useEffect(() => {
    const currentOperation = routeOperations.find(op => op.id === operationId);
    const contextOperation = routeOperations.find(op => op.id === initialContext?.operationId);
    const nextOperation = currentOperation || contextOperation || preferredOperation;
    if ((nextOperation?.id || "") !== operationId) setOperationId(nextOperation?.id || "");
  }, [routeOperations, operationId, preferredOperation?.id, initialContext?.operationId]);
  useEffect(() => {
    if (initialContext?.vendorId && vendors.some(vendor => vendor.id === initialContext.vendorId)) {
      setVendorId(initialContext.vendorId);
    }
  }, [initialContext?.vendorId, vendors]);
  const selectedOperation = routeOperations.find(op => op.id === operationId) || preferredOperation;
  // Show saved quotes for every process in the selected component/PO line.
  // Filtering by the currently selected operation hid quotations saved against
  // other steps, making a populated costing register look empty.
  const quoteRows = quotations.filter(q => q.componentId === selectedComponent?.id && (!selectedLine || (q.poId === selectedLine.poId && q.poLineId === selectedLine.lineId)))
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
  const overhead = selectedLine?.overhead ?? selectedComponent?.overhead ?? 0;
  const toolingCost = selectedLine?.toolingCost ?? selectedComponent?.toolingCost ?? 0;
  const reworkCost = selectedLine?.reworkCost ?? selectedComponent?.reworkCost ?? 0;
  const scrapCost = selectedLine?.scrapCost ?? selectedComponent?.scrapCost ?? 0;
  const rejectedQty = selectedLine?.rejectedQty ?? selectedComponent?.rejectedQty ?? 0;
  const gstRate = selectedLine?.gstRate ?? selectedComponent?.gstRate ?? 0;
  const materialCost = materialQty * materialRate;
  const costedRouteOperations = routeOperations.filter(op => op.costIncluded !== false);
  const componentTransportLegs = activeRows(data.transportLegs || []).filter(leg => leg.poId === selectedLine?.poId && leg.poLineId === selectedLine?.lineId && leg.componentId === selectedComponent?.id);
  const includedTransportLegs = componentTransportLegs.filter(leg => !leg.anchorOperationId || routeOperations.find(op => op.id === leg.anchorOperationId)?.costIncluded !== false);
  const savedTransportLegTotal = includedTransportLegs.reduce((sum,leg) => sum + Math.max(0,Number(leg.fixedAmount)||0) * Math.max(0,Number(leg.tripCount)||0),0);
  const plannedProcessFromOperations = costedRouteOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart, 0);
  const actualProcessTotal = costedRouteOperations.reduce((sum,op) => sum + op.quantity * (op.actualRatePerPart || 0), 0);
  const duplicateLegacyTransportIds = new Set(includedTransportLegs.filter(leg=>leg.anchorOperationId).filter(leg=>{
    const op=routeOperations.find(item=>item.id===leg.anchorOperationId);
    return Boolean(op?.transportRouteId)&&op?.transportRouteId===leg.routeId&&Math.abs(Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0)-Math.max(0,Number(op?.transportCost)||0))<0.01;
  }).map(leg=>leg.anchorOperationId));
  const operationTransportTotal = costedRouteOperations.reduce((sum,op) => sum + (duplicateLegacyTransportIds.has(op.id)?0:Math.max(0, Number(op.transportCost) || 0)), 0) + savedTransportLegTotal;
  const operationActual = actualProcessTotal;
  const extraCharges = overhead + toolingCost + reworkCost + scrapCost;
  const actualExtraCharges = (selectedLine?.overhead??0)+(selectedLine?.toolingCost??0)+(selectedLine?.reworkCost??0)+(selectedLine?.scrapCost??0);
  const sellingRate = selectedComponent?.salePrice ?? selectedLine?.unitPrice ?? 0;
  const revenue = (selectedLine?.quantity || 0) * sellingRate;
  const gstEstimate = revenue * gstRate / 100;
  const finalOperation = routeOperations[routeOperations.length - 1];
  const acceptedQty = selectedLine ? (finalOperation && finalOperation.completed > 0 ? finalOperation.accepted : Math.max(0, selectedLine.quantity - rejectedQty)) : 0;
  const independentPlannedCosts = selectedComponent ? activeRows(data.plannedCosts).filter(row => {
    const componentMatches = row.componentId
      ? row.componentId === selectedComponent.id
      : row.componentNumber.trim().toLowerCase() === selectedComponent.partNumber.trim().toLowerCase()
        || row.componentName.trim().toLowerCase() === selectedComponent.name.trim().toLowerCase();
    const poMatches = !row.poId || row.poId === selectedLine?.poId;
    return componentMatches && poMatches;
  }) : [];
  const independentPlannedTotal = independentPlannedCosts.reduce((sum,row) =>
    sum + row.plannedQty * row.plannedRate, 0
  );
  const plannedProcessTotal = independentPlannedCosts.length ? independentPlannedTotal : plannedProcessFromOperations;
  const plannedTotal = materialCost + plannedProcessTotal + operationTransportTotal + extraCharges;
  const actualMaterialCost = selectedLine?.materialQty !== undefined && selectedLine?.materialRate !== undefined ? materialCost : 0;
  const estimatedMaterialCost = actualMaterialCost > 0 ? 0 : materialCost;
  const actualTotal = actualMaterialCost + actualProcessTotal + operationTransportTotal + actualExtraCharges;
  const independentVariance = actualProcessTotal - independentPlannedTotal;
  const paidProcessTotal = costedRouteOperations.reduce((sum,op) => sum + paymentTotalFor(op), 0);
  const unpaidProcessBalance = Math.max(0, operationActual - paidProcessTotal);
  const processOverpaymentBalance = Math.max(0, paidProcessTotal - operationActual);
  const profit = revenue - actualTotal;
  const estimatedProfit = revenue - plannedTotal;
  const costPerAccepted = acceptedQty ? plannedTotal / acceptedQty : 0;

  const openQuote = (forOperationId?: string) => {
    if (!selectedComponent) { onNotice("Create a component master record first."); return; }
    if (!selectedLine) { onNotice("Link this component to a saved purchase-order line before entering a quote."); return; }
    if (!routeOperations.length) { onNotice("Add the required process operations in Process Map first, then enter each vendor quotation against the exact operation."); return; }
    setQuoteReference(""); setQuotedAt(stamp()); setValidUntil(""); setQuantity(String(selectedLine.quantity)); setRatePerPart(""); setTransportCost("0"); setLeadDays(""); setQuoteNotes("");
    setOperationId(forOperationId || routeOperations[0]?.id || ""); setVendorId(""); setShowQuoteForm(true);
  };
  const saveQuote = () => {
    if (!selectedComponent || !selectedLine || !selectedOperation || !vendorId) { onNotice("Choose a component, PO line, process operation and vendor."); return; }
    const rate = Number(ratePerPart);
    const qty = Number(quantity);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(qty) || qty <= 0) { onNotice("Enter a valid quoted rate and positive quantity."); return; }
    const stampNow = nowIso(); const id = makeId("quote");
    const quote: QuotationRecord = {
      id, poId: selectedLine.poId, poLineId: selectedLine.lineId, componentId: selectedComponent.id, operationId: selectedOperation.id, vendorId,
      quoteReference: quoteReference.trim(), quotedAt: quotedAt || stamp(), validUntil, quantity: qty, ratePerPart: rate,
      transportCost: Math.max(0, Number(transportCost) || 0), leadDays: Math.max(0, Number(leadDays) || 0),
      status: "Received", notes: quoteNotes.trim(), createdAt: stampNow, updatedAt: stampNow
    };
    update(current => ({ ...current, quotations: [...current.quotations, quote] }));
    setShowQuoteForm(false); onNotice("Quotation saved with component ID, PO-line ID, operation ID and vendor ID. It is recorded as a received quote, not an actual purchase/invoice.");
  };
  const selectQuote = (quote: QuotationRecord) => {
    const selectedStamp = nowIso();
    update(current => ({
      ...current,
      quotations: current.quotations.map(q => q.operationId === quote.operationId && q.poLineId === quote.poLineId && !q.deletedAt
        ? { ...q, status: q.id === quote.id ? "Selected" : q.status === "Selected" ? "Received" : q.status, updatedAt: selectedStamp }
        : q),
      operations: current.operations.map(op => op.id === quote.operationId
        ? { ...op, vendorId: quote.vendorId, ratePerPart: quote.ratePerPart, updatedAt: selectedStamp }
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
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / COMPONENT + PROCESS RATE HISTORY</div><h1>Costing &amp; Payment<span>.</span></h1><p>Store every supplier rate against the exact component, PO line and operation; compare quotations without treating them as actual invoices.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendor directory</button><button className="button-primary" onClick={() => openQuote()} disabled={!selectedComponent}><Plus size={15}/> Add process quotation</button></div></div>
    {!components.length ? <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>No component master records yet</h3><p>There are no sample components. Add your actual part number once; then create a PO line, add the required operations and record supplier quotations per operation.</p><button className="button-primary" onClick={() => onSelectModule("components")}><Plus size={14}/> Create component master</button></div></section> : <>
      <section className="surface-panel company-cost-rollup">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPANY-WIDE FINANCIAL ANALYSIS</div><h3>Company, PO & component profitability</h3><p>Aggregates all companies and purchase orders. Use the company, PO, component, quantity and vendor filters to narrow the analysis.</p></div><span className="module-number">{visibleCompanyRollup.length} COMPONENT LINES</span></div>
        <div className="process-table-bulkbar costing-rollup-filters ax-search-filter-columns">
          <SearchableMultiSelect id="costing-filter-companies" label="Companies" options={rollupCompanyOptions} selected={rollupCompanyIds} onChange={setRollupCompanyIds} emptyMeansAll/>
          <SearchableMultiSelect id="costing-filter-pos" label="Purchase orders" options={rollupPOOptions.map(po=>({id:po.id,label:po.number}))} selected={rollupPoIds} onChange={setRollupPoIds} emptyMeansAll/>
          <SearchableMultiSelect id="costing-filter-components" label="Components" options={rollupComponentOptions} selected={rollupComponentIds} onChange={setRollupComponentIds} emptyMeansAll/>
          <SearchableMultiSelect id="costing-filter-quantity" label="PO quantity" options={rollupQuantityOptions.map(qty=>({id:String(qty),label:qty.toLocaleString("en-IN")}))} selected={rollupQuantities.map(String)} onChange={values=>setRollupQuantities(values.map(Number).filter(Number.isFinite))} emptyMeansAll/>
          <SearchableMultiSelect id="costing-filter-vendors" label="Vendors" options={rollupVendorOptions} selected={rollupVendorIds} onChange={setRollupVendorIds} emptyMeansAll/>
          <div className="costing-filter-actions"><label>PO value warning at <input type="number" min="1" max="100" value={poValueWarningPercent} onChange={e=>setPoValueWarningPercent(Math.min(100,Math.max(1,Number(e.target.value)||1)))}/> %</label><button className="button-quiet compact-button" onClick={clearRollupFilters}>Clear all filters</button><span>{visibleCompanyRollup.length} / {companyRollupRows.length} component lines</span></div>
        </div>
        <div className="dashboard-job-summary company-rollup-totals">
          <div><strong>{money(companyRollupTotals.revenue)}</strong><span>Selected PO line value</span></div>
          <div><strong>{money(companyRollupTotals.planned)}</strong><span>Planned total budget (material + planned process + saved transport + extras); {companyRollupTotals.budgetsMissing} line(s) have no entered budget</span></div>
          <div><strong>{money(companyRollupTotals.material)}</strong><span>Material budget (includes estimates; not actual spend)</span></div>
          <div><strong>{money(companyRollupTotals.actualExtras)}</strong><span>Other costs explicitly entered on PO lines as actual</span></div>
          <div><strong>{money(companyRollupTotals.actualMaterial)}</strong><span>Material explicitly entered on PO lines as actual cost</span></div>
          <div><strong>{money(companyRollupTotals.estimatedMaterial)}</strong><span>Estimated material basis from BOM / component master</span></div>
          <div><strong>{money(companyRollupTotals.plannedProcess)}</strong><span>Planned process cost</span></div>
          <div><strong>{money(companyRollupTotals.process)}</strong><span>Actual process cost recorded</span></div>
          <div><strong>{money(companyRollupTotals.transport)}</strong><span>Transport cost (separate)</span></div>
          <div><strong>{money(companyRollupTotals.extras)}</strong><span>Entered overhead / tooling / rework / scrap</span></div>
          <div><strong>{money(companyRollupTotals.recorded)}</strong><span>Total recorded cost; {companyRollupTotals.actualCostsMissing} line(s) have incomplete actual cost entries</span></div>
          <div><strong>{money(companyRollupTotals.paid)}</strong><span>Process payments entered</span></div>
          <div><strong>{money(companyRollupTotals.unpaidProcess)}</strong><span>Unpaid process balance only</span></div>
          <div><strong>{money(companyRollupTotals.processOverpayment)}</strong><span>Process payments above recorded process cost; verify allocation</span></div>
          <div><strong className={companyRollupTotals.profitLoss<0?"loss-value":"profit-value"}>{money(companyRollupTotals.profitLoss)}</strong><span>Contribution before unentered costs and taxes; estimated material excluded</span></div>
          <div><strong className={companyRollupTotals.processVariance>0?"loss-value":"profit-value"}>{money(companyRollupTotals.processVariance)}</strong><span>Actual minus planned process cost</span></div>
        </div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Component</th><th>Qty</th><th>PO value</th><th>Material budget</th><th>Actual material entered</th><th>Planned process</th><th>Actual process</th><th>Transport</th><th>Other costs (budget)</th><th>Actual other costs entered</th><th>Planned total budget</th><th>Total recorded cost</th><th>Budget variance</th><th>Vendor(s)</th><th>Process paid</th><th>Process unpaid</th><th>Profit / loss status</th></tr></thead><tbody>{visibleCompanyRollup.map(row=><tr key={row.po.id+":"+row.line.id}><td><strong>{row.po.number}</strong><small>{row.po.issueDate||"No PO date"}</small></td><td><strong>{row.component?.name||"Missing component"}</strong><small>{row.component?.partNumber||"—"}</small></td><td>{row.line.quantity.toLocaleString("en-IN")}</td><td>{money(row.revenue)}</td><td>{money(row.materialCost)}<small>Budget basis</small></td><td>{money(row.actualMaterialCost)}<small>{row.actualMaterialCost>0?"PO-line explicit input":"Not entered as actual"}</small></td><td>{money(row.plannedProcessCost)}</td><td>{money(row.processCost)}</td><td>{money(row.transportCost)}</td><td>{money(row.extras)}<small>Budget basis</small></td><td>{money(row.actualExtras)}</td><td>{money(row.plannedCost)}</td><td><strong>{money(row.recordedCost)}</strong><small>Explicit actual material + process + transport + extras; estimates excluded</small></td><td>{row.budgetEntered?<><strong className={row.recordedCost>row.plannedCost?"loss-value":"profit-value"}>{money(row.recordedCost-row.plannedCost)}</strong><small>Actual total − planned total budget</small></>:<strong>Budget not entered</strong>}</td><td>{row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"Archived").join(", ")||"No vendor linked"}</td><td>{money(row.paid)}</td><td>{money(row.unpaidProcess)}</td><td><strong className={!row.actualCostEntered?"loss-value":row.recordedCost>row.revenue?"loss-value":row.revenue>0&&row.recordedCost>=row.revenue*poValueWarningPercent/100?"loss-value":"profit-value"}>{!row.actualCostEntered?"ACTUAL COSTS INCOMPLETE":row.recordedCost>row.revenue?"LOSS":row.revenue>0&&row.recordedCost>=row.revenue*poValueWarningPercent/100?"IMPROVEMENT NEEDED":"PROFIT"}</strong><small>{money(row.profitLoss)} contribution</small></td></tr>)}</tbody></table></div>
        <section className="surface-panel vendor-cost-rollup"><div className="panel-heading"><div><h4>Vendor-wise direct cost</h4><p>Process and assigned transport cost by vendor. Material and other shared costs stay at component level and are not artificially allocated.</p></div><span className="module-number">{vendorRollupRows.length} VENDOR LINES</span></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Vendor</th><th>Company</th><th>PO</th><th>Component</th><th>Qty</th><th>Planned process</th><th>Actual process</th><th>Transport</th><th>Vendor direct cost</th><th>Process paid</th><th>Process unpaid</th></tr></thead><tbody>{vendorRollupRows.map((item,index)=><tr key={item.vendorId+":"+item.poNumber+":"+item.partNumber+":"+index}><td>{vendors.find(v=>v.id===item.vendorId)?.company||"Archived vendor"}</td><td>{item.companyName}</td><td>{item.poNumber}</td><td>{item.partNumber} · {item.componentName}</td><td>{item.quantity.toLocaleString("en-IN")}</td><td>{money(item.plannedProcessCost)}</td><td>{money(item.processCost)}</td><td>{money(item.transportCost)}</td><td><strong>{money(item.recordedDirectCost)}</strong></td><td>{money(item.paid)}</td><td>{money(item.unpaidProcess)}</td></tr>)}</tbody></table></div></section>
        <div className="module-safety-note"><ShieldCheck size={14}/><span>Contribution is PO line value minus recorded material, process, transport and entered extras. Taxes, finance, selling expenses and other unentered costs remain excluded; this is not audited net profit.</span></div>
      </section>
      <div className="linked-master-selectors linked-cost-selectors">
        <SearchablePicker id="cost-company" label="Company" value={companyId} placeholder="Select company…" options={companies.map(c=>({id:c.id,label:c.name}))} onChange={id=>{setCompanyId(id);setPoId("");setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po" label="Purchase order" value={poId} placeholder="Select PO…" options={companyOrders.map(po=>({id:po.id,label:po.number+" · "+po.status}))} onChange={id=>{setPoId(id);setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po-line" label="PO component line" value={selectedLine?.key||""} placeholder="Select component line…" options={componentLines.map(line=>({id:line.key,label:(components.find(c=>c.id===line.componentId)?.partNumber||"Part missing")+" · "+(components.find(c=>c.id===line.componentId)?.name||"")+" · "+line.quantity+" "+(components.find(c=>c.id===line.componentId)?.salePriceUnit==="set"?"sets":"pieces")}))} onChange={key=>{setLineKey(key);setOperationId("");}}/>
        <SearchablePicker id="cost-operation" label="Process operation" value={selectedOperation?.id||""} placeholder="Select operation…" options={routeOperations.map(op=>({id:op.id,label:op.name+" · OP-"+op.sequence}))} onChange={setOperationId}/>
      </div>
      {!componentLines.length && <div className="module-safety-note"><FileText size={14}/><span>This component is not yet linked to a PO line. Create or edit the actual order in Purchase Orders; quotes will then be stored against that order line.</span><button className="button-quiet compact-button" onClick={() => onSelectModule("purchasing")}>Open purchase orders</button></div>}
      <div className="linked-component-summary"><div className="linked-component-identity"><ComponentIcon componentId={selectedComponent?.id} componentName={(selectedComponent?.name||"")+" "+(selectedComponent?.partNumber||"")}/><span><small>COMPONENT</small><strong>{selectedComponent?.partNumber} · {selectedComponent?.name}</strong><span>Revision {selectedComponent?.revision || "—"} · Drawing {selectedComponent?.drawingReference || "—"}</span></span></div><div><small>MATERIAL BUDGET / ESTIMATE</small><strong>{money(materialCost)}</strong><span>{materialQty.toLocaleString("en-IN")} units × {money(materialRate)} · {materialCostSource}{actualMaterialCost>0?" · explicitly entered actual":" · excluded from actual cost"}</span></div><div><small>PLANNED PROCESS COST</small><strong>{money(plannedProcessTotal)}</strong><span>Transport cost kept separate below: {money(operationTransportTotal)}</span></div><div><small>PLANNED COST / ACCEPTED PART</small><strong>{money(costPerAccepted)}</strong><span>Uses the selected PO quantity and entered rejects</span></div></div>
      <div className="linked-kpis linked-cost-kpis"><div className="route-kpi kpi-cost"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>PLANNED COST</small><strong>{money(plannedTotal)}</strong><em>Material + independent planned process + transport + entered extras</em></span></div><div className="route-kpi kpi-quality"><span className="kpi-icon"><Check size={19}/></span><span><small>ACTUAL COST</small><strong>{money(actualTotal)}</strong><em>Explicit PO-line material and other costs + actual process + transport; master defaults remain estimates</em></span></div><div className="route-kpi kpi-delivery"><span className="kpi-icon"><Package size={19}/></span><span><small>ORDER VALUE</small><strong>{money(revenue)}</strong><em>{selectedLine?.quantity || 0} {selectedComponent?.salePriceUnit === "set" ? "sets" : "pieces"} × {money(sellingRate)}</em></span></div><div className="route-kpi kpi-risk"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>RECORDED PROFIT / LOSS</small><strong>{money(profit)}</strong><em>Component-master defaults and unentered material are excluded from actual cost; missing costs remain excluded</em></span></div></div>
      {independentPlannedCosts.length > 0 && <section className="surface-panel planned-cost-comparison">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> INDEPENDENT PLANNED COST REGISTER</div><h3>Planned vs actual process cost</h3><p>Matched by component number or name. This independent register provides the planned process-cost baseline; actual process costs and transport remain separate.</p></div><span className="module-number">{independentPlannedCosts.length} PLANNED PROCESS RATES</span></div>
        <div className="dashboard-job-summary">
          <div><strong>{money(independentPlannedTotal)}</strong><span>Planned cost at selected PO quantity</span></div>
          <div><strong>{money(actualProcessTotal)}</strong><span>Actual entered process cost (transport separate)</span></div>
          <div><strong>{money(independentVariance)}</strong><span>{independentVariance > 0 ? "Actual process above plan" : independentVariance < 0 ? "Actual process below plan" : "Actual process equals plan"}</span></div>
        </div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Company name / reference</th><th>PO reference</th><th>Component name</th><th>Component number</th><th>Process type</th><th>Process category</th><th>Process subcategory</th><th>Planned quantity</th><th>Unit</th><th>Planned rate</th><th>Planned amount</th></tr></thead><tbody>{independentPlannedCosts.map(row=><tr key={row.id}><td>{row.companyName||selectedCompany?.name||"—"}</td><td>{row.poNumber||selectedPO?.number||"—"}</td><td>{row.componentName||selectedComponent?.name||"—"}</td><td>{row.componentNumber||selectedComponent?.partNumber||"—"}</td><td>{row.processType}</td><td>{row.processCategory||"—"}</td><td>{row.processSubcategory||"—"}</td><td>{row.plannedQty.toLocaleString("en-IN")}</td><td>{row.unit==="set"?"sets":"pieces"}</td><td>{money(row.plannedRate)}</td><td>{money(row.plannedQty*row.plannedRate)}</td></tr>)}</tbody></table></div>
      </section>}

      <section className="surface-panel costing-payment-summary">
  <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PROCESS PAYMENT CONTROL</div><h3>Payment status for selected PO component</h3><p>Payment entries are stored per process operation in Process Plan.</p></div></div>
  <div className="dashboard-job-summary">
    <div><strong>{money(paidProcessTotal)}</strong><span>Paid / recorded payments</span></div>
    <div><strong>{money(unpaidProcessBalance)}</strong><span>Remaining recorded process balance</span></div>
    <div><strong>{money(processOverpaymentBalance)}</strong><span>Payments above recorded process cost — verify</span></div>
    <div><strong>{costedRouteOperations.filter(op=>paymentTotalFor(op)<(op.quantity*(op.actualRatePerPart||0))).length}</strong><span>Operations with unpaid process balance</span></div>
  </div>
  <button className="button-quiet compact-button" onClick={() => onSelectModule("process-map",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.lineId,componentId:selectedComponent?.id,operationId:selectedOperation?.id,vendorId:selectedOperation?.vendorId})}><Wallet size={14}/> Update operation payments</button>
</section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUOTE-TO-OPERATION LINK</div><h3>Process costs for {selectedComponent?.partNumber}</h3><p>Each row references a specific operation ID and PO component line.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.lineId,componentId:selectedComponent?.id,operationId:selectedOperation?.id,vendorId:selectedOperation?.vendorId})}><ArrowRight size={14}/> Manage operations</button></div>
        {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Operation</th><th>Vendor</th><th>Qty</th><th>Selected quote / rate</th><th>Actual rate / part</th><th>Legacy transport (separate)</th><th>Planned process cost (transport excluded)</th><th>Payment ledger</th><th>Quotes</th></tr></thead><tbody>{routeOperations.map(op => {
          const quoteCount = quotations.filter(q => q.operationId === op.id && !q.deletedAt).length;
          const vendor = vendors.find(v => v.id === op.vendorId);
          const paymentRows=paymentTransactions.filter(payment=>payment.operationId===op.id).sort((a,b)=>(a.paidAt||"").localeCompare(b.paidAt||""));
          return <tr key={op.id}><td><div className="cost-op-cell"><ProcessIcon processName={op.name} fallback={<Workflow size={17}/>} /><span><strong>{op.name}</strong><small>{op.category || "Type not entered"} · OP-{op.sequence}</small></span></div></td><td>{vendor?.company || "Not assigned"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{(op.actualRatePerPart || 0) > 0 ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.transportCost)}<small>Legacy separate transport</small></td><td>{money(op.quantity * op.ratePerPart)}<small>Transport excluded</small></td><td><div className="payment-ledger-cell">{paymentRows.length?paymentRows.map(payment=><small key={payment.id}>{money(payment.amount)} · {payment.paidAt?new Date(payment.paidAt).toLocaleDateString("en-IN"):"Date not set"}{payment.reference?" · "+payment.reference:""}</small>):<small>{op.paidAmount? "Legacy recorded total: "+money(op.paidAmount):"No payment recorded"}</small>}<strong>Recorded: {money(paymentRows.length?paymentRows.reduce((sum,payment)=>sum+payment.amount,0):op.paidAmount||0)}</strong></div></td><td><button className="button-quiet compact-button" onClick={() => {openQuote(op.id);}}><Plus size={12}/> {quoteCount} · Add quote</button></td></tr>;
        })}</tbody></table></div> : <div className="module-empty-state"><FileText size={25}/><h3>No process operations linked yet</h3><p>Add the actual operations in Process Map for this component and PO line before recording supplier quotations.</p><button className="button-primary" onClick={() => onSelectModule("process-map",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.lineId,componentId:selectedComponent?.id,operationId:selectedOperation?.id,vendorId:selectedOperation?.vendorId})}><Plus size={14}/> Add operations</button></div>}
      </section>
      {showQuoteForm && <section className="surface-panel module-record-form-panel linked-quote-form"><div className="panel-heading"><div><h3>New supplier quotation</h3><p>Quote source and status stay separate from actual accepted invoice / job cost.</p></div><button className="icon-control" onClick={() => setShowQuoteForm(false)} aria-label="Close quote form"><X size={15}/></button></div>
        <div className="module-record-form">
          <label>PO / component line<select value={selectedLine?.key || ""} onChange={e => {setLineKey(e.target.value);setOperationId("");}}><option value="">Select line…</option>{componentLines.map(l=><option key={l.key} value={l.key}>{l.poNumber} · {l.quantity} pcs</option>)}</select></label>
          <label>Process operation *<select value={selectedOperation?.id || operationId} onChange={e => setOperationId(e.target.value)}><option value="">Select operation…</option>{routeOperations.map(op=><option key={op.id} value={op.id}>{op.name} · OP-{op.sequence}</option>)}</select></label>
          <label>Vendor / supplier *<select value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">Select actual vendor…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.phone || "No phone"}{v.status.toLowerCase().includes("unverified") ? " · Unverified contact" : ""}</option>)}</select>{!vendors.length&&<small className="field-hint">Add vendor details or QR-sync contacts in Vendors & Sub-vendors.</small>}</label>
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
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLIER QUOTATION HISTORY</div><h3>Saved quotations ({quoteRows.length})</h3><p>All process operations for this selected component and PO line are shown here. The current operation selector does not hide earlier saved quotes.</p></div><label className="module-record-search"><Search size={14}/><input value={quoteSearch} onChange={e=>setQuoteSearch(e.target.value)} placeholder="Search quote, vendor, process…"/></label></div>
        {quoteRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Quote reference</th><th>Quote date</th><th>Validity</th><th>Qty</th><th>Rate / part</th><th>Transport</th><th>Lead days</th><th>Status</th><th>Action</th></tr></thead><tbody>{quoteRows.map(q => <tr key={q.id}><td><div className="cost-op-cell cost-quote-process"><ProcessIcon processName={routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"} fallback={<Workflow size={16}/>} /><span><strong>{routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"}</strong><small>OP-{routeOperations.find(op=>op.id===q.operationId)?.sequence ?? "—"}</small></span></div></td><td>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</td><td>{q.quoteReference || "Not entered"}</td><td>{q.quotedAt || "—"}</td><td>{q.validUntil || "—"}</td><td>{q.quantity.toLocaleString("en-IN")}</td><td>{money(q.ratePerPart)}</td><td>{money(q.transportCost)}</td><td>{q.leadDays || "—"}</td><td><span className={"record-state state-" + q.status.toLowerCase()}>{q.status}</span></td><td>{q.status === "Selected" ? <span>Applied to operation</span> : <button className="button-primary compact-button" onClick={() => selectQuote(q)}><Check size={12}/> Use this rate</button>}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No quotations saved for this component/PO line/process yet.</div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPONENT OTHER COSTS</div><h3>Material, overhead and other entered costs</h3><p>When a PO line is selected, edits are saved to that line only so this order’s costs and rejects do not affect another order for the same part. Blank material defaults are estimated from linked BOM lines and their entered material rates; this is an estimate, not a supplier invoice.</p></div></div>
        <div className="module-record-form">
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Package size={15}/></span>Material quantity</span><input type="number" min="0" step="0.001" value={materialQty} onChange={e=>setExtra("materialQty",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><CircleDollarSign size={15}/></span>Material rate per unit (₹)</span><input type="number" min="0" step="0.01" value={materialRate} onChange={e=>setExtra("materialRate",Number(e.target.value)||0)}/></label>
                    <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Wallet size={15}/></span>Selling rate per part (₹)</span><input type="number" min="0" step="0.01" value={sellingRate} onChange={e=>setExtra("salePrice",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Activity size={15}/></span>Overhead (₹)</span><input type="number" min="0" step="0.01" value={overhead} onChange={e=>setExtra("overhead",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Wrench size={15}/></span>Tooling / fixture (₹)</span><input type="number" min="0" step="0.01" value={toolingCost} onChange={e=>setExtra("toolingCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><RotateCcw size={15}/></span>Rework cost (₹)</span><input type="number" min="0" step="0.01" value={reworkCost} onChange={e=>setExtra("reworkCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Recycle size={15}/></span>Scrap / rejection loss (₹)</span><input type="number" min="0" step="0.01" value={scrapCost} onChange={e=>setExtra("scrapCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><ShieldCheck size={15}/></span>Rejected quantity (pcs)</span><input type="number" min="0" value={rejectedQty} onChange={e=>setExtra("rejectedQty",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><FileText size={15}/></span>GST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={e=>setExtra("gstRate",Math.min(100,Number(e.target.value)||0))}/></label>
        </div>
        <div className="linked-cost-summary-lines">
          <div><span>Material input · quantity × rate</span><strong>{materialQty.toLocaleString("en-IN")} × {money(materialRate)} = {money(materialCost)}</strong></div>
          <div><span>Overhead item</span><strong>{money(overhead)}</strong></div>
          <div><span>Tooling / fixture item</span><strong>{money(toolingCost)}</strong></div>
          <div><span>Rework item</span><strong>{money(reworkCost)}</strong></div>
          <div><span>Scrap / rejection loss item</span><strong>{money(scrapCost)}</strong></div>
          <div><span>Rejected quantity</span><strong>{rejectedQty.toLocaleString("en-IN")} pcs</strong></div>
          <div><span>GST input</span><strong>{gstRate}% · {money(gstEstimate)}</strong></div>
          <div><span>Material budget / estimate</span><strong>{money(materialCost)}</strong></div><div><span>Material entered as actual</span><strong>{money(actualMaterialCost)}</strong></div><div><span>Material cost source</span><strong>{materialCostSource}</strong></div><div><span>Independent planned process cost</span><strong>{money(plannedProcessTotal)}</strong></div><div><span>Actual process cost</span><strong>{money(actualProcessTotal)}</strong></div><div><span>Transport cost (separate)</span><strong>{money(operationTransportTotal)}</strong></div><div><span>Overhead / tooling / rework / scrap budget</span><strong>{money(extraCharges)}</strong></div><div><span>Other costs entered as actual on PO line</span><strong>{money(actualExtraCharges)}</strong></div><div><span>Planned total before GST</span><strong>{money(plannedTotal)}</strong></div><div><span>Explicit actual material + extras + actual operation rates (missing actual rates count as zero)</span><strong>{money(actualTotal)}</strong></div><div><span>Recorded P/L using entered actual costs</span><strong>{money(profit)}</strong></div><div><span>Estimated P/L using planned process baseline</span><strong>{money(estimatedProfit)}</strong></div><div><span>Entered GST rate / illustrative GST on order value</span><strong>{gstRate}% · {money(gstEstimate)}</strong></div></div>
      </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Quotation amounts are supplier inputs, not live market benchmarks. Selecting a quote updates the operation's planned vendor/rate; it does not mark it as an invoice or actual expense.</span></div>
  </section>;
}
