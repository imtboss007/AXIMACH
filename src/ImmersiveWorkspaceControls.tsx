import { useEffect, useState, type RefObject } from "react";
import { Expand, Minimize2, Monitor, Smartphone, ArrowLeft } from "lucide-react";

type Props = {
  targetRef: RefObject<HTMLElement | null>;
  onBack: () => void;
  onNotice: (message: string) => void;
};

export default function ImmersiveWorkspaceControls({targetRef,onBack,onNotice}:Props) {
  const [fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{
    const update=()=>setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange",update);
    return ()=>document.removeEventListener("fullscreenchange",update);
  },[]);
  const toggleFullscreen=async()=>{
    const target=targetRef.current;
    if(!target){onNotice("The workspace is not ready for full-screen mode.");return;}
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen({navigationUI:"hide"});
    } catch {
      onNotice("Full-screen mode is unavailable in this browser. Rotate the device and use the expanded canvas controls.");
    }
  };
  const lockOrientation=async(mode:"portrait"|"landscape")=>{
    const target=targetRef.current;
    try {
      if(!document.fullscreenElement&&target) await target.requestFullscreen({navigationUI:"hide"});
      const orientation=window.screen?.orientation as unknown as {lock?:(value:"portrait"|"landscape")=>Promise<void>;unlock?:()=>void};
      if(orientation&&typeof orientation.lock==="function") {
        await orientation.lock(mode);
        onNotice("Workspace orientation locked to "+mode+".");
      } else onNotice("This browser does not support orientation locking. Rotate the device to change the view.");
    } catch {
      onNotice("Orientation lock was declined by the browser. Rotate your device manually; the workspace layout will adapt.");
    }
  };
  const back=async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      (window.screen?.orientation as unknown as {unlock?:()=>void}|undefined)?.unlock?.();
    } catch { /* Navigation must still return to the previous module. */ }
    onBack();
  };
  return <div className="ax-immersive-controls" aria-label="Workspace display controls">
    <button type="button" className="button-quiet compact-button" onClick={toggleFullscreen} title={fullscreen?"Exit full screen":"Open full screen"}>
      {fullscreen?<Minimize2 size={14}/>:<Expand size={14}/>} {fullscreen?"Exit full screen":"Full screen"}
    </button>
    <button type="button" className="button-quiet compact-button" onClick={()=>lockOrientation("portrait")} title="Use portrait orientation"><Smartphone size={14}/> Portrait</button>
    <button type="button" className="button-quiet compact-button" onClick={()=>lockOrientation("landscape")} title="Use landscape orientation"><Monitor size={14}/> Landscape</button>
    <button type="button" className="button-quiet compact-button" onClick={back}><ArrowLeft size={14}/> Back</button>
  </div>;
}
