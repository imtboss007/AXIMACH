import { useCallback, useEffect, useState } from "react";

export type WorkspaceTheme = "light" | "medium" | "dark" | "ocean";
const KEY="aximach.workspaceTheme.v1";
function readTheme():WorkspaceTheme {
  if(typeof window==="undefined")return "light";
  const value=window.localStorage.getItem(KEY);
  return value==="medium"||value==="dark"||value==="ocean"?value:"light";
}
export function useWorkspaceTheme(){
  const [theme,setTheme]=useState<WorkspaceTheme>(readTheme);
  useEffect(()=>{
    const sync=(event:StorageEvent)=>{if(event.key===KEY)setTheme(readTheme());};
    window.addEventListener("storage",sync);
    return ()=>window.removeEventListener("storage",sync);
  },[]);
  const change=useCallback((value:WorkspaceTheme)=>{
    setTheme(value);
    try{window.localStorage.setItem(KEY,value);}catch{/* Continue with in-memory theme if storage is unavailable. */}
  },[]);
  return [theme,change] as const;
}
