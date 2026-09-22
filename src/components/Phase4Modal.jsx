import { useEffect, useState } from "react";

export default function Phase4Modal({event,user,location,onClose,onFinish}){
  const [seconds,setSeconds]=useState(10);
  const [started,setStarted]=useState(false);

  useEffect(()=>{
    if(event?.id && !started){
      setStarted(true);
      setSeconds(10);
    }
  },[event?.id,started]);

  useEffect(()=>{
    if(!started || seconds===0) return;
    const timer=setInterval(()=>setSeconds((value)=>Math.max(value-1,0)),1000);
    return ()=>clearInterval(timer);
  },[started,seconds]);

  useEffect(()=>{
    if(started && seconds===0 && user && event?.id && event.status==="pending"){
      onFinish();
    }
  },[started,seconds,user,event?.id,event?.status,onFinish]);

  const done=event?.status==="dispatched" || event?.status==="cancelled";
  return <div className="sos-overlay"><div className="sos-modal">
    <div className="sos-modal-icon">✦</div>
    <span className="danger-label">VOICEPRINT</span>
    <h2>{event?.status==="cancelled" ? "Event cancelled" : event?.status==="dispatched" ? "Alert processed" : "Emergency flow active"}</h2>
    <p>{!user ? "Local demo mode. Sign in to enable cloud alerts." : event ? "Your cloud SOS event is active." : "Creating your secure SOS event…"}</p>
    <div className="sos-summary">
      <div><span>LOCATION</span><strong>{location ? location.latitude.toFixed(5)+", "+location.longitude.toFixed(5) : "Waiting"}</strong></div>
      <div><span>ACCOUNT</span><strong>{user ? "Signed in" : "Local"}</strong></div>
      <div><span>STATUS</span><strong>{event?.status || "creating"}</strong></div>
    </div>
    <div className="countdown">{done ? "✓" : event ? seconds : "…" }<small>{done || !event ? "" : " sec"}</small></div>
    <div className="alert-list">
      <div><span>{event ? "✓" : "!"}</span>{event ? "Cloud SOS event created" : "Waiting for backend event"}</div>
      <div><span>{location ? "✓" : "!"}</span>{location ? "Current coordinates available" : "Location unavailable"}</div>
      <div><span>{event?.status==="dispatched" ? "✓" : "!"}</span>{event?.status==="dispatched" ? (event.delivery?.message || "Alert processed.") : "Public emergency-service connection is not enabled."}</div>
    </div>
    <button className="cancel-btn wide" onClick={onClose}>{done ? "Close" : "Cancel"}</button>
  </div></div>;
}
