import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { ArrowRight, Building2, CalendarClock, Check, CircleDollarSign, Cog, Edit3, Factory, FileDown, FileText, Package, Plus, Search, Trash2, Wrench, Gauge, ClipboardCheck, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type CompanyRecord, type ComponentRecord, type FactoryRecord, type MachineRecord, type MachineStatus, type ToolingAssetRecord, type ToolingAssetStatus, type FixtureAssetRecord, type FixtureAssetStatus, type ResourceUsageEventRecord, type ResourceUsageEventKind, type PurchaseOrderLine, type PurchaseOrderRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { ComponentIcon } from "./IconStudio";
import { MechanicalIconGlyph, MECHANICAL_ICON_INVENTORY } from "./MechanicalOperationIcon";
import { mechanicalComponentSvgForName } from "./MechanicalOperationIcon";
import { removeComponentDependents, removePurchaseOrderDependents } from "./manufacturingDeletion.mjs";
import MachineMaintenanceWorkspace from "./MachineMaintenanceWorkspace";
import { applyResourceUsageEvent } from "./manufacturingResourceCompatibility.mjs";

function componentLogoSource(component: Pick<ComponentRecord, "id" | "name" | "partNumber">): string {
  try {
    const assignments = JSON.parse(window.localStorage.getItem("aximach.icon-assignments.v1") || "{}") as Record<string, { customAsset?: string }>;
    const savedAsset = assignments["component:" + component.id]?.customAsset;
    if (savedAsset && savedAsset.startsWith("data:image/")) return savedAsset;
  } catch { /* Use the deterministic mechanical fallback when local logo preferences are unavailable. */ }
  const svg = mechanicalComponentSvgForName(component.name + " " + component.partNumber);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

async function componentLogoPngBase64(component: Pick<ComponentRecord, "id" | "name" | "partNumber">): Promise<string> {
  const image = new Image();
  const source = componentLogoSource(component);
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render the saved component logo for export: " + component.partNumber));
    image.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable for component logos.");
  context.drawImage(image, 4, 4, 88, 88);
  return canvas.toDataURL("image/png").split(",")[1];
}

type LinkedNavigationContext = { companyId?: string; poId?: string; poLineId?: string; componentId?: string; subtab?:string };
type Props = {
  navigationContext?: LinkedNavigationContext;
  moduleId: "companies" | "purchasing" | "components";
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string, context?: LinkedNavigationContext) => void;
  onOpenIconStudio?: (componentId: string) => void;
};

const blankCompany = (): Omit<CompanyRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ name: "", gstin: "", contactPerson: "", phone: "", email: "", address: "", notes: "" });
const blankFactory = (): Omit<FactoryRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ companyId: "", name: "", address: "", contactPhone: "" });
const blankMachine = (): Omit<MachineRecord,"id"|"createdAt"|"updatedAt"|"deletedAt"> => ({
  companyId:"",factoryId:"",assetCode:"",name:"",machineType:"",manufacturer:"",model:"",serialNumber:"",controller:"",
  axisCount:3,workEnvelopeXmm:0,workEnvelopeYmm:0,workEnvelopeZmm:0,spindleMaxRpm:0,positioningAccuracyMicron:0,maxWorkpieceWeightKg:0,
  processDefinitionIds:[],materialCapabilities:[],status:"Available",commissionedAt:"",nextMaintenanceAt:"",notes:""
});
const MACHINE_STATUSES:MachineStatus[]=["Available","Running","Planned maintenance","Under maintenance","Breakdown","Retired"];
const blankTooling=():Omit<ToolingAssetRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">=>({
 companyId:"",factoryId:"",assetCode:"",name:"",toolType:"Cutting tool",manufacturer:"",model:"",specification:"",holderInterface:"",coating:"",
 diameterMm:0,fluteCount:0,maxRpm:0,compatibleMachineIds:[],machineTypeCapabilities:[],processDefinitionIds:[],materialCapabilities:[],
 toolLifeLimitMinutes:0,toolLifeUsedMinutes:0,toolLifeLimitCycles:0,toolLifeUsedCycles:0,regrindCount:0,maxRegrinds:0,lastInspectedAt:"",inspectionDueAt:"",
 status:"Available",storageLocation:"",notes:""
});
const blankFixture=():Omit<FixtureAssetRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">=>({
 companyId:"",factoryId:"",assetCode:"",name:"",fixtureType:"Dedicated fixture",manufacturer:"",model:"",workholdingType:"",
 compatibleMachineIds:[],machineTypeCapabilities:[],processDefinitionIds:[],componentIds:[],
 maxWorkpieceWeightKg:0,maxClampForceKn:0,repeatabilityMicron:0,usageCycles:0,maxUsageCycles:0,
 lastInspectedAt:"",inspectionDueAt:"",status:"Available",storageLocation:"",setupNotes:"",notes:""
});
const TOOLING_STATUSES:ToolingAssetStatus[]=["Available","In use","Needs regrind","Under maintenance","Retired"];
const FIXTURE_STATUSES:FixtureAssetStatus[]=["Available","In use","Under maintenance","Retired"];
const RESOURCE_EVENTS:ResourceUsageEventKind[]=["Production use","Regrind","Inspection","Repair","Replacement"];
type ResourceEventDraft={resourceType:"tooling"|"fixture";resourceId:string;operationId:string;eventType:ResourceUsageEventKind;runtimeMinutes:number;cycles:number;inspectionResult:"Pass"|"Fail"|"Not assessed";inspectionDueAt:string;occurredAt:string;notes:string};
const blankResourceEvent=(resourceType:"tooling"|"fixture"="tooling",resourceId=""):ResourceEventDraft=>({resourceType,resourceId,operationId:"",eventType:"Production use",runtimeMinutes:0,cycles:0,inspectionResult:"Not assessed",inspectionDueAt:"",occurredAt:new Date().toISOString().slice(0,16),notes:""});
const blankComponent = (): Omit<ComponentRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  companyId: "", partNumber: "", name: "", revision: "", drawingReference: "", notes: "",
  salePrice: 0, salePriceUnit: "piece",
  overhead: 0, toolingCost: 0, reworkCost: 0, scrapCost: 0, rejectedQty: 0, gstRate: 0
});
const blankPO = (): Omit<PurchaseOrderRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  number: "", companyId: "", factoryId: "", customerId: "", issueDate: new Date().toISOString().slice(0, 10),
  targetDelivery: "", status: "Open", notes: "", lines: []
});
const blankLine = (): Omit<PurchaseOrderLine, "id"> => ({ componentId: "", quantity: 0, targetDelivery: "", notes: "", allocationLevel: "component", partId: "" });

export default function ManufacturingMasterWorkspace({ moduleId, navigationContext, onBack, onNotice, notice, onSelectModule, onOpenIconStudio }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const customers = activeRows(data.customers || []);
  const factories = activeRows(data.factories);
  const machines = activeRows(data.machines || []);
  const toolingAssets=activeRows(data.toolingAssets||[]);
  const fixtureAssets=activeRows(data.fixtureAssets||[]);
  const resourceUsageEvents=activeRows(data.resourceUsageEvents||[]);
  const maintenancePlans = activeRows(data.maintenancePlans || []);
  const maintenanceWorkOrders = activeRows(data.maintenanceWorkOrders || []);
  const machineDowntime = activeRows(data.machineDowntime || []);
  const processDefinitions = activeRows(data.processDefinitions || []);
  const components = activeRows(data.components);
  const componentParts = activeRows(data.componentParts || []);
  const orders = activeRows(data.purchaseOrders);
  const [tab, setTab] = useState<"companies" | "factories" | "machines" | "tooling" | "fixtures">("companies");
  const [search, setSearch] = useState("");
  const [companyDraft, setCompanyDraft] = useState(blankCompany);
  const [factoryDraft, setFactoryDraft] = useState(blankFactory);
  const [machineDraft, setMachineDraft] = useState(blankMachine);
  const [machineEditingId, setMachineEditingId] = useState("");
  const [toolingDraft,setToolingDraft]=useState(blankTooling);
  const [toolingEditingId,setToolingEditingId]=useState("");
  const [fixtureDraft,setFixtureDraft]=useState(blankFixture);
  const [fixtureEditingId,setFixtureEditingId]=useState("");
  const [resourceEventDraft,setResourceEventDraft]=useState(blankResourceEvent());
  const [showResourceEventForm,setShowResourceEventForm]=useState(false);
  const [componentDraft, setComponentDraft] = useState(blankComponent);
  const [componentPriceInput,setComponentPriceInput]=useState("");
  const [poDraft, setPoDraft] = useState(blankPO);
  const [poLines, setPoLines] = useState<Array<PurchaseOrderLine>>([]);
  const [companyEditingId, setCompanyEditingId] = useState("");
  const [factoryEditingId, setFactoryEditingId] = useState("");
  const [componentEditingId, setComponentEditingId] = useState("");
  const [poEditingId, setPoEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [componentCompanyFilters, setComponentCompanyFilters] = useState<string[]>([]);
  const [componentNumberFilters, setComponentNumberFilters] = useState<string[]>([]);
  const [componentNameFilters, setComponentNameFilters] = useState<string[]>([]);
  const [componentRevisionFilters, setComponentRevisionFilters] = useState<string[]>([]);
  const [componentDrawingFilters, setComponentDrawingFilters] = useState<string[]>([]);
  const [componentUnitFilters, setComponentUnitFilters] = useState<string[]>([]);
  const [poCompanyFilters, setPoCompanyFilters] = useState<string[]>([]);
  const [poNumberFilters, setPoNumberFilters] = useState<string[]>([]);
  const [poIssueDateFilters, setPoIssueDateFilters] = useState<string[]>([]);
  const [poDeliveryFilters, setPoDeliveryFilters] = useState<string[]>([]);
  const [poComponentFilters, setPoComponentFilters] = useState<string[]>([]);
  const [poCustomerFilters, setPoCustomerFilters] = useState<string[]>([]);
  const [poStatusFilters, setPoStatusFilters] = useState<string[]>([]);
  const [openedPoId, setOpenedPoId] = useState("");
  useEffect(() => {
    if (moduleId === "companies") {
      const target=navigationContext?.companyId?companies.find(row=>row.id===navigationContext.companyId):undefined;
      setTab(navigationContext?.subtab==="machines"?"machines":navigationContext?.subtab==="factories"?"factories":navigationContext?.subtab==="tooling"?"tooling":navigationContext?.subtab==="fixtures"?"fixtures":"companies");
      setSelectedCompanyId(target?.id||"");
      setSearch(navigationContext?.subtab==="machines"?"":target?.name||"");
    }
    if (moduleId === "purchasing") {
      setPoCompanyFilters(navigationContext?.companyId ? [navigationContext.companyId] : []);
      setSearch("");
      setOpenedPoId(navigationContext?.poId || "");
    }
    if (moduleId === "components") {
      setSearch("");
      const target=navigationContext?.componentId?components.find(row=>row.id===navigationContext.componentId):undefined;
      if(target){
        setSelectedComponentIds([target.id]);
        setComponentCompanyFilters(target.companyId?[target.companyId]:[]);
        setComponentNumberFilters([target.partNumber]);
      }else{
        setSelectedComponentIds([]);
        setComponentCompanyFilters(navigationContext?.companyId?[navigationContext.companyId]:[]);
        setComponentNumberFilters([]);
      }
    }
  }, [moduleId, navigationContext?.companyId, navigationContext?.poId, navigationContext?.componentId, navigationContext?.subtab, companies.length, components.length]);
  const openedOrder = orders.find(order => order.id === openedPoId);
  useEffect(() => {
    if (openedPoId) document.getElementById("po-open-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openedPoId]);
  const togglePoSelection = (id: string) => setSelectedPoIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const exportPurchaseOrdersPdf = (rows: PurchaseOrderRecord[]) => {
    if (!rows.length) { onNotice("Select one or more purchase orders first."); return; }
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]!));
    const body = rows.map(order => {
      const lines = order.lines.map(line => {
        const part = components.find(component => component.id === line.componentId);
        const componentPart = componentParts.find(item => item.id === line.partId);
        const logo = part ? componentLogoSource(part) : componentLogoSource({ id: "", name: "Missing component", partNumber: "" });
        return "<tr><td><img src='"+escapeHtml(logo)+"' width='32' height='32' alt='component logo'/></td><td>"+escapeHtml(part?.partNumber)+"</td><td>"+escapeHtml(part?.name)+"</td><td>"+escapeHtml(line.partId?((componentPart?.partNumber||"")+" "+(componentPart?.name||"")):"Component-level")+"</td><td>"+escapeHtml(quantityLabel(line.quantity,line.componentId))+"</td><td>₹"+escapeHtml((part?.salePrice || 0).toLocaleString("en-IN"))+" / "+escapeHtml(part?.salePriceUnit || "piece")+"</td><td>"+escapeHtml(line.targetDelivery || order.targetDelivery)+"</td></tr>";
      }).join("");
      return "<section class='po-sheet'><header><h1>AXIMACH · PURCHASE ORDER</h1><h2>"+escapeHtml(order.number)+"</h2></header><p><b>Company:</b> "+escapeHtml(companyName(order.companyId))+"</p><p><b>PO date:</b> "+escapeHtml(order.issueDate)+" &nbsp; <b>Due:</b> "+escapeHtml(order.targetDelivery)+" &nbsp; <b>Status:</b> "+escapeHtml(order.status)+"</p><table><thead><tr><th>Logo</th><th>Component No.</th><th>Component Name</th><th>Part / Allocation</th><th>Quantity (piece / set)</th><th>Master Price / Unit</th><th>Delivery</th></tr></thead><tbody>"+lines+"</tbody></table><p>"+escapeHtml(order.notes)+"</p><footer>Generated from AXIMACH Component Master and Purchase Order records.</footer></section>";
    }).join("");
    const popup = window.open("", "_blank");
    if (!popup) { onNotice("Allow pop-ups to print / save the selected purchase orders as PDF."); return; }
    popup.document.write("<!doctype html><html><head><title>AXIMACH Purchase Orders</title><style>body{font:12px Arial;color:#172033;margin:24px}.po-sheet{page-break-after:always;margin-bottom:32px}.po-sheet:last-child{page-break-after:auto}h1{font-size:18px}h2{font-size:24px;margin:8px 0 18px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #9aa6b2;padding:8px;text-align:left}th{background:#e9eef5}footer{margin-top:40px;color:#637084}@media print{body{margin:12mm}}</style></head><body>"+body+"</body></html>");
    popup.document.close(); popup.focus(); popup.print();
  };


  const componentName = (id: string) => components.find(c => c.id === id)?.partNumber || components.find(c => c.id === id)?.name || "Deleted / missing component";
  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "Company not found";
  const customerName = (id?:string) => id ? (customers.find(customer=>customer.id===id)?.displayName||customers.find(customer=>customer.id===id)?.legalName||"Customer archived") : "Buyer not assigned";
  const factoryName = (id: string) => factories.find(f => f.id === id)?.name || "Factory not found";
  const componentUnit = (id: string) => components.find(c => c.id === id)?.salePriceUnit === "set" ? "set" : "piece";
  const quantityLabel = (quantity: number, componentId: string) => `${quantity.toLocaleString("en-IN")} ${componentUnit(componentId)}${quantity === 1 ? "" : "s"}`;
  const componentNavigationContext = (componentId:string):LinkedNavigationContext => {
    const component=components.find(row=>row.id===componentId);
    const matchingLines=orders.flatMap(po=>po.lines.filter(line=>!line.deletedAt&&line.componentId===componentId).map(line=>({po,line})));
    const unique=matchingLines.length===1?matchingLines[0]:undefined;
    return {companyId:unique?.po.companyId||component?.companyId,poId:unique?.po.id,poLineId:unique?.line.id,componentId};
  };
  const companyContacts = activeRows(data.contactProfiles || []).filter(person => person.linkedType === "company");
  const filteredCompanies = useMemo(() => companies.filter(c => {
    const people = companyContacts.filter(person => person.linkedId === c.id)
      .map(person => [person.name, person.role, person.group, person.phone, person.whatsapp, person.email, person.address, person.history].join(" ")).join(" ");
    return (c.name + " " + c.gstin + " " + c.contactPerson + " " + c.phone + " " + c.email + " " + c.address + " " + people).toLowerCase().includes(search.toLowerCase().trim());
  }), [companies, search, data.contactProfiles]);
  const filteredFactories = useMemo(() => factories.filter(f => (f.name + " " + f.address + " " + companyName(f.companyId)).toLowerCase().includes(search.toLowerCase().trim())), [factories, search, data.companies]);
  const filteredMachines = useMemo(() => machines.filter(machine => (!selectedCompanyId||machine.companyId===selectedCompanyId) && [
    machine.assetCode,machine.name,machine.machineType,machine.manufacturer,machine.model,machine.serialNumber,machine.controller,
    companyName(machine.companyId),factoryName(machine.factoryId),...(machine.materialCapabilities||[]),
    ...(machine.processDefinitionIds||[]).map(id=>processDefinitions.find(item=>item.id===id)?.processType||id)
  ].join(" ").toLowerCase().includes(search.toLowerCase().trim())),[machines,search,data.companies,data.factories,data.processDefinitions]);
  const filteredToolingAssets=useMemo(()=>toolingAssets.filter(asset=>(!selectedCompanyId||asset.companyId===selectedCompanyId)&&[
    asset.assetCode,asset.name,asset.toolType,asset.manufacturer,asset.model,asset.specification,asset.holderInterface,asset.coating,
    companyName(asset.companyId),factoryName(asset.factoryId),...(asset.machineTypeCapabilities||[]),...(asset.materialCapabilities||[]),
    ...(asset.processDefinitionIds||[]).map(id=>processDefinitions.find(item=>item.id===id)?.processType||id)
  ].join(" ").toLowerCase().includes(search.toLowerCase().trim())),[toolingAssets,selectedCompanyId,search,data.companies,data.factories,data.processDefinitions]);
  const filteredFixtureAssets=useMemo(()=>fixtureAssets.filter(asset=>(!selectedCompanyId||asset.companyId===selectedCompanyId)&&[
    asset.assetCode,asset.name,asset.fixtureType,asset.manufacturer,asset.model,asset.workholdingType,asset.storageLocation,
    companyName(asset.companyId),factoryName(asset.factoryId),...(asset.machineTypeCapabilities||[])
  ].join(" ").toLowerCase().includes(search.toLowerCase().trim())),[fixtureAssets,selectedCompanyId,search,data.companies,data.factories]);
  const filteredComponents = useMemo(() => components.filter(c => (c.partNumber + " " + c.name + " " + c.drawingReference + " " + c.revision).toLowerCase().includes(search.toLowerCase().trim())
    &&(!componentCompanyFilters.length||componentCompanyFilters.includes(c.companyId||""))
    &&(!componentNumberFilters.length||componentNumberFilters.includes(c.partNumber))
    &&(!componentNameFilters.length||componentNameFilters.includes(c.name))
    &&(!componentRevisionFilters.length||componentRevisionFilters.includes(c.revision||"—"))
    &&(!componentDrawingFilters.length||componentDrawingFilters.includes(c.drawingReference||"—"))
    &&(!componentUnitFilters.length||componentUnitFilters.includes(c.salePriceUnit||"piece"))), [components, search, componentCompanyFilters, componentNumberFilters, componentNameFilters, componentRevisionFilters, componentDrawingFilters, componentUnitFilters]);
  const filteredOrders = useMemo(() => orders.filter(p => (p.number + " " + companyName(p.companyId) + " " + customerName(p.customerId) + " " + p.lines.map(l => componentName(l.componentId)).join(" ")).toLowerCase().includes(search.toLowerCase().trim())
    &&(!poCompanyFilters.length||poCompanyFilters.includes(p.companyId||""))
    &&(!poNumberFilters.length||poNumberFilters.includes(p.number))
    &&(!poIssueDateFilters.length||poIssueDateFilters.includes(p.issueDate||"—"))
    &&(!poDeliveryFilters.length||poDeliveryFilters.includes(p.targetDelivery||"—"))
    &&(!poComponentFilters.length||p.lines.some(line=>poComponentFilters.includes(line.componentId)))
    &&(!poCustomerFilters.length||poCustomerFilters.includes(p.customerId||""))
    &&(!poStatusFilters.length||poStatusFilters.includes(p.status))), [orders, search, data.companies, data.factories, data.components, customers, poCompanyFilters, poNumberFilters, poIssueDateFilters, poDeliveryFilters, poComponentFilters, poCustomerFilters, poStatusFilters]);

  const selectedComponentForNavigation=components.find(row=>selectedComponentIds.includes(row.id))||(filteredComponents.length===1?filteredComponents[0]:undefined);
  const selectedComponentContext=selectedComponentForNavigation?componentNavigationContext(selectedComponentForNavigation.id):{};
  const selectedPOForNavigation=openedOrder||(selectedPoIds.length===1?orders.find(row=>row.id===selectedPoIds[0]):undefined)||(filteredOrders.length===1?filteredOrders[0]:undefined);
  const selectedPOActiveLines=(selectedPOForNavigation?.lines||[]).filter(line=>!line.deletedAt);
  const selectedPOFirstLine=selectedPOActiveLines.length===1?selectedPOActiveLines[0]:undefined;
  const selectedPOContext:LinkedNavigationContext={companyId:selectedPOForNavigation?.companyId,poId:selectedPOForNavigation?.id,poLineId:selectedPOFirstLine?.id,componentId:selectedPOFirstLine?.componentId};

  const resetForms = () => {
    setShowForm(false); setCompanyEditingId(""); setFactoryEditingId(""); setMachineEditingId(""); setComponentEditingId(""); setPoEditingId("");
    setCompanyDraft(blankCompany()); setFactoryDraft(blankFactory()); setMachineDraft(blankMachine()); setToolingDraft(blankTooling()); setToolingEditingId(""); setFixtureDraft(blankFixture()); setFixtureEditingId(""); setResourceEventDraft(blankResourceEvent()); setShowResourceEventForm(false); setComponentDraft(blankComponent()); setComponentPriceInput(""); setPoDraft(blankPO()); setPoLines([]);
  };
  const beginAdd = () => {
    resetForms();
    if (moduleId === "companies") {
      const companyId=selectedCompanyId || companies[0]?.id || "";
      const factoryId=factories.find(factory=>factory.companyId===companyId)?.id||"";
      if (tab === "factories") setFactoryDraft({ ...blankFactory(), companyId });
      if (tab === "machines") setMachineDraft({...blankMachine(),companyId,factoryId});
      if (tab === "tooling") setToolingDraft({...blankTooling(),companyId,factoryId});
      if (tab === "fixtures") setFixtureDraft({...blankFixture(),companyId,factoryId});
    }
    if (moduleId === "purchasing") setPoLines([{ ...blankLine(), id: makeId("line") }]);
    setShowForm(true);
  };
  const saveCompany = () => {
    if (!companyDraft.name.trim()) { onNotice("Enter a company name."); return; }
    const stamp = nowIso();
    const id = companyEditingId || makeId("company");
    update(current => ({ ...current, companies: [...current.companies.filter(x => x.id !== id), { ...companyDraft, name: companyDraft.name.trim(), id, createdAt: current.companies.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Company saved. It can now be linked to components and purchase orders.");
  };
  const saveFactory = () => {
    if (!factoryDraft.companyId || !factoryDraft.name.trim()) { onNotice("Select the parent company and enter a factory name."); return; }
    const currentFactory=factories.find(row=>row.id===factoryEditingId);
    if(currentFactory&&currentFactory.companyId!==factoryDraft.companyId&&(
      machines.some(machine=>machine.factoryId===currentFactory.id)||
      toolingAssets.some(asset=>asset.factoryId===currentFactory.id)||
      fixtureAssets.some(asset=>asset.factoryId===currentFactory.id)
    )){
      onNotice("This factory has machine, tooling or fixture assets. Reassign or archive those assets before moving the factory to another company.");return;
    }
    const stamp = nowIso(); const id = factoryEditingId || makeId("factory");
    update(current => ({ ...current, factories: [...current.factories.filter(x => x.id !== id), { ...factoryDraft, name: factoryDraft.name.trim(), id, createdAt: current.factories.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Factory saved and linked to its company by record ID.");
  };
  const saveMachine = () => {
    const parentFactory=factories.find(factory=>factory.id===machineDraft.factoryId);
    if(!machineDraft.companyId||!parentFactory||parentFactory.companyId!==machineDraft.companyId||!machineDraft.assetCode.trim()||!machineDraft.name.trim()||!machineDraft.machineType.trim()){
      onNotice("Select a company and its factory, then enter the machine asset code, name and machine type.");return;
    }
    const duplicate=machines.some(row=>row.id!==machineEditingId&&row.companyId===machineDraft.companyId&&row.assetCode.trim().toLowerCase()===machineDraft.assetCode.trim().toLowerCase());
    if(duplicate){onNotice("That asset code is already used by another machine in this company.");return;}
    const validProcessIds=machineDraft.processDefinitionIds.filter(id=>processDefinitions.some(definition=>definition.id===id));
    if(validProcessIds.length!==machineDraft.processDefinitionIds.length){onNotice("Remove invalid process capability references before saving.");return;}
    const stamp=nowIso(),id=machineEditingId||makeId("machine");
    const prior=machines.find(row=>row.id===id);
    if(prior&&(prior.companyId!==machineDraft.companyId||prior.factoryId!==machineDraft.factoryId)&&(
      data.operations.some(operation=>!operation.deletedAt&&operation.machineId===id)||
      toolingAssets.some(asset=>!asset.deletedAt&&(asset.compatibleMachineIds||[]).includes(id))||
      fixtureAssets.some(asset=>!asset.deletedAt&&(asset.compatibleMachineIds||[]).includes(id))
    )){
      onNotice("This machine is linked to production operations, tools or fixtures. Remove or reassign those links before moving it to another company or factory.");return;
    }
    const record:MachineRecord={
      ...machineDraft,id,assetCode:machineDraft.assetCode.trim(),name:machineDraft.name.trim(),machineType:machineDraft.machineType.trim(),
      processDefinitionIds:[...new Set(validProcessIds)],
      materialCapabilities:[...new Set(machineDraft.materialCapabilities.map(value=>value.trim()).filter(Boolean))],
      createdAt:prior?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined
    };
    update(current=>({...current,machines:[...(current.machines||[]).filter(row=>row.id!==id),record]}));
    resetForms();onNotice("Machine asset saved and linked to its company, factory and Process Directory capabilities.");
  };
  const editMachine=(row:MachineRecord)=>{
    resetForms();
    const {id,createdAt,updatedAt,deletedAt,...draft}=row;
    setMachineDraft({...blankMachine(),...draft,processDefinitionIds:[...(row.processDefinitionIds||[])],materialCapabilities:[...(row.materialCapabilities||[])]});
    setMachineEditingId(id);setShowForm(true);
  };
  const saveToolingAsset=()=>{
    const factory=factories.find(row=>row.id===toolingDraft.factoryId);
    if(!toolingDraft.companyId||!factory||factory.companyId!==toolingDraft.companyId||!toolingDraft.assetCode.trim()||!toolingDraft.name.trim()||!toolingDraft.toolType.trim()){
      onNotice("Select the owning company and factory, then enter a tooling asset code, name and type.");return;
    }
    const duplicate=toolingAssets.some(row=>row.id!==toolingEditingId&&!row.deletedAt&&row.companyId===toolingDraft.companyId&&row.assetCode.trim().toLowerCase()===toolingDraft.assetCode.trim().toLowerCase());
    if(duplicate){onNotice("This tooling asset code is already used by the selected company.");return;}
    if(toolingDraft.compatibleMachineIds.some(id=>!machines.some(machine=>machine.id===id&&machine.companyId===toolingDraft.companyId&&machine.factoryId===toolingDraft.factoryId&&!machine.deletedAt))||
       toolingDraft.processDefinitionIds.some(id=>!processDefinitions.some(definition=>definition.id===id&&!definition.deletedAt))){
      onNotice("Remove machine or process capability links that do not belong to this factory or Process Directory.");return;
    }
    if((toolingDraft.toolLifeLimitMinutes>0&&toolingDraft.toolLifeUsedMinutes>toolingDraft.toolLifeLimitMinutes)||(toolingDraft.toolLifeLimitCycles>0&&toolingDraft.toolLifeUsedCycles>toolingDraft.toolLifeLimitCycles)){
      onNotice("Recorded tool life used cannot exceed its defined life limit. Record a regrind or replacement event instead.");return;
    }
    const stamp=nowIso(),id=toolingEditingId||makeId("tooling");
    const prior=toolingAssets.find(row=>row.id===id);
    const assignedToolingOperations=data.operations.filter(operation=>!operation.deletedAt&&(operation.toolingAssetIds||[]).includes(id));
    if(prior&&(prior.companyId!==toolingDraft.companyId||prior.factoryId!==toolingDraft.factoryId)&&assignedToolingOperations.length){
      onNotice("This tool is assigned to production operations. Remove or reassign those operations before moving the tool to another company or factory.");return;
    }
    const record:ToolingAssetRecord={...toolingDraft,id,assetCode:toolingDraft.assetCode.trim(),name:toolingDraft.name.trim(),toolType:toolingDraft.toolType.trim(),
      compatibleMachineIds:[...new Set(toolingDraft.compatibleMachineIds)],machineTypeCapabilities:[...new Set(toolingDraft.machineTypeCapabilities.map(value=>value.trim()).filter(Boolean))],
      processDefinitionIds:[...new Set(toolingDraft.processDefinitionIds)],materialCapabilities:[...new Set(toolingDraft.materialCapabilities.map(value=>value.trim()).filter(Boolean))],
      createdAt:prior?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};
    update(current=>({...current,toolingAssets:[...(current.toolingAssets||[]).filter(row=>row.id!==id),record]}));
    resetForms();onNotice("Tooling asset saved with company/factory, machine/process compatibility and tool-life limits.");
  };
  const editToolingAsset=(row:ToolingAssetRecord)=>{
    resetForms();const {id,createdAt,updatedAt,deletedAt,...draft}=row;
    setToolingDraft({...blankTooling(),...draft,compatibleMachineIds:[...(row.compatibleMachineIds||[])],machineTypeCapabilities:[...(row.machineTypeCapabilities||[])],processDefinitionIds:[...(row.processDefinitionIds||[])],materialCapabilities:[...(row.materialCapabilities||[])]});
    setToolingEditingId(id);setShowForm(true);
  };
  const saveFixtureAsset=()=>{
    const factory=factories.find(row=>row.id===fixtureDraft.factoryId);
    if(!fixtureDraft.companyId||!factory||factory.companyId!==fixtureDraft.companyId||!fixtureDraft.assetCode.trim()||!fixtureDraft.name.trim()||!fixtureDraft.fixtureType.trim()){
      onNotice("Select the owning company and factory, then enter a fixture code, name and type.");return;
    }
    const duplicate=fixtureAssets.some(row=>row.id!==fixtureEditingId&&!row.deletedAt&&row.companyId===fixtureDraft.companyId&&row.assetCode.trim().toLowerCase()===fixtureDraft.assetCode.trim().toLowerCase());
    if(duplicate){onNotice("This fixture asset code is already used by the selected company.");return;}
    if(fixtureDraft.compatibleMachineIds.some(id=>!machines.some(machine=>machine.id===id&&machine.companyId===fixtureDraft.companyId&&machine.factoryId===fixtureDraft.factoryId&&!machine.deletedAt))||
       fixtureDraft.processDefinitionIds.some(id=>!processDefinitions.some(definition=>definition.id===id&&!definition.deletedAt))||
       fixtureDraft.componentIds.some(id=>!components.some(component=>component.id===id&&(!component.companyId||component.companyId===fixtureDraft.companyId)&&!component.deletedAt))){
      onNotice("Remove machine, process or component links that do not belong to this company/factory.");return;
    }
    const stamp=nowIso(),id=fixtureEditingId||makeId("fixture");
    const prior=fixtureAssets.find(row=>row.id===id);
    const assignedFixtureOperations=data.operations.filter(operation=>!operation.deletedAt&&(operation.fixtureAssetIds||[]).includes(id));
    if(prior&&(prior.companyId!==fixtureDraft.companyId||prior.factoryId!==fixtureDraft.factoryId)&&assignedFixtureOperations.length){
      onNotice("This fixture is assigned to production operations. Remove or reassign those operations before moving the fixture to another company or factory.");return;
    }
    const record:FixtureAssetRecord={...fixtureDraft,id,assetCode:fixtureDraft.assetCode.trim(),name:fixtureDraft.name.trim(),fixtureType:fixtureDraft.fixtureType.trim(),
      compatibleMachineIds:[...new Set(fixtureDraft.compatibleMachineIds)],machineTypeCapabilities:[...new Set(fixtureDraft.machineTypeCapabilities.map(value=>value.trim()).filter(Boolean))],
      processDefinitionIds:[...new Set(fixtureDraft.processDefinitionIds)],componentIds:[...new Set(fixtureDraft.componentIds)],
      createdAt:prior?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};
    update(current=>({...current,fixtureAssets:[...(current.fixtureAssets||[]).filter(row=>row.id!==id),record]}));
    resetForms();onNotice("Fixture saved with machine/process compatibility, component scope and inspection status.");
  };
  const editFixtureAsset=(row:FixtureAssetRecord)=>{
    resetForms();const {id,createdAt,updatedAt,deletedAt,...draft}=row;
    setFixtureDraft({...blankFixture(),...draft,compatibleMachineIds:[...(row.compatibleMachineIds||[])],machineTypeCapabilities:[...(row.machineTypeCapabilities||[])],processDefinitionIds:[...(row.processDefinitionIds||[])],componentIds:[...(row.componentIds||[])]});
    setFixtureEditingId(id);setShowForm(true);
  };
  const openResourceUsage=(resourceType:"tooling"|"fixture",resourceId:string)=>{
    resetForms();setResourceEventDraft(blankResourceEvent(resourceType,resourceId));setShowResourceEventForm(true);
  };
  const saveResourceUsage=()=>{
    const resource=resourceEventDraft.resourceType==="tooling"?toolingAssets.find(row=>row.id===resourceEventDraft.resourceId):fixtureAssets.find(row=>row.id===resourceEventDraft.resourceId);
    if(!resource){onNotice("Select a registered tooling or fixture asset first.");return;}
    const operation=resourceEventDraft.operationId?data.operations.find(row=>row.id===resourceEventDraft.operationId&&!row.deletedAt):undefined;
    if(resourceEventDraft.operationId&&(!operation||
       !orders.some(po=>po.id===operation.poId&&po.companyId===resource.companyId&&po.factoryId===resource.factoryId)||
       !(resourceEventDraft.resourceType==="tooling"?(operation.toolingAssetIds||[]).includes(resource.id):(operation.fixtureAssetIds||[]).includes(resource.id)))){
      onNotice("Select an operation that is already linked to this exact asset and factory.");return;
    }
    if(resourceEventDraft.eventType==="Regrind"&&resourceEventDraft.resourceType!=="tooling"){onNotice("Regrind events apply only to cutting tools and tooling assets.");return;}
    const parsedOccurredAt=new Date(resourceEventDraft.occurredAt);
    if(!Number.isFinite(parsedOccurredAt.getTime())){onNotice("Enter a valid resource usage date and time.");return;}
    const stamp=parsedOccurredAt.toISOString();
    const event:ResourceUsageEventRecord={id:makeId("resource-usage"),companyId:resource.companyId,factoryId:resource.factoryId,
      resourceType:resourceEventDraft.resourceType,resourceId:resource.id,operationId:operation?.id,
      eventType:resourceEventDraft.eventType,runtimeMinutes:Math.max(0,Number(resourceEventDraft.runtimeMinutes)||0),cycles:Math.max(0,Number(resourceEventDraft.cycles)||0),
      inspectionResult:resourceEventDraft.eventType==="Inspection"?resourceEventDraft.inspectionResult:undefined,
      inspectionDueAt:resourceEventDraft.eventType==="Inspection"?resourceEventDraft.inspectionDueAt||undefined:undefined,
      occurredAt:stamp,notes:resourceEventDraft.notes.trim(),createdAt:nowIso(),updatedAt:nowIso()};
    try{
      const updated=applyResourceUsageEvent(resource,event,resourceUsageEvents);
      update(current=>({...current,
        [resourceEventDraft.resourceType==="tooling"?"toolingAssets":"fixtureAssets"]:(resourceEventDraft.resourceType==="tooling"?current.toolingAssets:current.fixtureAssets).map(row=>row.id===resource.id?updated:row),
        resourceUsageEvents:[...(current.resourceUsageEvents||[]),event]
      }));
      setShowResourceEventForm(false);setResourceEventDraft(blankResourceEvent());
      onNotice("Resource usage event recorded. Tool life, fixture cycle count and availability were updated.");
    }catch(error){onNotice(error instanceof Error?error.message:"Could not record resource usage event.");}
  };

  const saveComponent = () => {
    if (!componentDraft.companyId || !componentDraft.partNumber.trim() || !componentDraft.name.trim()) { onNotice("Select a company and enter component number and name."); return; }
    const stamp = nowIso(); const id = componentEditingId || makeId("component");
    update(current => ({ ...current, components: [...current.components.filter(x => x.id !== id), { ...componentDraft, salePrice: Math.max(0, Number(componentPriceInput) || 0), partNumber: componentDraft.partNumber.trim(), name: componentDraft.name.trim(), revision: componentDraft.revision.trim(), id, createdAt: current.components.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Component master saved. Purchase-order lines, operations and quotations can link to this component ID.");
  };
  const savePO = () => {
    if (!poDraft.number.trim() || !poDraft.companyId) { onNotice("Select a company and enter the purchase-order number."); return; }
    if (poDraft.customerId && !customers.some(customer=>customer.id===poDraft.customerId&&customer.ownerCompanyId===poDraft.companyId)) { onNotice("Select a buyer customer account owned by the selected company."); return; }
    if (!poLines.length || poLines.some(line => !line.componentId || line.quantity <= 0 || (line.allocationLevel === "part" && !componentParts.some(part => part.id === line.partId && part.componentId === line.componentId)))) { onNotice("Add valid PO lines. Every line needs a component and positive quantity; part-level lines must select a saved part belonging to that component. Add separate lines for component-level and part-level quantities when needed."); return; }
    const stamp = nowIso(); const id = poEditingId || makeId("po");
    const lines = poLines.map(line => { const clean = { ...line }; delete clean.unitPrice; return { ...clean, id: line.id || makeId("line"), targetDelivery: line.targetDelivery || poDraft.targetDelivery }; });
    update(current => ({ ...current, purchaseOrders: [...current.purchaseOrders.filter(x => x.id !== id), { ...poDraft, number: poDraft.number.trim(), id, lines, createdAt: current.purchaseOrders.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Purchase order saved. Each PO line now points to a component record ID; the Process Map can load the selected line, quantity and delivery target automatically.");
  };

  const editCompany = (row: CompanyRecord) => { resetForms(); setCompanyDraft({ name: row.name, gstin: row.gstin, contactPerson: row.contactPerson || "", phone: row.phone, email: row.email, address: row.address || "", notes: row.notes }); setCompanyEditingId(row.id); setShowForm(true); };
  const editFactory = (row: FactoryRecord) => { resetForms(); setFactoryDraft({ companyId: row.companyId, name: row.name, address: row.address, contactPhone: row.contactPhone }); setFactoryEditingId(row.id); setShowForm(true); };
  const editComponent = (row: ComponentRecord) => {
    resetForms();
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setComponentDraft(draft); setComponentPriceInput(String(row.salePrice ?? "")); setComponentEditingId(row.id); setShowForm(true);
  };
  const editPO = (row: PurchaseOrderRecord) => {
    resetForms();
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setPoDraft(draft); setPoLines(row.lines.map(line => ({ ...line }))); setPoEditingId(row.id); setShowForm(true);
  };
  const deleteComponents = (ids:string[]) => {
    const targets=components.filter(row=>ids.includes(row.id));
    if(!targets.length)return;
    if(!window.confirm("Permanently delete "+targets.length+" component master record(s) and all dependent PO lines, process/route relationships, material links, transport, quotations, payments, inspections, stock transactions and planned-cost records where the component identity is unambiguous? This cannot be undone. Shared material, vendor, process and transport masters remain intact."))return;
    const targetIds=targets.map(row=>row.id);
    update(current=>removeComponentDependents(current,targetIds));
    setSelectedComponentIds(current=>current.filter(id=>!targetIds.includes(id)));
    onNotice(targets.length+" component(s) and their dependent operational links deleted. Shared masters and ambiguous legacy planned-cost rows were preserved.");
  };
  const deletePurchaseOrders = (ids:string[]) => {
    const targets=orders.filter(row=>ids.includes(row.id));
    if(!targets.length)return;
    if(!window.confirm("Permanently delete "+targets.length+" purchase order(s), their component lines and linked operations, route relationships, material-process links, transport, costing, payment, inspection, stock movements and follow-up assignments? Shared component and master records will remain. This cannot be undone."))return;
    const targetIds=targets.map(row=>row.id);
    update(current=>removePurchaseOrderDependents(current,targetIds));
    setSelectedPoIds(current=>current.filter(id=>!targetIds.includes(id)));
    setOpenedPoId("");
    onNotice(targets.length+" purchase order(s) and their PO-specific dependent records deleted. Shared component and master records remain intact.");
  };
  const exportComponentsExcel = async (rows:ComponentRecord[],fileName="AXIMACH-Components.xlsx") => {
    if(!rows.length){onNotice("No component records selected for export.");return;}
    const workbook=new ExcelJS.Workbook();workbook.creator="AXIMACH";const sheet=workbook.addWorksheet("Components");
    sheet.columns=[{header:"Logo",key:"logo",width:10},{header:"Company",key:"company",width:28},{header:"Component Number",key:"partNumber",width:24},{header:"Component Name",key:"name",width:36},{header:"Revision",key:"revision",width:14},{header:"Drawing Reference",key:"drawing",width:28},{header:"Price",key:"price",width:16},{header:"Price Unit",key:"unit",width:14},{header:"Notes",key:"notes",width:40}];
    sheet.addRows(rows.map(row=>({company:companyName(row.companyId||""),partNumber:row.partNumber,name:row.name,revision:row.revision,drawing:row.drawingReference,price:row.salePrice,unit:row.salePriceUnit,notes:row.notes})));
    for(let index=0;index<rows.length;index++){
      const row=rows[index];
      const imageId=workbook.addImage({base64:await componentLogoPngBase64(row),extension:"png"});
      sheet.addImage(imageId,{tl:{col:0,row:index+1},ext:{width:30,height:30}});
      sheet.getRow(index+2).height=28;
    }
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};sheet.views=[{state:"frozen",ySplit:1}];
    const bytes=await workbook.xlsx.writeBuffer();const blob=new Blob([new Uint8Array(bytes).buffer as ArrayBuffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url);onNotice("Exported "+rows.length+" component record(s) to Excel.");
  };
  const exportComponentsPdf = (rows:ComponentRecord[]) => {
    if(!rows.length){onNotice("No component records selected for PDF.");return;}const esc=(v:unknown)=>String(v??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
    const body=rows.map(row=>"<tr><td><img src='"+esc(componentLogoSource(row))+"' width='32' height='32' alt='component logo'/></td><td>"+esc(row.partNumber)+"</td><td>"+esc(row.name)+"</td><td>"+esc(row.revision)+"</td><td>"+esc(companyName(row.companyId||""))+"</td><td>"+esc(row.drawingReference)+"</td><td>"+esc("₹"+row.salePrice.toLocaleString("en-IN")+" / "+row.salePriceUnit)+"</td></tr>").join("");
    const win=window.open("","_blank");if(!win){onNotice("Allow pop-ups to save the component register as PDF.");return;}win.document.write("<!doctype html><html><head><title>AXIMACH Components</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left;vertical-align:middle}th{background:#eef2f6}img{display:block;object-fit:contain}</style></head><body><h1>AXIMACH · Component Master</h1><table><thead><tr><th>Logo</th><th>Part no.</th><th>Component</th><th>Revision</th><th>Company</th><th>Drawing ref</th><th>Master price</th></tr></thead><tbody>"+body+"</tbody></table></body></html>");win.document.close();win.focus();win.print();
  };
  const exportPurchaseOrdersExcel = async (rows:PurchaseOrderRecord[]) => {
    if(!rows.length){onNotice("No purchase orders selected for export.");return;}const workbook=new ExcelJS.Workbook();workbook.creator="AXIMACH";const sheet=workbook.addWorksheet("Purchase Orders");
    sheet.columns=[{header:"Logo",key:"logo",width:10},{header:"PO Number",key:"number",width:20},{header:"Company",key:"company",width:28},{header:"PO Date",key:"date",width:16},{header:"Target Delivery",key:"delivery",width:18},{header:"Status",key:"status",width:16},{header:"Component Number",key:"partNumber",width:22},{header:"Component Name",key:"component",width:34},{header:"Part / Allocation",key:"part",width:34},{header:"Quantity",key:"quantity",width:14},{header:"Unit Price",key:"price",width:16},{header:"Line Delivery",key:"lineDelivery",width:18}];
    let exportRow=0;
    for(const po of rows)for(const line of po.lines){
      const component=components.find(row=>row.id===line.componentId);
      const componentPart=componentParts.find(row=>row.id===(line.partId||""));
      sheet.addRow({number:po.number,company:companyName(po.companyId),date:po.issueDate,delivery:po.targetDelivery,status:po.status,partNumber:component?.partNumber||"",component:component?.name||"",part:line.partId?((componentPart?.partNumber||"")+" · "+(componentPart?.name||"")):"Component-level",quantity:line.quantity,price:component?.salePrice||0,lineDelivery:line.targetDelivery});
      if(component){const imageId=workbook.addImage({base64:await componentLogoPngBase64(component),extension:"png"});sheet.addImage(imageId,{tl:{col:0,row:exportRow+1},ext:{width:30,height:30}});}
      sheet.getRow(exportRow+2).height=28;
      exportRow++;
    }
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};sheet.views=[{state:"frozen",ySplit:1}];
    const bytes=await workbook.xlsx.writeBuffer();const blob=new Blob([new Uint8Array(bytes).buffer as ArrayBuffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="AXIMACH-Purchase-Orders.xlsx";a.click();URL.revokeObjectURL(url);onNotice("Exported "+rows.length+" purchase order(s) to Excel.");
  };
  const archive = (collection: "companies" | "factories" | "machines" | "toolingAssets" | "fixtureAssets" | "components" | "purchaseOrders", id: string) => {
    if(collection==="companies"&&(machines.some(machine=>machine.companyId===id)||toolingAssets.some(asset=>asset.companyId===id)||fixtureAssets.some(asset=>asset.companyId===id))){
      onNotice("Archive or reassign this company's machine assets before archiving the company. Machine ownership and production history must remain traceable.");return;
    }
    if(collection==="factories"&&(machines.some(machine=>machine.factoryId===id)||toolingAssets.some(asset=>asset.factoryId===id)||fixtureAssets.some(asset=>asset.factoryId===id))){
      onNotice("Archive or reassign the machine assets in this factory before archiving the factory.");return;
    }
    if(collection==="toolingAssets"&&data.operations.some(operation=>!operation.deletedAt&&(operation.toolingAssetIds||[]).includes(id))){
      onNotice("This tooling asset is assigned to active operations. Remove its assignments before archiving it.");return;
    }
    if(collection==="fixtureAssets"&&data.operations.some(operation=>!operation.deletedAt&&(operation.fixtureAssetIds||[]).includes(id))){
      onNotice("This fixture asset is assigned to active operations. Remove its assignments before archiving it.");return;
    }
    if(collection==="machines"&&(toolingAssets.some(asset=>!asset.deletedAt&&(asset.compatibleMachineIds||[]).includes(id))||fixtureAssets.some(asset=>!asset.deletedAt&&(asset.compatibleMachineIds||[]).includes(id)))){
      onNotice("This machine is linked to tooling or fixtures. Remove those compatibility links before archiving the machine.");return;
    }
    if(collection==="machines"&&data.operations.some(operation=>!operation.deletedAt&&operation.machineId===id)){
      onNotice("This machine is referenced by active production operations. Reassign those operations before archiving the machine.");return;
    }
    if(collection==="machines"&&maintenancePlans.some(plan=>plan.machineId===id&&plan.active)){
      onNotice("Pause or reassign active preventive maintenance plans before archiving this machine.");return;
    }
    if(collection==="machines"&&maintenanceWorkOrders.some(order=>order.machineId===id&&!["Completed","Cancelled"].includes(order.status))){
      onNotice("Complete or cancel open maintenance work orders before archiving this machine.");return;
    }
    if(collection==="machines"&&machineDowntime.some(event=>event.machineId===id&&!event.endedAt)){
      onNotice("Close open downtime events before archiving this machine.");return;
    }
    if (!window.confirm("Archive this record? It will be hidden from active selectors but retained in history to protect linked records.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, [collection]: current[collection].map(row => row.id === id ? { ...row, deletedAt: stamp, updatedAt: stamp } : row) } as typeof current));
    onNotice("Record archived. Linked historical records remain intact.");
  };

  const header = moduleId === "companies" ? tab === "machines" ? "Machine & Equipment Register" : tab === "tooling" ? "Tooling Register" : tab === "fixtures" ? "Fixtures & Workholding Register" : "Company Directory" : moduleId === "purchasing" ? "Purchase Orders" : "Component Master";
  const description = moduleId === "companies"
    ? tab === "machines" ? "Register owned machines by company and factory, record technical limits and map supported Process Directory operations." : tab === "tooling" ? "Register cutting tools, holders and tooling assets; track tool life, regrinds, inspections, machine/process compatibility and auditable use." : tab === "fixtures" ? "Register jigs, fixtures and workholding; track machine/component compatibility, usage cycles, setup information and inspections." : "Maintain company name, GST, contact person, email and address; records link by stable IDs."
    : moduleId === "purchasing"
      ? "Create each PO once and add multiple component lines; every line stores component ID, quantity and target delivery."
      : "Create each part number once with drawing revision/reference and a master price per piece or set; reuse the linked record in every order and route.";

  return <section className="workspace-page module-functional-page master-data-page">
    {notice && <div className="notice-banner"><Check size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER NOT CONNECTED"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER RECORDS / LINKED DATA</div><h1>{header}<span>.</span></h1><p>{description}</p></div>
      <div className="workspace-title-actions">
        {moduleId === "components" && <button className="button-quiet" disabled={!selectedComponentForNavigation} onClick={() => onSelectModule("costing",selectedComponentContext)}><CircleDollarSign size={15}/> Component costing</button>}
        {moduleId === "purchasing" && <button className="button-quiet" disabled={!selectedPOForNavigation} onClick={() => onSelectModule("process-map",selectedPOContext)}><ArrowRight size={15}/> Open Process Map</button>}
        <button className="button-primary" onClick={beginAdd}><Plus size={15}/> {moduleId === "companies" ? (tab === "factories" ? "Add Factory" : tab === "machines" ? "Add Machine" : tab === "tooling" ? "Add Tooling" : tab === "fixtures" ? "Add Fixture" : "Add Company") : moduleId === "purchasing" ? "Create Purchase Order" : "Add Component"}</button>
      </div>
    </div>
    {moduleId === "companies" && <div className="costing-tabs">
      <button className={tab === "companies" ? "costing-tab-active" : ""} onClick={() => { setTab("companies"); resetForms(); }}><Building2 size={15}/> Companies ({companies.length})</button>
      <button className={tab === "factories" ? "costing-tab-active" : ""} onClick={() => { setTab("factories"); resetForms(); }}><Factory size={15}/> Factories ({factories.length})</button>
      <button className={tab === "machines" ? "costing-tab-active" : ""} onClick={() => { setTab("machines"); resetForms(); setSearch(""); }}><Cog size={15}/> Machines ({machines.length})</button>
      <button className={tab === "tooling" ? "costing-tab-active" : ""} onClick={() => { setTab("tooling"); resetForms(); setSearch(""); }}><Wrench size={15}/> Tooling ({toolingAssets.length})</button>
      <button className={tab === "fixtures" ? "costing-tab-active" : ""} onClick={() => { setTab("fixtures"); resetForms(); setSearch(""); }}><Gauge size={15}/> Fixtures ({fixtureAssets.length})</button>
    </div>}
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Search " + header.toLowerCase() + "…"}/></label><span className="module-number">{moduleId === "companies" ? tab === "companies" ? companies.length + " COMPANIES" : tab === "factories" ? factories.length + " FACTORIES" : tab === "machines" ? machines.length + " MACHINES" : tab === "tooling" ? toolingAssets.length + " TOOLING ASSETS" : fixtureAssets.length + " FIXTURES" : moduleId === "purchasing" ? orders.length + " ORDERS" : components.length + " COMPONENTS"}</span></div>
    {moduleId === "components" && <section className="surface-panel master-column-filters"><div className="panel-heading"><div><h3>Component Master filters</h3><p>Column-wise search and multi-select for the actual company, part number, component name, revision, drawing and unit values.</p></div><button className="button-quiet compact-button" onClick={()=>{setSearch("");setComponentCompanyFilters([]);setComponentNumberFilters([]);setComponentNameFilters([]);setComponentRevisionFilters([]);setComponentDrawingFilters([]);setComponentUnitFilters([]);}}>Clear all filters</button></div><div className="contact360-filter-grid ax-search-filter-columns"><SearchableMultiSelect id="component-master-company-filter" label="Company" options={companies.map(row=>({id:row.id,label:row.name}))} selected={componentCompanyFilters} onChange={setComponentCompanyFilters} emptyMeansAll/><SearchableMultiSelect id="component-master-number-filter" label="Component number" options={[...new Set(components.map(row=>row.partNumber).filter(Boolean))].sort().map(value=>({id:value,label:value}))} selected={componentNumberFilters} onChange={setComponentNumberFilters} emptyMeansAll/><SearchableMultiSelect id="component-master-name-filter" label="Component name" options={[...new Set(components.map(row=>row.name).filter(Boolean))].sort().map(value=>({id:value,label:value}))} selected={componentNameFilters} onChange={setComponentNameFilters} emptyMeansAll/><SearchableMultiSelect id="component-master-revision-filter" label="Revision" options={[...new Set(components.map(row=>row.revision||"—"))].sort().map(value=>({id:value,label:value}))} selected={componentRevisionFilters} onChange={setComponentRevisionFilters} emptyMeansAll/><SearchableMultiSelect id="component-master-drawing-filter" label="Drawing reference" options={[...new Set(components.map(row=>row.drawingReference||"—"))].sort().map(value=>({id:value,label:value}))} selected={componentDrawingFilters} onChange={setComponentDrawingFilters} emptyMeansAll/><SearchableMultiSelect id="component-master-unit-filter" label="Unit" options={["piece","set"].map(value=>({id:value,label:value==="piece"?"Per piece":"Per set"}))} selected={componentUnitFilters} onChange={setComponentUnitFilters} emptyMeansAll/></div></section>}
    {moduleId === "purchasing" && <section className="surface-panel master-column-filters"><div className="panel-heading"><div><h3>Purchase Orders filters</h3><p>Column-wise search and multi-select for PO number, company, issue date, target delivery, component and status.</p></div><button className="button-quiet compact-button" onClick={()=>{setSearch("");setPoCompanyFilters([]);setPoNumberFilters([]);setPoIssueDateFilters([]);setPoDeliveryFilters([]);setPoComponentFilters([]);setPoCustomerFilters([]);setPoStatusFilters([]);}}>Clear all filters</button></div><div className="contact360-filter-grid ax-search-filter-columns"><SearchableMultiSelect id="purchase-order-number-filter" label="PO number" options={[...new Set(orders.map(row=>row.number).filter(Boolean))].sort().map(value=>({id:value,label:value}))} selected={poNumberFilters} onChange={setPoNumberFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-company-filter" label="Company" options={companies.map(row=>({id:row.id,label:row.name}))} selected={poCompanyFilters} onChange={setPoCompanyFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-issue-date-filter" label="Issue date" options={[...new Set(orders.map(row=>row.issueDate||"—"))].sort().map(value=>({id:value,label:value}))} selected={poIssueDateFilters} onChange={setPoIssueDateFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-delivery-filter" label="Target delivery" options={[...new Set(orders.map(row=>row.targetDelivery||"—"))].sort().map(value=>({id:value,label:value}))} selected={poDeliveryFilters} onChange={setPoDeliveryFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-component-filter" label="Component" options={components.map(row=>({id:row.id,label:row.partNumber+" · "+row.name}))} selected={poComponentFilters} onChange={setPoComponentFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-customer-filter" label="Customer / buyer" options={customers.map(row=>({id:row.id,label:row.displayName||row.legalName}))} selected={poCustomerFilters} onChange={setPoCustomerFilters} emptyMeansAll/><SearchableMultiSelect id="purchase-order-status-filter" label="PO status" options={[...new Set(orders.map(row=>row.status).filter(Boolean))].sort().map(value=>({id:value,label:value}))} selected={poStatusFilters} onChange={setPoStatusFilters} emptyMeansAll/></div></section>}
    {moduleId === "components" && <div className="module-action-bar po-bulk-actions">
      <label><input type="checkbox" checked={filteredComponents.length>0&&filteredComponents.every(row=>selectedComponentIds.includes(row.id))} onChange={event=>setSelectedComponentIds(event.target.checked?[...new Set([...selectedComponentIds,...filteredComponents.map(row=>row.id)])]:selectedComponentIds.filter(id=>!filteredComponents.some(row=>row.id===id)))} /> Select all visible</label>
      <span className="module-number">{selectedComponentIds.filter(id=>components.some(row=>row.id===id)).length} SELECTED</span>
      <button className="button-primary compact-button" disabled={!selectedComponentIds.length} onClick={()=>exportComponentsPdf(components.filter(row=>selectedComponentIds.includes(row.id)))}>Selected PDF</button>
      <button className="button-quiet compact-button" disabled={!selectedComponentIds.length} onClick={()=>void exportComponentsExcel(components.filter(row=>selectedComponentIds.includes(row.id)))}>Selected Excel</button>
      <button className="button-quiet compact-button" onClick={()=>exportComponentsPdf(components)}>All PDF</button>
      <button className="button-quiet compact-button" onClick={()=>void exportComponentsExcel(components)}>All Excel</button>
      <button className="button-danger compact-button" disabled={!selectedComponentIds.length} onClick={()=>deleteComponents(selectedComponentIds)}><Trash2 size={13}/> Delete selected</button>
      <button className="button-danger compact-button" disabled={!components.length} onClick={()=>deleteComponents(components.map(row=>row.id))}>Delete all components</button>
      <button className="button-quiet compact-button" disabled={!selectedComponentIds.length} onClick={()=>setSelectedComponentIds([])}>Clear selection</button>
    </div>}
    {moduleId === "purchasing" && <div className="module-action-bar po-bulk-actions">
      <label><input type="checkbox" checked={filteredOrders.length>0 && filteredOrders.every(order=>selectedPoIds.includes(order.id))} onChange={event=>setSelectedPoIds(event.target.checked?[...new Set([...selectedPoIds,...filteredOrders.map(order=>order.id)])]:selectedPoIds.filter(id=>!filteredOrders.some(order=>order.id===id)))} /> Select all visible</label>
      <span className="module-number">{selectedPoIds.filter(id=>orders.some(order=>order.id===id)).length} SELECTED</span>
      <button className="button-primary compact-button" disabled={!selectedPoIds.length} onClick={()=>exportPurchaseOrdersPdf(orders.filter(order=>selectedPoIds.includes(order.id)))}><FileDown size={14}/> Selected PDF</button>
      <button className="button-quiet compact-button" disabled={!selectedPoIds.length} onClick={()=>void exportPurchaseOrdersExcel(orders.filter(order=>selectedPoIds.includes(order.id)))}>Selected Excel</button>
      <button className="button-quiet compact-button" onClick={()=>exportPurchaseOrdersPdf(orders)}>All PDF</button>
      <button className="button-quiet compact-button" onClick={()=>void exportPurchaseOrdersExcel(orders)}>All Excel</button>
      <button className="button-danger compact-button" disabled={!selectedPoIds.length} onClick={()=>deletePurchaseOrders(selectedPoIds)}><Trash2 size={13}/> Delete selected</button>
      <button className="button-danger compact-button" disabled={!orders.length} onClick={()=>deletePurchaseOrders(orders.map(row=>row.id))}>Delete all Purchase Orders</button>
      <button className="button-quiet compact-button" disabled={!selectedPoIds.length} onClick={()=>setSelectedPoIds([])}>Clear selection</button>
    </div>}

    {showForm && <section className="surface-panel module-record-form-panel">
      <div className="panel-heading"><div><h3>{moduleId === "companies" ? toolingEditingId ? "Edit tooling asset" : fixtureEditingId ? "Edit fixture" : machineEditingId ? "Edit machine" : companyEditingId ? "Edit company" : factoryEditingId ? "Edit factory" : tab === "tooling" ? "New tooling asset" : tab === "fixtures" ? "New fixture" : tab === "machines" ? "New machine" : tab === "companies" ? "New company" : "New factory" : moduleId === "purchasing" ? poEditingId ? "Edit purchase order" : "New purchase order" : componentEditingId ? "Edit component" : "New component"}</h3><p>Required fields are checked before the record is saved.</p></div><button className="icon-control" onClick={resetForms} aria-label="Close form"><X size={15}/></button></div>
      {moduleId === "companies" && tab === "companies" && !factoryEditingId && <div className="module-record-form">
        <label>Company name *<input value={companyDraft.name} onChange={e => setCompanyDraft({ ...companyDraft, name: e.target.value })} placeholder="Enter your actual registered company name"/></label>
        <label>GSTIN<input value={companyDraft.gstin} onChange={e => setCompanyDraft({ ...companyDraft, gstin: e.target.value.toUpperCase() })} placeholder="Optional"/></label>
        <label>Contact person<input value={companyDraft.contactPerson || ""} onChange={e => setCompanyDraft({ ...companyDraft, contactPerson: e.target.value })} placeholder="Primary contact person"/></label>
        <label>Phone<input value={companyDraft.phone} onChange={e => setCompanyDraft({ ...companyDraft, phone: e.target.value })} placeholder="Country code + number"/></label>
        <label>Email<input type="email" value={companyDraft.email} onChange={e => setCompanyDraft({ ...companyDraft, email: e.target.value })} placeholder="Accounts / contact email"/></label>
        <label>Address<input value={companyDraft.address || ""} onChange={e => setCompanyDraft({ ...companyDraft, address: e.target.value })} placeholder="Registered / business address"/></label>
        <label className="module-form-wide">Notes<input value={companyDraft.notes} onChange={e => setCompanyDraft({ ...companyDraft, notes: e.target.value })} placeholder="Optional notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveCompany}><Check size={14}/> Save company</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "companies" && (factoryEditingId || (tab === "factories" && !machineEditingId)) && <div className="module-record-form">
        <SearchablePicker id="factory-parent-company" label="Parent company *" value={factoryDraft.companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={companyId=>setFactoryDraft({...factoryDraft,companyId})}/>
        <label>Factory / site name *<input value={factoryDraft.name} onChange={e => setFactoryDraft({ ...factoryDraft, name: e.target.value })} placeholder="Enter factory name"/></label>
        <label>Address<input value={factoryDraft.address} onChange={e => setFactoryDraft({ ...factoryDraft, address: e.target.value })} placeholder="Factory address"/></label>
        <label>Factory contact phone<input value={factoryDraft.contactPhone} onChange={e => setFactoryDraft({ ...factoryDraft, contactPhone: e.target.value })} placeholder="Optional"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveFactory}><Check size={14}/> Save factory</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
        {!companies.length && <div className="module-safety-note">Add a company first; a factory must reference its parent company.</div>}
      </div>}
      {moduleId === "companies" && (machineEditingId || tab === "machines") && <div className="module-record-form">
        <SearchablePicker id="machine-company" label="Owning company *" value={machineDraft.companyId} placeholder="Select company…" options={companies.map(row=>({id:row.id,label:row.name}))} onChange={companyId=>setMachineDraft({...machineDraft,companyId,factoryId:factories.some(factory=>factory.id===machineDraft.factoryId&&factory.companyId===companyId)?machineDraft.factoryId:""})}/>
        <SearchablePicker id="machine-factory" label="Factory / site *" value={machineDraft.factoryId} placeholder="Select the machine's physical factory…" options={factories.filter(factory=>factory.companyId===machineDraft.companyId).map(factory=>({id:factory.id,label:factory.name+" · "+factory.address}))} onChange={factoryId=>setMachineDraft({...machineDraft,factoryId})}/>
        <label>Asset code *<input value={machineDraft.assetCode} onChange={event=>setMachineDraft({...machineDraft,assetCode:event.target.value.toUpperCase()})} placeholder="e.g. VMC-01 / WEDM-02"/></label>
        <label>Machine / equipment name *<input value={machineDraft.name} onChange={event=>setMachineDraft({...machineDraft,name:event.target.value})} placeholder="Vertical machining centre 01"/></label>
        <SearchablePicker id="machine-type" label="Machine type *" value={machineDraft.machineType} placeholder="Select or enter machine type…" options={["CNC Turning","VMC","HMC","5-axis machining centre","Wire EDM","Sinker EDM","Surface Grinding","Cylindrical Grinding","Plano Milling","Laser Cutting","Press Brake","Welding","CMM","Other"].map(value=>({id:value,label:value}))} onChange={machineType=>setMachineDraft({...machineDraft,machineType})} allowCustom/>
        <label>Manufacturer<input value={machineDraft.manufacturer||""} onChange={event=>setMachineDraft({...machineDraft,manufacturer:event.target.value})} placeholder="Machine manufacturer"/></label>
        <label>Model<input value={machineDraft.model||""} onChange={event=>setMachineDraft({...machineDraft,model:event.target.value})} placeholder="Model / series"/></label>
        <label>Serial number<input value={machineDraft.serialNumber||""} onChange={event=>setMachineDraft({...machineDraft,serialNumber:event.target.value})} placeholder="Manufacturer serial number"/></label>
        <label>Controller<input value={machineDraft.controller||""} onChange={event=>setMachineDraft({...machineDraft,controller:event.target.value})} placeholder="Fanuc / Siemens / Mitsubishi…"/></label>
        <label>Axis count<input type="number" min="1" max="12" value={machineDraft.axisCount??""} onChange={event=>setMachineDraft({...machineDraft,axisCount:Math.max(1,Math.min(12,Math.floor(Number(event.target.value)||1)))})}/></label>
        <label>X travel (mm)<input type="number" min="0" step="0.1" value={machineDraft.workEnvelopeXmm||""} onChange={event=>setMachineDraft({...machineDraft,workEnvelopeXmm:Math.max(0,Number(event.target.value)||0)})}/></label>
        <label>Y travel (mm)<input type="number" min="0" step="0.1" value={machineDraft.workEnvelopeYmm||""} onChange={event=>setMachineDraft({...machineDraft,workEnvelopeYmm:Math.max(0,Number(event.target.value)||0)})}/></label>
        <label>Z travel (mm)<input type="number" min="0" step="0.1" value={machineDraft.workEnvelopeZmm||""} onChange={event=>setMachineDraft({...machineDraft,workEnvelopeZmm:Math.max(0,Number(event.target.value)||0)})}/></label>
        <label>Maximum spindle speed (RPM)<input type="number" min="0" value={machineDraft.spindleMaxRpm||""} onChange={event=>setMachineDraft({...machineDraft,spindleMaxRpm:Math.max(0,Number(event.target.value)||0)})}/></label>
        <label>Positioning accuracy (µm)<input type="number" min="0" step="0.1" value={machineDraft.positioningAccuracyMicron||""} onChange={event=>setMachineDraft({...machineDraft,positioningAccuracyMicron:Math.max(0,Number(event.target.value)||0)})}/></label>
        <label>Maximum workpiece weight (kg)<input type="number" min="0" step="0.1" value={machineDraft.maxWorkpieceWeightKg||""} onChange={event=>setMachineDraft({...machineDraft,maxWorkpieceWeightKg:Math.max(0,Number(event.target.value)||0)})}/></label>
        <div className="module-form-wide"><SearchableMultiSelect id="machine-process-capabilities" label="Supported Process Directory definitions" options={processDefinitions.map(definition=>({id:definition.id,label:definition.category+" · "+definition.processType}))} selected={machineDraft.processDefinitionIds} onChange={processDefinitionIds=>setMachineDraft({...machineDraft,processDefinitionIds})}/><small className="field-hint">Only operations linked to these stable process IDs will be eligible for this machine.</small></div>
        <label className="module-form-wide">Material capabilities<input value={machineDraft.materialCapabilities.join(", ")} onChange={event=>setMachineDraft({...machineDraft,materialCapabilities:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="Aluminium, EN24, stainless steel…"/></label>
        <SearchablePicker id="machine-status" label="Machine status" value={machineDraft.status} options={MACHINE_STATUSES.map(value=>({id:value,label:value}))} onChange={status=>setMachineDraft({...machineDraft,status:status as MachineStatus})}/>
        <label>Commissioned date<input type="date" value={machineDraft.commissionedAt||""} onChange={event=>setMachineDraft({...machineDraft,commissionedAt:event.target.value})}/></label>
        <label>Next planned maintenance<input type="date" value={machineDraft.nextMaintenanceAt||""} onChange={event=>setMachineDraft({...machineDraft,nextMaintenanceAt:event.target.value})}/></label>
        <label className="module-form-wide">Engineering notes / machine limits<input value={machineDraft.notes} onChange={event=>setMachineDraft({...machineDraft,notes:event.target.value})} placeholder="Workholding limits, inspection notes, special restrictions…"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveMachine}><Check size={14}/> Save machine asset</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
        {!companies.length&&<div className="module-safety-note">Add a company first. Every machine must be owned by an existing company and assigned to one of its factories.</div>}
        {machineDraft.companyId&&!factories.some(factory=>factory.companyId===machineDraft.companyId)&&<div className="module-safety-note">Add a factory for this company before registering a machine.</div>}
      </div>}
      {moduleId === "companies" && (toolingEditingId || tab === "tooling") && <div className="module-record-form">
        <SearchablePicker id="tooling-company" label="Owning company *" value={toolingDraft.companyId} options={companies.map(row=>({id:row.id,label:row.name}))} placeholder="Select company…" onChange={companyId=>setToolingDraft({...toolingDraft,companyId,factoryId:factories.some(row=>row.id===toolingDraft.factoryId&&row.companyId===companyId)?toolingDraft.factoryId:""})}/>
        <SearchablePicker id="tooling-factory" label="Factory / site *" value={toolingDraft.factoryId} options={factories.filter(row=>row.companyId===toolingDraft.companyId).map(row=>({id:row.id,label:row.name}))} placeholder="Select factory…" onChange={factoryId=>setToolingDraft({...toolingDraft,factoryId})}/>
        <label>Tool asset code *<input value={toolingDraft.assetCode} onChange={e=>setToolingDraft({...toolingDraft,assetCode:e.target.value.toUpperCase()})} placeholder="e.g. END-MILL-10 / DRILL-06"/></label>
        <label>Tool / holder name *<input value={toolingDraft.name} onChange={e=>setToolingDraft({...toolingDraft,name:e.target.value})} placeholder="10 mm solid carbide end mill"/></label>
        <SearchablePicker id="tooling-type" label="Tool type *" value={toolingDraft.toolType} options={["Solid carbide end mill","Indexable milling cutter","Drill","Tap","Reamer","Boring bar","Turning insert","Turning tool holder","Grinding wheel","EDM wire","EDM electrode","Collet / holder","Tool assembly","Other"].map(value=>({id:value,label:value}))} placeholder="Choose or type a tool category…" allowCustom onChange={toolType=>setToolingDraft({...toolingDraft,toolType})}/>
        <label>Manufacturer<input value={toolingDraft.manufacturer||""} onChange={e=>setToolingDraft({...toolingDraft,manufacturer:e.target.value})} placeholder="Brand / manufacturer"/></label>
        <label>Model / part number<input value={toolingDraft.model||""} onChange={e=>setToolingDraft({...toolingDraft,model:e.target.value})} placeholder="Manufacturer model"/></label>
        <label>Specification<input value={toolingDraft.specification||""} onChange={e=>setToolingDraft({...toolingDraft,specification:e.target.value})} placeholder="Grade, geometry, standard or drawing reference"/></label>
        <label>Holder interface<input value={toolingDraft.holderInterface||""} onChange={e=>setToolingDraft({...toolingDraft,holderInterface:e.target.value})} placeholder="BT40 / HSK63A / ER32…"/></label>
        <label>Coating<input value={toolingDraft.coating||""} onChange={e=>setToolingDraft({...toolingDraft,coating:e.target.value})} placeholder="TiAlN / AlTiN / uncoated…"/></label>
        <label>Diameter (mm)<input type="number" min="0" step="0.001" value={toolingDraft.diameterMm||""} onChange={e=>setToolingDraft({...toolingDraft,diameterMm:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Flute / cutting edge count<input type="number" min="0" step="1" value={toolingDraft.fluteCount||""} onChange={e=>setToolingDraft({...toolingDraft,fluteCount:Math.max(0,Math.floor(Number(e.target.value)||0))})}/></label>
        <label>Maximum RPM<input type="number" min="0" value={toolingDraft.maxRpm||""} onChange={e=>setToolingDraft({...toolingDraft,maxRpm:Math.max(0,Number(e.target.value)||0)})}/></label>
        <div className="module-form-wide"><SearchableMultiSelect id="tooling-compatible-machines" label="Compatible registered machines" options={machines.filter(row=>row.companyId===toolingDraft.companyId&&row.factoryId===toolingDraft.factoryId).map(row=>({id:row.id,label:row.assetCode+" · "+row.name+" · "+row.machineType}))} selected={toolingDraft.compatibleMachineIds} onChange={compatibleMachineIds=>setToolingDraft({...toolingDraft,compatibleMachineIds})}/></div>
        <div className="module-form-wide"><SearchableMultiSelect id="tooling-machine-types" label="Compatible machine types (optional)" options={[...new Set(machines.filter(row=>row.companyId===toolingDraft.companyId&&row.factoryId===toolingDraft.factoryId).map(row=>row.machineType))].map(value=>({id:value,label:value}))} selected={toolingDraft.machineTypeCapabilities} onChange={machineTypeCapabilities=>setToolingDraft({...toolingDraft,machineTypeCapabilities})}/></div>
        <div className="module-form-wide"><SearchableMultiSelect id="tooling-process-definitions" label="Supported Process Directory definitions" options={processDefinitions.map(row=>({id:row.id,label:row.category+" · "+row.processType}))} selected={toolingDraft.processDefinitionIds} onChange={processDefinitionIds=>setToolingDraft({...toolingDraft,processDefinitionIds})}/></div>
        <label className="module-form-wide">Material / grade capabilities<input value={toolingDraft.materialCapabilities.join(", ")} onChange={e=>setToolingDraft({...toolingDraft,materialCapabilities:e.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="EN24, EN8, aluminium, SS304…"/></label>
        <label>Tool-life limit (runtime minutes)<input type="number" min="0" value={toolingDraft.toolLifeLimitMinutes||""} onChange={e=>setToolingDraft({...toolingDraft,toolLifeLimitMinutes:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Tool-life limit (cycles / parts)<input type="number" min="0" value={toolingDraft.toolLifeLimitCycles||""} onChange={e=>setToolingDraft({...toolingDraft,toolLifeLimitCycles:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Maximum regrinds<input type="number" min="0" value={toolingDraft.maxRegrinds||""} onChange={e=>setToolingDraft({...toolingDraft,maxRegrinds:Math.max(0,Math.floor(Number(e.target.value)||0))})}/></label>
        <label>Current regrind count<input type="number" min="0" value={toolingDraft.regrindCount||0} readOnly title="Updated by the regrind usage event"/></label>
        <SearchablePicker id="tooling-status" label="Tool status" value={toolingDraft.status} options={TOOLING_STATUSES.map(value=>({id:value,label:value}))} onChange={status=>setToolingDraft({...toolingDraft,status:status as ToolingAssetStatus})}/>
        <label>Last inspected<input type="date" value={toolingDraft.lastInspectedAt||""} onChange={e=>setToolingDraft({...toolingDraft,lastInspectedAt:e.target.value})}/></label>
        <label>Next inspection due<input type="date" value={toolingDraft.inspectionDueAt||""} onChange={e=>setToolingDraft({...toolingDraft,inspectionDueAt:e.target.value})}/></label>
        <label>Storage location<input value={toolingDraft.storageLocation} onChange={e=>setToolingDraft({...toolingDraft,storageLocation:e.target.value})} placeholder="Tool crib / cabinet / rack"/></label>
        <label className="module-form-wide">Notes<input value={toolingDraft.notes} onChange={e=>setToolingDraft({...toolingDraft,notes:e.target.value})} placeholder="Special limits, preset length, holder notes…"/></label>
        <small className="field-hint module-form-wide">Runtime and cycle consumption are updated from logged usage events, not by manually editing historical life totals. No sample tools are preloaded.</small>
        <div className="module-form-actions"><button className="button-primary" onClick={saveToolingAsset}><Check size={14}/> Save tooling asset</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "companies" && (fixtureEditingId || tab === "fixtures") && <div className="module-record-form">
        <SearchablePicker id="fixture-company" label="Owning company *" value={fixtureDraft.companyId} options={companies.map(row=>({id:row.id,label:row.name}))} placeholder="Select company…" onChange={companyId=>setFixtureDraft({...fixtureDraft,companyId,factoryId:factories.some(row=>row.id===fixtureDraft.factoryId&&row.companyId===companyId)?fixtureDraft.factoryId:""})}/>
        <SearchablePicker id="fixture-factory" label="Factory / site *" value={fixtureDraft.factoryId} options={factories.filter(row=>row.companyId===fixtureDraft.companyId).map(row=>({id:row.id,label:row.name}))} placeholder="Select factory…" onChange={factoryId=>setFixtureDraft({...fixtureDraft,factoryId})}/>
        <label>Fixture asset code *<input value={fixtureDraft.assetCode} onChange={e=>setFixtureDraft({...fixtureDraft,assetCode:e.target.value.toUpperCase()})} placeholder="e.g. FIX-001 / JIG-012"/></label>
        <label>Fixture / jig name *<input value={fixtureDraft.name} onChange={e=>setFixtureDraft({...fixtureDraft,name:e.target.value})} placeholder="Spindle sleeve machining fixture"/></label>
        <SearchablePicker id="fixture-type" label="Fixture type *" value={fixtureDraft.fixtureType} options={["Dedicated fixture","Modular fixture","Jig","Vice / workholding","Collet / chuck","Soft jaw set","Welding fixture","Inspection fixture","Assembly fixture","Pallet / tombstone","Other"].map(value=>({id:value,label:value}))} placeholder="Choose or type fixture type…" allowCustom onChange={fixtureType=>setFixtureDraft({...fixtureDraft,fixtureType})}/>
        <label>Manufacturer / maker<input value={fixtureDraft.manufacturer||""} onChange={e=>setFixtureDraft({...fixtureDraft,manufacturer:e.target.value})} placeholder="In-house / external maker"/></label>
        <label>Model / drawing reference<input value={fixtureDraft.model||""} onChange={e=>setFixtureDraft({...fixtureDraft,model:e.target.value})} placeholder="Fixture drawing / revision"/></label>
        <label>Workholding method<input value={fixtureDraft.workholdingType} onChange={e=>setFixtureDraft({...fixtureDraft,workholdingType:e.target.value})} placeholder="Hydraulic / pneumatic / manual / vacuum…"/></label>
        <div className="module-form-wide"><SearchableMultiSelect id="fixture-compatible-machines" label="Compatible registered machines" options={machines.filter(row=>row.companyId===fixtureDraft.companyId&&row.factoryId===fixtureDraft.factoryId).map(row=>({id:row.id,label:row.assetCode+" · "+row.name+" · "+row.machineType}))} selected={fixtureDraft.compatibleMachineIds} onChange={compatibleMachineIds=>setFixtureDraft({...fixtureDraft,compatibleMachineIds})}/></div>
        <div className="module-form-wide"><SearchableMultiSelect id="fixture-machine-types" label="Compatible machine types (optional)" options={[...new Set(machines.filter(row=>row.companyId===fixtureDraft.companyId&&row.factoryId===fixtureDraft.factoryId).map(row=>row.machineType))].map(value=>({id:value,label:value}))} selected={fixtureDraft.machineTypeCapabilities} onChange={machineTypeCapabilities=>setFixtureDraft({...fixtureDraft,machineTypeCapabilities})}/></div>
        <div className="module-form-wide"><SearchableMultiSelect id="fixture-process-definitions" label="Supported Process Directory definitions" options={processDefinitions.map(row=>({id:row.id,label:row.category+" · "+row.processType}))} selected={fixtureDraft.processDefinitionIds} onChange={processDefinitionIds=>setFixtureDraft({...fixtureDraft,processDefinitionIds})}/></div>
        <div className="module-form-wide"><SearchableMultiSelect id="fixture-components" label="Compatible components (optional)" options={components.filter(row=>!row.companyId||row.companyId===fixtureDraft.companyId).map(row=>({id:row.id,label:row.partNumber+" · "+row.name}))} selected={fixtureDraft.componentIds} onChange={componentIds=>setFixtureDraft({...fixtureDraft,componentIds})}/></div>
        <label>Max workpiece weight (kg)<input type="number" min="0" step="0.1" value={fixtureDraft.maxWorkpieceWeightKg||""} onChange={e=>setFixtureDraft({...fixtureDraft,maxWorkpieceWeightKg:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Max clamp force (kN)<input type="number" min="0" step="0.1" value={fixtureDraft.maxClampForceKn||""} onChange={e=>setFixtureDraft({...fixtureDraft,maxClampForceKn:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Repeatability (µm)<input type="number" min="0" step="0.1" value={fixtureDraft.repeatabilityMicron||""} onChange={e=>setFixtureDraft({...fixtureDraft,repeatabilityMicron:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Maximum usage cycles<input type="number" min="0" value={fixtureDraft.maxUsageCycles||""} onChange={e=>setFixtureDraft({...fixtureDraft,maxUsageCycles:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Current usage cycles<input type="number" min="0" value={fixtureDraft.usageCycles||0} readOnly title="Updated by production usage events"/></label>
        <SearchablePicker id="fixture-status" label="Fixture status" value={fixtureDraft.status} options={FIXTURE_STATUSES.map(value=>({id:value,label:value}))} onChange={status=>setFixtureDraft({...fixtureDraft,status:status as FixtureAssetStatus})}/>
        <label>Last inspected<input type="date" value={fixtureDraft.lastInspectedAt||""} onChange={e=>setFixtureDraft({...fixtureDraft,lastInspectedAt:e.target.value})}/></label>
        <label>Next inspection due<input type="date" value={fixtureDraft.inspectionDueAt||""} onChange={e=>setFixtureDraft({...fixtureDraft,inspectionDueAt:e.target.value})}/></label>
        <label>Storage location<input value={fixtureDraft.storageLocation} onChange={e=>setFixtureDraft({...fixtureDraft,storageLocation:e.target.value})} placeholder="Fixture rack / storage"/></label>
        <label className="module-form-wide">Setup / clamping notes<input value={fixtureDraft.setupNotes} onChange={e=>setFixtureDraft({...fixtureDraft,setupNotes:e.target.value})} placeholder="Datum, clamping sequence, torque, zero reference…"/></label>
        <label className="module-form-wide">Notes<input value={fixtureDraft.notes} onChange={e=>setFixtureDraft({...fixtureDraft,notes:e.target.value})} placeholder="Care, maintenance and handling notes…"/></label>
        <small className="field-hint module-form-wide">Fixture cycles are updated by logged production-use events. Failed inspection or reaching the cycle limit removes the fixture from new operation assignments.</small>
        <div className="module-form-actions"><button className="button-primary" onClick={saveFixtureAsset}><Check size={14}/> Save fixture</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "components" && <div className="module-record-form">
        <div className="module-form-wide component-form-identity"><ComponentIcon componentId={componentEditingId || undefined} componentName={componentDraft.name+" "+componentDraft.partNumber}/><span><strong>Component mechanical logo</strong><small>Generated from part name and number; assign or customise it in the global Logo Studio after saving the master record.</small></span></div>
        <SearchablePicker id="component-company" label="Company *" value={componentDraft.companyId || ""} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name}))} onChange={companyId=>setComponentDraft({...componentDraft,companyId})}/>
        <label>Component / part number *<input value={componentDraft.partNumber} onChange={e => setComponentDraft({ ...componentDraft, partNumber: e.target.value })} placeholder="Customer or internal part number"/></label>
        <label>Component name *<input value={componentDraft.name} onChange={e => setComponentDraft({ ...componentDraft, name: e.target.value })} placeholder="Actual component name"/></label>
        <label>Drawing revision<input value={componentDraft.revision} onChange={e => setComponentDraft({ ...componentDraft, revision: e.target.value })} placeholder="e.g. Rev A"/></label>
        
        <label>Drawing number / file reference<input value={componentDraft.drawingReference} onChange={e => setComponentDraft({ ...componentDraft, drawingReference: e.target.value })} placeholder="Drawing reference"/></label>
        <label>Component price (₹)<input type="text" inputMode="decimal" value={componentPriceInput} onChange={e=>setComponentPriceInput(e.target.value)} placeholder="Enter price; leave blank if not quoted"/></label>
        <label>Price unit<select value={componentDraft.salePriceUnit || "piece"} onChange={e=>setComponentDraft({...componentDraft,salePriceUnit:e.target.value as "piece"|"set"})}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
        
        
        
        
        <label className="module-form-wide">Notes<input value={componentDraft.notes} onChange={e => setComponentDraft({ ...componentDraft, notes: e.target.value })} placeholder="Optional engineering / purchase notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveComponent}><Check size={14}/> Save component</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "purchasing" && <div className="module-record-form">
        <label>PO number *<input value={poDraft.number} onChange={e => setPoDraft({ ...poDraft, number: e.target.value })} placeholder="Enter the customer's actual PO number"/></label>
        <SearchablePicker id="po-company" label="Company *" value={poDraft.companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={companyId=>{const factoryId=factories.find(f=>f.companyId===companyId)?.id||"";setPoDraft({...poDraft,companyId,factoryId});}}/>
        <SearchablePicker id="po-customer" label="Customer / buyer account" value={poDraft.customerId||""} placeholder="Select a saved buyer…" options={customers.filter(customer=>customer.ownerCompanyId===poDraft.companyId).map(customer=>({id:customer.id,label:(customer.displayName||customer.legalName)+" · "+customer.customerCode}))} onChange={customerId=>setPoDraft({...poDraft,customerId})}/>
        
        
        <label>PO issue date<input type="date" value={poDraft.issueDate} onChange={e => setPoDraft({ ...poDraft, issueDate: e.target.value })}/></label>
        <label>Target delivery<input type="date" value={poDraft.targetDelivery} onChange={e => setPoDraft({ ...poDraft, targetDelivery: e.target.value })}/></label>
        <label>Status<select value={poDraft.status} onChange={e => setPoDraft({ ...poDraft, status: e.target.value })}><option>Open</option><option>Confirmed</option><option>In Production</option><option>Complete</option><option>On Hold</option><option>Cancelled</option></select></label>
        <label className="module-form-wide">PO notes<input value={poDraft.notes} onChange={e => setPoDraft({ ...poDraft, notes: e.target.value })} placeholder="Optional PO notes"/></label>
        <div className="module-form-wide"><div className="panel-heading"><div><h3>PO component lines</h3><p>Each row can be component-level or part-level. Add repeated component lines for multiple parts or a mixed component + part PO; quantities remain separate.</p></div><button type="button" className="button-quiet compact-button" disabled={!components.length} onClick={() => setPoLines(prev => [...prev, { ...blankLine(), targetDelivery: poDraft.targetDelivery, id: makeId("line") }])}><Plus size={14}/> Add component line</button></div>
          {poLines.map((line, index) => <div className="module-record-form po-line-form" key={line.id}>
            <SearchablePicker id={"po-line-component-"+line.id} label="Component *" value={line.componentId} placeholder="Type part number…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={componentId=>{const master=components.find(item=>item.id===componentId);setPoLines(prev=>prev.map(row=>row.id===line.id?{...row,componentId,partId:"",unitPrice:master?.salePrice||0}:row));}}/>
            <div className="po-selected-component-logo"><ComponentIcon componentId={line.componentId || undefined} componentName={(components.find(item=>item.id===line.componentId)?.name||"Component") + " " + (components.find(item=>item.id===line.componentId)?.partNumber||"")}/><span><strong>{components.find(item=>item.id===line.componentId)?.name||"Select a component"}</strong><small>Logo from the linked Component Master ID</small></span></div>
            <label>PO line allocation<select value={line.allocationLevel||"component"} onChange={e=>setPoLines(prev=>prev.map(row=>row.id===line.id?{...row,allocationLevel:e.target.value as "component"|"part",partId:""}:row))}><option value="component">Component-level (no part breakdown)</option><option value="part">Part-level (select a part)</option></select></label>
            {line.allocationLevel==="part"&&<SearchablePicker id={"po-line-part-"+line.id} label="Component part *" value={line.partId||""} placeholder="Search part name / number…" options={componentParts.filter(part=>part.componentId===line.componentId).map(part=>({id:part.id,label:(part.partNumber?part.partNumber+" · ":"")+part.name}))} onChange={partId=>setPoLines(prev=>prev.map(row=>row.id===line.id?{...row,partId}:row))}/>}
            {line.allocationLevel==="part"&&!componentParts.some(part=>part.componentId===line.componentId)&&<small className="module-safety-note">No saved parts for this component. Open Process Map or Planned Cost to add its part breakdown, then return to this PO.</small>}
            <label>Quantity * ({componentUnit(line.componentId)})<input type="number" min="1" value={line.quantity || ""} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, quantity: Math.max(0, Number(e.target.value) || 0) } : row))}/></label>
            <label>Line delivery date<input type="date" value={line.targetDelivery} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, targetDelivery: e.target.value } : row))}/></label>
            <div className="po-master-price"><small>COMPONENT MASTER PRICE</small><strong>{(() => { const c=components.find(item=>item.id===line.componentId); return c ? "₹"+c.salePrice.toLocaleString("en-IN")+" / per "+(c.salePriceUnit||"piece") : "Select a component"; })()}</strong><span>Linked from Component Directory; not editable on the PO line.</span></div>
            <label className="module-form-wide">Line notes<input value={line.notes} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, notes: e.target.value } : row))} placeholder="Optional"/></label>
            <button type="button" className="button-quiet compact-button" onClick={() => setPoLines(prev => prev.filter(row => row.id !== line.id))}><Trash2 size={13}/> Remove line {index + 1}</button>
          </div>)}
          {!components.length && <div className="module-empty-state"><p>Create component master records before adding PO lines.</p><button className="button-primary" onClick={() => onSelectModule("components")}>Open Components <ArrowRight size={14}/></button></div>}
        </div>
        <div className="module-form-actions"><button className="button-primary" onClick={savePO}><Check size={14}/> Save purchase order</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
    </section>}
    {showResourceEventForm && <section className="surface-panel module-record-form-panel resource-usage-event-panel">
      <div className="panel-heading"><div><div className="eyebrow">TOOLING & FIXTURE HISTORY</div><h3>Log {resourceEventDraft.resourceType==="tooling"?"tooling":"fixture"} usage / inspection event</h3><p>This appends an auditable event and updates the current life or availability counters.</p></div><button className="icon-control" onClick={()=>setShowResourceEventForm(false)} aria-label="Close usage event form"><X size={15}/></button></div>
      <div className="module-record-form">
        <SearchablePicker id="resource-event-operation" label="Linked production operation (optional)" value={resourceEventDraft.operationId} options={activeRows(data.operations||[]).filter(operation=>(resourceEventDraft.resourceType==="tooling"?(operation.toolingAssetIds||[]).includes(resourceEventDraft.resourceId):(operation.fixtureAssetIds||[]).includes(resourceEventDraft.resourceId))).map(operation=>({id:operation.id,label:operation.name+" · "+(orders.find(po=>po.id===operation.poId)?.number||operation.poId)}))} placeholder="Choose an operation already assigned to this asset…" onChange={operationId=>setResourceEventDraft({...resourceEventDraft,operationId})}/>
        <SearchablePicker id="resource-event-type" label="Event type" value={resourceEventDraft.eventType} options={RESOURCE_EVENTS.filter(value=>resourceEventDraft.resourceType==="tooling"||value!=="Regrind").map(value=>({id:value,label:value}))} onChange={eventType=>setResourceEventDraft({...resourceEventDraft,eventType:eventType as ResourceUsageEventKind})}/>
        <label>Runtime used (minutes)<input type="number" min="0" step="0.1" value={resourceEventDraft.runtimeMinutes} onChange={e=>setResourceEventDraft({...resourceEventDraft,runtimeMinutes:Math.max(0,Number(e.target.value)||0)})} disabled={resourceEventDraft.eventType!=="Production use"}/></label>
        <label>Production cycles / parts<input type="number" min="0" step="1" value={resourceEventDraft.cycles} onChange={e=>setResourceEventDraft({...resourceEventDraft,cycles:Math.max(0,Math.floor(Number(e.target.value)||0))})} disabled={resourceEventDraft.eventType!=="Production use"}/></label>
        {resourceEventDraft.eventType==="Inspection" && <>
          <SearchablePicker id="resource-event-inspection-result" label="Inspection result" value={resourceEventDraft.inspectionResult} options={["Pass","Fail","Not assessed"].map(value=>({id:value,label:value}))} onChange={inspectionResult=>setResourceEventDraft({...resourceEventDraft,inspectionResult:inspectionResult as ResourceEventDraft["inspectionResult"]})}/>
          <label>Next inspection due<input type="date" value={resourceEventDraft.inspectionDueAt} onChange={e=>setResourceEventDraft({...resourceEventDraft,inspectionDueAt:e.target.value})}/></label>
        </>}
        <label>Event date / time<input type="datetime-local" value={resourceEventDraft.occurredAt} onChange={e=>setResourceEventDraft({...resourceEventDraft,occurredAt:e.target.value})}/></label>
        <label className="module-form-wide">Notes / measurement<input value={resourceEventDraft.notes} onChange={e=>setResourceEventDraft({...resourceEventDraft,notes:e.target.value})} placeholder="Runtime, cycles, inspection measurements, reason or action taken…"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveResourceUsage}><ClipboardCheck size={14}/> Save audited event</button><button className="button-quiet" onClick={()=>setShowResourceEventForm(false)}>Cancel</button></div>
      </div>
    </section>}
    <div className="module-workbench-grid"><section className="surface-panel module-records-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ACTIVE MASTER DATA</div><h3>{header}</h3><p>Only records you or your imports have saved appear here.</p></div></div>
      {moduleId === "companies" && (tab === "companies" || tab === "factories") && (tab === "companies" ? filteredCompanies.length ? <div className="module-record-list">{filteredCompanies.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Building2 size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{row.gstin || "GSTIN not entered"} · {row.contactPerson || "Contact person not entered"} · {row.phone || "Phone not entered"}</span><p>{row.email || "No email entered"} · {row.address || "No address entered"} {row.notes ? "· " + row.notes : ""}</p>{companyContacts.some(person=>person.linkedId===row.id)&&<small>Other contacts: {companyContacts.filter(person=>person.linkedId===row.id).map(person=>person.name+(person.group?" · "+person.group:"")).join(", ")}</small>}</div><div className="module-record-card-actions"><button onClick={() => editCompany(row)}>Edit</button><button onClick={() => onSelectModule("purchasing",{companyId:row.id})}>Purchase Orders</button><button onClick={() => archive("companies", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Building2 size={28}/><h3>No companies added</h3><p>No placeholder company is preloaded. Add your actual company once and reuse it across all purchase orders and routes.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add your company</button></div> : filteredFactories.length ? <div className="module-record-list">{filteredFactories.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Factory size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{companyName(row.companyId||"")}</span><p>{row.address || "No address entered"} · {row.contactPhone || "No contact phone"}</p></div><div className="module-record-card-actions"><button onClick={() => editFactory(row)}>Edit</button><button onClick={() => archive("factories", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Factory size={28}/><h3>No factories added</h3><p>Add a factory and link it to its parent company.</p><button className="button-primary" disabled={!companies.length} onClick={beginAdd}><Plus size={14}/> Add factory</button></div>)}
      {moduleId === "companies" && tab === "machines" && (filteredMachines.length ? <div className="module-record-list">{filteredMachines.map(row=><article className="module-record-card" key={row.id}><div className="module-record-mark"><Cog size={18}/></div><div className="module-record-copy"><strong>{row.assetCode} · {row.name}</strong><span>{companyName(row.companyId)} · {factoryName(row.factoryId)} · {row.machineType}</span><p>{[row.manufacturer,row.model,row.controller,row.axisCount?row.axisCount+" axes":"",row.workEnvelopeXmm||row.workEnvelopeYmm||row.workEnvelopeZmm?"Travel "+[row.workEnvelopeXmm||"—",row.workEnvelopeYmm||"—",row.workEnvelopeZmm||"—"].join(" × ")+" mm":"",row.spindleMaxRpm?row.spindleMaxRpm.toLocaleString("en-IN")+" RPM":""].filter(Boolean).join(" · ")||"Technical specifications not entered"}</p><small>Processes: {(row.processDefinitionIds||[]).map(id=>{const definition=processDefinitions.find(item=>item.id===id);return definition?definition.category+" · "+definition.processType:id;}).join(", ")||"No process capabilities mapped"} · Materials: {row.materialCapabilities.join(", ")||"Not specified"}</small></div><div className="module-record-card-actions"><span className="record-state">{row.status}</span><button onClick={()=>editMachine(row)}>Edit</button><button onClick={()=>archive("machines",row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Cog size={28}/><h3>No machine assets registered</h3><p>Add actual company-owned production machines, record their technical envelope and map them to saved Process Directory definitions. No sample machines are preloaded.</p><button className="button-primary" disabled={!companies.length||!factories.length} onClick={beginAdd}><Plus size={14}/> Add machine</button></div>)}
      {moduleId === "companies" && tab === "tooling" && (filteredToolingAssets.length ? <div className="module-record-list">{filteredToolingAssets.map(row=>{
        const minutesRemaining=row.toolLifeLimitMinutes>0?Math.max(0,row.toolLifeLimitMinutes-row.toolLifeUsedMinutes):undefined;
        const cyclesRemaining=row.toolLifeLimitCycles>0?Math.max(0,row.toolLifeLimitCycles-row.toolLifeUsedCycles):undefined;
        const linkedEvents=resourceUsageEvents.filter(event=>event.resourceType==="tooling"&&event.resourceId===row.id);
        return <article className="module-record-card" key={row.id}>
          <div className="module-record-mark"><Wrench size={18}/></div>
          <div className="module-record-copy">
            <strong>{row.assetCode} · {row.name}</strong>
            <span>{companyName(row.companyId)} · {factoryName(row.factoryId)} · {row.toolType}</span>
            <p>{[row.manufacturer,row.model,row.specification,row.holderInterface,row.coating,row.diameterMm?row.diameterMm+" mm":""].filter(Boolean).join(" · ")||"Tool specifications not entered"}</p>
            <small>Machine compatibility: {(row.compatibleMachineIds||[]).map(id=>machines.find(machine=>machine.id===id)?.assetCode||id).join(", ")||row.machineTypeCapabilities.join(", ")||"Not restricted"} · Processes: {(row.processDefinitionIds||[]).map(id=>processDefinitions.find(item=>item.id===id)?.processType||id).join(", ")||"Not restricted"}</small>
            <small>Life remaining: {minutesRemaining===undefined?"No runtime limit":minutesRemaining.toLocaleString("en-IN")+" min"} · {cyclesRemaining===undefined?"No cycle limit":cyclesRemaining.toLocaleString("en-IN")+" cycles"} · Regrinds {row.regrindCount}/{row.maxRegrinds} · Inspection due {row.inspectionDueAt||"Not scheduled"} · {linkedEvents.length} usage event(s)</small>
          </div>
          <div className="module-record-card-actions"><span className="record-state">{row.status}</span><button onClick={()=>editToolingAsset(row)}>Edit</button><button onClick={()=>openResourceUsage("tooling",row.id)}>Log event</button><button onClick={()=>archive("toolingAssets",row.id)}>Archive</button></div>
        </article>;
      })}</div> : <div className="module-empty-state"><Wrench size={28}/><h3>No tooling assets registered</h3><p>Register cutting tools, holders and assemblies against a real company and factory. Map compatible machines, processes and materials; no sample tools are preloaded.</p><button className="button-primary" disabled={!companies.length||!factories.length} onClick={beginAdd}><Plus size={14}/> Add tooling asset</button></div>)}
      {moduleId === "companies" && tab === "fixtures" && (filteredFixtureAssets.length ? <div className="module-record-list">{filteredFixtureAssets.map(row=>{
        const cyclesRemaining=row.maxUsageCycles&&row.maxUsageCycles>0?Math.max(0,row.maxUsageCycles-row.usageCycles):undefined;
        const linkedEvents=resourceUsageEvents.filter(event=>event.resourceType==="fixture"&&event.resourceId===row.id);
        return <article className="module-record-card" key={row.id}>
          <div className="module-record-mark"><Gauge size={18}/></div>
          <div className="module-record-copy">
            <strong>{row.assetCode} · {row.name}</strong>
            <span>{companyName(row.companyId)} · {factoryName(row.factoryId)} · {row.fixtureType}</span>
            <p>{[row.manufacturer,row.model,row.workholdingType,row.maxWorkpieceWeightKg?row.maxWorkpieceWeightKg+" kg":"",row.maxClampForceKn?row.maxClampForceKn+" kN":"",row.repeatabilityMicron?row.repeatabilityMicron+" µm repeatability":""].filter(Boolean).join(" · ")||"Fixture specifications not entered"}</p>
            <small>Machines: {(row.compatibleMachineIds||[]).map(id=>machines.find(machine=>machine.id===id)?.assetCode||id).join(", ")||row.machineTypeCapabilities.join(", ")||"Not restricted"} · Components: {(row.componentIds||[]).map(id=>components.find(component=>component.id===id)?.partNumber||id).join(", ")||"Not restricted"}</small>
            <small>Usage cycles: {row.usageCycles.toLocaleString("en-IN")} · Remaining: {cyclesRemaining===undefined?"No limit":cyclesRemaining.toLocaleString("en-IN")} · Inspection due {row.inspectionDueAt||"Not scheduled"} · {linkedEvents.length} usage event(s)</small>
            {row.setupNotes&&<small>Setup: {row.setupNotes}</small>}
          </div>
          <div className="module-record-card-actions"><span className="record-state">{row.status}</span><button onClick={()=>editFixtureAsset(row)}>Edit</button><button onClick={()=>openResourceUsage("fixture",row.id)}>Log event</button><button onClick={()=>archive("fixtureAssets",row.id)}>Archive</button></div>
        </article>;
      })}</div> : <div className="module-empty-state"><Gauge size={28}/><h3>No fixtures registered</h3><p>Register dedicated fixtures, jigs, jaws and workholding assemblies. Map compatible machines, operations and components; no sample fixtures are preloaded.</p><button className="button-primary" disabled={!companies.length||!factories.length} onClick={beginAdd}><Plus size={14}/> Add fixture</button></div>)}
      {moduleId === "companies" && tab === "machines" && <MachineMaintenanceWorkspace machines={machines} plans={maintenancePlans} workOrders={maintenanceWorkOrders} downtime={machineDowntime} operations={activeRows(data.operations||[])} update={update} onNotice={onNotice}/>}
      {moduleId === "components" && (filteredComponents.length ? <div className="module-record-list">{filteredComponents.map(row => <article className="module-record-card" key={row.id}><label className="po-row-select" aria-label={"Select "+row.partNumber}><input type="checkbox" checked={selectedComponentIds.includes(row.id)} onChange={()=>setSelectedComponentIds(current=>current.includes(row.id)?current.filter(id=>id!==row.id):[...current,row.id])}/></label><div className="module-record-mark">{<ComponentIcon componentId={row.id} componentName={row.name+" "+row.partNumber}/>}<Package size={16}/></div><div className="module-record-copy"><strong>{row.partNumber} · {row.name}</strong><span>Rev {row.revision || "—"} · {companyName(row.companyId||"")}</span><p>{row.drawingReference || "No drawing reference"} · {"₹" + row.salePrice.toLocaleString("en-IN")} / {row.salePriceUnit || "piece"} · {data.purchaseOrders.filter(p => p.lines.some(l => l.componentId === row.id)).length} linked PO(s)</p></div><div className="module-record-card-actions"><button onClick={()=>exportComponentsPdf([row])}>PDF</button><button onClick={()=>void exportComponentsExcel([row],"AXIMACH-"+row.partNumber+".xlsx")}>Excel</button><button onClick={()=>onOpenIconStudio?.(row.id)} title="Assign or customise this component logo">Logo Studio</button><button onClick={() => editComponent(row)}>Edit</button><button className="button-danger" onClick={() => deleteComponents([row.id])}>Delete</button><button onClick={()=>onSelectModule("inventory",componentNavigationContext(row.id))}>Inventory</button><button onClick={()=>onSelectModule("process-map",componentNavigationContext(row.id))}>Process Plan</button><button onClick={()=>onSelectModule("costing",componentNavigationContext(row.id))}>Costing</button></div></article>)}</div> : <div className="module-empty-state"><Package size={28}/><h3>No components added</h3><p>Save each part number once. Quotations, operations and PO lines will refer back to this component record.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add component</button></div>)}
      {moduleId === "components" && <section className="surface-panel mechanical-icon-inventory"><div className="panel-heading"><div><h3>Mechanical logo inventory</h3><p>{MECHANICAL_ICON_INVENTORY.length} engineering symbols for component identities, machining tools, machines, workholding and inspection. Each component can receive its own saved Logo Studio assignment.</p></div><button className="button-quiet compact-button" onClick={()=>onOpenIconStudio?.(components[0]?.id||"")} disabled={!components.length}>Open Logo Studio</button></div><div className="mechanical-icon-grid">{MECHANICAL_ICON_INVENTORY.map(item=><article className="mechanical-icon-card" key={item.glyph}><MechanicalIconGlyph glyph={item.glyph} label={item.label}/><div><strong>{item.label}</strong><small>{item.application}</small></div></article>)}</div></section>}
      {moduleId === "purchasing" && (filteredOrders.length ? <div className="module-record-list">{filteredOrders.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><FileText size={18}/></div><div className="module-record-copy"><strong>{row.number}</strong><span>{companyName(row.companyId||"")} · Buyer: {customerName(row.customerId)}</span><p>{row.lines.length} component line(s) · Due {row.targetDelivery || "not set"}</p><div className="related-row-stack">{row.lines.map(line => <small key={line.id} className="po-component-line-label"><ComponentIcon componentId={line.componentId || undefined} componentName={componentName(line.componentId||"")}/>{componentName(line.componentId||"")}{line.partId?" · "+((componentParts.find(part=>part.id===line.partId)?.partNumber||"")+" "+(componentParts.find(part=>part.id===line.partId)?.name||"")):" · Component-level"} · {quantityLabel(line.quantity, line.componentId||"")} · {line.targetDelivery || row.targetDelivery || "No line date"}</small>)}</div></div><div className="module-record-card-actions"><label className="po-row-select" aria-label={"Select PO "+row.number}><input type="checkbox" checked={selectedPoIds.includes(row.id)} onChange={()=>togglePoSelection(row.id)}/></label><span className="record-state">{row.status}</span><button aria-expanded={openedPoId===row.id} onClick={() => setOpenedPoId(openedPoId===row.id?"":row.id)}>{openedPoId===row.id?"Close":"Open"}</button><button className="button-quiet compact-button" onClick={() => exportPurchaseOrdersPdf([row])}><FileDown size={13}/> PDF</button><button className="button-quiet compact-button" onClick={() => void exportPurchaseOrdersExcel([row])}>Excel</button><button onClick={() => editPO(row)}>Edit</button><button className="button-danger compact-button" onClick={() => deletePurchaseOrders([row.id])}>Delete</button></div></article>)}</div> : <div className="module-empty-state"><FileText size={28}/><h3>No purchase orders added</h3><p>Create a PO and add one or many component lines; the Process Map will take its quantity and dates from the selected line.</p><button className="button-primary" disabled={!companies.length || !components.length} onClick={beginAdd}><Plus size={14}/> Create purchase order</button></div>)}
      {moduleId === "purchasing" && openedOrder && <section id="po-open-detail" className="surface-panel po-open-detail">
        <div className="panel-heading"><div><div className="eyebrow">PURCHASE ORDER DETAIL</div><h3>{openedOrder.number}</h3><p>{companyName(openedOrder.companyId)} · {openedOrder.issueDate || "PO date not set"} · {openedOrder.status}</p></div><button className="button-quiet compact-button" onClick={()=>setOpenedPoId("")}>Close</button></div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component number</th><th>Component name / part</th><th>Allocation</th><th>Quantity (piece / set)</th><th>Master price / unit</th><th>Line delivery</th></tr></thead><tbody>{openedOrder.lines.map(line=>{const component=components.find(item=>item.id===line.componentId);return <tr key={line.id}><td>{component?.partNumber||"Missing"}</td><td><span className="po-component-line-label"><ComponentIcon componentId={component?.id} componentName={(component?.name||"Missing component")+" "+(component?.partNumber||"")}/>{component?.name||"Missing component"}</span>{line.partId&&<small>{componentParts.find(part=>part.id===line.partId)?.partNumber} · {componentParts.find(part=>part.id===line.partId)?.name}</small>}</td><td>{line.partId?"Part-level":"Component-level"}</td><td>{quantityLabel(line.quantity, line.componentId||"")}</td><td>₹{(component?.salePrice||0).toLocaleString("en-IN")} / {component?.salePriceUnit||"piece"}</td><td>{line.targetDelivery||openedOrder.targetDelivery||"—"}</td></tr>;})}</tbody></table></div>
        <div className="module-form-actions"><button className="button-primary" onClick={()=>exportPurchaseOrdersPdf([openedOrder])}><FileDown size={14}/> Save this PO as PDF</button><button className="button-quiet" onClick={()=>editPO(openedOrder)}>Edit PO</button><button className="button-quiet" onClick={()=>onSelectModule("process-map",selectedPOContext)}>Open Process Map</button></div>
      </section>}
    </section>
      <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> NEXT WORKFLOW</div><h3>Linked modules</h3><p>Use saved records to prevent duplicate typing.</p></div></div>
        {moduleId === "companies" ? <><button className="related-row" onClick={() => onSelectModule("purchasing",{companyId:selectedCompanyId||(filteredCompanies.length===1?filteredCompanies[0].id:undefined)})}><Package size={16}/><span><strong>Purchase orders</strong><small>{orders.length} saved orders</small></span><ArrowRight size={14}/></button></> : moduleId === "components" ? <><button className="related-row" onClick={() => onSelectModule("purchasing",selectedComponentContext)}><FileText size={16}/><span><strong>PO components</strong><small>{orders.reduce((n,p) => n + p.lines.length, 0)} saved lines</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Operations linked by component + PO line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Supplier rates per component and process</small></span><ArrowRight size={14}/></button></> : <><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Load a PO component line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Compare rates for the PO component</small></span><ArrowRight size={14}/></button></>}
        <div className="module-safety-note"><CalendarClock size={14}/><span>Master data sync is {syncStatus === "synced" ? "connected to the configured server" : "local until the existing AXIMACH server URL/API key are configured in Communication & Follow-up"}. Store the server on persistent hosting for cross-device access.</span></div>
      </aside>
    </div>
  </section>;
}
