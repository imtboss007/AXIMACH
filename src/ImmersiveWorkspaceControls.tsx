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
   const active=document.fullscreenElement===targetRef.current;
   setFullscreen(active);
   onZoomReset?.();
   if(!active){(window.screen?.orientation as unknown as {unlock?:()=>void}|undefined)?.unlock?.();}
  };
  document.addEventListener("fullscreenchange",update);
  return ()=>document.removeEventListener("fullscreenchange",update);
 },[targetRef,onZoomReset]);
 const toggle=async()=>{
  const target=targetRef.current;
  if(!target){onNotice("The workspace is not ready for full-screen mode.");return;}
  try{
   if(document.fullscreenElement===target){await document.exitFullscreen();return;}
   if(document.fullscreenElement) await document.exitFullscreen();
   await target.requestFullscreen({navigationUI:"hide"});
  }catch{
   onNotice("Full-screen is not available in this browser. The workspace will remain in its normal responsive view.");
  }
 };
 return <button type="button" className={"ax-map-fullscreen-toggle"+(fullscreen?" is-expanded":"")} onClick={toggle}
   title={fullscreen?"Exit map full screen":"Open map full screen"} aria-label={fullscreen?"Exit map full screen":"Open map full screen"}>
   {fullscreen?<ArrowLeft size={20}/>:<Expand size={18}/>}
  </button>;
}
