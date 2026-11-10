import { useEffect, useState, type RefObject } from "react";
import { ArrowLeft, Expand } from "lucide-react";

type Props={
  targetRef:RefObject<HTMLElement|null>;
  onNotice:(message:string)=>void;
  onZoomReset?:()=>void;
};
export default function ImmersiveWorkspaceControls({targetRef,onNotice,onZoomReset}:Props){
 const [fullscreen,setFullscreen]=useState(false);
 useEffect(()=>{
  const update=()=>{
   const active=Boolean(document.fullscreenElement);
   setFullscreen(active);
   onZoomReset?.();\n   if(!active){(window.screen?.orientation as unknown as {unlock?:()=>void}|undefined)?.unlock?.();}
  };
  document.addEventListener("fullscreenchange",update);
  return ()=>document.removeEventListener("fullscreenchange",update);
 },[onZoomReset]);
 const toggle=async()=>{
  const target=targetRef.current;
  if(!target){onNotice("The workspace is not ready for full-screen mode.");return;}
  try{
   if(document.fullscreenElement){await document.exitFullscreen();return;}
   await target.requestFullscreen({navigationUI:"hide"});
  }catch{
   onNotice("Full-screen is not available in this browser. The workspace will remain in its normal responsive view.");
  }
 };
 return <button type="button" className={"ax-workspace-expand-toggle"+(fullscreen?" is-expanded":"")} onClick={toggle}
   title={fullscreen?"Back to fitted workspace":"Expand workspace"} aria-label={fullscreen?"Back to fitted workspace":"Expand workspace"}>
   {fullscreen?<ArrowLeft size={20}/>:<Expand size={18}/>}
  </button>;
}
