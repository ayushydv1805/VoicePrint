import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import twilio from "twilio";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const ALERT_COOLDOWN_MS = Math.max(0, Number(process.env.ALERT_COOLDOWN_SECONDS || 30) * 1000);
const LOCATION_UPDATE_MIN_MS = Math.max(1000, Number(process.env.LOCATION_UPDATE_MIN_SECONDS || 5) * 1000);
const isProd = process.env.NODE_ENV === "production";

const origins = new Set((process.env.CORS_ORIGINS || "").split(",").map((v)=>v.trim()).filter(Boolean));
const allowOrigin = (origin) =>
  !origin ||
  origins.has(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
  /^https:\/\/voice-print-[a-z0-9-]+-ayush0018\.vercel\.app$/.test(origin) ||
  origin === "https://voice-print-eight.vercel.app";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy:false }));
app.use(cors({ origin:(origin,cb)=>allowOrigin(origin)?cb(null,true):cb(new Error("Origin is not allowed.")), credentials:true, methods:["GET","POST","PATCH","DELETE"], allowedHeaders:["Content-Type","Idempotency-Key"], maxAge:86400 }));
app.use(express.json({limit:"32kb"}));
app.use("/api",rateLimit({windowMs:60000,limit:120,standardHeaders:"draft-8",legacyHeaders:false}));
app.use("/api/v1/sos",rateLimit({windowMs:600000,limit:12,standardHeaders:"draft-8",legacyHeaders:false}));

const lastSosByUser = new Map();
const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
const smsClient = smsConfigured ? twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN) : null;

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((p)=>p.trim()).filter(Boolean).map((p)=>{
    const i=p.indexOf("="); return i<0 ? [p,""] : [p.slice(0,i),decodeURIComponent(p.slice(i+1))];
  }));
}
function setSession(res,access,refresh) {
  const common=`Path=/; HttpOnly; SameSite=Lax${isProd?"; Secure":""}`;
  res.setHeader("Set-Cookie",[`vp_access=${encodeURIComponent(access)}; Max-Age=3600; ${common}`,`vp_refresh=${encodeURIComponent(refresh)}; Max-Age=2592000; ${common}`]);
}
function clearSession(res) {
  const common=`Path=/; HttpOnly; SameSite=Lax${isProd?"; Secure":""}`;
  res.setHeader("Set-Cookie",[`vp_access=; Max-Age=0; ${common}`,`vp_refresh=; Max-Age=0; ${common}`]);
}
async function supabaseAuth(path,body,authHeader) {
  const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
  if(authHeader) headers.Authorization=authHeader;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method:"POST",headers,body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(payload?.msg||payload?.message||payload?.error_description||"Authentication request failed.");e.status=response.status;throw e;}
  return payload;
}
async function currentUser(req,res) {
  const c=cookies(req); if(!c.vp_access){return null;}
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${c.vp_access}`}});
  if(response.ok)return {user:await response.json(),token:c.vp_access};
  if(c.vp_refresh){
    try {
      const next=await supabaseAuth("token?grant_type=refresh_token",{refresh_token:c.vp_refresh});
      setSession(res,next.access_token,next.refresh_token||c.vp_refresh);
      return {user:next.user,token:next.access_token};
    } catch {}
  }
  clearSession(res);
  return null;
}
async function requireUser(req,res){const auth=await currentUser(req,res);if(!auth){res.status(401).json({ok:false,error:"Sign in is required for cloud VoicePrint features."});return null;}return auth;}

async function db(table,{method="GET",query="",body},token){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`,{
    method,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"return=representation"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const raw=await response.text(); const data=raw?JSON.parse(raw):null;
  if(!response.ok){const e=new Error(data?.message||data?.hint||"Database request failed.");e.status=response.status;throw e;}
  return data;
}
function contact(value){
  const name=typeof value?.name==="string"?value.name.trim().slice(0,80):"";
  const phone=typeof value?.phone_e164==="string"?value.phone_e164.trim():"";
  const relationship=typeof value?.relationship==="string"?value.relationship.trim().slice(0,40):"Other";
  if(!name||!/^\+[1-9][0-9]{7,14}$/.test(phone))return null;
  return {name,phone_e164:phone,relationship:relationship||"Other"};
}
function location(value){
  const latitude=Number(value?.latitude),longitude=Number(value?.longitude),accuracy=Number(value?.accuracy);
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return null;
  return {latitude,longitude,accuracy_m:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,captured_at:new Date().toISOString()};
}
function eventView(row){
  return {
    id:row.id,source:row.source,status:row.status,createdAt:row.created_at,
    dispatchedAt:row.dispatched_at,cancelledAt:row.cancelled_at,
    location:row.latitude==null?null:{latitude:row.latitude,longitude:row.longitude,accuracy:row.accuracy_m,timestamp:row.location_captured_at?Date.parse(row.location_captured_at):null},
    contactsCount:row.contacts_count,
    delivery:{mode:row.delivery_mode||"pending",message:row.delivery_summary||""}
  };
}
function smsText(row){
  const loc=row.latitude==null?"Location unavailable.":`Location: ${row.latitude}, ${row.longitude}. Map: https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
  return [ "VOICEPRINT SOS ALERT", `Trigger: ${row.source==="three-clap"?"3-clap pattern":"manual SOS"}`, loc, "Please check on the VoicePrint user. This alert does not itself contact emergency services." ].join("\n");
}

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"voiceprint-api",version:"phase-4",time:new Date().toISOString(),smsConfigured,authRequired:true}));
app.get("/api/v1/status",(_req,res)=>res.json({ok:true,phase:"4",features:{authentication:true,persistentContacts:true,sosHistory:true,liveLocation:true,trustedContactSms:smsConfigured,emergencyServicesDispatch:false}}));

app.post("/api/v1/auth/signup",async(req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return res.status(400).json({ok:false,error:"Enter a valid email and a password with at least 8 characters."});
    const body=await supabaseAuth("signup",{email,password});
    if(body.access_token&&body.refresh_token)setSession(res,body.access_token,body.refresh_token);
    return res.json({ok:true,user:body.user||null,needsConfirmation:!body.access_token});
  }catch(e){return res.status(e.status===400?400:502).json({ok:false,error:e.message});}
});
app.post("/api/v1/auth/signin",async(req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
    const body=await supabaseAuth("token?grant_type=password",{email,password});
    setSession(res,body.access_token,body.refresh_token);
    return res.json({ok:true,user:body.user});
  }catch(e){return res.status(e.status===400?400:401).json({ok:false,error:e.message});}
});
app.get("/api/v1/auth/me",async(req,res)=>{
  const auth=await currentUser(req,res); return res.json({ok:true,user:auth?.user||null});
});
app.post("/api/v1/auth/logout",async(req,res)=>{
  const c=cookies(req);
  if(c.vp_access){await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${c.vp_access}`}}).catch(()=>{});}
  clearSession(res); return res.json({ok:true});
});

app.get("/api/v1/contacts",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  try{return res.json({ok:true,contacts:await db("trusted_contacts",{query:`?select=id,name,phone_e164,relationship,created_at,updated_at&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.asc`},auth.token)});}
  catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.post("/api/v1/contacts",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;const c=contact(req.body);if(!c)return res.status(400).json({ok:false,error:"Valid name and E.164 phone number are required."});
  try{const data=await db("trusted_contacts",{method:"POST",body:{...c,user_id:auth.user.id}},auth.token);return res.status(201).json({ok:true,contact:data?.[0]});}
  catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.delete("/api/v1/contacts/:id",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  try{await db("trusted_contacts",{method:"DELETE",query:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`},auth.token);return res.json({ok:true});}
  catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.get("/api/v1/history",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  try{const rows=await db("sos_events",{query:`?select=*&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=50`},auth.token);return res.json({ok:true,events:(rows||[]).map(eventView)});}
  catch(e){return res.status(502).json({ok:false,error:e.message});}
});

app.post("/api/v1/sos/events",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  const prev=lastSosByUser.get(auth.user.id)||0;
  if(Date.now()-prev<ALERT_COOLDOWN_MS){const retry=Math.ceil((ALERT_COOLDOWN_MS-(Date.now()-prev))/1000);res.set("Retry-After",String(retry));return res.status(429).json({ok:false,error:`Please wait ${retry}s before creating another SOS event.`});}
  const loc=location(req.body?.location);
  try{
    const contacts=await db("trusted_contacts",{query:`?select=name,phone_e164,relationship&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.asc&limit=5`},auth.token);
    const inserted=await db("sos_events",{method:"POST",body:{
      user_id:auth.user.id,source:req.body?.source==="three-clap"?"three-clap":"manual",status:"pending",
      device_id:typeof req.body?.device_id==="string"?req.body.device_id.slice(0,128):null,
      latitude:loc?.latitude??null,longitude:loc?.longitude??null,accuracy_m:loc?.accuracy_m??null,location_captured_at:loc?.captured_at??null,
      contacts_count:contacts.length,delivery_summary:"10-second confirmation window started."
    }},auth.token);
    const event=inserted?.[0];if(!event)throw new Error("Could not create SOS event.");
    if(loc)await db("sos_event_locations",{method:"POST",body:{event_id:event.id,user_id:auth.user.id,latitude:loc.latitude,longitude:loc.longitude,accuracy_m:loc.accuracy_m,captured_at:loc.captured_at}},auth.token);
    if(contacts.length)await db("sos_event_deliveries",{method:"POST",body:contacts.map((c)=>({event_id:event.id,user_id:auth.user.id,contact_name:c.name,phone_e164:c.phone_e164,status:"pending"}))},auth.token);
    lastSosByUser.set(auth.user.id,Date.now());
    return res.status(201).json({ok:true,event:eventView(event)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.post("/api/v1/sos/events/:id/location",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;const loc=location(req.body?.location);if(!loc)return res.status(400).json({ok:false,error:"Valid location is required."});
  try{
    const rows=await db("sos_events",{query:`?select=id,status&user_id=eq.${encodeURIComponent(auth.user.id)}&id=eq.${encodeURIComponent(req.params.id)}`},auth.token);
    if(!rows?.[0])return res.status(404).json({ok:false,error:"SOS event not found."});
    if(rows[0].status==="cancelled")return res.status(409).json({ok:false,error:"SOS is cancelled."});
    await db("sos_event_locations",{method:"POST",body:{event_id:req.params.id,user_id:auth.user.id,latitude:loc.latitude,longitude:loc.longitude,accuracy_m:loc.accuracy_m,captured_at:loc.captured_at}},auth.token);
    const updated=await db("sos_events",{method:"PATCH",query:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,body:{latitude:loc.latitude,longitude:loc.longitude,accuracy_m:loc.accuracy_m,location_captured_at:loc.captured_at}},auth.token);
    return res.json({ok:true,event:eventView(updated[0])});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.post("/api/v1/sos/events/:id/dispatch",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  try{
    const rows=await db("sos_events",{query:`?select=*&id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`},auth.token);
    const event=rows?.[0];if(!event)return res.status(404).json({ok:false,error:"SOS event not found."});
    if(event.status==="cancelled")return res.status(409).json({ok:false,error:"This SOS was cancelled."});
    const contacts=await db("sos_event_deliveries",{query:`?select=*&event_id=eq.${encodeURIComponent(event.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`},auth.token);
    let sent=0,failed=0,mode="not_configured",summary=smsConfigured?"No trusted contacts were configured.":"SMS provider is not configured on the backend.";
    if(smsConfigured&&contacts.length){
      mode="twilio";
      const results=await Promise.allSettled(contacts.map((c)=>smsClient.messages.create({body:smsText(event),from:process.env.TWILIO_FROM_NUMBER,to:c.phone_e164})));
      for(let i=0;i<results.length;i+=1){
        if(results[i].status==="fulfilled"){sent+=1;await db("sos_event_deliveries",{method:"PATCH",query:`?id=eq.${encodeURIComponent(contacts[i].id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,body:{status:"sent",provider:"twilio",provider_message_id:results[i].value.sid,sent_at:new Date().toISOString()}},auth.token);}
        else{failed+=1;await db("sos_event_deliveries",{method:"PATCH",query:`?id=eq.${encodeURIComponent(contacts[i].id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,body:{status:"failed",provider:"twilio",error_message:results[i].reason?.message||"SMS failed"}},auth.token);}
      }
      summary=`${sent} SMS sent, ${failed} failed.`;
    }
    const updated=await db("sos_events",{method:"PATCH",query:`?id=eq.${encodeURIComponent(event.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,body:{status:"dispatched",delivery_mode:mode,delivery_summary:summary,dispatched_at:new Date().toISOString()}},auth.token);
    const view=eventView(updated[0]||event);view.delivery={mode,attempted:smsConfigured&&contacts.length>0,sent,failed,message:summary};
    return res.json({ok:true,event:view});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
});
app.post("/api/v1/sos/events/:id/cancel",async(req,res)=>{
  const auth=await requireUser(req,res);if(!auth)return;
  try{
    const rows=await db("sos_events",{query:`?select=*&id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`},auth.token);
    const event=rows?.[0];if(!event)return res.status(404).json({ok:false,error:"SOS event not found."});
    if(event.status==="dispatched")return res.status(409).json({ok:false,error:"Already dispatched."});
    const updated=await db("sos_events",{method:"PATCH",query:`?id=eq.${encodeURIComponent(event.id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,body:{status:"cancelled",cancelled_at:new Date().toISOString(),delivery_summary:"Cancelled before dispatch."}},auth.token);
    return res.json({ok:true,event:eventView(updated[0]||event)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
});

app.use((error,_req,res,_next)=>res.status(403).json({ok:false,error:error?.message||"Request blocked."}));
app.listen(PORT,()=>console.log(`VoicePrint Phase 4 API listening on port ${PORT}`));
