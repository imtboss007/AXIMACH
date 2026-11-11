export type TransportPopupAnchor={x:number;y:number};
export function transportPopupAnchorFromPoint(left:number,top:number,width=32,height=32):TransportPopupAnchor{
 const popupWidth=Math.min(360,Math.max(280,window.innerWidth-16));
 const popupHeight=Math.min(520,Math.max(260,window.innerHeight*.68));
 return {
  x:Math.max(8,Math.min(left+width/2-popupWidth/2,window.innerWidth-popupWidth-8)),
  y:Math.max(8,Math.min(top+height/2,window.innerHeight-popupHeight-8))
 };
}
export function transportPopupAnchor(element:HTMLElement):TransportPopupAnchor{
 const rect=element.getBoundingClientRect();
 return transportPopupAnchorFromPoint(rect.left,rect.top,rect.width,rect.height);
}
