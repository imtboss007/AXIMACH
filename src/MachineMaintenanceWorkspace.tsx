import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarClock, Check, ClipboardCheck, Clock3, Cog, Plus, ShieldCheck, Wrench, X } from "lucide-react";
import {
  activeRows, makeId, nowIso,
  type MachineRecord, type MachineMaintenancePlanRecord, type MachineMaintenanceWorkOrderRecord,
  type MachineDowntimeRecord, type MaintenancePlanType as MachineMaintenancePlanType, type MachineMaintenanceWorkType,
  type MachineMaintenancePriority, type MachineMaintenanceWorkStatus, type MachineDowntimeType,
  type ManufacturingData, type OperationRecord
} from "./manufacturingData";
import { getMachineAvailability, validateMachineMaintenanceWindow } from "./machineMaintenance.mjs";

type Props = {
  machines: MachineRecord[];
  plans: MachineMaintenancePlanRecord[];
  workOrders: MachineMaintenanceWorkOrderRecord[];
  downtime: MachineDowntimeRecord[];
  operations: OperationRecord[];
  update:(change:(current:ManufacturingData)=>ManufacturingData)=>void;
  onNotice:(message:string)=>void;
};
type PlanDraft=Omit<MachineMaintenancePlanRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">;
type WorkOrderDraft=Omit<MachineMaintenanceWorkOrderRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">;
type DowntimeDraft=Omit<MachineDowntimeRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">;
const localDateTime=(value:string)=>{
  if(!value)return "";
  const date=new Date(value);
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
};
const toIso=(value:string)=>value?new Date(value).toISOString():"";
const dateLabel=(value?:string)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
const money=(value:number)=>"₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const dayAfter=(date=new Date())=>{const next=new Date(date);next.setDate(next.getDate()+1);return next.toISOString().slice(0,10);};
const addFrequency=(date:string,value:number,unit:string)=>{
  if(!date||!Number.isFinite(value)||value<=0)return "";
  const next=new Date(date+"T12:00:00");
  if(unit==="Days")next.setDate(next.getDate()+value);
  else if(unit==="Weeks")next.setDate(next.getDate()+value*7);
  else if(unit==="Months")next.setMonth(next.getMonth()+value);
  return next.toISOString().slice(0,10);
};
const blankPlan=(machine?:MachineRecord):PlanDraft=>({
  companyId:machine?.companyId||"",factoryId:machine?.factoryId||"",machineId:machine?.id||"",
  planName:"",maintenanceType:"Preventive",frequencyValue:90,frequencyUnit:"Days",
  lastCompletedAt:"",nextDueAt:dayAfter(),estimatedDurationHours:2,checklist:[],
  assignedTo:"",active:true,notes:""
});
const blankWorkOrder=(machine?:MachineRecord,planId=""):WorkOrderDraft=>({
  companyId:machine?.companyId||"",factoryId:machine?.factoryId||"",machineId:machine?.id||"",planId,
  workOrderNumber:"MWO-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+Math.random().toString(36).slice(2,6).toUpperCase(),
  workType:"Preventive",priority:"Normal",status:"Open",title:"",reportedAt:nowIso(),
  scheduledStart:"",scheduledEnd:"",actualStart:"",actualEnd:"",
  symptom:"",rootCause:"",actionTaken:"",technician:"",estimatedCost:0,actualCost:0,notes:""
});
const blankDowntime=(machine?:MachineRecord,workOrderId=""):DowntimeDraft=>({
  companyId:machine?.companyId||"",factoryId:machine?.factoryId||"",machineId:machine?.id||"",workOrderId,
  downtimeType:"Unplanned breakdown",startedAt:nowIso(),endedAt:"",
  reason:"",productionImpactQty:0,recordedBy:"",notes:""
});
const PLAN_TYPES:MachineMaintenancePlanType[]=["Preventive","Lubrication","Calibration","Inspection"];
const WORK_TYPES:MachineMaintenanceWorkType[]=["Preventive","Breakdown","Corrective","Calibration","Inspection"];
const PRIORITIES:MachineMaintenancePriority[]=["Low","Normal","High","Critical"];
const WORK_STATUSES:MachineMaintenanceWorkStatus[]=["Planned","Open","In progress","Waiting parts","Completed","Cancelled"];
const DOWNTIME_TYPES:MachineDowntimeType[]=["Planned maintenance","Unplanned breakdown","Waiting for parts","Setup","Quality hold","Other"];

export default function MachineMaintenanceWorkspace({machines,plans,workOrders,downtime,operations,update,onNotice}:Props){
  const [machineId,setMachineId]=useState(machines[0]?.id||"");
  const [tab,setTab]=useState<"plans"|"workOrders"|"downtime">("plans");
  const [planDraft,setPlanDraft]=useState<PlanDraft>(()=>blankPlan(machines[0]));
  const [workDraft,setWorkDraft]=useState<WorkOrderDraft>(()=>blankWorkOrder(machines[0]));
  const [editingPlanId,setEditingPlanId]=useState("");
  const [editingWorkOrderId,setEditingWorkOrderId]=useState("");
  const [downtimeDraft,setDowntimeDraft]=useState<DowntimeDraft>(()=>blankDowntime(machines[0]));
  const [showPlanForm,setShowPlanForm]=useState(false);
  const [showWorkForm,setShowWorkForm]=useState(false);
  const [showDowntimeForm,setShowDowntimeForm]=useState(false);
  const machine=machines.find(row=>row.id===machineId)||machines[0];
  const selectedPlans=useMemo(()=>plans.filter(row=>row.machineId===machine?.id),[plans,machine?.id]);
  const selectedWorkOrders=useMemo(()=>workOrders.filter(row=>row.machineId===machine?.id).sort((a,b)=>Date.parse(b.reportedAt)-Date.parse(a.reportedAt)),[workOrders,machine?.id]);
  const selectedDowntime=useMemo(()=>downtime.filter(row=>row.machineId===machine?.id).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)),[downtime,machine?.id]);
  const availability=machine?getMachineAvailability(machine,selectedWorkOrders,selectedDowntime):null;
  const overduePlans=selectedPlans.filter(plan=>plan.active&&plan.nextDueAt&&plan.nextDueAt<new Date().toISOString().slice(0,10));
  const openDowntime=selectedDowntime.filter(row=>!row.endedAt);
  const plannedDuration=selectedWorkOrders.filter(row=>["Planned","In progress","Waiting parts"].includes(row.status)).reduce((sum,row)=>sum+Math.max(0,Number(row.scheduledStart&&row.scheduledEnd?(Date.parse(row.scheduledEnd)-Date.parse(row.scheduledStart))/3600000:0)||0),0);

  useEffect(()=>{
    if(machine&&(!machineId||!machines.some(row=>row.id===machineId)))setMachineId(machine.id);
  },[machines,machineId,machine?.id]);
  useEffect(()=>{
    setPlanDraft(blankPlan(machine));
    setWorkDraft(blankWorkOrder(machine));
    setDowntimeDraft(blankDowntime(machine));
    setShowPlanForm(false);setShowWorkForm(false);setShowDowntimeForm(false);
  },[machine?.id]);

  const savePlan=()=>{
    if(!machine||!planDraft.planName.trim()||!planDraft.nextDueAt||!Number.isSafeInteger(Number(planDraft.frequencyValue))||planDraft.frequencyValue<1){
      onNotice("Select a machine and enter a plan name, valid interval and next due date.");return;
    }
    if(planDraft.estimatedDurationHours<=0||planDraft.estimatedDurationHours>10000){
      onNotice("Estimated maintenance duration must be greater than zero hours.");return;
    }
    const stamp=nowIso(),prior=plans.find(row=>row.id===editingPlanId);
    const record:MachineMaintenancePlanRecord={...planDraft,id:editingPlanId||makeId("maintenance-plan"),
      companyId:machine.companyId,factoryId:machine.factoryId,machineId:machine.id,
      frequencyValue:Number(planDraft.frequencyValue),estimatedDurationHours:Number(planDraft.estimatedDurationHours),
      checklist:planDraft.checklist.map(value=>value.trim()).filter(Boolean),
      createdAt:prior?.createdAt||stamp,updatedAt:stamp
    };
    update(current=>({...current,maintenancePlans:editingPlanId
      ?(current.maintenancePlans||[]).map(row=>row.id===editingPlanId?record:row)
      :[...(current.maintenancePlans||[]),record]}));
    setPlanDraft(blankPlan(machine));setEditingPlanId("");setShowPlanForm(false);
    onNotice((editingPlanId?"Preventive maintenance plan updated for ":"Preventive maintenance plan saved against ")+machine.assetCode+".");
  };
  const editPlan=(plan:MachineMaintenancePlanRecord)=>{
    const {id,createdAt,updatedAt,deletedAt,...draft}=plan;
    setPlanDraft({...blankPlan(machine),...draft,checklist:[...(plan.checklist||[])]});
    setEditingPlanId(id);setShowPlanForm(true);setTab("plans");
  };
  const createWorkOrder=(plan?:MachineMaintenancePlanRecord)=>{
    setWorkDraft({...blankWorkOrder(machine,plan?.id||""),workType:plan?.maintenanceType==="Lubrication"?"Preventive":plan?.maintenanceType||"Preventive",title:plan?.planName||""});
    setEditingWorkOrderId("");setTab("workOrders");setShowWorkForm(true);
  };
  const editWorkOrder=(order:MachineMaintenanceWorkOrderRecord)=>{
    const {id,createdAt,updatedAt,deletedAt,...draft}=order;
    setWorkDraft({...blankWorkOrder(machine),...draft});
    setEditingWorkOrderId(id);setShowWorkForm(true);setTab("workOrders");
  };
  const saveWorkOrder=()=>{
    if(!machine||!workDraft.title.trim()){
      onNotice("Select a machine and enter a maintenance work-order title.");return;
    }
    if(workDraft.status==="Planned"&&(!workDraft.scheduledStart||!workDraft.scheduledEnd)){
      onNotice("A planned maintenance work order needs both start and end times.");return;
    }
    if(Boolean(workDraft.scheduledStart)!==Boolean(workDraft.scheduledEnd)){
      onNotice("Enter both the scheduled start and end, or leave both blank for an open work order.");return;
    }
    if(workDraft.scheduledStart&&workDraft.scheduledEnd){
      const check=validateMachineMaintenanceWindow(machine.id,toIso(workDraft.scheduledStart),toIso(workDraft.scheduledEnd),operations,selectedWorkOrders,selectedDowntime,editingWorkOrderId);
      if(!check.ok){
        const label=check.reason==="production-conflict"?"The maintenance window overlaps a production operation.":check.reason==="maintenance-conflict"?"Another active maintenance work order already reserves this machine.":check.reason==="downtime-conflict"?"The machine already has downtime recorded in this interval.":"Enter a valid maintenance interval.";
        onNotice(label+" Choose another window.");return;
      }
    }
    const stamp=nowIso(),prior=workOrders.find(row=>row.id===editingWorkOrderId);
    const actualStart=workDraft.actualStart?toIso(workDraft.actualStart):workDraft.status==="In progress"?(prior?.actualStart||stamp):workDraft.status==="Completed"?(prior?.actualStart||""):"";
    const actualEnd=workDraft.actualEnd?toIso(workDraft.actualEnd):workDraft.status==="Completed"?(prior?.actualEnd||stamp):"";
    if(workDraft.status==="Completed"&&(!actualStart||!actualEnd||Date.parse(actualEnd)<=Date.parse(actualStart))){
      onNotice("Record an actual maintenance start and an end time later than the start before completing this work order.");return;
    }
    const record:MachineMaintenanceWorkOrderRecord={...workDraft,id:editingWorkOrderId||makeId("maintenance-wo"),
      companyId:machine.companyId,factoryId:machine.factoryId,machineId:machine.id,
      reportedAt:workDraft.reportedAt||stamp,scheduledStart:toIso(workDraft.scheduledStart),scheduledEnd:toIso(workDraft.scheduledEnd),
      actualStart,actualEnd,
      estimatedCost:Math.max(0,Number(workDraft.estimatedCost)||0),actualCost:Math.max(0,Number(workDraft.actualCost)||0),
      createdAt:prior?.createdAt||stamp,updatedAt:stamp
    };
    update(current=>({...current,maintenanceWorkOrders:editingWorkOrderId
      ?(current.maintenanceWorkOrders||[]).map(row=>row.id===editingWorkOrderId?record:row)
      :[...(current.maintenanceWorkOrders||[]),record]}));
    setWorkDraft(blankWorkOrder(machine));setEditingWorkOrderId("");setShowWorkForm(false);
    onNotice("Maintenance work order "+record.workOrderNumber+(editingWorkOrderId?" updated.":" saved."));
  };
  const updateWorkOrderStatus=(order:MachineMaintenanceWorkOrderRecord,status:MachineMaintenanceWorkStatus)=>{
    if(status==="Planned"&&(!order.scheduledStart||!order.scheduledEnd)){
      onNotice("Add a scheduled start and end before planning this work order.");return;
    }
    if(status==="Planned"&&machine){
      const check=validateMachineMaintenanceWindow(machine.id,order.scheduledStart,order.scheduledEnd,operations,selectedWorkOrders,selectedDowntime,order.id);
      if(!check.ok){
        const reason=check.reason==="production-conflict"?"The planned maintenance window overlaps a production operation.":check.reason==="maintenance-conflict"?"Another maintenance work order already reserves this machine.":check.reason==="downtime-conflict"?"The machine already has downtime recorded in this interval.":"Enter a valid maintenance interval.";
        onNotice(reason+" Choose a different schedule.");return;
      }
    }
    const stamp=nowIso();
    const updated={...order,status,
      actualStart:status==="Completed"?(order.actualStart||order.reportedAt||stamp):status==="In progress"?(order.actualStart||stamp):order.actualStart,
      actualEnd:status==="Completed"?(order.actualEnd||stamp):status==="Cancelled"?order.actualEnd:"",
      updatedAt:stamp
    };
    if(status==="Completed"&&!updated.actualStart){
      onNotice("Edit this work order and record its actual start time before completing it.");return;
    }
    if(status==="Completed"&&updated.actualStart&&updated.actualEnd&&Date.parse(updated.actualEnd)<=Date.parse(updated.actualStart)){
      onNotice("Work order completion time must be after its recorded start.");return;
    }
    update(current=>{
      let nextPlans=current.maintenancePlans||[];
      if(status==="Completed"&&order.planId){
        nextPlans=nextPlans.map(plan=>{
          if(plan.id!==order.planId)return plan;
          const nextDueAt=addFrequency(stamp.slice(0,10),plan.frequencyValue,plan.frequencyUnit)||plan.nextDueAt;
          return {...plan,lastCompletedAt:stamp.slice(0,10),nextDueAt,updatedAt:stamp};
        });
      }
      const nextDowntime=(current.machineDowntime||[]).map(event=>
        status==="Completed"&&event.workOrderId===order.id&&!event.endedAt?{...event,endedAt:stamp,updatedAt:stamp}:event
      );
      return {...current,maintenancePlans:nextPlans,machineDowntime:nextDowntime,
        maintenanceWorkOrders:(current.maintenanceWorkOrders||[]).map(row=>row.id===order.id?updated:row)};
    });
    onNotice("Work order "+order.workOrderNumber+" marked "+status+".");
  };
  const saveDowntime=()=>{
    if(!machine||!downtimeDraft.reason.trim()||!downtimeDraft.startedAt){
      onNotice("Select a machine, downtime start and reason.");return;
    }
    if(downtimeDraft.endedAt&&Date.parse(downtimeDraft.endedAt)<=Date.parse(downtimeDraft.startedAt)){
      onNotice("Downtime end must be later than its start.");return;
    }
    const linked=workOrders.find(row=>row.id===downtimeDraft.workOrderId);
    if(downtimeDraft.workOrderId&&(!linked||linked.machineId!==machine.id)){
      onNotice("Select a work order linked to this machine.");return;
    }
    const stamp=nowIso(),record:MachineDowntimeRecord={...downtimeDraft,id:makeId("machine-downtime"),
      companyId:machine.companyId,factoryId:machine.factoryId,machineId:machine.id,
      startedAt:toIso(downtimeDraft.startedAt),endedAt:downtimeDraft.endedAt?toIso(downtimeDraft.endedAt):"",
      productionImpactQty:Math.max(0,Number(downtimeDraft.productionImpactQty)||0),
      createdAt:stamp,updatedAt:stamp
    };
    update(current=>({...current,machineDowntime:[...(current.machineDowntime||[]),record]}));
    setDowntimeDraft(blankDowntime(machine));setShowDowntimeForm(false);
    onNotice("Machine downtime event recorded. Overlapping production reservations will be rejected.");
  };
  const closeDowntime=(event:MachineDowntimeRecord)=>{
    if(event.endedAt)return;
    const stamp=nowIso();
    if(Date.parse(stamp)<=Date.parse(event.startedAt)){
      onNotice("A downtime event cannot be closed before its recorded start time.");return;
    }
    update(current=>({...current,machineDowntime:(current.machineDowntime||[]).map(row=>row.id===event.id?{...row,endedAt:stamp,updatedAt:stamp}:row)}));
    onNotice("Downtime event closed. The machine's availability has been recalculated.");
  };
  if(!machines.length)return <section className="surface-panel machine-maintenance-workspace"><div className="module-empty-state"><Wrench size={28}/><h3>Machine maintenance is ready for your asset register</h3><p>Register a real machine in Company Directory → Machines before creating maintenance plans, work orders or downtime records.</p></div></section>;

  return <section className="surface-panel machine-maintenance-workspace">
    <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PHASE 2 · MACHINE RELIABILITY</div><h3>Maintenance & downtime</h3><p>Preventive schedules, repair work orders and downtime events are linked to the registered machine asset.</p></div><span className="record-state">{machines.length} machine assets</span></div>
    <div className="machine-maintenance-selector"><label>Selected machine<select value={machine?.id||""} onChange={event=>setMachineId(event.target.value)}>{machines.map(row=><option key={row.id} value={row.id}>{row.assetCode} · {row.name} · {row.machineType}</option>)}</select></label>
      {availability&&<div className={"machine-availability-chip status-"+availability.status.toLowerCase().replace(/[^a-z]+/g,"-")}><Activity size={15}/><span><small>DERIVED AVAILABILITY</small><strong>{availability.status}</strong></span></div>}
    </div>
    <div className="machine-maintenance-metrics">
      <article><small>ACTIVE PLANS</small><strong>{selectedPlans.filter(plan=>plan.active).length}</strong></article>
      <article><small>OPEN WORK ORDERS</small><strong>{selectedWorkOrders.filter(order=>!["Completed","Cancelled"].includes(order.status)).length}</strong></article>
      <article><small>OPEN DOWNTIME</small><strong>{openDowntime.length}</strong></article>
      <article className={overduePlans.length?"is-warning":""}><small>OVERDUE PLANS</small><strong>{overduePlans.length}</strong></article>
    </div>
    {availability?.blocksProduction&&<div className="module-safety-note machine-maintenance-alert"><AlertTriangle size={16}/><span><strong>{availability.status}.</strong> New production reservations on this machine are blocked where their time windows overlap active maintenance or downtime records.</span></div>}
    <div className="machine-maintenance-tabs">
      <button className={tab==="plans"?"is-active":""} onClick={()=>setTab("plans")}><CalendarClock size={15}/> Preventive plans</button>
      <button className={tab==="workOrders"?"is-active":""} onClick={()=>setTab("workOrders")}><Wrench size={15}/> Work orders</button>
      <button className={tab==="downtime"?"is-active":""} onClick={()=>setTab("downtime")}><Clock3 size={15}/> Downtime</button>
    </div>
    {tab==="plans"&&<>
      <div className="machine-maintenance-section-heading"><div><h4>Maintenance schedules</h4><p>Frequency, next due date and technician checklist.</p></div><button className="button-primary compact-button" onClick={()=>{setPlanDraft(blankPlan(machine));setShowPlanForm(value=>!value);}}><Plus size={14}/> Add plan</button></div>
      {showPlanForm&&<div className="module-record-form machine-maintenance-form">
        <label>Plan name *<input value={planDraft.planName} onChange={event=>setPlanDraft({...planDraft,planName:event.target.value})} placeholder="90-day spindle and lubrication service"/></label>
        <label>Maintenance type<select value={planDraft.maintenanceType} onChange={event=>setPlanDraft({...planDraft,maintenanceType:event.target.value as MachineMaintenancePlanType})}>{PLAN_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Frequency value<input type="number" min="1" value={planDraft.frequencyValue} onChange={event=>setPlanDraft({...planDraft,frequencyValue:Math.max(1,Math.floor(Number(event.target.value)||1))})}/></label>
        <label>Frequency unit<select value={planDraft.frequencyUnit} onChange={event=>setPlanDraft({...planDraft,frequencyUnit:event.target.value as PlanDraft["frequencyUnit"]})}>{["Days","Weeks","Months"].map(value=><option key={value}>{value}</option>)}</select><small className="field-hint">Calendar-based recurrence is supported now. Machine-hour and cycle triggers will be enabled with meter capture.</small></label>
        <label>Next due date *<input type="date" value={planDraft.nextDueAt} onChange={event=>setPlanDraft({...planDraft,nextDueAt:event.target.value})}/></label>
        <label>Estimated duration (hours)<input type="number" min="0.1" step="0.1" value={planDraft.estimatedDurationHours} onChange={event=>setPlanDraft({...planDraft,estimatedDurationHours:Number(event.target.value)||0})}/></label>
        <label>Assigned technician / team<input value={planDraft.assignedTo} onChange={event=>setPlanDraft({...planDraft,assignedTo:event.target.value})} placeholder="Maintenance team"/></label>
        <label className="module-form-wide">Checklist · one task per line<textarea value={planDraft.checklist.join("\n")} onChange={event=>setPlanDraft({...planDraft,checklist:event.target.value.split("\n").slice(0,100)})} rows={4} placeholder={"Inspect spindle runout\nCheck lubrication pressure\nVerify safety interlocks"}/></label>
        <label className="module-form-wide">Notes<textarea value={planDraft.notes} onChange={event=>setPlanDraft({...planDraft,notes:event.target.value})} rows={2}/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={savePlan}><Check size={14}/> {editingPlanId?"Update maintenance plan":"Save maintenance plan"}</button><button className="button-quiet" onClick={()=>{setShowPlanForm(false);setEditingPlanId("");setPlanDraft(blankPlan(machine));}}>Cancel</button></div>
      </div>}
      {selectedPlans.length?<div className="module-record-list">{selectedPlans.map(plan=>{
        const overdue=plan.active&&plan.nextDueAt<new Date().toISOString().slice(0,10);
        return <article className="module-record-card" key={plan.id}><div className="module-record-mark"><CalendarClock size={18}/></div><div className="module-record-copy"><strong>{plan.planName}</strong><span>{plan.maintenanceType} · Every {plan.frequencyValue} {plan.frequencyUnit.toLowerCase()} · {plan.estimatedDurationHours} h</span><p>Last completed: {plan.lastCompletedAt||"Not yet completed"} · Next due: {plan.nextDueAt}</p><small>{plan.assignedTo||"No technician assigned"} · {plan.checklist.length} checklist items · {plan.active?"Active":"Paused"}</small>{overdue&&<em className="machine-maintenance-overdue">Maintenance overdue</em>}</div><div className="module-record-card-actions"><button onClick={()=>editPlan(plan)}>Edit</button><button onClick={()=>createWorkOrder(plan)}>Create work order</button><button onClick={()=>update(current=>({...current,maintenancePlans:(current.maintenancePlans||[]).map(row=>row.id===plan.id?{...row,active:!row.active,updatedAt:nowIso()}:row)}))}>{plan.active?"Pause":"Activate"}</button></div></article>;
      })}</div>:<div className="module-empty-state"><CalendarClock size={26}/><h3>No preventive plans</h3><p>Create a service, lubrication, calibration or inspection schedule for this machine.</p></div>}
    </>}
    {tab==="workOrders"&&<>
      <div className="machine-maintenance-section-heading"><div><h4>Maintenance work orders</h4><p>Plan and record preventive service, breakdown repair and corrective work.</p></div><button className="button-primary compact-button" onClick={()=>{setWorkDraft(blankWorkOrder(machine));setEditingWorkOrderId("");setShowWorkForm(value=>!value);}}><Plus size={14}/> New work order</button></div>
      {showWorkForm&&<div className="module-record-form machine-maintenance-form">
        <label>Work order number *<input value={workDraft.workOrderNumber} onChange={event=>setWorkDraft({...workDraft,workOrderNumber:event.target.value.toUpperCase()})}/></label>
        <label>Title / job description *<input value={workDraft.title} onChange={event=>setWorkDraft({...workDraft,title:event.target.value})} placeholder="Replace spindle bearings"/></label>
        <label>Work type<select value={workDraft.workType} onChange={event=>setWorkDraft({...workDraft,workType:event.target.value as MachineMaintenanceWorkType})}>{WORK_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Priority<select value={workDraft.priority} onChange={event=>setWorkDraft({...workDraft,priority:event.target.value as MachineMaintenancePriority})}>{PRIORITIES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Status<select value={workDraft.status} onChange={event=>setWorkDraft({...workDraft,status:event.target.value as MachineMaintenanceWorkStatus})}>{WORK_STATUSES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Preventive plan (optional)<select value={workDraft.planId||""} onChange={event=>setWorkDraft({...workDraft,planId:event.target.value})}><option value="">Not linked</option>{selectedPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.planName}</option>)}</select></label>
        <label>Scheduled start<input type="datetime-local" value={localDateTime(workDraft.scheduledStart)} onChange={event=>setWorkDraft({...workDraft,scheduledStart:event.target.value})}/></label>
        <label>Scheduled end<input type="datetime-local" value={localDateTime(workDraft.scheduledEnd)} onChange={event=>setWorkDraft({...workDraft,scheduledEnd:event.target.value})}/></label>
        <label>Technician / owner<input value={workDraft.technician} onChange={event=>setWorkDraft({...workDraft,technician:event.target.value})}/></label>
        <label>Actual start<input type="datetime-local" value={localDateTime(workDraft.actualStart)} onChange={event=>setWorkDraft({...workDraft,actualStart:event.target.value})}/></label>
        <label>Actual end<input type="datetime-local" value={localDateTime(workDraft.actualEnd)} onChange={event=>setWorkDraft({...workDraft,actualEnd:event.target.value})}/></label>
        <label>Estimated cost (₹)<input type="number" min="0" step="0.01" value={workDraft.estimatedCost} onChange={event=>setWorkDraft({...workDraft,estimatedCost:Number(event.target.value)||0})}/></label>
        <label>Actual cost (₹)<input type="number" min="0" step="0.01" value={workDraft.actualCost} onChange={event=>setWorkDraft({...workDraft,actualCost:Number(event.target.value)||0})}/></label>
        <label className="module-form-wide">Symptom / reported issue<textarea rows={2} value={workDraft.symptom} onChange={event=>setWorkDraft({...workDraft,symptom:event.target.value})}/></label>
        <label className="module-form-wide">Root cause<textarea rows={2} value={workDraft.rootCause} onChange={event=>setWorkDraft({...workDraft,rootCause:event.target.value})}/></label>
        <label className="module-form-wide">Corrective action taken<textarea rows={2} value={workDraft.actionTaken} onChange={event=>setWorkDraft({...workDraft,actionTaken:event.target.value})}/></label>
        <label className="module-form-wide">Notes<textarea rows={2} value={workDraft.notes} onChange={event=>setWorkDraft({...workDraft,notes:event.target.value})}/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveWorkOrder}><Check size={14}/> {editingWorkOrderId?"Update work order":"Save work order"}</button><button className="button-quiet" onClick={()=>{setShowWorkForm(false);setEditingWorkOrderId("");setWorkDraft(blankWorkOrder(machine));}}>Cancel</button></div>
      </div>}
      {selectedWorkOrders.length?<div className="module-record-list">{selectedWorkOrders.map(order=><article className="module-record-card" key={order.id}><div className="module-record-mark"><Wrench size={18}/></div><div className="module-record-copy"><strong>{order.workOrderNumber} · {order.title}</strong><span>{order.workType} · {order.priority} · {order.status}</span><p>Scheduled: {dateLabel(order.scheduledStart)} → {dateLabel(order.scheduledEnd)}</p><small>Actual: {dateLabel(order.actualStart)} → {dateLabel(order.actualEnd)}</small><small>{order.technician||"No technician assigned"} · Estimated {money(order.estimatedCost)} · Actual {money(order.actualCost)}</small>{order.symptom&&<small>Issue: {order.symptom}</small>}{order.rootCause&&<small>Root cause: {order.rootCause}</small>}{order.actionTaken&&<small>Action: {order.actionTaken}</small>}</div><div className="module-record-card-actions"><button onClick={()=>editWorkOrder(order)}>Edit</button><select aria-label={"Status for "+order.workOrderNumber} value={order.status} onChange={event=>updateWorkOrderStatus(order,event.target.value as MachineMaintenanceWorkStatus)}>{WORK_STATUSES.map(value=><option key={value}>{value}</option>)}</select></div></article>)}</div>:<div className="module-empty-state"><Wrench size={26}/><h3>No maintenance work orders</h3><p>Create a planned service or record a breakdown/corrective work order.</p></div>}
    </>}
    {tab==="downtime"&&<>
      <div className="machine-maintenance-section-heading"><div><h4>Machine downtime log</h4><p>Open events block overlapping production until closed.</p></div><button className="button-primary compact-button" onClick={()=>{setDowntimeDraft(blankDowntime(machine));setShowDowntimeForm(value=>!value);}}><Plus size={14}/> Record downtime</button></div>
      {showDowntimeForm&&<div className="module-record-form machine-maintenance-form">
        <label>Downtime type<select value={downtimeDraft.downtimeType} onChange={event=>setDowntimeDraft({...downtimeDraft,downtimeType:event.target.value as MachineDowntimeType})}>{DOWNTIME_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Linked work order<select value={downtimeDraft.workOrderId||""} onChange={event=>setDowntimeDraft({...downtimeDraft,workOrderId:event.target.value})}><option value="">Not linked</option>{selectedWorkOrders.filter(order=>!["Completed","Cancelled"].includes(order.status)).map(order=><option key={order.id} value={order.id}>{order.workOrderNumber} · {order.title}</option>)}</select></label>
        <label>Start date/time<input type="datetime-local" value={localDateTime(downtimeDraft.startedAt)} onChange={event=>setDowntimeDraft({...downtimeDraft,startedAt:event.target.value})}/></label>
        <label>End date/time (leave blank while machine is down)<input type="datetime-local" value={downtimeDraft.endedAt?localDateTime(downtimeDraft.endedAt):""} onChange={event=>setDowntimeDraft({...downtimeDraft,endedAt:event.target.value})}/></label>
        <label>Production quantity affected<input type="number" min="0" value={downtimeDraft.productionImpactQty} onChange={event=>setDowntimeDraft({...downtimeDraft,productionImpactQty:Number(event.target.value)||0})}/></label>
        <label>Recorded by<input value={downtimeDraft.recordedBy} onChange={event=>setDowntimeDraft({...downtimeDraft,recordedBy:event.target.value})}/></label>
        <label className="module-form-wide">Reason / failure description *<textarea rows={3} value={downtimeDraft.reason} onChange={event=>setDowntimeDraft({...downtimeDraft,reason:event.target.value})} placeholder="Describe the fault, failure or planned downtime reason"/></label>
        <label className="module-form-wide">Notes<textarea rows={2} value={downtimeDraft.notes} onChange={event=>setDowntimeDraft({...downtimeDraft,notes:event.target.value})}/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveDowntime}><Check size={14}/> Save downtime event</button><button className="button-quiet" onClick={()=>setShowDowntimeForm(false)}>Cancel</button></div>
      </div>}
      {selectedDowntime.length?<div className="module-record-list">{selectedDowntime.map(event=><article className="module-record-card" key={event.id}><div className="module-record-mark"><AlertTriangle size={18}/></div><div className="module-record-copy"><strong>{event.downtimeType}</strong><span>{dateLabel(event.startedAt)} → {event.endedAt?dateLabel(event.endedAt):"OPEN · machine unavailable"}</span><p>{event.reason}</p><small>{event.productionImpactQty.toLocaleString("en-IN")} production units affected · {event.recordedBy||"Not attributed"}</small></div><div className="module-record-card-actions">{!event.endedAt&&<button onClick={()=>closeDowntime(event)}>End downtime</button>}</div></article>)}</div>:<div className="module-empty-state"><Clock3 size={26}/><h3>No downtime events recorded</h3><p>Breakdowns and planned outages will appear here with their start/end times and production impact.</p></div>}
    </>}
    <div className="machine-maintenance-footnote"><ShieldCheck size={15}/><span>Machine availability is derived from the machine register, active work orders and open downtime records. Completed/cancelled work orders remain as maintenance history.</span></div>
    <div className="sr-only" aria-live="polite">{plannedDuration.toFixed(1)} hours of active scheduled maintenance.</div>
  </section>;
}
