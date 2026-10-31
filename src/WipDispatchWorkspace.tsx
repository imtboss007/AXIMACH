import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Plus, Search, ShieldCheck, Truck, Warehouse, Workflow, X } from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type CustomerDispatchRecord, type CustomerDispatchStatus, type InventoryTransactionRecord,
  type OperationRecord, type StockLocationType, type WipTransferRecord, type WipTransferStatus
} from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type ProcessSelection = { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string };
type Props = {
  mode: "wip" | "dispatch"; onBack: () => void; onNotice: (value: string) => void; notice: string;
  onSelectModule: (id: string) => void; initialSelection?: ProcessSelection | null; onInitialSelectionApplied?: () => void;
  onOpenOperation: (selection: ProcessSelection) => void;
};
const today = () => new Date().toISOString().slice(0,10);
const number = (value: number) => Number(value || 0).toLocaleString("en-IN");
const locationOfOperation = (operation: OperationRecord, factoryId: string): { type: "factory"|"vendor"; id: string; vendorId: string } => operation.vendorId
  ? { type:"vendor", id:operation.vendorId, vendorId:operation.vendorId }
  : { type:"factory", id:factoryId, vendorId:"" };

export default function WipDispatchWorkspace({ mode, onBack, onNotice, notice, onSelectModule, initialSelection, onInitialSelectionApplied, onOpenOperation }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const operations = activeRows(data.operations);
  const vendors = activeRows(data.vendors);
  const transfers = activeRows(data.wipTransfers);
  const dispatches = activeRows(data.customerDispatches);

  const [companyId,setCompanyId] = useState(initialSelection?.companyId || "");
  const [factoryId,setFactoryId] = useState(initialSelection?.factoryId || "");
  const [poId,setPoId] = useState(initialSelection?.poId || "");
  const [poLineId,setPoLineId] = useState(initialSelection?.poLineId || "");
  const [sourceOperationId,setSourceOperationId] = useState(initialSelection?.operationId || "");
  const [destinationOperationId,setDestinationOperationId] = useState("");
  const [wipQuantity,setWipQuantity] = useState("");
  const [wipDate,setWipDate] = useState(today());
  const [wipChallan,setWipChallan] = useState("");
  const [wipVehicle,setWipVehicle] = useState("");
  const [wipTransporter,setWipTransporter] = useState("");
  const [wipLr,setWipLr] = useState("");
  const [wipNotes,setWipNotes] = useState("");
  const [wipFormOpen,setWipFormOpen] = useState(!!initialSelection);
  const [dispatchFormOpen,setDispatchFormOpen] = useState(false);
  const [dispatchQuantity,setDispatchQuantity] = useState("");
  const [dispatchDate,setDispatchDate] = useState(today());
  const [challan,setChallan] = useState("");
  const [ewayBill,setEwayBill] = useState("");
  const [transporter,setTransporter] = useState("");
  const [vehicle,setVehicle] = useState("");
  const [lrNumber,setLrNumber] = useState("");
  const [destination,setDestination] = useState("");
  const [dispatchNotes,setDispatchNotes] = useState("");
  const [search,setSearch] = useState("");
  const [wipReceiveQuantities,setWipReceiveQuantities] = useState<Record<string,string>>({});
  const [wipReceivedBy,setWipReceivedBy] = useState<Record<string,string>>({});
  const [wipDiscrepancy,setWipDiscrepancy] = useState<Record<string,string>>({});
  const [deliveryQuantities,setDeliveryQuantities] = useState<Record<string,string>>({});
  const [deliveryReceivedBy,setDeliveryReceivedBy] = useState<Record<string,string>>({});
  const [deliveryProof,setDeliveryProof] = useState<Record<string,string>>({});
  const [deliveryDiscrepancy,setDeliveryDiscrepancy] = useState<Record<string,string>>({});
  useEffect(() => { if (initialSelection) onInitialSelectionApplied?.(); }, []);

  const companyFactories = factories.filter(row=>row.companyId===companyId);
  const companyOrders = orders.filter(row=>row.companyId===companyId && (!factoryId || row.factoryId===factoryId));
  const selectedPO = orders.find(row=>row.id===poId);
  const poLines = selectedPO?.lines.filter(line=>!("deletedAt" in line && (line as typeof line & {deletedAt?:string}).deletedAt)) || [];
  const selectedLine = poLines.find(row=>row.id===poLineId);
  const selectedComponent = components.find(row=>row.id===selectedLine?.componentId);
  const lineOperations = operations.filter(row=>row.poId===poId && row.poLineId===poLineId && row.componentId===selectedLine?.componentId).sort((a,b)=>a.sequence-b.sequence);
  const sourceOperation = lineOperations.find(row=>row.id===sourceOperationId);
  const destinationOperation = lineOperations.find(row=>row.id===destinationOperationId);

  const locationBalance = (itemId:string, locationType:StockLocationType, locationId:string) => data.inventoryTransactions.reduce((sum,row)=>{
    if(row.itemType!=="component" || row.itemId!==itemId) return sum;
    const effectiveType = row.locationType || (row.factoryId ? "factory" : row.vendorId ? "vendor" : undefined);
    const effectiveId = row.locationId || (effectiveType==="vendor" ? row.vendorId : effectiveType==="factory" ? row.factoryId : "");
    if(effectiveType!==locationType || effectiveId!==locationId) return sum;
    return sum + (row.direction==="in" ? row.quantity : -row.quantity);
  },0);
  const transitBalance = (itemId:string, movementId:string) => locationBalance(itemId,"transit",movementId);
  const makeTransaction = (args:{id:string;movementId:string;movementKind:"WIP transfer"|"Customer dispatch";itemId:string;direction:"in"|"out";quantity:number;occurredAt:string;reference:string;notes:string;companyId:string;factoryId:string;poId:string;poLineId:string;operationId:string;vendorId:string;locationType:StockLocationType;locationId:string}):InventoryTransactionRecord=>({
    id:args.id,itemType:"component",itemId:args.itemId,transactionType:args.movementKind==="WIP transfer"?"WIP transfer":"Dispatch",
    direction:args.direction,quantity:args.quantity,occurredAt:args.occurredAt,reference:args.reference,notes:args.notes,
    companyId:args.companyId,factoryId:args.factoryId,poId:args.poId,poLineId:args.poLineId,operationId:args.operationId,
    vendorId:args.vendorId,reversalOfId:"",createdAt:nowIso(),createdBy:"AXIMACH operator (not identity-verified)",
    locationType:args.locationType,locationId:args.locationId,movementId:args.movementId,movementKind:args.movementKind
  });

  const resetWipForm=()=>{setWipFormOpen(false);setSourceOperationId("");setDestinationOperationId("");setWipQuantity("");setWipDate(today());setWipChallan("");setWipVehicle("");setWipTransporter("");setWipLr("");setWipNotes("");};
  const createWipTransfer=()=>{
    if(!selectedPO||!selectedLine||!selectedComponent||!sourceOperation||!destinationOperation){onNotice("Select the PO component line, source operation and destination operation.");return;}
    if(sourceOperation.id===destinationOperation.id){onNotice("Choose two different operations for a WIP handover.");return;}
    const qty=Number(wipQuantity);
    if(!Number.isFinite(qty)||qty<=0){onNotice("Enter a positive WIP handover quantity.");return;}
    if(qty>selectedLine.quantity){onNotice("WIP transfer quantity cannot exceed this PO component line quantity.");return;}
    if(!wipDate){onNotice("Enter the actual handover preparation date.");return;}
    const source=locationOfOperation(sourceOperation,selectedPO.factoryId);
    const destination=locationOfOperation(destinationOperation,selectedPO.factoryId);
    const stamp=nowIso();
    const record:WipTransferRecord={
      id:makeId("wip"),companyId:selectedPO.companyId,factoryId:selectedPO.factoryId,poId:selectedPO.id,poLineId:selectedLine.id,
      componentId:selectedComponent.id,fromOperationId:sourceOperation.id,toOperationId:destinationOperation.id,
      sourceLocationType:source.type,sourceLocationId:source.id,destinationLocationType:destination.type,destinationLocationId:destination.id,
      sourceVendorId:source.vendorId,destinationVendorId:destination.vendorId,quantity:qty,dispatchedQuantity:0,receivedQuantity:0,
      status:"Prepared",preparedAt:wipDate,dispatchedAt:"",lastReceivedAt:"",challanReference:wipChallan.trim(),
      vehicleNumber:wipVehicle.trim(),transporterVendorId:wipTransporter,lrNumber:wipLr.trim(),receivedBy:"",
      discrepancyNotes:"",notes:wipNotes.trim(),stockTransactionIds:[],createdAt:stamp,updatedAt:stamp
    };
    update(current=>({...current,wipTransfers:[...current.wipTransfers,record]}));
    resetWipForm();
    onNotice("WIP handover prepared and linked to both operations. No stock has moved; use Dispatch WIP when the physical handover occurs.");
  };

  const dispatchWip=(record:WipTransferRecord)=>{
    if(record.status!=="Prepared")return;
    const available=locationBalance(record.componentId,record.sourceLocationType,record.sourceLocationId);
    if(available<record.quantity){onNotice("Insufficient component stock at the source location. Available: "+number(available)+" pcs. Post/verify the actual receipt or production handover first.");return;}
    const stamp=nowIso(), date=today();
    const out=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"WIP transfer",itemId:record.componentId,direction:"out",quantity:record.quantity,occurredAt:date,reference:record.challanReference||record.id,notes:"WIP dispatched from source operation "+record.fromOperationId,companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.fromOperationId,vendorId:record.sourceVendorId,locationType:record.sourceLocationType,locationId:record.sourceLocationId});
    const transit=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"WIP transfer",itemId:record.componentId,direction:"in",quantity:record.quantity,occurredAt:date,reference:record.challanReference||record.id,notes:"In-transit WIP from "+record.fromOperationId+" to "+record.toOperationId,companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.toOperationId,vendorId:"",locationType:"transit",locationId:record.id});
    update(current=>({...current,inventoryTransactions:[...current.inventoryTransactions,out,transit],wipTransfers:current.wipTransfers.map(row=>row.id===record.id?{...row,status:"In transit",dispatchedQuantity:record.quantity,dispatchedAt:date,stockTransactionIds:[...row.stockTransactionIds,out.id,transit.id],updatedAt:stamp}:row)}));
    onNotice("WIP dispatched. Source stock reduced and an in-transit balance created. Destination stock will increase only when receipt is confirmed.");
  };
  const receiveWip=(record:WipTransferRecord)=>{
    const qty=Number(wipReceiveQuantities[record.id]||0);
    const outstanding=record.dispatchedQuantity-record.receivedQuantity;
    if(!Number.isFinite(qty)||qty<=0||qty>outstanding){onNotice("Enter a positive receipt quantity no greater than the outstanding in-transit quantity ("+number(outstanding)+" pcs).");return;}
    const inTransit=transitBalance(record.componentId,record.id);
    if(inTransit<qty){onNotice("The in-transit ledger balance is lower than this receipt quantity. Review transfer-linked stock transactions.");return;}
    const date=today(),stamp=nowIso(),newReceived=record.receivedQuantity+qty;
    const out=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"WIP transfer",itemId:record.componentId,direction:"out",quantity:qty,occurredAt:date,reference:record.challanReference||record.id,notes:"WIP receipt from in-transit transfer",companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.toOperationId,vendorId:"",locationType:"transit",locationId:record.id});
    const incoming=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"WIP transfer",itemId:record.componentId,direction:"in",quantity:qty,occurredAt:date,reference:record.challanReference||record.id,notes:"WIP received at destination operation "+record.toOperationId,companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.toOperationId,vendorId:record.destinationVendorId,locationType:record.destinationLocationType,locationId:record.destinationLocationId});
    const discrepancy=wipDiscrepancy[record.id]?.trim()||"";
    const by=wipReceivedBy[record.id]?.trim()||"";
    update(current=>({...current,inventoryTransactions:[...current.inventoryTransactions,out,incoming],wipTransfers:current.wipTransfers.map(row=>row.id===record.id?{...row,receivedQuantity:newReceived,status:newReceived===row.dispatchedQuantity?"Received":"Partially received",lastReceivedAt:date,receivedBy:by,discrepancyNotes:discrepancy||row.discrepancyNotes,stockTransactionIds:[...row.stockTransactionIds,out.id,incoming.id],updatedAt:stamp}:row)}));
    onNotice(newReceived===record.dispatchedQuantity?"WIP receipt confirmed. Destination stock updated and handover is complete.":"Partial WIP receipt recorded. Remaining quantity stays in transit.");
  };

  const createDispatch=()=>{
    if(!selectedPO||!selectedLine||!selectedComponent){onNotice("Select the customer company, factory, PO and component line.");return;}
    const qty=Number(dispatchQuantity);
    if(!Number.isFinite(qty)||qty<=0){onNotice("Enter a positive customer dispatch quantity.");return;}
    const committed=dispatches.filter(row=>row.poLineId===selectedLine.id&&row.status!=="Cancelled").reduce((sum,row)=>sum+row.quantity,0);
    const availableOrderQty=selectedLine.quantity-committed;
    if(qty>availableOrderQty){onNotice("This dispatch exceeds the remaining undispatched PO line quantity ("+number(Math.max(0,availableOrderQty))+" pcs).");return;}
    if(!dispatchDate){onNotice("Enter the planned dispatch date.");return;}
    const stamp=nowIso();
    const record:CustomerDispatchRecord={
      id:makeId("dispatch"),companyId:selectedPO.companyId,factoryId:selectedPO.factoryId,poId:selectedPO.id,poLineId:selectedLine.id,
      componentId:selectedComponent.id,quantity:qty,dispatchedQuantity:0,deliveredQuantity:0,status:"Prepared",
      deliveryChallan:challan.trim(),eWayBill:ewayBill.trim(),transporterVendorId:transporter,vehicleNumber:vehicle.trim(),
      lrNumber:lrNumber.trim(),destination:destination.trim(),dispatchDate,lastDeliveryDate:"",receivedBy:"",proofReference:"",
      discrepancyNotes:"",notes:dispatchNotes.trim(),stockTransactionIds:[],createdAt:stamp,updatedAt:stamp
    };
    update(current=>({...current,customerDispatches:[...current.customerDispatches,record]}));
    setDispatchFormOpen(false);setDispatchQuantity("");setDispatchDate(today());setChallan("");setEwayBill("");setTransporter("");setVehicle("");setLrNumber("");setDestination("");setDispatchNotes("");
    onNotice("Customer dispatch prepared against the exact PO component line. Inventory changes only when you confirm physical dispatch.");
  };
  const dispatchCustomerGoods=(record:CustomerDispatchRecord)=>{
    if(record.status!=="Prepared")return;
    const available=locationBalance(record.componentId,"factory",record.factoryId);
    if(available<record.quantity){onNotice("Insufficient finished/component stock at the selected factory. Available: "+number(available)+" pcs. Receive/complete the actual production quantity first.");return;}
    const stamp=nowIso(),date=today();
    const out=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"Customer dispatch",itemId:record.componentId,direction:"out",quantity:record.quantity,occurredAt:date,reference:record.deliveryChallan||record.id,notes:"Customer dispatch to "+(record.destination||"destination not entered"),companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:"",vendorId:"",locationType:"factory",locationId:record.factoryId});
    const transit=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"Customer dispatch",itemId:record.componentId,direction:"in",quantity:record.quantity,occurredAt:date,reference:record.deliveryChallan||record.id,notes:"Customer shipment in transit",companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:"",vendorId:record.transporterVendorId,locationType:"transit",locationId:record.id});
    update(current=>({...current,inventoryTransactions:[...current.inventoryTransactions,out,transit],customerDispatches:current.customerDispatches.map(row=>row.id===record.id?{...row,status:"In transit",dispatchedQuantity:record.quantity,stockTransactionIds:[...row.stockTransactionIds,out.id,transit.id],updatedAt:stamp}:row)}));
    onNotice("Customer goods dispatched. Factory stock reduced and shipment placed in transit; delivery is still unconfirmed.");
  };
  const confirmDelivery=(record:CustomerDispatchRecord)=>{
    const outstanding=record.dispatchedQuantity-record.deliveredQuantity;
    const qty=Number(deliveryQuantities[record.id]||0);
    if(!Number.isFinite(qty)||qty<=0||qty>outstanding){onNotice("Enter a positive delivery quantity no greater than the outstanding shipment ("+number(outstanding)+" pcs).");return;}
    const inTransit=transitBalance(record.componentId,record.id);
    if(inTransit<qty){onNotice("In-transit ledger quantity is insufficient. Review dispatch-linked stock transactions.");return;}
    const stamp=nowIso(),date=today(),newDelivered=record.deliveredQuantity+qty;
    const out=makeTransaction({id:makeId("stock"),movementId:record.id,movementKind:"Customer dispatch",itemId:record.componentId,direction:"out",quantity:qty,occurredAt:date,reference:record.deliveryChallan||record.id,notes:"Customer delivery acknowledgement",companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:"",vendorId:"",locationType:"transit",locationId:record.id});
    const by=deliveryReceivedBy[record.id]?.trim()||"";
    const proof=deliveryProof[record.id]?.trim()||"";
    const discrepancy=deliveryDiscrepancy[record.id]?.trim()||"";
    update(current=>({...current,inventoryTransactions:[...current.inventoryTransactions,out],customerDispatches:current.customerDispatches.map(row=>row.id===record.id?{...row,deliveredQuantity:newDelivered,status:newDelivered===row.dispatchedQuantity?"Delivered":"Partially delivered",lastDeliveryDate:date,receivedBy:by,proofReference:proof,discrepancyNotes:discrepancy||row.discrepancyNotes,stockTransactionIds:[...row.stockTransactionIds,out.id],updatedAt:stamp}:row)}));
    onNotice(newDelivered===record.dispatchedQuantity?"Customer delivery confirmed for the full shipment.":"Partial delivery recorded; outstanding quantity remains in transit.");
  };
  const cancelPrepared=(record:WipTransferRecord|CustomerDispatchRecord,kind:"wip"|"dispatch")=>{
    if(record.status!=="Prepared"){onNotice("Only prepared movements can be cancelled. In-transit movements require an actual receipt or a separate controlled adjustment.");return;}
    if(!window.confirm("Cancel this prepared movement? No stock has moved."))return;
    const stamp=nowIso();
    if(kind==="wip")update(current=>({...current,wipTransfers:current.wipTransfers.map(row=>row.id===record.id?{...row,status:"Cancelled",updatedAt:stamp}:row)}));
    else update(current=>({...current,customerDispatches:current.customerDispatches.map(row=>row.id===record.id?{...row,status:"Cancelled",updatedAt:stamp}:row)}));
    onNotice("Prepared movement cancelled. No inventory quantity was posted.");
  };

  const visibleWip=useMemo(()=>transfers.filter(row=>{
    const po=data.purchaseOrders.find(item=>item.id===row.poId);
    const comp=data.components.find(item=>item.id===row.componentId);
    const from=data.operations.find(item=>item.id===row.fromOperationId);
    const to=data.operations.find(item=>item.id===row.toOperationId);
    return [po?.number,comp?.partNumber,comp?.name,from?.name,to?.name,row.challanReference,row.status,row.notes].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[transfers,data.purchaseOrders,data.components,data.operations,search]);
  const visibleDispatch=useMemo(()=>dispatches.filter(row=>{
    const po=data.purchaseOrders.find(item=>item.id===row.poId);
    const comp=data.components.find(item=>item.id===row.componentId);
    const company=data.companies.find(item=>item.id===row.companyId);
    return [company?.name,po?.number,comp?.partNumber,comp?.name,row.deliveryChallan,row.eWayBill,row.vehicleNumber,row.lrNumber,row.status,row.destination].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[dispatches,data.purchaseOrders,data.components,data.companies,search]);

  const openOperation=(record:WipTransferRecord)=>{
    onOpenOperation({companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.fromOperationId});
  };
  const contextControls=<div className="movement-context-selectors">
    <SearchablePicker id="movement-company" label="Customer / company" value={companyId} placeholder="Select company…" options={companies.map(row=>({id:row.id,label:row.name}))} onChange={id=>{setCompanyId(id);setFactoryId("");setPoId("");setPoLineId("");setSourceOperationId("");setDestinationOperationId("");}}/>
    <SearchablePicker id="movement-factory" label="Factory" value={factoryId} placeholder="Select factory…" options={companyFactories.map(row=>({id:row.id,label:row.name}))} onChange={id=>{setFactoryId(id);setPoId("");setPoLineId("");setSourceOperationId("");setDestinationOperationId("");}}/>
    <SearchablePicker id="movement-po" label="Purchase order" value={poId} placeholder="Select PO…" options={companyOrders.map(row=>({id:row.id,label:row.number}))} onChange={id=>{setPoId(id);setPoLineId("");setSourceOperationId("");setDestinationOperationId("");}}/>
    <SearchablePicker id="movement-line" label="PO component line" value={poLineId} placeholder="Select component line…" options={poLines.map(row=>{const component=components.find(item=>item.id===row.componentId);return {id:row.id,label:(component?.partNumber||"Part")+" · "+(component?.name||"Component")+" · "+number(row.quantity)+" pcs"};})} onChange={id=>{setPoLineId(id);setSourceOperationId("");setDestinationOperationId("");}}/>
  </div>;

  return <section className="workspace-page wip-dispatch-page">
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED SERVER DATA":syncStatus==="syncing"?"SYNCING DATA":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":mode==="wip"?"WIP HANDOVER REGISTER":"DISPATCH REGISTER"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / STOCK CUSTODY & DELIVERY</div><h1>{mode==="wip"?"WIP Transfers":"Customer Dispatch"}<span>.</span></h1><p>{mode==="wip"?"Trace component custody between consecutive process operations, factory stores and subcontract vendors. Stock moves only when dispatch and receipt are confirmed.":"Prepare customer shipments against exact PO component lines, post factory stock-out at dispatch and clear in-transit quantities only after delivery acknowledgement."}</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("inventory")}><Warehouse size={15}/> Inventory ledger</button><button className="button-quiet" onClick={()=>onSelectModule("process-map")}><Workflow size={15}/> Process Map</button><button className="button-primary" onClick={()=>mode==="wip"?setWipFormOpen(true):setDispatchFormOpen(true)}><Plus size={15}/>{mode==="wip"?"Prepare WIP transfer":"Prepare dispatch"}</button></div></div>
    <div className="costing-tabs"><button className={mode==="wip"?"costing-tab-active":""} onClick={()=>{onSelectModule("wip-transfers");setSearch("");}}><Workflow size={15}/> WIP transfers ({transfers.length})</button><button className={mode==="dispatch"?"costing-tab-active":""} onClick={()=>{onSelectModule("dispatch");setSearch("");}}><Truck size={15}/> Customer dispatch ({dispatches.length})</button></div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={mode==="wip"?"Search PO, component, operation, challan or status…":"Search customer, PO, part, challan, vehicle or status…"}/></label><span className="module-number">{mode==="wip"?visibleWip.length+" / "+transfers.length+" HANDOVERS":visibleDispatch.length+" / "+dispatches.length+" SHIPMENTS"}</span></div>

    {mode==="wip"&&<>
      {wipFormOpen&&<section className="surface-panel master-editor movement-editor"><div className="panel-heading"><div><h3>Prepare WIP handover</h3><p>Both operation IDs come from the selected PO component route. Preparing does not post stock.</p></div><button className="icon-control" onClick={resetWipForm} aria-label="Close form"><X size={14}/></button></div>
        {contextControls}
        <div className="module-record-form movement-form">
          <SearchablePicker id="wip-source-operation" label="From operation *" value={sourceOperationId} placeholder="Select source operation…" options={lineOperations.map(row=>({id:row.id,label:"OP-"+String(row.sequence).padStart(3,"0")+" · "+row.name+" · "+(row.vendorId?vendors.find(v=>v.id===row.vendorId)?.company||"Vendor":"Factory")}))} onChange={setSourceOperationId}/>
          <SearchablePicker id="wip-destination-operation" label="To operation *" value={destinationOperationId} placeholder="Select receiving operation…" options={lineOperations.filter(row=>row.id!==sourceOperationId).map(row=>({id:row.id,label:"OP-"+String(row.sequence).padStart(3,"0")+" · "+row.name+" · "+(row.vendorId?vendors.find(v=>v.id===row.vendorId)?.company||"Vendor":"Factory")}))} onChange={setDestinationOperationId}/>
          <label>Handover quantity (pcs) *<input type="number" min="0.000001" step="0.000001" value={wipQuantity} onChange={e=>setWipQuantity(e.target.value)}/></label>
          <label>Preparation date *<input type="date" value={wipDate} onChange={e=>setWipDate(e.target.value)}/></label>
          <label>Challan / handover reference<input value={wipChallan} onChange={e=>setWipChallan(e.target.value)} placeholder="Actual challan / job reference"/></label>
<SearchablePicker id="wip-transporter" label="Transport vendor" value={wipTransporter} placeholder="Select transporter…" options={vendors.map(v=>({id:v.id,label:v.company}))} onChange={setWipTransporter}/>
          <label>Vehicle number<input value={wipVehicle} onChange={e=>setWipVehicle(e.target.value)} placeholder="Vehicle registration"/></label>
          <label>LR / consignment number<input value={wipLr} onChange={e=>setWipLr(e.target.value)} placeholder="Transport LR reference"/></label>
          <label className="movement-form-wide">Handover notes<input value={wipNotes} onChange={e=>setWipNotes(e.target.value)} placeholder="Condition, packaging, batch/lot or handover notes"/></label>
          {sourceOperation&&destinationOperation&&<div className="module-safety-note movement-form-wide">Custody path: <strong>{sourceOperation.vendorId?vendors.find(v=>v.id===sourceOperation.vendorId)?.company||"Source vendor":"Selected factory"} → {destinationOperation.vendorId?vendors.find(v=>v.id===destinationOperation.vendorId)?.company||"Destination vendor":"Selected factory"}</strong>. The stock ledger will move quantity through a transfer-specific in-transit location after dispatch.</div>}
          <div className="module-form-actions"><button className="button-primary" onClick={createWipTransfer}><Check size={14}/> Prepare transfer</button><button className="button-quiet" onClick={resetWipForm}>Cancel</button></div>
        </div>
      </section>}
      <section className="surface-panel movement-register"><div className="panel-heading"><div><h3>WIP custody and transfer history ({visibleWip.length})</h3><p>Prepared → In transit → Partially received / Received. Paired stock entries preserve origin, transit and destination quantities.</p></div></div>
        {visibleWip.length?<div className="movement-card-list">{visibleWip.map(row=>{
          const po=orders.find(item=>item.id===row.poId),company=data.companies.find(item=>item.id===row.companyId),component=components.find(item=>item.id===row.componentId);
          const from=operations.find(item=>item.id===row.fromOperationId),to=operations.find(item=>item.id===row.toOperationId);
          const sourceName=row.sourceLocationType==="vendor"?vendors.find(v=>v.id===row.sourceLocationId)?.company||"Vendor unavailable":factories.find(f=>f.id===row.sourceLocationId)?.name||"Factory unavailable";
          const destinationName=row.destinationLocationType==="vendor"?vendors.find(v=>v.id===row.destinationLocationId)?.company||"Vendor unavailable":factories.find(f=>f.id===row.destinationLocationId)?.name||"Factory unavailable";
          const outstanding=row.dispatchedQuantity-row.receivedQuantity;
          return <article className="surface-panel movement-card" key={row.id}>
            <div className="movement-card-head"><div><strong>{po?.number||"PO unavailable"} · {component?.partNumber||"Part unavailable"} · {component?.name||""}</strong><small>{company?.name||"Company"} · {row.challanReference||row.id}</small></div><span className="record-state">{row.status}</span></div>
            <div className="movement-path"><span><small>FROM</small><strong>{from?.name||"Source operation unavailable"}</strong><em>{sourceName}</em></span><ArrowRight size={18}/><span><small>TO</small><strong>{to?.name||"Destination operation unavailable"}</strong><em>{destinationName}</em></span></div>
            <div className="movement-facts"><div><small>PLANNED QTY</small><strong>{number(row.quantity)} pcs</strong></div><div><small>DISPATCHED</small><strong>{number(row.dispatchedQuantity)} pcs</strong></div><div><small>RECEIVED</small><strong>{number(row.receivedQuantity)} pcs</strong></div><div><small>IN TRANSIT</small><strong>{number(transitBalance(row.componentId,row.id))} pcs</strong></div><div><small>CHALLAN / DATE</small><strong>{row.challanReference||"—"} · {row.dispatchedAt||row.preparedAt}</strong></div></div>
            {row.discrepancyNotes&&<p className="movement-discrepancy">Discrepancy: {row.discrepancyNotes}</p>}
            <div className="movement-card-actions"><button className="button-quiet compact-button" onClick={()=>openOperation(row)}>Open source operation</button><button className="button-quiet compact-button" onClick={()=>onOpenOperation({companyId:row.companyId,factoryId:row.factoryId,poId:row.poId,poLineId:row.poLineId,operationId:row.toOperationId})}>Open destination operation</button>{row.status==="Prepared"&&<><button className="button-primary compact-button" onClick={()=>dispatchWip(row)}>Dispatch WIP</button><button className="button-quiet compact-button" onClick={()=>cancelPrepared(row,"wip")}>Cancel prepared</button></>}{(row.status==="In transit"||row.status==="Partially received")&&<><label>Receive qty<input type="number" min="0.000001" step="0.000001" value={wipReceiveQuantities[row.id]??String(outstanding)} onChange={e=>setWipReceiveQuantities(current=>({...current,[row.id]:e.target.value}))}/></label><label>Received by<input value={wipReceivedBy[row.id]||""} onChange={e=>setWipReceivedBy(current=>({...current,[row.id]:e.target.value}))} placeholder="Name / reference"/></label><label>Discrepancy<input value={wipDiscrepancy[row.id]||""} onChange={e=>setWipDiscrepancy(current=>({...current,[row.id]:e.target.value}))} placeholder="Short / excess / damage notes"/></label><button className="button-primary compact-button" onClick={()=>receiveWip(row)}>Confirm receipt</button></>}</div>
          </article>;
        })}</div>:<div className="module-empty-state"><Workflow size={27}/><h3>No WIP handovers recorded</h3><p>Choose a saved PO component route and record an actual operation-to-operation handover. No sample transfer is preloaded.</p><button className="button-primary" onClick={()=>setWipFormOpen(true)}><Plus size={14}/> Prepare first WIP transfer</button></div>}
      </section>
    </>}

    {mode==="dispatch"&&<>
      <section className="surface-panel quality-selection-panel"><div className="panel-heading"><div><h3>Customer order context</h3><p>Every shipment is linked to the original customer/company, factory, PO and component line.</p></div><span className="module-number">{dispatches.length} SHIPMENTS</span></div>{contextControls}
        {selectedPO&&selectedLine&&<div className="quality-context-summary"><div><small>SELECTED ORDER LINE</small><strong>{selectedPO.number} · {selectedComponent?.partNumber||"Part"} · {selectedComponent?.name||""}</strong><span>{number(selectedLine.quantity)} pcs ordered · target {selectedLine.targetDelivery||selectedPO.targetDelivery||"not set"}</span></div><div><small>FACTORY STOCK AVAILABLE</small><strong>{number(selectedComponent?locationBalance(selectedComponent.id,"factory",selectedPO.factoryId):0)} pcs</strong><span>Ledger-derived component balance at the selected factory</span></div></div>}
      </section>
      <div className="workspace-title-actions"><button className="button-primary" disabled={!selectedLine} onClick={()=>setDispatchFormOpen(true)}><Plus size={14}/> Prepare customer dispatch</button></div>
      {dispatchFormOpen&&<section className="surface-panel master-editor movement-editor"><div className="panel-heading"><div><h3>Prepare customer dispatch</h3><p>Preparation reserves the PO quantity in the dispatch register but does not deduct stock.</p></div><button className="icon-control" onClick={()=>setDispatchFormOpen(false)} aria-label="Close dispatch form"><X size={14}/></button></div>
        <div className="module-record-form movement-form">
          <label>Dispatch quantity (pcs) *<input type="number" min="0.000001" step="0.000001" value={dispatchQuantity} onChange={e=>setDispatchQuantity(e.target.value)}/></label>
          <label>Planned dispatch date *<input type="date" value={dispatchDate} onChange={e=>setDispatchDate(e.target.value)}/></label>
          <label>Delivery challan<input value={challan} onChange={e=>setChallan(e.target.value)} placeholder="Actual challan number"/></label>
          <label>e-Way bill<input value={ewayBill} onChange={e=>setEwayBill(e.target.value)} placeholder="Applicable e-Way bill reference"/></label>
          <SearchablePicker id="dispatch-transporter" label="Transporter vendor" value={transporter} placeholder="Select transporter…" options={vendors.map(v=>({id:v.id,label:v.company}))} onChange={setTransporter}/>
          <label>Vehicle number<input value={vehicle} onChange={e=>setVehicle(e.target.value)} placeholder="Vehicle registration"/></label>
          <label>LR / consignment number<input value={lrNumber} onChange={e=>setLrNumber(e.target.value)} placeholder="Transport LR reference"/></label>
          <label>Delivery destination<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Ship-to location / address"/></label>
          <label className="movement-form-wide">Dispatch notes<input value={dispatchNotes} onChange={e=>setDispatchNotes(e.target.value)} placeholder="Packing, batch, handling and delivery notes"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={createDispatch}><Check size={14}/> Save dispatch preparation</button><button className="button-quiet" onClick={()=>setDispatchFormOpen(false)}>Cancel</button></div>
        </div>
      </section>}
      <section className="surface-panel movement-register"><div className="panel-heading"><div><h3>Customer dispatch register ({visibleDispatch.length})</h3><p>Factory stock leaves on dispatch. In-transit stock is cleared only when delivery quantity is acknowledged.</p></div></div>
        {visibleDispatch.length?<div className="movement-card-list">{visibleDispatch.map(row=>{
          const po=orders.find(item=>item.id===row.poId),company=data.companies.find(item=>item.id===row.companyId),component=components.find(item=>item.id===row.componentId);
          const outstanding=row.dispatchedQuantity-row.deliveredQuantity;
          const remainingOrderQty=(po?.lines.find(line=>line.id===row.poLineId)?.quantity||0)-dispatches.filter(d=>d.poLineId===row.poLineId&&d.status!=="Cancelled").reduce((sum,d)=>sum+d.quantity,0);
          return <article className="surface-panel movement-card" key={row.id}>
            <div className="movement-card-head"><div><strong>{po?.number||"PO unavailable"} · {component?.partNumber||"Part unavailable"} · {component?.name||""}</strong><small>{company?.name||"Customer unavailable"} · {row.deliveryChallan||row.id}</small></div><span className="record-state">{row.status}</span></div>
            <div className="movement-facts"><div><small>COMMITTED</small><strong>{number(row.quantity)} pcs</strong></div><div><small>DISPATCHED</small><strong>{number(row.dispatchedQuantity)} pcs</strong></div><div><small>DELIVERED</small><strong>{number(row.deliveredQuantity)} pcs</strong></div><div><small>IN TRANSIT</small><strong>{number(transitBalance(row.componentId,row.id))} pcs</strong></div><div><small>ORDER QTY LEFT TO PLAN</small><strong>{number(Math.max(0,remainingOrderQty))} pcs</strong></div></div>
            <div className="movement-shipment-details"><span>Destination: {row.destination||"Not entered"}</span><span>Vehicle: {row.vehicleNumber||"—"}</span><span>LR: {row.lrNumber||"—"}</span><span>e-Way bill: {row.eWayBill||"—"}</span><span>Transporter: {vendors.find(v=>v.id===row.transporterVendorId)?.company||"—"}</span></div>
            {row.discrepancyNotes&&<p className="movement-discrepancy">Discrepancy: {row.discrepancyNotes}</p>}
            <div className="movement-card-actions">{row.status==="Prepared"&&<><button className="button-primary compact-button" onClick={()=>dispatchCustomerGoods(row)}>Confirm physical dispatch</button><button className="button-quiet compact-button" onClick={()=>cancelPrepared(row,"dispatch")}>Cancel prepared</button></>}{(row.status==="In transit"||row.status==="Partially delivered")&&<><label>Delivered qty<input type="number" min="0.000001" step="0.000001" value={deliveryQuantities[row.id]??String(outstanding)} onChange={e=>setDeliveryQuantities(current=>({...current,[row.id]:e.target.value}))}/></label><label>Received by<input value={deliveryReceivedBy[row.id]||""} onChange={e=>setDeliveryReceivedBy(current=>({...current,[row.id]:e.target.value}))} placeholder="Customer receiver"/></label><label>Proof / POD reference<input value={deliveryProof[row.id]||""} onChange={e=>setDeliveryProof(current=>({...current,[row.id]:e.target.value}))} placeholder="POD link / reference"/></label><label>Discrepancy<input value={deliveryDiscrepancy[row.id]||""} onChange={e=>setDeliveryDiscrepancy(current=>({...current,[row.id]:e.target.value}))} placeholder="Short / damaged quantity"/></label><button className="button-primary compact-button" onClick={()=>confirmDelivery(row)}>Confirm delivery</button></>}</div>
          </article>;
        })}</div>:<div className="module-empty-state"><Truck size={27}/><h3>No customer dispatch records</h3><p>Select a customer PO component line. Prepare a shipment, confirm the actual factory dispatch and record delivery acknowledgement.</p></div>}
      </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>All transfers and dispatches are append-only business records. Physical inventory changes occur only at confirmed dispatch/receipt events. WIP and shipment quantities are not automatically added to production-completed or customer-invoiced quantities.</span></div>
  </section>;
}
