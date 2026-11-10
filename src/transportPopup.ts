export type TransportPopupAnchor={x:number;y:number};
export function transportPopupAnchor(element:HTMLElement):TransportPopupAnchor{
 const rect=element.getBoundingClientRect();
 const width=Math.min(360,Math.max(280,window.innerWidth-16));
 const height=Math.min(520,Math.max(260,window.innerHeight*.68));
 return {
  x:Math.max(8,Math.min(rect.left+rect.width/2-width/2,window.innerWidth-width-8)),
  y:Math.max(8,Math.min(rect.top+rect.height/2,window.innerHeight-height-8))
 };
}
