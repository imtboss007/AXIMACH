export type PlannedCostEntry = {
  id:string;
  componentName:string;
  componentNumber:string;
  processType:string;
  processCategory:string;
  plannedQty:number;
  unit:"piece"|"set";
  plannedRate:number;
  notes:string;
  createdAt:string;
  updatedAt:string;
};
export const PLANNED_COST_KEY="aximach.componentPlannedCost.v1";
export function readPlannedCostRecords():PlannedCostEntry[]{
  try{const value=JSON.parse(localStorage.getItem(PLANNED_COST_KEY)||"[]");return Array.isArray(value)?value as PlannedCostEntry[]:[];}catch{return[];}
}
export function savePlannedCostRecords(rows:PlannedCostEntry[]){
  localStorage.setItem(PLANNED_COST_KEY,JSON.stringify(rows));
}
