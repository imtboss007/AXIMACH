import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Activity, Boxes, Factory, ShieldCheck, Workflow, Truck, Calculator, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { OrbCounts } from "./AXIMACHOrb";
type Props = { onSelectModule: (id: string) => void; counts: OrbCounts; onFailure: () => void; paused?: boolean };
const satellites = [
  { id: "companies", label: "Company", Icon: Factory, color: 0x72dcf5, position: new THREE.Vector3(-2.25,.65,.1), countKey: "companies" as const },
  { id: "production", label: "Production", Icon: Workflow, color: 0x8d9cff, position: new THREE.Vector3(2.05,.55,.25), countKey: "processSteps" as const },
  { id: "inventory", label: "Material", Icon: Boxes, color: 0x55d9ae, position: new THREE.Vector3(-1.65,-1.35,.45), countKey: "stockEvents" as const },
  { id: "quality", label: "Quality", Icon: ShieldCheck, color: 0xffbd69, position: new THREE.Vector3(1.55,-1.45,.55), countKey: "qualityFlags" as const },
  { id: "dispatch", label: "Dispatch", Icon: Truck, color: 0x65aaff, position: new THREE.Vector3(0,2.25,.1), countKey: "dispatches" as const },
  { id: "component-cost-planner", label: "Cost plan", Icon: Calculator, color: 0xd2a6ff, position: new THREE.Vector3(0,-2.25,.35), countKey: "components" as const },
];
type VisualSettings = { animationIntensity:number; particles:number; lighting:number; cameraSensitivity:number; performanceQuality:"balanced"|"high"|"low"; reducedMotion:boolean };
function readVisualSettings():VisualSettings {
  const fallback:VisualSettings={animationIntensity:72,particles:65,lighting:75,cameraSensitivity:60,performanceQuality:"balanced",reducedMotion:false};
  try{const saved=JSON.parse(localStorage.getItem("aximach.visual-experience.v1")||"{}") as Partial<VisualSettings>;return {...fallback,...saved};}catch{return fallback;}
}
export default function AXIMACHOrbWebGL({onSelectModule,counts,onFailure,paused=false}:Props) {
  const hostRef=useRef<HTMLDivElement>(null);
  const latest=useRef({onSelectModule,counts,onFailure,paused});
  const [zoom,setZoom]=useState(0);
  const [visualRevision,setVisualRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setVisualRevision(value=>value+1);window.addEventListener("aximach-visual-preferences-updated",refresh);return()=>window.removeEventListener("aximach-visual-preferences-updated",refresh);},[]);
  useEffect(()=>{latest.current={onSelectModule,counts,onFailure,paused};},[onSelectModule,counts,onFailure,paused]);

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    const settings=readVisualSettings();
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:settings.performanceQuality!=="low",powerPreference:"high-performance",failIfMajorPerformanceCaveat:false});}
    catch{latest.current.onFailure();return;}
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=.95+settings.lighting/350;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,settings.performanceQuality==="high"?2:settings.performanceQuality==="low"?1:1.5));
    renderer.domElement.setAttribute("aria-label","Interactive AXIMACH three-dimensional intelligence core. Drag to rotate, pinch or scroll to zoom, select a module node.");
    renderer.domElement.tabIndex=0;renderer.domElement.style.touchAction="none";host.prepend(renderer.domElement);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(36,1,.1,80);camera.position.set(0,0,8.7);
    scene.add(new THREE.AmbientLight(0x8eafd3,.8));
    const keyLight=new THREE.PointLight(0x75dfff,160,24,2);keyLight.position.set(-3.5,4.5,5);scene.add(keyLight);
    const rimLight=new THREE.PointLight(0x8a78ff,105,20,2);rimLight.position.set(4,-3,-4);scene.add(rimLight);
    const universe=new THREE.Group();scene.add(universe);
    const core=new THREE.Group();universe.add(core);
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1.42,settings.performanceQuality==="high"?96:64,settings.performanceQuality==="high"?72:48),new THREE.MeshPhysicalMaterial({color:0x0c4d83,metalness:.72,roughness:.2,clearcoat:1,clearcoatRoughness:.13,emissive:0x062d59,emissiveIntensity:.7,transparent:true,opacity:.96})));
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1.445,48,32),new THREE.MeshBasicMaterial({color:0x8bdcff,wireframe:true,transparent:true,opacity:.13})));
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1.54,40,30),new THREE.MeshBasicMaterial({color:0x43bfff,side:THREE.BackSide,transparent:true,opacity:.105})));
    const ringMaterials=[0x59d9f7,0x8b86ff,0x6aaaff].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72}));
    const rings=[
      new THREE.Mesh(new THREE.TorusGeometry(2.04,.018,10,180),ringMaterials[0]),
      new THREE.Mesh(new THREE.TorusGeometry(2.25,.012,8,180),ringMaterials[1]),
      new THREE.Mesh(new THREE.TorusGeometry(2.52,.008,8,180),ringMaterials[2])
    ];
    rings[0].rotation.set(.9,.2,.2);rings[1].rotation.set(.1,1.15,.7);rings[2].rotation.set(1.35,.2,-.35);rings.forEach(r=>universe.add(r));

    const particleCount=Math.round((settings.performanceQuality==="low"?700:settings.performanceQuality==="high"?2600:1500)*settings.particles/65);
    const particlePositions=new Float32Array(particleCount*3),goldenAngle=Math.PI*(3-Math.sqrt(5));
    for(let i=0;i<particleCount;i++){const y=1-(i/Math.max(1,particleCount-1))*2,radius=Math.sqrt(1-y*y),theta=goldenAngle*i,o=i*3;particlePositions[o]=Math.cos(theta)*radius*1.46;particlePositions[o+1]=y*1.46;particlePositions[o+2]=Math.sin(theta)*radius*1.46;}
    const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute("position",new THREE.BufferAttribute(particlePositions,3));
    core.add(new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xafeaff,size:.012,transparent:true,opacity:.7,depthWrite:false})));
    const starCount=settings.performanceQuality==="low"?250:settings.performanceQuality==="high"?1100:650;
    const starPositions=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){starPositions[i*3]=(Math.random()-.5)*18;starPositions[i*3+1]=(Math.random()-.5)*10;starPositions[i*3+2]=-2-Math.random()*14;}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute("position",new THREE.BufferAttribute(starPositions,3));
    const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0x79b9ed,size:.018,transparent:true,opacity:.55,depthWrite:false}));scene.add(stars);

    const nodeMeshes:THREE.Mesh[]=[];const nodeGroups:THREE.Group[]=[];
    const nodeGeometry=new THREE.IcosahedronGeometry(.22,1);
    const nodeMaterials=satellites.map(item=>new THREE.MeshPhysicalMaterial({color:item.color,emissive:item.color,emissiveIntensity:.32,metalness:.42,roughness:.22,clearcoat:1}));
    satellites.forEach((item,index)=>{
      const group=new THREE.Group();group.position.copy(item.position);
      const node=new THREE.Mesh(nodeGeometry,nodeMaterials[index]);node.userData.moduleId=item.id;group.add(node);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(.31,.012,8,48),new THREE.MeshBasicMaterial({color:item.color,transparent:true,opacity:.8}));halo.rotation.x=.55+index*.27;group.add(halo);
      const point=new THREE.PointLight(item.color,12,2.2);point.position.set(0,0,.25);group.add(point);
      nodeMeshes.push(node);nodeGroups.push(group);universe.add(group);
    });

    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const activePointers=new Map<number,{x:number;y:number}>();
    let dragOrigin:{x:number;y:number}|null=null,previous={x:0,y:0},moved=false,pinchDistance=0,frame=0,lastTime=0;
    const onPointerDown=(event:PointerEvent)=>{renderer.domElement.setPointerCapture(event.pointerId);activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});dragOrigin={x:event.clientX,y:event.clientY};previous={x:event.clientX,y:event.clientY};moved=false;if(activePointers.size===2){const v=[...activePointers.values()];pinchDistance=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);}};
    const onPointerMove=(event:PointerEvent)=>{if(!activePointers.has(event.pointerId))return;activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(activePointers.size>=2){const v=[...activePointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(pinchDistance>0)camera.position.z=THREE.MathUtils.clamp(camera.position.z+(pinchDistance-d)*.012,5.2,12.5);pinchDistance=d;}else if(dragOrigin){const dx=event.clientX-previous.x,dy=event.clientY-previous.y;if(Math.abs(event.clientX-dragOrigin.x)+Math.abs(event.clientY-dragOrigin.y)>5)moved=true;const sensitivity=.0035*settings.cameraSensitivity/60;universe.rotation.y+=dx*sensitivity;universe.rotation.x=THREE.MathUtils.clamp(universe.rotation.x+dy*sensitivity,-.72,.72);}previous={x:event.clientX,y:event.clientY};};
    const onPointerUp=(event:PointerEvent)=>{const wasClick=!moved&&!!dragOrigin&&activePointers.size===1;if(wasClick){const b=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-b.left)/b.width)*2-1;pointer.y=-((event.clientY-b.top)/b.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(nodeMeshes,false)[0];if(hit?.object.userData.moduleId)latest.current.onSelectModule(String(hit.object.userData.moduleId));}activePointers.delete(event.pointerId);if(!activePointers.size){dragOrigin=null;moved=false;pinchDistance=0;}};
    const onWheel=(event:WheelEvent)=>{event.preventDefault();camera.position.z=THREE.MathUtils.clamp(camera.position.z+event.deltaY*.0035,5.2,12.5);};
    const onReset=()=>{universe.rotation.set(0,0,0);camera.position.set(0,0,8.7);};
    const onContextMenu=(event:Event)=>event.preventDefault();
    const onLostContext=(event:Event)=>{event.preventDefault();latest.current.onFailure();};
    renderer.domElement.addEventListener("pointerdown",onPointerDown);
    renderer.domElement.addEventListener("pointermove",onPointerMove);
    renderer.domElement.addEventListener("pointerup",onPointerUp);
    renderer.domElement.addEventListener("pointercancel",onPointerUp);
    renderer.domElement.addEventListener("wheel",onWheel,{passive:false});
    renderer.domElement.addEventListener("contextmenu",onContextMenu);
    renderer.domElement.addEventListener("webglcontextlost",onLostContext);
    host.addEventListener("aximach-orb-reset",onReset);

    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const reducedMotion=settings.reducedMotion||window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate=(time:number)=>{frame=requestAnimationFrame(animate);const delta=Math.min(.05,Math.max(0,(time-(lastTime||time))/1000));lastTime=time;if(!reducedMotion&&!latest.current.paused&&document.visibilityState==="visible"){universe.rotation.y+=delta*.075*settings.animationIntensity/72;rings[0].rotation.z+=delta*.16;rings[1].rotation.x-=delta*.11;rings[2].rotation.y+=delta*.09;nodeGroups.forEach((g,i)=>{g.rotation.y+=delta*(.3+i*.035);g.rotation.x+=delta*.18;});stars.rotation.y+=delta*.0015;}renderer.render(scene,camera);};
    frame=requestAnimationFrame(animate);
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown",onPointerDown);renderer.domElement.removeEventListener("pointermove",onPointerMove);
      renderer.domElement.removeEventListener("pointerup",onPointerUp);renderer.domElement.removeEventListener("pointercancel",onPointerUp);
      renderer.domElement.removeEventListener("wheel",onWheel);renderer.domElement.removeEventListener("contextmenu",onContextMenu);
      renderer.domElement.removeEventListener("webglcontextlost",onLostContext);host.removeEventListener("aximach-orb-reset",onReset);
      scene.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose?.();if(Array.isArray(mesh.material))mesh.material.forEach(m=>m.dispose());else mesh.material?.dispose();});
      renderer.dispose();renderer.domElement.remove();
    };
  },[visualRevision]);

  const changeZoom=useCallback((direction:number)=>{const host=hostRef.current;if(host)host.dispatchEvent(new CustomEvent("aximach-orb-zoom",{detail:direction}));setZoom(v=>THREE.MathUtils.clamp(v+direction,-3,3));},[]);
  useEffect(()=>{const host=hostRef.current;if(!host)return;const onZoom=(event:Event)=>{const direction=Number((event as CustomEvent<number>).detail),canvas=host.querySelector("canvas");if(canvas)canvas.dispatchEvent(new WheelEvent("wheel",{deltaY:-direction*120,cancelable:true}));};host.addEventListener("aximach-orb-zoom",onZoom);return()=>host.removeEventListener("aximach-orb-zoom",onZoom);},[]);
  const resetView=()=>{hostRef.current?.dispatchEvent(new Event("aximach-orb-reset"));setZoom(0);};
  return <div className="axr-orb-shell">
    <div className="axr-orb-canvas" ref={hostRef}/>
    <div className="axr-orb-core-label"><b>AXI</b><strong>MACH</strong><small>MANUFACTURING INTELLIGENCE</small></div>
    <div className="axr-orb-topline"><span><i/> 3D INTELLIGENCE CORE</span><span>WEBGL · LIVE RECORD COUNTS</span></div>
    <div className="axr-orb-module-constellation">{satellites.map(item=>{const Icon=item.Icon;return <button key={item.id} type="button" className="axr-orb-module" onClick={()=>latest.current.onSelectModule(item.id)}><span className="axr-orb-module-icon" style={{color:"#"+item.color.toString(16).padStart(6,"0")}}><Icon size={15}/></span><span><b>{item.label}</b><small>{latest.current.counts[item.countKey].toLocaleString("en-IN")} records</small></span><i/></button>;})}</div>
    <div className="axr-orb-controls"><button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>changeZoom(-1)}><ZoomOut size={14}/></button><button type="button" aria-label="Reset view" title="Reset view" onClick={resetView}><RotateCcw size={14}/></button><button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>changeZoom(1)}><ZoomIn size={14}/></button></div>
    <div className="axr-orb-hint">DRAG TO ROTATE · PINCH / SCROLL TO ZOOM · SELECT AN ORBIT NODE</div>
  </div>;
}