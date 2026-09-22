import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signIn, signUp, signOut } from "../lib/auth";
import { api } from "../lib/apiAuth";
import { useClapDetector, useDeviceLocation } from "./useSafetySensors";

export default function usePhase4Core(){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),[contacts,setContacts]=useState([]),[history,setHistory]=useState([]);
  const [active,setActive]=useState(()=>localStorage.getItem("voiceprint-protection")!=="false"),[open,setOpen]=useState(false),[event,setEvent]=useState(null),[source,setSource]=useState("manual"),[error,setError]=useState(""),[authMsg,setAuthMsg]=useState("");
  const [sosWatch,setSosWatch]=useState(false),last=useRef(0);

  const {listening,clapCount,micError,start:startMic,stop:stopMic}=useClapDetector(()=>startFlow("three-clap"));
  const {location,locationError,watching,startWatching,stopWatching}=useDeviceLocation();

  useEffect(()=>{getCurrentUser().then(setUser).catch(()=>{}).finally(()=>setReady(true))},[]);
  const refresh=useCallback(async()=>{if(!user)return;const [c,h]=await Promise.all([api("/api/v1/contacts"),api("/api/v1/history")]);setContacts((c.contacts||[]).map(x=>({id:x.id,name:x.name,phone:x.phone_e164,relationship:x.relationship})));setHistory(h.events||[])},[user]);
  useEffect(()=>{if(user)refresh().catch(e=>setError(e.message));else setContacts([])},[user,refresh]);
  useEffect(()=>{localStorage.setItem("voiceprint-protection",String(active));if(!active)stopMic()},[active,stopMic]);

  const startFlow=useCallback((src)=>{if(!active||open)return;setSource(src);setOpen(true);setEvent(null);setError("");setSosWatch(true);last.current=0;stopMic();startWatching();if(!user)return;api("/api/v1/sos/events",{method:"POST",headers:{"Idempotency-Key":globalThis.crypto?.randomUUID?.()||String(Date.now())},body:JSON.stringify({source:src,location,device_id:localStorage.getItem("voiceprint-device-id")||String(Date.now())})}).then(r=>setEvent(r.event)).catch(e=>setError(e.message))},[active,open,user,location,startWatching,stopMic]);
  useEffect(()=>{if(!open||!event?.id||!location||Date.now()-last.current<5000)return;last.current=Date.now();api("/api/v1/sos/events/"+encodeURIComponent(event.id)+"/location",{method:"POST",body:JSON.stringify({location})}).then(r=>setEvent(r.event)).catch(e=>setError(e.message))},[open,event?.id,location]);

  const closeFlow=useCallback(async()=>{if(event?.id){try{const r=await api("/api/v1/sos/events/"+encodeURIComponent(event.id)+"/cancel",{method:"POST"});setEvent(r.event);await refresh()}catch(e){setError(e.message)}}if(sosWatch)stopWatching();setSosWatch(false);setOpen(false)},[event,sosWatch,stopWatching,refresh]);
  const finish=useCallback(async()=>{if(!event?.id)return;try{const r=await api("/api/v1/sos/events/"+encodeURIComponent(event.id)+"/dispatch",{method:"POST"});setEvent(r.event);await refresh()}catch(e){setError(e.message)}},[event,refresh]);
  const add=useCallback(async(c)=>{if(!user)throw new Error("Sign in from Settings first.");const r=await api("/api/v1/contacts",{method:"POST",body:JSON.stringify({name:c.name,phone_e164:c.phone,relationship:c.relationship})});const x=r.contact;setContacts(v=>[...v,{id:x.id,name:x.name,phone:x.phone_e164,relationship:x.relationship}])},[user]);
  const remove=useCallback(async(id)=>{await api("/api/v1/contacts/"+encodeURIComponent(id),{method:"DELETE"});setContacts(v=>v.filter(x=>x.id!==id))},[]);
  const auth=useCallback(async(mode,email,password)=>{try{const r=mode==="signup"?await signUp(email,password):await signIn(email,password);if(mode==="signup"&&!r?.access_token){setAuthMsg("Account created. Confirm email if required.");return}setUser(await getCurrentUser());setAuthMsg("Signed in successfully.")}catch(e){setAuthMsg(e.message)}},[]);
  const logout=useCallback(async()=>{await signOut();setUser(null);setContacts([]);setHistory([]);setAuthMsg("Signed out.")},[]);

  return {ready,user,contacts,history,active,setActive,open,event,source,error,setError,authMsg,auth,logout,listening,clapCount,micError,location,locationError,watching,sosWatch,startFlow,closeFlow,finish,startMic,stopMic,startWatching,stopWatching,add,remove,refresh};
}
