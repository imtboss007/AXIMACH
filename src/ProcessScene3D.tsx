import { useEffect, useMemo, useRef, useState } from "react";
import { Truck } from "lucide-react";
import type { OperationRecord } from "./manufacturingData";

type Mode = "sphere"|"vortex"|"linear"|"horizontal"|"vertical"|"timeline"|"gantt"|"nodes"|"branch"|"combined"|"cube"|"molecular"|"orbit"|"digital-mesh"|"route"|"helix"|"stacked"|"pipeline"|"network"|"grid";
type CatalogueDefinition = { id:string; processType:string; category:string; displayColor?:string };
type RouteAnchor = { operation:OperationRecord; relation:"main"|"alternate"|"rework"; color:string };
type MaterialRouteNode = { id:string; poLineId?:string; partLabel:string; partNumber?:string; partName?:string; materialLabel:string; dimensionsLabel?:string; companyLabel?:string; poLabel?:string; componentLabel?:string; densityKgM3?:number; anchorOperationId?:string; anchorOperationName?:string; quantity:number; weightKg:number; supplier:string; transporter:string; from:string; to:string; vehicle:string; materialGivenAt:string; materialDueAt:string; materialReceivedAt:string; pickupAt:string; deliveryAt:string; status:string; materialRate:number; priceUnit:"kg"|"lb"; materialCost:number; cuttingType:string; cuttingBasis:string; cuttingRate:number; cuttingCost:number; transportCost:number };
type TransportLegNode = { id:string; poLineId:string; anchorOperationId:string; targetOperationId?:string; placement:"start"|"before"|"after"; fromLocation:string; toLocation:string; vehicleType:string; vendorName:string; tripDirection:"One-way"|"Two-way"; tripCount:number; amount:number; pickupAt:string; deliveryAt:string; status:string; relation:"main"|"alternate"|"rework" };
const hasMaterialTransport=(route:MaterialRouteNode)=>Boolean(
 route.transporter&&route.transporter!=="Transporter not assigned" ||
 route.from || route.to || route.vehicle || route.transportCost>0 || route.pickupAt || route.deliveryAt
);

type Props = { operations: OperationRecord[]; materialRoutes?: MaterialRouteNode[]; transportLegs?:TransportLegNode[]; visibleFields?:string[]; autoRotate?: boolean; mode: Mode; selectedOperationId: string; expandedOperationId?: string; onSelectOperation: (id:string)=>void; onExpandOperation?:(id:string)=>void; onArrowSelect?:(id:string)=>void; onSelectTransportLeg?:(id:string)=>void; edges?:Array<{from:OperationRecord;to:OperationRecord;relation:string;color:string}>; coordinateOperations?:OperationRecord[]; anchors?:RouteAnchor[]; catalogue?:CatalogueDefinition[]; onAddCatalogue?:(id:string)=>void; showArrows?: boolean; vendors?:Array<{id:string;company:string}>; quantityUnit?:string; ganttScale?:"day"|"week"|"month" };
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
function ganttDomain(rows:OperationRecord[],scale:"day"|"week"|"month"="week"){
 const events=rows.flatMap(row=>[timestamp(row.plannedStart)??timestamp(row.actualStart),timestamp(row.plannedEnd)??timestamp(row.actualEnd)]).filter((value):value is number=>value!==null);
 const hasEvents=events.length>0;
 const unitMs=scale==="day"?86400000:scale==="week"?7*86400000:30*86400000;
 const rawMin=hasEvents?Math.min(...events):0;
 const rawMax=hasEvents?Math.max(...events):rawMin+Math.max(1,rows.length)*unitMs;
 const startDate=new Date(rawMin);
 if(scale==="day")startDate.setHours(0,0,0,0);
 else if(scale==="week"){startDate.setHours(0,0,0,0);startDate.setDate(startDate.getDate()-((startDate.getDay()+6)%7));}
 else {startDate.setDate(1);startDate.setHours(0,0,0,0);}
 const next=(date:Date)=>{const value=new Date(date);if(scale==="day")value.setDate(value.getDate()+1);else if(scale==="week")value.setDate(value.getDate()+7);else value.setMonth(value.getMonth()+1);return value;};
 let endDate=next(startDate);
 while(endDate.getTime()<=rawMax)endDate=next(endDate);
 let cursor=new Date(startDate),all:number[]=[];
 while(cursor.getTime()<=endDate.getTime()&&all.length<500){all.push(cursor.getTime());cursor=next(cursor);}
 const stride=Math.max(1,Math.ceil((all.length-1)/12));
 const ticks=hasEvents?all.filter((_,index)=>index%stride===0):[];
 if(hasEvents&&ticks[ticks.length-1]!==endDate.getTime())ticks.push(endDate.getTime());
 return {minimum:startDate.getTime(),maximum:endDate.getTime(),ticks,hasEvents};
}
function ganttSegment(index:number,rows:OperationRecord[],scale:"day"|"week"|"month"="week"):{start:P;end:P;center:P;hasStart:boolean;hasEnd:boolean;scheduled:boolean}{
 const domain=ganttDomain(rows,scale),span=Math.max(1,domain.maximum-domain.minimum);
 const operation=rows[index];
 const startMs=timestamp(operation?.plannedStart)??timestamp(operation?.actualStart);
 const endMs=timestamp(operation?.plannedEnd)??timestamp(operation?.actualEnd);
 const scheduled=startMs!==null||endMs!==null;
 const fallbackX=domain.hasEvents?1.34:((index+0.5)/Math.max(1,rows.length))*2.35-1.175;
 const x=(value:number)=>((Math.max(domain.minimum,Math.min(domain.maximum,value))-domain.minimum)/span)*2.35-1.175;
 const startValue=startMs??endMs,endValue=endMs??startMs;
 const y=((rows.length-1)/2-index)*Math.min(.32,1.55/Math.max(1,rows.length-1));
 const start={x:startValue===null?fallbackX:x(startValue),y,z:0};
 const end={x:endValue===null?fallbackX:x(endValue),y,z:0};
 return {start,end,center:{x:(start.x+end.x)/2,y,z:0},hasStart:startMs!==null,hasEnd:endMs!==null,scheduled};
}
function nodeDateTime(value?:string):string{
 if(!value)return "Not set";
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return value;
 return parsed.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function hexRgb(hex?:string):number[]{const value=(hex||"#477fbd").replace("#","");if(!/^[0-9a-fA-F]{6}$/.test(value))return [.28,.5,.74];return [parseInt(value.slice(0,2),16)/255,parseInt(value.slice(2,4),16)/255,parseInt(value.slice(4,6),16)/255];}
function operationRgb(operation:OperationRecord):number[]{if(operation.relationType==="rework")return [.9,.43,.12];if(operation.status==="Complete")return [.12,.64,.4];if(operation.relationType==="alternate")return [.12,.48,.88];return hexRgb(operation.processColor);}
function operationCode(operation:OperationRecord):string{
 const relation=operation.relationType==="alternate"?"ALT":operation.relationType==="rework"?"REWORK":operation.relationType==="subprocess"?"SUB":"";
 return "OP-"+String(operation.sequence).padStart(3,"0")+(relation?" · "+relation:"");
}
type ProjectedPoint={x:number;y:number;z:number};
type LabelCandidate={id:string;screen:ProjectedPoint;kind:"operation"|"material"|"transport"|"transportLeg"};
function relaxLabels(items:LabelCandidate[],width:number,height:number){
 const cardWidth=width<600?Math.min(166,width*.44):Math.min(220,width*.36);
 const cardHeight=width<600?188:190;
 const placed=items.map((item,index)=>({...item,screen:{...item.screen},index}));
 const minX=cardWidth/2+7,maxX=Math.max(cardWidth/2+7,width-cardWidth/2-7);
 const minY=cardHeight/2+24,maxY=Math.max(cardHeight/2+24,height-cardHeight/2-48);
 for(let pass=0;pass<72;pass++){
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
   const a=placed[i],b=placed[j],dx=b.screen.x-a.screen.x,dy=b.screen.y-a.screen.y;
   const ox=cardWidth+10-Math.abs(dx),oy=cardHeight+9-Math.abs(dy);
   if(ox>0&&oy>0){
    if(ox<oy){const sign=dx===0?(a.index%2?1:-1):Math.sign(dx),push=Math.min(ox*.52,18);a.screen.x-=sign*push;b.screen.x+=sign*push;}
    else{const sign=dy===0?(a.index%2?1:-1):Math.sign(dy),push=Math.min(oy*.52,18);a.screen.y-=sign*push;b.screen.y+=sign*push;}
   }
  }
  for(const item of placed){item.screen.x=Math.max(minX,Math.min(maxX,item.screen.x));item.screen.y=Math.max(minY,Math.min(maxY,item.screen.y));}
 }
 return placed;
}
const PROCUREMENT_POINT:P={x:-1.18,y:-.05,z:0};
function arrowHeadMesh(from:P,to:P,r:number){const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,len=Math.hypot(dx,dy,dz)||1,ux=dx/len,uy=dy/len,uz=dz/len,ref=Math.abs(uy)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};let vx=uy*ref.z-uz*ref.y,vy=uz*ref.x-ux*ref.z,vz=ux*ref.y-uy*ref.x,vl=Math.hypot(vx,vy,vz)||1;vx/=vl;vy/=vl;vz/=vl;const wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx,base={x:to.x-ux*.16,y:to.y-uy*.16,z:to.z-uz*.16},v:number[]=[],n:number[]=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4,p1={x:base.x+r*(vx*Math.cos(a)+wx*Math.sin(a)),y:base.y+r*(vy*Math.cos(a)+wy*Math.sin(a)),z:base.z+r*(vz*Math.cos(a)+wz*Math.sin(a))},p2={x:base.x+r*(vx*Math.cos(b)+wx*Math.sin(b)),y:base.y+r*(vy*Math.cos(b)+wy*Math.sin(b)),z:base.z+r*(vz*Math.cos(b)+wz*Math.sin(b))};v.push(to.x,to.y,to.z,p1.x,p1.y,p1.z,p2.x,p2.y,p2.z);for(let j=0;j<3;j++)n.push(ux*.55+vx*.45,uy*.55+vy*.45,uz*.55+vz*.45);}return {v,n};}
function sphereOrbitMesh():{v:number[];n:number[]}{
 const mesh={v:[] as number[],n:[] as number[]};
 const append=(a:P,b:P)=>{const part=lineMesh(a,b,.007);mesh.v.push(...part.v);mesh.n.push(...part.n);};
 const rings:[ "xy"|"xz"|"yz",number,number ][]=[["xy",1.105,.18],["xz",1.085,.34],["yz",1.06,.22]];
 for(const [axis,radius,tilt] of rings)for(let i=0;i<64;i++){
  const point=(angle:number):P=>axis==="xy"?{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*Math.cos(tilt),z:Math.sin(angle)*radius*Math.sin(tilt)}:axis==="xz"?{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*Math.sin(tilt),z:Math.sin(angle)*radius*Math.cos(tilt)}:{x:Math.sin(angle)*radius*Math.sin(tilt),y:Math.cos(angle)*radius,z:Math.sin(angle)*radius*Math.cos(tilt)};
  append(point(i*Math.PI*2/64),point((i+1)*Math.PI*2/64));
 }
 return mesh;
}
const SPHERE_GUIDE_MESH = sphereWireMesh(1.025);
const SPHERE_ORBIT_MESH = sphereOrbitMesh();
function pointFor(i:number,n:number,mode:Mode):P{const t=(i+0.5)/Math.max(1,n),a=i*2.399963;const c=i-(n-1)/2;switch(mode){case"route":case"linear":case"horizontal":case"pipeline":return{x:c*.72,y:Math.sin(i*.7)*.16,z:Math.cos(i*.5)*.18};case"vertical":return{x:Math.cos(a)*.34,y:-c*.64,z:Math.sin(a)*.34};case"timeline":case"gantt":return{x:(t-.5)*2.5,y:Math.sin(i*.8)*.12,z:Math.cos(i*.6)*.28};case"cube":{const s=Math.ceil(Math.cbrt(n));return{x:((i%s)-(s-1)/2)*.72,y:((Math.floor(i/s)%s)-(s-1)/2)*.72,z:(Math.floor(i/(s*s))-(s-1)/2)*.72};}case"vortex":{const r=.35+t*.72;return{x:Math.cos(a)*r,y:(t-.5)*1.7,z:Math.sin(a)*r};}case"molecular":case"network":return{x:Math.cos(Math.floor(i/3)*2.1)*.55+Math.cos(a)*.25,y:Math.sin(i*.8)*.35,z:Math.sin(Math.floor(i/3)*2.1)*.55+Math.sin(a)*.25};case"orbit":{const r=.42+(i%3)*.28;return{x:Math.cos(a)*r,y:Math.sin(i*.65)*.42,z:Math.sin(a)*r};}case"nodes":return{x:(i%3-1)*.8,y:(Math.floor(i/3)-(Math.ceil(n/3)-1)/2)*.65,z:(i%2?1:-1)*.24};case"branch":return{x:c*.55,y:(i%3-1)*.25,z:(i%2?1:-1)*.52};case"digital-mesh":case"grid":{const cols=Math.max(2,Math.ceil(Math.sqrt(n))),row=Math.floor(i/cols),col=row%2?cols-1-i%cols:i%cols;return{x:(col-(cols-1)/2)*.58,y:((Math.ceil(n/cols)-1)/2-row)*.55,z:Math.sin(i*.45)*.12};}case"helix":{const radius=.48+(i%3)*.08;return{x:Math.cos(i*1.08)*radius,y:(t-.5)*2.05,z:Math.sin(i*1.08)*radius};}case"stacked":{const cols=Math.max(2,Math.ceil(Math.sqrt(n))),row=Math.floor(i/cols),col=i%cols,rows=Math.ceil(n/cols);return{x:(col-(cols-1)/2)*.7,y:((rows-1)/2-row)*.68,z:(i%3-1)*.48};}case"combined":return{x:Math.cos(a)*(.4+t*.6),y:Math.sin(i*.9)*.5,z:Math.sin(a)*(.4+t*.6)};default:{const y=1-2*t,r=Math.sqrt(1-y*y);return{x:Math.cos(a)*r*.9,y:y*.9,z:Math.sin(a)*r*.9};}}}

export default function ProcessScene3D({operations,materialRoutes=[],transportLegs=[],visibleFields=[],autoRotate=true,mode,selectedOperationId,expandedOperationId="",onSelectOperation,onExpandOperation,onArrowSelect,onSelectTransportLeg,edges=[],coordinateOperations=[],anchors=[],catalogue=EMPTY_CATALOGUE,onAddCatalogue,showArrows=true,vendors=[],quantityUnit="pieces",ganttScale="week"}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),[angle,setAngle]=useState(0),rotationRef=useRef(0),[dragging,setDragging]=useState(false),drag=useRef<{x:number;y:number;angle:number}|null>(null),[size,setSize]=useState({w:600,h:500});
 const rows=useMemo(()=>operations.slice().sort((a,b)=>a.sequence-b.sequence),[operations]);
 const geometryRows=useMemo(()=>{const byId=new Map<string,OperationRecord>();for(const op of (coordinateOperations.length?coordinateOperations:rows))byId.set(op.id,op);for(const anchor of anchors)byId.set(anchor.operation.id,anchor.operation);return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);},[coordinateOperations,rows,anchors]);
 const geometryPoints=useMemo(()=>geometryRows.map((op,i)=>({op,p:mode==="gantt"?ganttSegment(i,geometryRows,ganttScale).center:pointFor(i,geometryRows.length,mode)})),[geometryRows,mode,ganttScale]);
 const materialPlacements=useMemo(()=>materialRoutes.map((route,index)=>{
  const lineRows=geometryRows.filter(operation=>(!route.poLineId||operation.poLineId===route.poLineId)&&operation.relationType!=="subprocess");
  const anchor=route.anchorOperationId?lineRows.find(operation=>operation.id===route.anchorOperationId):undefined;
  const branch=anchor?.branch||"Main route";
  const firstMain=lineRows.filter(operation=>(operation.branch||"Main route")==="Main route").sort((a,b)=>a.sequence-b.sequence)[0]||lineRows.slice().sort((a,b)=>a.sequence-b.sequence)[0];
  const fromOperation=anchor||undefined;
  const toOperation=anchor
    ? lineRows.filter(operation=>(operation.branch||"Main route")===branch&&operation.sequence>anchor.sequence).sort((a,b)=>a.sequence-b.sequence)[0]
    : firstMain;
  const fromPoint=fromOperation?geometryPoints.find(item=>item.op.id===fromOperation.id)?.p:undefined;
  const toPoint=toOperation?geometryPoints.find(item=>item.op.id===toOperation.id)?.p:undefined;
  const lane=(index-(materialRoutes.length-1)/2)*.13;
  const lerp=(a:P,b:P,t:number):P=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+lane,z:a.z+(b.z-a.z)*t+Math.sign(lane||1)*.045});
  let materialPoint:P,transportPoint:P;
  if(fromPoint&&toPoint){materialPoint=lerp(fromPoint,toPoint,.28);transportPoint=lerp(fromPoint,toPoint,.70);}
  else if(fromPoint){materialPoint={x:fromPoint.x+.30,y:fromPoint.y+.20+lane,z:fromPoint.z+.16};transportPoint={x:fromPoint.x+.62,y:fromPoint.y+.30+lane,z:fromPoint.z+.22};}
  else if(toPoint){materialPoint={x:toPoint.x-.48,y:toPoint.y+.17+lane,z:toPoint.z+.16};transportPoint={x:toPoint.x-.22,y:toPoint.y+.10+lane,z:toPoint.z+.22};}
  else{materialPoint={x:-.98,y:-.55+lane,z:.30};transportPoint={x:-.62,y:-.60+lane,z:.34};}
  return {route,index,fromOperation,toOperation,materialPoint,transportPoint};
 }),[materialRoutes,geometryRows,geometryPoints]);
 const transportLegPlacements=useMemo(()=>transportLegs.map((leg,index)=>{
  const anchor=leg.anchorOperationId?geometryRows.find(operation=>operation.id===leg.anchorOperationId):undefined;
  const branch=anchor?.branch||"Main route";
  const lineRows=geometryRows.filter(operation=>operation.poLineId===leg.poLineId&&(operation.branch||"Main route")===branch&&operation.relationType!=="subprocess").sort((a,b)=>a.sequence-b.sequence);
  const anchorIndex=anchor?lineRows.findIndex(operation=>operation.id===anchor.id):-1;
  const fromOperation=leg.placement==="start"?undefined:leg.placement==="before"?(anchorIndex>0?lineRows[anchorIndex-1]:undefined):anchor;
  const toOperation=(leg.targetOperationId?lineRows.find(operation=>operation.id===leg.targetOperationId):undefined)||(leg.placement==="start"?lineRows[0]:leg.placement==="before"?anchor:(anchorIndex>=0?lineRows[anchorIndex+1]:undefined));
  const fromPoint=fromOperation?geometryPoints.find(item=>item.op.id===fromOperation.id)?.p:undefined;
  const toPoint=toOperation?geometryPoints.find(item=>item.op.id===toOperation.id)?.p:undefined;
  const siblings=transportLegs.filter(other=>other.poLineId===leg.poLineId&&other.anchorOperationId===leg.anchorOperationId&&other.placement===leg.placement);
  const lane=(siblings.findIndex(other=>other.id===leg.id)-(siblings.length-1)/2)*.17;
  let point:P;
  if(fromPoint&&toPoint)point={x:(fromPoint.x+toPoint.x)/2,y:(fromPoint.y+toPoint.y)/2+lane,z:(fromPoint.z+toPoint.z)/2+.16};
  else if(toPoint)point={x:toPoint.x-.34,y:toPoint.y+.22+lane,z:toPoint.z+.18};
  else if(fromPoint)point={x:fromPoint.x+.34,y:fromPoint.y+.22+lane,z:fromPoint.z+.18};
  else point={x:-.8+lane,y:-.65,z:.32};
  return {leg,index,fromOperation,toOperation,point};
 }),[transportLegs,geometryRows,geometryPoints]);
 const points=useMemo(()=>rows.map(op=>geometryPoints.find(item=>item.op.id===op.id)).filter((item):item is {op:OperationRecord;p:P}=>!!item),[rows,geometryPoints]);
 const anchorPoints=useMemo(()=>anchors.filter(anchor=>!rows.some(op=>op.id===anchor.operation.id)).map(anchor=>({anchor,point:geometryPoints.find(item=>item.op.id===anchor.operation.id)?.p})).filter((item):item is {anchor:RouteAnchor;point:P}=>!!item),[anchors,rows,geometryPoints]);
 const cataloguePoints=useMemo(()=>catalogue.map((definition,index)=>({definition,p:pointFor(index,catalogue.length,mode)})),[catalogue,mode]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const gl=el.getContext("webgl",{alpha:true,antialias:true});if(!gl)return;let program:WebGLProgram;try{program=gl.createProgram()!;gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error("link");}catch{return;}gl.useProgram(program);const pos=gl.createBuffer()!,normal=gl.createBuffer()!;const loc=gl.getAttribLocation(program,"aPosition"),nl=gl.getAttribLocation(program,"aNormal"),mvp=gl.getUniformLocation(program,"uMvp"),color=gl.getUniformLocation(program,"uColor");gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);let last=0,lastOverlayUpdate=0,raf=0;const render=(now:number)=>{const dt=Math.min(40,now-last);last=now;if(autoRotate&&!drag.current){rotationRef.current+=dt*.00022;if(now-lastOverlayUpdate>=33){lastOverlayUpdate=now;setAngle(rotationRef.current);}}const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(el.width!==Math.floor(w*dpr)||el.height!==Math.floor(h*dpr)){el.width=Math.floor(w*dpr);el.height=Math.floor(h*dpr);}gl.viewport(0,0,el.width,el.height);gl.clearColor(.94,.97,1,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,rotationRef.current),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));gl.uniformMatrix4fv(mvp,false,new Float32Array(m));const draw=(mesh:{v:number[];n:number[]},rgb:number[])=>{gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.v),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.n),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(nl);gl.vertexAttribPointer(nl,3,gl.FLOAT,false,0,0);gl.uniform3fv(color,new Float32Array(rgb));gl.drawArrays(gl.TRIANGLES,0,mesh.v.length/3);};const center={x:0,y:0,z:0};
 if(mode==="sphere"){
  draw(SPHERE_GUIDE_MESH,[.24,.58,.83]);
  draw(SPHERE_ORBIT_MESH,[.05,.48,.74]);
  draw(sphereMesh(center.x,center.y,center.z,.12),[.08,.48,.78]);
 }
 if(mode==="gantt"){
   const domain=ganttDomain(geometryRows,ganttScale);
   for(const tickTime of domain.ticks){const x=((tickTime-domain.minimum)/Math.max(1,domain.maximum-domain.minimum))*2.35-1.175;draw(lineMesh({x,y:-1.04,z:-.09},{x,y:1.04,z:-.09},.004),[.54,.66,.79]);}
   geometryRows.forEach((op,index)=>{const segment=ganttSegment(index,geometryRows,ganttScale),status=op.status.toLowerCase();const rgb=status.includes("complete")?[.12,.62,.42]:status.includes("running")?[.12,.42,.88]:status.includes("hold")?[.83,.27,.35]:op.relationType==="rework"?[.89,.48,.18]:op.relationType==="alternate"?[.18,.49,.86]:[.35,.56,.78];const length=Math.hypot(segment.end.x-segment.start.x,segment.end.y-segment.start.y,segment.end.z-segment.start.z);if(segment.hasStart&&segment.hasEnd&&length>.035)draw(lineMesh(segment.start,segment.end,.071),rgb);if(segment.scheduled){draw(sphereMesh(segment.start.x,segment.start.y,segment.start.z,.052),rgb);if(length>.035)draw(sphereMesh(segment.end.x,segment.end.y,segment.end.z,.052),rgb);}else draw(sphereMesh(segment.center.x,segment.center.y,segment.center.z,.065),[.52,.59,.68]);});
 }
 const pointById=new Map(geometryPoints.map(({op,p})=>[op.id,p]));
 const replacedOperationEdges=new Set([
  ...materialPlacements.filter(item=>item.fromOperation&&item.toOperation).map(item=>item.fromOperation!.id+"->"+item.toOperation!.id),
  ...transportLegPlacements.filter(item=>item.fromOperation&&item.toOperation).map(item=>item.fromOperation!.id+"->"+item.toOperation!.id)
 ]);
 const routeEdges=edges.length?edges:points.slice(0,-1).map((item,i)=>({from:item.op,to:points[i+1].op,relation:"main",color:"#4b95eb"}));
 let flowIndex=0;
 const drawOperationFlow=(p:P,q:P,offset:number,rgb:number[],relation:string="main")=>{
  const delta={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z},length=Math.hypot(delta.x,delta.y,delta.z)||1;
  const planar=Math.hypot(delta.x,delta.y)||1;
  const bend=relation==="feedback"?.52:relation==="parallel"?.32:relation==="merge"||relation==="split"?.26:relation==="conditional"?.22:relation==="dependency"?.18:.14;
  const direction=relation==="feedback"||relation==="alternate"?-1:1;
  const control={x:(p.x+q.x)/2+(-delta.y/planar)*bend*direction,y:(p.y+q.y)/2+(delta.x/planar)*bend*direction,z:(p.z+q.z)/2+(relation==="parallel"?.14:relation==="feedback"?.20:0)};
  const pointAt=(t:number):P=>{const u=1-t;return{x:u*u*p.x+2*u*t*control.x+t*t*q.x,y:u*u*p.y+2*u*t*control.y+t*t*q.y,z:u*u*p.z+2*u*t*control.z+t*t*q.z};};
  const dashed=relation==="rework"||relation==="dependency"||relation==="conditional";
  const segments=16;
  for(let i=0;i<segments;i++){
   if(dashed&&(i%4===1||i%4===2))continue;
   const a=pointAt(i/segments),b=pointAt((i+1)/segments);
   draw(lineMesh(a,b,relation==="parallel"?.026:.035),rgb);
  }
  if(showArrows){
   const tangent={x:q.x-control.x,y:q.y-control.y,z:q.z-control.z},tLen=Math.hypot(tangent.x,tangent.y,tangent.z)||1;
   const tip={x:q.x-tangent.x/tLen*.14,y:q.y-tangent.y/tLen*.14,z:q.z-tangent.z/tLen*.14};
   draw(arrowHeadMesh(tip,q,.095),rgb);
   const phase=((now*.00012+offset*.23)%1+1)%1,particle=pointAt(phase);
   draw(sphereMesh(particle.x,particle.y,particle.z,.045,4,6),[.24,.86,1]);
   if(relation==="conditional"||relation==="merge"||relation==="split"){
    const mid=pointAt(.52);
    draw(sphereMesh(mid.x,mid.y,mid.z,relation==="conditional"?.065:.05,5,7),rgb);
   }
  }
 };
 const drawFlow=(from:P,to:P,offset:number,rgb:number[],radius=.034)=>{
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(delta.x,delta.y,delta.z)||1;
  draw(lineMesh(from,to,radius),rgb);
  if(showArrows){const tip={x:to.x-delta.x/length*.14,y:to.y-delta.y/length*.14,z:to.z-delta.z/length*.14};draw(arrowHeadMesh(tip,to,.09),rgb);const phase=((now*.00012+offset*.23)%1+1)%1;const particle={x:from.x+delta.x*phase,y:from.y+delta.y*phase,z:from.z+delta.z*phase};draw(sphereMesh(particle.x,particle.y,particle.z,.045,4,6),[.24,.86,1]);}
 };
 routeEdges.forEach(edge=>{
  if(replacedOperationEdges.has(edge.from.id+"->"+edge.to.id))return;
  const edgeIndex=flowIndex++;
  let p=pointById.get(edge.from.id),q=pointById.get(edge.to.id);
  if(mode==="gantt"){const fromIndex=geometryRows.findIndex(op=>op.id===edge.from.id),toIndex=geometryRows.findIndex(op=>op.id===edge.to.id);if(fromIndex>=0&&toIndex>=0){p=ganttSegment(fromIndex,geometryRows,ganttScale).end;q=ganttSegment(toIndex,geometryRows,ganttScale).start;}}
  if(!p||!q)return;
  const fallback=edge.relation==="rework"?[.93,.25,.29]:edge.relation==="alternate"?[.95,.61,.12]:[.12,.43,.82];
  const hex=String(edge.color||"").replace("#","");
  const rgb=/^[0-9a-f]{6}$/i.test(hex)?[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255):fallback;
  drawOperationFlow(p,q,edgeIndex,rgb,edge.relation);
 });
 materialPlacements.forEach((placement,index)=>{
  const from=placement.fromOperation?pointById.get(placement.fromOperation.id):undefined;
  const to=placement.toOperation?pointById.get(placement.toOperation.id):undefined;
  const rgb=[.06,.76,.98];
  const hasTransport=hasMaterialTransport(placement.route);
  const startLegs=transportLegPlacements.filter(item=>item.leg.poLineId===placement.route.poLineId&&item.leg.placement==="start"&&!item.leg.anchorOperationId);
  const routeExit=hasTransport?placement.transportPoint:placement.materialPoint;
  if(from)drawFlow(from,placement.materialPoint,index*3,rgb,.037);
  if(hasTransport){
   drawFlow(placement.materialPoint,placement.transportPoint,index*3+1,rgb,.042);
   draw(boxMesh(placement.transportPoint.x,placement.transportPoint.y,placement.transportPoint.z,.105),[.14,.55,.91]);
  }
  if(startLegs.length)startLegs.forEach((leg,legIndex)=>drawFlow(routeExit,leg.point,index*5+legIndex+2,rgb,.032));
  else if(to)drawFlow(routeExit,to,index*3+2,rgb,.037);
  draw(sphereMesh(placement.materialPoint.x,placement.materialPoint.y,placement.materialPoint.z,.13),[.03,.78,.96]);
 });
 transportLegPlacements.forEach((placement,index)=>{
  const from=placement.fromOperation?pointById.get(placement.fromOperation.id):undefined;
  const to=placement.toOperation?pointById.get(placement.toOperation.id):undefined;
  const rgb=placement.leg.relation==="rework"?[.9,.43,.12]:placement.leg.relation==="alternate"?[.18,.49,.88]:[.12,.68,.86];
  if(from)drawFlow(from,placement.point,index*2,rgb,.034);
  if(to)drawFlow(placement.point,to,index*2+1,rgb,.034);
  draw(boxMesh(placement.point.x,placement.point.y,placement.point.z,.115),[.08,.55,.85]);
  draw(sphereMesh(placement.point.x,placement.point.y,placement.point.z,.065),[.12,.79,.94]);
 });
 points.forEach(({p,op})=>{const rgb=operationRgb(op);draw(mode==="cube"||mode==="digital-mesh"||mode==="grid"||mode==="stacked"?boxMesh(p.x,p.y,p.z,.13):sphereMesh(p.x,p.y,p.z,.14),rgb);});anchorPoints.forEach(({point})=>draw(sphereMesh(point.x,point.y,point.z,.085),[.38,.58,.82]));cataloguePoints.forEach(({p,definition})=>{const rgb=definition.displayColor?[.22,.55,.86]:[.24,.5,.78];draw(mode==="cube"||mode==="digital-mesh"?boxMesh(p.x,p.y,p.z,.13):sphereMesh(p.x,p.y,p.z,.14),rgb);});raf=requestAnimationFrame(render);};raf=requestAnimationFrame(render);return()=>cancelAnimationFrame(raf);},[geometryRows,geometryPoints,points,anchorPoints,cataloguePoints,edges,mode,autoRotate,showArrows,ganttScale,materialPlacements,transportLegPlacements]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const ro=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r)setSize({w:r.width,h:r.height});});ro.observe(el);return()=>ro.disconnect();},[]);
 const projectedLayout=useMemo(()=>{
  const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));
  const ops=points.map(({op,p})=>({id:op.id,op,kind:"operation" as const,screen:project(p,m,w,h)})).filter((item):item is {id:string;op:OperationRecord;kind:"operation";screen:ProjectedPoint}=>!!item.screen);
  const materials=materialPlacements.map(item=>({id:item.route.id,screen:project(item.materialPoint,m,w,h)})).filter((item):item is {id:string;screen:ProjectedPoint}=>!!item.screen);
  const transports=materialPlacements.filter(item=>hasMaterialTransport(item.route)).map(item=>({id:item.route.id,screen:project(item.transportPoint,m,w,h)})).filter((item):item is {id:string;screen:ProjectedPoint}=>!!item.screen);
  const transportLegsProjected=transportLegPlacements.map(item=>({id:item.leg.id,screen:project(item.point,m,w,h)})).filter((item):item is {id:string;screen:ProjectedPoint}=>!!item.screen);
  const centerScreen=mode==="sphere"?project({x:0,y:0,z:0},m,w,h):null;
  const all:LabelCandidate[]=[...ops.map(item=>({id:item.id,kind:item.kind,screen:item.screen})),...materials.map(item=>({id:item.id,kind:"material" as const,screen:item.screen})),...transports.map(item=>({id:item.id,kind:"transport" as const,screen:item.screen})),...transportLegsProjected.map(item=>({id:item.id,kind:"transportLeg" as const,screen:item.screen}))];
  const relaxed=relaxLabels(all,w,h);
  return {operations:relaxed.filter(item=>item.kind==="operation").map(item=>({op:ops.find(candidate=>candidate.id===item.id)!.op,screen:item.screen})),materials:relaxed.filter(item=>item.kind==="material").map(item=>({id:item.id,screen:item.screen})),transports:relaxed.filter(item=>item.kind==="transport").map(item=>({id:item.id,screen:item.screen})),transportLegs:relaxed.filter(item=>item.kind==="transportLeg").map(item=>({id:item.id,screen:item.screen})),center:centerScreen};
 },[points,size,angle,materialPlacements,transportLegPlacements,mode]);
 const projected=projectedLayout.operations;
 const projectedMaterials=projectedLayout.materials;
 const projectedTransports=projectedLayout.transports;
 const projectedTransportLegs=projectedLayout.transportLegs;
 const projectedCore=projectedLayout.center;
 const projectedEdges=useMemo(()=>{
  const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));
  const positions=new Map(projected.map(item=>[item.op.id,item.screen]));
  for(const anchor of anchorPoints){const screen=project(anchor.point,m,w,h);if(screen)positions.set(anchor.anchor.operation.id,screen);}
  const materialPosition=new Map(projectedMaterials.map(item=>[item.id,item.screen]));
  const transportPosition=new Map(projectedTransports.map(item=>[item.id,item.screen]));
  const transportLegPosition=new Map(projectedTransportLegs.map(item=>[item.id,item.screen]));
  const result:any[]=[];
  const add=(key:string,fromId:string,toId:string,fromName:string,toName:string,from:ProjectedPoint|undefined|null,to:ProjectedPoint|undefined|null,relation:string)=>{
   if(!from||!to)return;const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(length<7)return;const inset=Math.min(20,length*.2);result.push({key,fromId,toId,from:fromName,to:toName,x:from.x+(dx/length)*inset,y:from.y+(dy/length)*inset,length:Math.max(7,length-inset*2),angle:Math.atan2(dy,dx)*180/Math.PI,relation});
  };
  const routeEdges=edges.length?edges:points.slice(0,-1).map((item,i)=>({from:item.op,to:points[i+1].op,relation:"main",color:"#4b95eb"}));
  const replaced=new Set([
   ...materialPlacements.filter(item=>item.fromOperation&&item.toOperation).map(item=>item.fromOperation!.id+"->"+item.toOperation!.id),
   ...transportLegPlacements.filter(item=>item.fromOperation&&item.toOperation).map(item=>item.fromOperation!.id+"->"+item.toOperation!.id)
  ]);
  routeEdges.forEach(edge=>{if(replaced.has(edge.from.id+"->"+edge.to.id))return;add("op-"+edge.from.id+"-"+edge.to.id,edge.from.id,edge.to.id,edge.from.name,edge.to.name,positions.get(edge.from.id),positions.get(edge.to.id),edge.relation);});
  materialPlacements.forEach(item=>{
   const mat=materialPosition.get(item.route.id),trans=transportPosition.get(item.route.id);
   const from=item.fromOperation?positions.get(item.fromOperation.id):undefined;
   const to=item.toOperation?positions.get(item.toOperation.id):undefined;
   const startLegs=transportLegPlacements.filter(leg=>leg.leg.poLineId===item.route.poLineId&&leg.leg.placement==="start"&&!leg.leg.anchorOperationId);
   const exit=trans||mat;
   if(from&&mat)add("material-in-"+item.route.id,item.fromOperation!.id,"",item.fromOperation!.name,"Material · "+item.route.materialLabel,from,mat,"material");
   if(mat&&trans)add("material-transport-"+item.route.id,"","","Material · "+item.route.materialLabel,"Transport · "+item.route.transporter,mat,trans,"material");
   if(exit&&startLegs.length)startLegs.forEach(leg=>{
    const node=transportLegPosition.get(leg.leg.id);
    if(node)add("material-start-transport-"+item.route.id+"-"+leg.leg.id,"","__transport_leg__"+leg.leg.id,"Material · "+item.route.materialLabel,"Transport · "+leg.leg.fromLocation+" → "+leg.leg.toLocation,exit,node,"material");
   });
   else if(exit&&to&&!trans)add("material-process-"+item.route.id,"",item.toOperation!.id,"Material · "+item.route.materialLabel,item.toOperation!.name,exit,to,"material");
   else if(trans&&to&&!startLegs.length)add("transport-process-"+item.route.id,"__transport__"+item.route.id,item.toOperation!.id,"Transport · "+item.route.transporter,item.toOperation!.name,trans,to,"material");
  });
  transportLegPlacements.forEach(item=>{
   const node=transportLegPosition.get(item.leg.id);
   const from=item.fromOperation?positions.get(item.fromOperation.id):undefined;
   const to=item.toOperation?positions.get(item.toOperation.id):undefined;
   const relation=item.leg.relation;
   if(from&&node)add("operation-transport-"+item.leg.id,item.fromOperation!.id,"__transport_leg__"+item.leg.id,item.fromOperation!.name,"Transport · "+item.leg.fromLocation+" → "+item.leg.toLocation,from,node,relation);
   if(node&&to)add("transport-operation-"+item.leg.id,"__transport_leg__"+item.leg.id,item.toOperation!.id,"Transport · "+item.leg.fromLocation+" → "+item.leg.toLocation,item.toOperation!.name,node,to,relation);
  });
  return result;
 },[projected,projectedMaterials,projectedTransports,projectedTransportLegs,materialPlacements,transportLegPlacements,edges,points,anchorPoints,size,angle]);
 const projectedGanttTicks=useMemo(()=>{if(mode!=="gantt")return[];const domain=ganttDomain(geometryRows,ganttScale);if(!domain.hasEvents)return[];const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));return domain.ticks.map(value=>{const x=((value-domain.minimum)/Math.max(1,domain.maximum-domain.minimum))*2.35-1.175;const screen=project({x,y:-1.08,z:-.09},m,w,h);const date=new Date(value);const label=date.toLocaleDateString("en-IN",ganttScale==="month"?{month:"short",year:"2-digit"}:{day:"2-digit",month:"short"});return screen?{key:String(value),x:screen.x,label}:null;}).filter(Boolean);},[mode,geometryRows,ganttScale,size,angle]);
 const projectedCatalogue=useMemo(()=>{const w=size.w,h=size.h,proj=perspective(.82,w/Math.max(1,h),.1,30),rot=rotation(-.24,angle),view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.8,1],m=matMul(proj,matMul(view,rot));return cataloguePoints.map(({definition,p})=>({definition,screen:project(p,m,w,h)}));},[cataloguePoints,size,angle]);
  const ganttStatus=useMemo(()=>{if(mode!=="gantt")return "";const domain=ganttDomain(geometryRows,ganttScale);const unscheduled=geometryRows.filter(op=>!(timestamp(op.plannedStart)??timestamp(op.actualStart))&&!(timestamp(op.plannedEnd)??timestamp(op.actualEnd))).length;const incomplete=geometryRows.filter(op=>!(timestamp(op.plannedStart)??timestamp(op.actualStart))||!(timestamp(op.plannedEnd)??timestamp(op.actualEnd))).length;return !domain.hasEvents?"NO SCHEDULE DATES · "+unscheduled+" UNSCHEDULED":incomplete?"INCOMPLETE SCHEDULE · "+incomplete+" OPERATION(S)":"";},[mode,geometryRows,ganttScale]);
 return <div className="ax-full3d-scene" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,angle:rotationRef.current};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}} onPointerMove={e=>{if(drag.current){rotationRef.current=drag.current.angle+(e.clientX-drag.current.x)*.008;setAngle(rotationRef.current);}}} onPointerUp={()=>{drag.current=null;setDragging(false);}} onPointerCancel={()=>{drag.current=null;setDragging(false);}}>
  <canvas ref={canvas} aria-label="Interactive WebGL 3D manufacturing process graph"/>
  <div className="ax-full3d-label-layer">{projectedCore&&mode==="sphere"&&<div className="ax-full3d-core-label" style={{left:projectedCore.x,top:projectedCore.y}}><strong>AXIMACH</strong><small>MANUFACTURING FLOW</small></div>}
   {ganttStatus&&<div className="ax-full3d-gantt-status">{ganttStatus}</div>}
   {projectedGanttTicks.map(tick=>tick&&<div key={tick.key} className="ax-full3d-gantt-tick" style={{left:tick.x}}>{tick.label}</div>)}
   {projectedEdges.map(edge=><div key={edge.key} role="button" tabIndex={0} className={"ax-full3d-route-arrow "+(edge.relation==="rework"?"rework":edge.relation==="alternate"?"alternate":edge.relation==="material"?"material":"main")+(showArrows?"":" no-arrowhead")} style={{left:edge.x,top:edge.y,width:edge.length,transform:"rotate("+edge.angle+"deg)"}} aria-label={"Follow route from "+edge.from+" to "+edge.to} title={"Route: "+edge.from+" → "+edge.to} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();if(edge.toId)onArrowSelect?.(edge.toId);}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();if(edge.toId)onArrowSelect?.(edge.toId);}}}><span>{edge.from} → {edge.to}</span></div>)}
   {projectedMaterials.map((item,index)=>{const route=materialRoutes.find(row=>row.id===item.id);if(!route)return null;return <div key={"material-card-"+item.id} className="ax-full3d-label ax-full3d-material-label" style={{left:item.screen.x,top:item.screen.y}} onPointerDown={event=>event.stopPropagation()}>
     <small>MATERIAL PROCUREMENT · {index+1}/{materialRoutes.length}</small><strong>{route.partLabel}</strong><em>{route.materialLabel}</em>
     {visibleFields.includes("company")&&<small>Company · {route.companyLabel||"Not linked"}</small>}
     {visibleFields.includes("po")&&<small>PO · {route.poLabel||"—"}</small>}
     {visibleFields.includes("component")&&<small>Component · {route.componentLabel||"—"}</small>}
     {visibleFields.includes("materialShape")&&<small>{route.dimensionsLabel||"Shape / dimensions not entered"}</small>}
     {visibleFields.includes("materialDensity")&&<small>Density {route.densityKgM3?route.densityKgM3.toLocaleString("en-IN")+" kg/m³":"Not set"}</small>}
     {visibleFields.includes("materialQuantity")&&<small>Qty {route.quantity.toLocaleString("en-IN")}</small>}
     {visibleFields.includes("materialWeight")&&<small>Weight {route.weightKg.toFixed(3)} kg</small>}
     {visibleFields.includes("materialVendor")&&<small>Supplier {route.supplier}</small>}
     {visibleFields.includes("materialGiven")&&<small>Given {nodeDateTime(route.materialGivenAt)}</small>}
     {visibleFields.includes("materialDelivery")&&<small>Expected delivery {nodeDateTime(route.materialDueAt)}</small>}
     {visibleFields.includes("materialReceived")&&<small>Received {nodeDateTime(route.materialReceivedAt)}</small>}
     {visibleFields.includes("materialCost")&&<small>₹{route.materialRate.toLocaleString("en-IN",{maximumFractionDigits:2})}/{route.priceUnit} · Material {route.materialCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</small>}
     {visibleFields.includes("materialCuttingCost")&&<small>{route.cuttingType||"No cutting"} · Cutting ₹{route.cuttingCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</small>}
   </div>;})}
   {projectedTransports.map((item,index)=>{const route=materialRoutes.find(row=>row.id===item.id);if(!route)return null;return <div key={"transport-card-"+item.id} className="ax-full3d-label ax-full3d-transport-label" style={{left:item.screen.x,top:item.screen.y}} onPointerDown={event=>event.stopPropagation()}>
     <small>INBOUND TRANSPORT · {index+1}/{materialRoutes.length}</small><strong>{route.transporter||"Transporter not assigned"}</strong>
     {visibleFields.includes("transportRoute")&&<small>{route.from||"Pickup not set"} → {route.to||"Delivery not set"}</small>}
     {visibleFields.includes("vehicle")&&<small>{route.vehicle||"Vehicle not set"} · {route.status||"Planned"}</small>}
     {visibleFields.includes("transportVendor")&&<small>Transporter {route.transporter||"Not assigned"}</small>}
     {visibleFields.includes("transportPickup")&&<small>Pickup {nodeDateTime(route.pickupAt)}</small>}
     {visibleFields.includes("transportDelivery")&&<small>Delivery {nodeDateTime(route.deliveryAt)}</small>}
     {visibleFields.includes("materialTransportCost")&&<small>Transport ₹{route.transportCost.toLocaleString("en-IN",{maximumFractionDigits:2})}</small>}
   </div>;})}
    {projectedTransportLegs.map((item,index)=>{const leg=transportLegs.find(row=>row.id===item.id);if(!leg)return null;return <button type="button" key={"transport-leg-card-"+item.id} className="ax-full3d-label ax-full3d-transport-leg-label" style={{left:item.screen.x,top:item.screen.y}} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onSelectTransportLeg?.(leg.id);}} aria-label={"Edit transport leg "+leg.fromLocation+" to "+leg.toLocation}>
      <small><Truck size={12}/> TRANSPORT LEG · {index+1}/{transportLegs.length}</small><strong>{leg.vendorName||"Transporter not assigned"}</strong>
      <small>{leg.fromLocation||"From not set"} → {leg.toLocation||"To not set"}</small>
      <small>{leg.vehicleType||"Vehicle not set"} · {leg.tripDirection} · {leg.tripCount} trip(s)</small>
      <small>Pickup {nodeDateTime(leg.pickupAt)} → Delivery {nodeDateTime(leg.deliveryAt)} · {leg.status||"Planned"}</small>
      <em>₹{leg.amount.toLocaleString("en-IN",{maximumFractionDigits:2})}</em>
    </button>;})}
   {projected.map(({op,screen})=>screen&&<button key={op.id} type="button" className={"ax-full3d-label"+(selectedOperationId===op.id?" selected":"")} style={{left:screen.x,top:screen.y}} onPointerDown={e=>e.stopPropagation()} onClick={()=>{onSelectOperation(op.id);onExpandOperation?.(op.id);}} aria-controls="process-orbit-selected-details" aria-expanded={expandedOperationId===op.id} aria-label={"Open details for "+op.name+" · "+operationCode(op)} title={operationCode(op)+" · "+op.name+" · "+nodeDateTime(op.plannedStart)+" → "+nodeDateTime(op.plannedEnd)}>
     <small>{operationCode(op)}{visibleFields.includes("status")?" · "+op.status:""}</small><strong>{op.name}</strong>
     <small>CATEGORY · {op.category||"Not set"}</small>
     <small>SUB-PROCESS · {op.subcategory||"Not set"}</small>
     <em>Qty {op.quantity.toLocaleString("en-IN")} {quantityUnit}</em>
     <small className="ax-full3d-node-meta">Given / start · {nodeDateTime(op.plannedStart)}</small>
     <small className="ax-full3d-node-meta">Delivery / due · {nodeDateTime(op.plannedEnd)}</small>
     <small className="ax-full3d-node-meta">Vendor · {vendors.find(vendor=>vendor.id===op.vendorId)?.company||"Vendor not assigned"}</small>
     {visibleFields.includes("price")&&<small className="ax-full3d-node-meta">Rate · ₹{(op.actualRatePerPart>0?op.actualRatePerPart:op.ratePerPart).toLocaleString("en-IN",{maximumFractionDigits:2})}/{quantityUnit==="sets"?"set":"piece"}</small>}
     <small className="ax-full3d-node-meta">Linked amount · ₹{(op.quantity*(op.actualRatePerPart>0?op.actualRatePerPart:op.ratePerPart)).toLocaleString("en-IN",{maximumFractionDigits:2})}</small>
   </button>)}
   {projectedCatalogue.map(({definition,screen},index)=>screen&&<button key={definition.id} type="button" className="ax-full3d-label ax-full3d-catalogue-label" style={{left:screen.x,top:screen.y}} onPointerDown={e=>e.stopPropagation()} onClick={()=>onAddCatalogue?.(definition.id)} disabled={!onAddCatalogue} aria-label={"Add "+definition.processType+" to this PO line"}><small>LIB-{String(index+1).padStart(2,"0")}</small><strong>{definition.processType}</strong><em>{definition.category} · ADD STAGE</em></button>)}
  </div>
  <div className="ax-full3d-controls"><span>{dragging?"DRAGGING · TRUE 3D VIEW":mode.toUpperCase()+" · WEBGL 3D · "+(autoRotate?"AUTO ROTATING":"ROTATION PAUSED")}</span></div>
 </div>;
}