import { useEffect, useMemo, useRef, useState } from "react";
import type { OperationRecord } from "./manufacturingData";

type Mode = "sphere"|"vortex"|"linear"|"horizontal"|"vertical"|"timeline"|"gantt"|"nodes"|"branch"|"combined"|"cube"|"molecular"|"orbit"|"digital-mesh"|"route";
type CatalogueDefinition = { id:string; processType:string; category:string; displayColor?:string };
type RouteAnchor = { operation:OperationRecord; relation:"main"|"alternate"|"rework"; color:string };
type Props = { operations: OperationRecord[]; mode: Mode; selectedOperationId: string; expandedOperationId?: string; onSelectOperation: (id:string)=>void; onExpandOperation?:(id:string)=>void; edges?:Array<{from:OperationRecord;to:OperationRecord;relation:string;color:string}>; coordinateOperations?:OperationRecord[]; anchors?:RouteAnchor[]; catalogue?:CatalogueDefinition[]; onAddCatalogue?:(id:string)=>void; showArrows?: boolean; vendors?:Array<{id:string;company:string}>; quantityUnit?:string; ganttScale?:"day"|"week"|"month" };
const EMPTY_CATALOGUE: CatalogueDefinition[] = [];

type P = {x:number;y:number;z:number};
const vs = `attribute vec3 aPosition; attribute vec3 aNormal; uniform mat4 uMvp; varying vec3 vNormal; varying vec3 vPosition; void main(){ vNormal=aNormal; vPosition=aPosition; gl_Position=uMvp*vec4(aPosition,1.0); }`;
const fs = `precision mediump float; uniform vec3 uColor; varying vec3 vNormal; varying vec3 vPosition; void main(){ vec3 n=normalize(vNormal); vec3 l=normalize(vec3(-0.45,0.8,1.0)); float d=max(dot(n,l),0.0); float rim=pow(1.0-abs(n.z),2.0); gl_FragColor=vec4(uColor*(0.28+0.72*d)+vec3(0.12,0.28,0.48)*rim,1.0); }`;
function shader(gl:WebGLRenderingContext,type:number,src:string){const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"shader");return s;}
function matMul(a:number[],b:number[]){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function perspective(f:number,aspect:number,n:number,far:number){const t=1/Math.tan(f/2),nf=1/(n-far);return [t/aspect,0,0,0,0,t,0,0,0,0,(far+n)*nf,-1,0,0,2*far*n*nf,0];}
function rotation(x:number,y:number){const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y);return [cy,sx*sy,cx*sy,0,0,cx,-sx,0,-sy,sx*cy,cx*cy,0,0,0,0,1];}
function project(p:P,m:number[],w:number,h:number){const x=m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],y=m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],z=m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14],q=m[3]*p.x+m[7]*p.y+m[11]*p.z+m[15];if(q<=0)return null;return {x:(x/q*.5+.5)*w,y:(1-(y/q*.5+.5))*h,z:z/q};}
function sphereMesh(cx:number,cy:number,cz:number,r:number,lat=10,lon=14){const v:number[]=[],n:number[]=[];for(let a=0;a<lat;a++){const t0=Math.PI*a/lat,t1=Math.PI*(a+1)/lat;for(let b=0;b<lon;b++){const p0=2*Math.PI*b/lon,p1=2*Math.PI*(b+1)/lon;const pts=[[Math.sin(t0)*Math.cos(p0),Math.cos(t0),Math.sin(t0)*Math.sin(p0)],[Math.sin(t1)*Math.cos(p0),Math.cos(t1),Math.sin(t1)*Math.sin(p0)],[Math.sin(t1)*Math.cos(p1),Math.cos(t1),Math.sin(t1)*Math.sin(p1)],[Math.sin(t0)*Math.cos(p1),Math.cos(t0),Math.sin(t0)*Math.sin(p1)]];for(const ix of [0,1,2,0,2,3]){const q=pts[ix];v.push(cx+q[0]*r,cy+q[1]*r,cz+q[2]*r);n.push(q[0],q[1],q[2]);}}}return {v,n};}
function boxMesh(cx:number,cy:number,cz:number,r:number){const v:number[]=[],n:number[]=[];const faces=[[[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]];for(const f of faces){const ids=[1,2,3,1,3,4];for(const id of ids){const p=f[id] as number[];v.push(cx+p[0]*r,cy+p[1]*r,cz+p[2]*r);n.push(...f[0] as number[]);}}return {v,n};}
function lineMesh(a:P,b:P,r:number){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz)||1;
 const ux=dx/len,uy=dy/len,uz=dz/len,ref=Math.abs(uy)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};
 let vx=uy*ref.z-uz*ref.y,vy=uz*ref.x-ux*ref.z,vz=ux*ref.y-uy*ref.x,vl=Math.hypot(vx,vy,vz)||1;
 vx/=vl;vy/=vl;vz/=vl;
 const wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx;
 const v:number[]=[],n:number[]=[],segments=10;
 for(let i=0;i<segments;i++){
  const a0=i*Math.PI*2/segments,a1=(i+1)*Math.PI*2/segments;
  const radial=(angle:number)=>({x:vx*Math.cos(angle)+wx*Math.sin(angle),y:vy*Math.cos(angle)+wy*Math.sin(angle),z:vz*Math.cos(angle)+wz*Math.sin(angle)});
  const r0=radial(a0),r1=radial(a1);
  const a0p={x:a.x+r0.x*r,y:a.y+r0.y*r,z:a.z+r0.z*r},a1p={x:a.x+r1.x*r,y:a.y+r1.y*r,z:a.z+r1.z*r};
  const b0p={x:b.x+r0.x*r,y:b.y+r0.y*r,z:b.z+r0.z*r},b1p={x:b.x+r1.x*r,y:b.y+r1.y*r,z:b.z+r1.z*r};
  const tri=[a0p,a1p,b1p,a0p,b1p,b0p];
  for(const p of tri){v.push(p.x,p.y,p.z);const radialNormal=p===a0p||p===b0p?r0:p===a1p||p===b1p?r1:r0;n.push(radialNormal.x,radialNormal.y,radialNormal.z);}
 }
 return {v,n};
}
function sphereWireMesh(radius:number):{v:number[];n:number[]}{
 const mesh={v:[] as number[],n:[] as number[]};
 const append=(a:P,b:P)=>{const part=lineMesh(a,b,.006);mesh.v.push(...part.v);mesh.n.push(...part.n);};
 const segments=32;
 for(let ring=1;ring<9;ring++){
  const latitude=-Math.PI/2+ring*Math.PI/9,rr=radius*Math.cos(latitude),y=radius*Math.sin(latitude);
  for(let step=0;step<segments;step++){
   const a=step*Math.PI*2/segments,b=(step+1)*Math.PI*2/segments;
   append({x:Math.cos(a)*rr,y,z:Math.sin(a)*rr},{x:Math.cos(b)*rr,y,z:Math.sin(b)*rr});
  }
 }
 for(let meridian=0;meridian<12;meridian++){
  const longitude=meridian*Math.PI/12;
  for(let step=0;step<segments;step++){
   const a=-Math.PI/2+step*Math.PI/segments,b=-Math.PI/2+(step+1)*Math.PI/segments;
   append({x:Math.cos(a)*radius*Math.cos(longitude),y:Math.sin(a)*radius,z:Math.cos(a)*radius*Math.sin(longitude)},
          {x:Math.cos(b)*radius*Math.cos(longitude),y:Math.sin(b)*radius,z:Math.cos(b)*radius*Math.sin(longitude)});
  }
 }
 return mesh;
}
function timestamp(value?:string):number|null{if(!value)return null;const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null;}
function ganttSegment(index:number,rows:OperationRecord[]):{start:P;end:P;center:P}{
 const events=rows.flatMap(row=>[timestamp(row.plannedStart||row.actualStart),timestamp(row.plannedEnd||row.actualEnd)]).filter((value):value is number=>value!==null);
 const minimum=events.length?Math.min(...events):0,rawMaximum=events.length?Math.max(...events):minimum+Math.max(1,rows.length)*86400000;
 const maximum=Math.max(rawMaximum,minimum+86400000),span=maximum-minimum,step=span/Math.max(1,rows.length);
 const operation=rows[index],startMs=timestamp(operation?.plannedStart||operation?.actualStart)??minimum+index*step;
 const endMs=Math.max(startMs+Math.max(60000,step*.55),timestamp(operation?.plannedEnd||operation?.actualEnd)??startMs+step*.55);
 const x=(value:number)=>((value-minimum)/span)*2.35-1.175;
 const y=((rows.length-1)/2-index)*Math.min(.32,1.55/Math.max(1,rows.length-1));
 const start={x:x(startMs),y,z:0},end={x:x(Math.min(maximum,endMs)),y,z:0};
 return {start,end,center:{x:(start.x+end.x)/2,y,z:0}};
}
function nodeDateTime(value?:string):string{
 if(!value)return "Not set";
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return value;
 return parsed.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function operationCode(operation:OperationRecord):string{
 const relation=operation.relationType==="alternate"?"ALT":operation.relationType==="rework"?"REWORK":operation.relationType==="subprocess"?"SUB":"";
 return "OP-"+String(operation.sequence).padStart(3,"0")+(relation?" · "+relation:"");
}
function arrowHeadMesh(from:P,to:P,r:number){const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,len=Math.hypot(dx,dy,dz)||1,ux=dx/len,uy=dy/len,uz=dz/len,ref=Math.abs(uy)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};let vx=uy*ref.z-uz*ref.y,vy=uz*ref.x-ux*ref.z,vz=ux*ref.y-uy*ref.x,vl=Math.hypot(vx,vy,vz)||1;vx/=vl;vy/=vl;vz/=vl;const wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx,base={x:to.x-ux*.16,y:to.y-uy*.16,z:to.z-uz*.16},v:number[]=[],n:number[]=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4,p1={x:base.x+r*(vx*Math.cos(a)+wx*Math.sin(a)),y:base.y+r*(vy*Math.cos(a)+wy*Math.sin(a)),z:base.z+r*(vz*Math.cos(a)+wz*Math.sin(a))},p2={x:base.x+r*(vx*Math.cos(b)+wx*Math.sin(b)),y:base.y+r*(vy*Math.cos(b)+wy*Math.sin(b)),z:base.z+r*(vz*Math.cos(b)+wz*Math.sin(b))};v.push(to.x,to.y,to.z,p1.x,p1.y,p1.z,p2.x,p2.y,p2.z);for(let j=0;j<3;j++)n.push(ux*.55+vx*.45,uy*.55+vy*.45,uz*.55+vz*.45);}return {v,n};}
function pointFor(i:number,n:number,mode:Mode):P{const t=(i+0.5)/Math.max(1,n),a=i*2.399963;const c=i-(n-1)/2;switch(mode){case"route":case"linear":case"horizontal":return{x:c*.72,y:Math.sin(i*.7)*.16,z:Math.cos(i*.5)*.18};case"vertical":return{x:Math.cos(a)*.34,y:-c*.64,z:Math.sin(a)*.34};case"timeline":case"gantt":return{x:(t-.5)*2.5,y:Math.sin(i*.8)*.12,z:Math.cos(i*.6)*.28};case"cube":{const s=Math.ceil(Math.cbrt(n));return{x:((i%s)-(s-1)/2)*.72,y:((Math.floor(i/s)%s)-(s-1)/2)*.72,z:(Math.floor(i/(s*s))-(s-1)/2)*.72};}case"vortex":{const r=.35+t*.72;return{x:Math.cos(a)*r,y:(t-.5)*1.7,z:Math.sin(a)*r};}case"molecular":return{x:Math.cos(Math.floor(i/3)*2.1)*.55+Math.cos(a)*.25,y:Math.sin(i*.8)*.35,z:Math.sin(Math.floor(i/3)*2.1)*.55+Math.sin(a)*.25};case"orbit":{const r=.42+(i%3)*.28;return{x:Math.cos(a)*r,y:Math.sin(i*.65)*.42,z:Math.sin(a)*r};}case"nodes":return{x:(i%3-1)*.8,y:(Math.floor(i/3)-(Math.ceil(n/3)-1)/2)*.65,z:(i%2?1:-1)*.24};case"branch":return{x:c*.55,y:(i%3-1)*.25,z:(i%2?1:-1)*.52};case"digital-mesh":{const cols=Math.max(2,Math.ceil(Math.sqrt(n))),row=Math.floor(i/cols),col=row%2?cols-1-i%cols:i%cols;return{x:(col-(cols-1)/2)*.58,y:((Math.ceil(n/cols)-1)/2-row)*.55,z:Math.sin(i*.45)*.12};}case"combined":return{x:Math.cos(a)*(.4+t*.6),y:Math.sin(i*.9)*.5,z:Math.sin(a)*(.4+t*.6)};default:{const y=1-2*t,r=Math.sqrt(1-y*y);return{x:Math.cos(a)*r*.9,y:y*.9,z:Math.sin(a)*r*.9};}}}

export default function ProcessScene3D({operations,mode,selectedOperationId,expandedOperationId="",onSelectOperation,onExpandOperation,edges=[],coordinateOperations=[],anchors=[],catalogue=EMPTY_CATALOGUE,onAddCatalogue,showArrows=true,vendors=[],quantityUnit="pieces",ganttScale="week"}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),[angle,setAngle]=useState(0),rotationRef=useRef(0),[paused,setPaused]=useState(false),[dragging,setDragging]=useState(false),drag=useRef<{x:number;y:number;angle:number}|null>(null),[size,setSize]=useState({w:600,h:500});
 const rows=useMemo(()=>operations.slice().sort((a,b)=>a.sequence-b.sequence),[operations]);
 const geometryRows=useMemo(()=>{const byId=new Map<string,OperationRecord>();for(const op of (coordinateOperations.length?coordinateOperations:rows))byId.set(op.id,op);for(const anchor of anchors)byId.set(anchor.operation.id,anchor.operation);return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);},[coordinateOperations,rows,anchors]);
 const geometryPoints=useMemo(()=>geometryRows.map((op,i)=>({op,p:mode==="gantt"?ganttSegment(i,geometryRows).center:pointFor(i,geometryRows.length,mode)})),[geometryRows,mode]);
 const points=useMemo(()=>rows.map(op=>geometryPoints.find(item=>item.op.id===op.id)).filter((item):item is {op:OperationRecord;p:P}=>!!item),[rows,geometryPoints]);
 const anchorPoints=useMemo(()=>anchors.filter(anchor=>!rows.some(op=>op.id===anchor.operation.id)).map(anchor=>({anchor,point:geometryPoints.find(item=>item.op.id===anchor.operation.id)?.p})).filter((item):item is {anchor:RouteAnchor;point:P}=>!!item),[anchors,rows,geometryPoints]);
 const cataloguePoints=useMemo(()=>catalogue.map((definition,index)=>({definition,p:pointFor(index,catalogue.length,mode)})),[catalogue,mode]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const gl=el.getContext("webgl",{alpha:true,antialias:true});if(!gl)return;let program:WebGLProgram;try{program=gl.createProgram()!;gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error("link");}catch{return;}gl.useProgram(program);const pos=gl.createBuffer()!,normal=gl.createBuffer()!;const loc=gl.getAttribLocation(program,"aPosition"),nl=gl.getAttribLocation(program,"aNormal"),mvp=gl.getUniformLocation(program,"uMvp"),color=gl.getUniformLocation(program,"uColor");gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);let frame=0,last=0,raf=0;const render=(now:number)=>{const dt=Math.min(40,now-last);last=now;if(!paused&&!drag.current){rotationRef.current+=dt*.00022;setAngle(rotationRef.current);}const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(el.width!==Math.floor(w*dpr)||el.height!==Math.floor(h*dpr)){el.width=Math.floor(w*dpr);el.height=Math.floor(h*dpr);}gl.viewport(0,0,el.width,el.height);gl.clearColor(.94,.97,1,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,rotationRef.current),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));gl.uniformMatrix4fv(mvp,false,new Float32Array(m));const draw=(mesh:{v:number[];n:number[]},rgb:number[])=>{gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.v),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.n),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(nl);gl.vertexAttribPointer(nl,3,gl.FLOAT,false,0,0);gl.uniform3fv(color,new Float32Array(rgb));gl.drawArrays(gl.TRIANGLES,0,mesh.v.length/3);};const center={x:0,y:0,z:0};
 if(mode==="sphere"){draw(sphereWireMesh(1.025),[.35,.57,.78]);draw(sphereMesh(center.x,center.y,center.z,.105),[.12,.34,.62]);}
 if(mode==="gantt"){
  const tickCount=ganttScale==="day"?12:ganttScale==="week"?8:6;
  for(let tick=0;tick<=tickCount;tick++){const x=-1.175+2.35*tick/tickCount;draw(lineMesh({x,y:-1.04,z:-.09},{x,y:1.04,z:-.09},.004),[.54,.66,.79]);}
  geometryRows.forEach((op,index)=>{const segment=ganttSegment(index,geometryRows),status=op.status.toLowerCase();const rgb=status.includes("complete")?[.12,.62,.42]:status.includes("running")?[.12,.42,.88]:status.includes("hold")?[.83,.27,.35]:op.relationType==="rework"?[.89,.48,.18]:op.relationType==="alternate"?[.18,.49,.86]:[.35,.56,.78];draw(lineMesh(segment.start,segment.end,.071),rgb);draw(sphereMesh(segment.start.x,segment.start.y,segment.start.z,.052),rgb);draw(sphereMesh(segment.end.x,segment.end.y,segment.end.z,.052),rgb);});
 }
 const pointById=new Map(geometryPoints.map(({op,p})=>[op.id,p]));
 const routeEdges=edges.length?edges:points.slice(0,-1).map((item,i)=>({from:item.op,to:points[i+1].op,relation:"main",color:"#4b95eb"}));
 if(showArrows)routeEdges.forEach(edge=>{
  let p=pointById.get(edge.from.id),q=pointById.get(edge.to.id);
  if(mode==="gantt"){const fromIndex=geometryRows.findIndex(op=>op.id===edge.from.id),toIndex=geometryRows.findIndex(op=>op.id===edge.to.id);if(fromIndex>=0&&toIndex>=0){p=ganttSegment(fromIndex,geometryRows).end;q=ganttSegment(toIndex,geometryRows).start;}}
  if(!p||!q)return;
  const rgb=edge.relation==="rework"?[.89,.48,.18]:edge.relation==="alternate"?[.12,.48,.88]:[.12,.43,.82];
  draw(lineMesh(p,q,.026),rgb);
  const d={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z},l=Math.hypot(d.x,d.y,d.z)||1;
  const tip={x:q.x-d.x/l*.14,y:q.y-d.y/l*.14,z:q.z-d.z/l*.14};
  draw(arrowHeadMesh(tip,q,.095),rgb);
 });points.forEach(({p,op})=>{const status=op.status.toLowerCase();const rgb=status.includes("complete")?[.12,.62,.42]:status.includes("running")?[.12,.42,.88]:status.includes("hold")?[.83,.27,.35]:[.35,.52,.72];draw(mode==="cube"||mode==="digital-mesh"?boxMesh(p.x,p.y,p.z,.13):sphereMesh(p.x,p.y,p.z,.14),rgb);});anchorPoints.forEach(({point})=>draw(sphereMesh(point.x,point.y,point.z,.085),[.38,.58,.82]));cataloguePoints.forEach(({p,definition})=>{const rgb=definition.displayColor?[.22,.55,.86]:[.24,.5,.78];draw(mode==="cube"||mode==="digital-mesh"?boxMesh(p.x,p.y,p.z,.13):sphereMesh(p.x,p.y,p.z,.14),rgb);});raf=requestAnimationFrame(render);};raf=requestAnimationFrame(render);return()=>cancelAnimationFrame(raf);},[geometryRows,geometryPoints,points,anchorPoints,cataloguePoints,edges,mode,paused,showArrows,ganttScale]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const ro=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r)setSize({w:r.width,h:r.height});});ro.observe(el);return()=>ro.disconnect();},[]);
 const projected=useMemo(()=>{const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));return points.map(({op,p})=>({op,screen:project(p,m,w,h)}));},[points,size,angle]);
 const projectedCatalogue=useMemo(()=>{const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));return cataloguePoints.map(({definition,p})=>({definition,screen:project(p,m,w,h)}));},[cataloguePoints,size,angle]);
 return <div className="ax-full3d-scene" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,angle:rotationRef.current};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}} onPointerMove={e=>{if(drag.current){rotationRef.current=drag.current.angle+(e.clientX-drag.current.x)*.008;setAngle(rotationRef.current);}}} onPointerUp={()=>{drag.current=null;setDragging(false);}} onPointerCancel={()=>{drag.current=null;setDragging(false);}}>
  <canvas ref={canvas} aria-label="Interactive WebGL 3D manufacturing process graph"/>
  <div className="ax-full3d-label-layer">{projected.map(({op,screen})=>screen&&<button key={op.id} type="button" className={"ax-full3d-label"+(selectedOperationId===op.id?" selected":"")} style={{left:screen.x,top:screen.y}} onPointerDown={e=>e.stopPropagation()} onClick={()=>{onSelectOperation(op.id);onExpandOperation?.(op.id);}} aria-controls="process-orbit-selected-details" aria-expanded={expandedOperationId===op.id} aria-label={"Open details for "+op.name+" · "+operationCode(op)} title={operationCode(op)+" · "+op.name+" · "+nodeDateTime(op.plannedStart)+" → "+nodeDateTime(op.plannedEnd)}><small>{operationCode(op)}</small><strong>{op.name}</strong><em>{op.status} · Qty {op.quantity.toLocaleString("en-IN")} {quantityUnit}</em><small className="ax-full3d-node-meta">S {nodeDateTime(op.plannedStart)} · D {nodeDateTime(op.plannedEnd)}</small><small className="ax-full3d-node-meta">{vendors.find(vendor=>vendor.id===op.vendorId)?.company||"Vendor not assigned"} · ₹{(op.actualRatePerPart>0?op.actualRatePerPart:op.ratePerPart).toLocaleString("en-IN",{maximumFractionDigits:2})}/part</small></button>)}{projectedCatalogue.map(({definition,screen},index)=>screen&&<button key={definition.id} type="button" className="ax-full3d-label ax-full3d-catalogue-label" style={{left:screen.x,top:screen.y}} onPointerDown={e=>e.stopPropagation()} onClick={()=>onAddCatalogue?.(definition.id)} disabled={!onAddCatalogue} aria-label={"Add "+definition.processType+" to this PO line"}><small>LIB-{String(index+1).padStart(2,"0")}</small><strong>{definition.processType}</strong><em>{definition.category} · ADD STAGE</em></button>)}</div>
  <div className="ax-full3d-controls"><button type="button" onPointerDown={e=>e.stopPropagation()} onClick={()=>setPaused(v=>!v)}>{paused?"Resume 3D rotation":"Pause 3D rotation"}</button><span>{dragging?"DRAGGING · 3D VIEW":mode.toUpperCase()+" · WEBGL 3D"}</span></div>
 </div>;
}
