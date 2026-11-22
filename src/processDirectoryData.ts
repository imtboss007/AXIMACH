export type ProcessDefinitionRecord={id:string;processType:string;category:string;subcategories:string[];vendorIds:string[];notes:string;createdAt:string;updatedAt:string};
export const PROCESS_DIRECTORY_KEY="aximach.processDirectory.v1";
export function readProcessDirectoryRecords():ProcessDefinitionRecord[]{
 try{const rows=JSON.parse(localStorage.getItem(PROCESS_DIRECTORY_KEY)||"[]");return Array.isArray(rows)?rows as ProcessDefinitionRecord[]:[];}catch{return[];}
}
