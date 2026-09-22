import { useEffect, useState } from "react";

export default function Phase4Modal({event,user,location,onClose,onFinish}){
  const [seconds,setSeconds]=useState(10);
  useEffect(()=>{const t=setInterval(()=>setSeconds(v=>Math.max(v-1,0)),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(seconds===0&&user&&event?.id&&event.status==="pending")onFinish()},[seconds,user,event?.id,event?.status,onFinish]);
  const done=event?.status==="dispatched"||event?.status==="cancelled";
  return <div className="sos-overlay"><div className="sos-modal"><div className="sos-modal-icon">✦</div><span className="danger-label">VOICEPRINT</span><h2>{done?"Processed":"Active"}</h2><p>{user?"Cloud event is active.":"Local demo is active."}</p><div className="sos-summary"><div><span>LOCATION</span><strong>{location?location.latitude.toFixed(5)+", "+location.longitude.toFixed(5):"Waiting"}</strong></div><div><span>ACCOUNT</span><strong>{user?"Signed in":"Local"}</strong></div><div><span>STATUS</span><strong>{event?.status||"waiting"}</strong></div></div><div className="countdown">{done?"✓":seconds}<small>{done?"":" sec"}</small></div><button className="cancel-btn wide" onClick={onClose}>{done?"Close":"Cancel"}</button></div></div>;
}
