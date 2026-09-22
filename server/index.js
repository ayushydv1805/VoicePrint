import "dotenv/config";
import crypto from "node:crypto";
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
const CONFIRMATION_WINDOW_MS = Math.max(0, Number(process.env.CONFIRMATION_WINDOW_SECONDS || 10) * 1000);

app.disable("x-powered-by");
app.set("trust proxy", 1);

const origins = new Set(
  (process.env.CORS_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean)
);
const allowedOrigin = (origin) =>
  !origin ||
  origins.has(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
  /^https:\/\/voice-print-[a-z0-9-]+-ayush0018\.vercel\.app$/.test(origin) ||
  origin === "https://voice-print-eight.vercel.app";

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (origin, cb) => allowedOrigin(origin) ? cb(null, true) : cb(new Error("Origin is not allowed.")), methods:["GET","POST","PATCH","DELETE"], allowedHeaders:["Content-Type","X-VoicePrint-Device","Authorization","Idempotency-Key"], maxAge:86400 }));
app.use(express.json({ limit:"32kb" }));
app.use("/api", rateLimit({ windowMs:60000, limit:120, standardHeaders:"draft-8", legacyHeaders:false }));
app.use("/api/v1/sos", rateLimit({ windowMs:600000, limit:12, standardHeaders:"draft-8", legacyHeaders:false }));

const lastSosByUser = new Map();
const eventLocks = new Map();

const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
const smsClient = smsConfigured ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

async function authenticatedUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: header },
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireUser(req, res) {
  const user = await authenticatedUser(req);
  if (!user) {
    res.status(401).json({ ok:false, error:"Sign in is required for cloud VoicePrint features." });
    return null;
  }
  return user;
}

async function supabaseRest(table, { method="GET", query="", body } = {}, token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type":"application/json",
      Prefer: method === "GET" ? "return=representation" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Supabase request failed.");
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function tokenFrom(req) { return (req.headers.authorization || "").slice(7); }

function cleanContact(value) {
  const name = typeof value?.name === "string" ? value.name.trim().slice(0,80) : "";
  const phone = typeof value?.phone_e164 === "string" ? value.phone_e164.trim() : "";
  const relationship = typeof value?.relationship === "string" ? value.relationship.trim().slice(0,40) : "Other";
  if (!name || !/^\+[1-9][0-9]{7,14}$/.test(phone)) return null;
  return { name, phone_e164:phone, relationship:relationship || "Other" };
}

function cleanLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const accuracy = Number(value?.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude, accuracy_m:Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, captured_at:new Date().toISOString() };
}

function eventPublic(row) {
  return {
    id:row.id,
    source:row.source,
    status:row.status,
    createdAt:row.created_at,
    dispatchedAt:row.dispatched_at,
    cancelledAt:row.cancelled_at,
    location: row.latitude == null ? null : { latitude:row.latitude, longitude:row.longitude, accuracy:row.accuracy_m, timestamp:row.location_captured_at ? Date.parse(row.location_captured_at) : null },
    contactsCount:row.contacts_count,
    delivery:{ mode:row.delivery_mode || "pending", attempted:row.delivery_mode === "twilio", sent:undefined, failed:undefined, message:row.delivery_summary || "" },
  };
}

function alertMessage(event, location) {
  const loc = location ? `Location: ${location.latitude}, ${location.longitude}. Map: https://www.google.com/maps?q=${location.latitude},${location.longitude}` : "Location: unavailable.";
  return [ "VOICEPRINT SOS ALERT", `Trigger: ${event.source === "three-clap" ? "3-clap pattern" : "manual SOS"}`, loc, "Please check on the VoicePrint user. This trusted-contact alert does not itself contact emergency services." ].join("\n");
}

async function dispatchEvent(eventId, user, token) {
  if (eventLocks.has(eventId)) return eventLocks.get(eventId);
  const work = (async () => {
    const rows = await supabaseRest("sos_events", { query:`?select=*&id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(user.id)}` }, token);
    const event = rows?.[0];
    if (!event) throw new Error("SOS event not found.");
    if (event.status === "cancelled") throw new Error("This SOS was cancelled.");
    if (event.status === "dispatched") return eventPublic(event);

    const contacts = await supabaseRest("sos_event_deliveries", { query:`?select=*&event_id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(user.id)}` }, token);
    const location = event.latitude == null ? null : { latitude:event.latitude, longitude:event.longitude, accuracy:event.accuracy_m };

    let deliveryMode = "not_configured";
    let summary = smsConfigured ? "No trusted contacts were configured." : "SMS provider is not configured on the backend.";
    let sent = 0;
    let failed = 0;

    if (smsConfigured && contacts.length) {
      deliveryMode = "twilio";
      const results = await Promise.allSettled(contacts.map((contact) => smsClient.messages.create({ body:alertMessage(event,location), from:process.env.TWILIO_FROM_NUMBER, to:contact.phone_e164 })));
      for (let i=0;i<results.length;i += 1) {
        const result = results[i];
        if (result.status === "fulfilled") {
          sent += 1;
          await supabaseRest("sos_event_deliveries", { method:"PATCH", query:`?id=eq.${encodeURIComponent(contacts[i].id)}&user_id=eq.${encodeURIComponent(user.id)}`, body:{ status:"sent", provider:"twilio", provider_message_id:result.value.sid, sent_at:new Date().toISOString() } }, token);
        } else {
          failed += 1;
          await supabaseRest("sos_event_deliveries", { method:"PATCH", query:`?id=eq.${encodeURIComponent(contacts[i].id)}&user_id=eq.${encodeURIComponent(user.id)}`, body:{ status:"failed", provider:"twilio", error_message:result.reason?.message || "SMS failed" } }, token);
        }
      }
      summary = `${sent} SMS sent, ${failed} failed.`;
    }

    const updated = await supabaseRest("sos_events", { method:"PATCH", query:`?id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(user.id)}`, body:{ status:"dispatched", delivery_mode:deliveryMode, delivery_summary:summary, dispatched_at:new Date().toISOString() } }, token);
    const publicEvent = eventPublic(updated[0] || event);
    publicEvent.delivery = { mode:deliveryMode, attempted:smsConfigured && contacts.length > 0, sent, failed, message:summary };
    return publicEvent;
  })();
  eventLocks.set(eventId, work);
  try { return await work; } finally { eventLocks.delete(eventId); }
}

app.get("/api/health", (_req,res)=>res.json({ok:true,service:"voiceprint-api",version:"phase-4",time:new Date().toISOString(),smsConfigured,authRequired:true}));
app.get("/api/v1/status", (_req,res)=>res.json({ok:true,phase:"4",sms:{configured:smsConfigured,provider:smsConfigured?"twilio":null},features:{authentication:true,persistentContacts:true,sosHistory:true,liveLocation:true,trustedContactSms:smsConfigured,emergencyServicesDispatch:false}}));

app.get("/api/v1/contacts", async (req,res) => {
  const user = await requireUser(req,res); if (!user) return;
  try {
    const data = await supabaseRest("trusted_contacts", { query:`?select=id,name,phone_e164,relationship,created_at,updated_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc` }, tokenFrom(req));
    return res.json({ok:true,contacts:data || []});
  } catch (error) { return res.status(502).json({ok:false,error:error.message}); }
});

app.post("/api/v1/contacts", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  const contact=cleanContact(req.body); if(!contact)return res.status(400).json({ok:false,error:"Valid name and E.164 phone number are required."});
  try {
    const data=await supabaseRest("trusted_contacts",{method:"POST",query:"",body:{...contact,user_id:user.id}},tokenFrom(req));
    return res.status(201).json({ok:true,contact:data?.[0]});
  } catch(error){ return res.status(502).json({ok:false,error:error.message}); }
});

app.delete("/api/v1/contacts/:id", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  try {
    await supabaseRest("trusted_contacts",{method:"DELETE",query:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(user.id)}`},tokenFrom(req));
    return res.json({ok:true});
  } catch(error){ return res.status(502).json({ok:false,error:error.message}); }
});

app.get("/api/v1/history", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  try {
    const data=await supabaseRest("sos_events",{query:`?select=*&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50`},tokenFrom(req));
    return res.json({ok:true,events:(data||[]).map(eventPublic)});
  } catch(error){ return res.status(502).json({ok:false,error:error.message}); }
});

app.post("/api/v1/sos/events", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  const now=Date.now();
  const previous=lastSosByUser.get(user.id)||0;
  if(now-previous<ALERT_COOLDOWN_MS){
    const retry=Math.ceil((ALERT_COOLDOWN_MS-(now-previous))/1000);
    res.set("Retry-After",String(retry));
    return res.status(429).json({ok:false,error:`Please wait ${retry}s before creating another SOS event.`});
  }
  const idem=req.header("Idempotency-Key");
  const source=req.body?.source==="three-clap"?"three-clap":"manual";
  const location=cleanLocation(req.body?.location);
  let contacts=[];
  try { contacts=await supabaseRest("trusted_contacts",{query:`?select=name,phone_e164,relationship&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc&limit=5`},tokenFrom(req)); }
  catch(error){ return res.status(502).json({ok:false,error:error.message}); }

  try {
    const body={
      user_id:user.id,source,status:"pending",
      device_id:typeof req.body?.device_id==="string"?req.body.device_id.slice(0,128):null,
      latitude:location?.latitude ?? null,
      longitude:location?.longitude ?? null,
      accuracy_m:location?.accuracy_m ?? null,
      location_captured_at:location?.captured_at ?? null,
      contacts_count:contacts.length,
      delivery_summary:"10-second confirmation window started."
    };
    const inserted=await supabaseRest("sos_events",{method:"POST",body},tokenFrom(req));
    const event=inserted?.[0];
    if(!event) throw new Error("Could not create SOS event.");
    if(location) await supabaseRest("sos_event_locations",{method:"POST",body:{event_id:event.id,user_id:user.id,latitude:location.latitude,longitude:location.longitude,accuracy_m:location.accuracy_m,captured_at:location.captured_at}},tokenFrom(req));
    if(contacts.length) await supabaseRest("sos_event_deliveries",{method:"POST",body:contacts.map((c)=>({event_id:event.id,user_id:user.id,contact_name:c.name,phone_e164:c.phone_e164,status:"pending"}))},tokenFrom(req));
    lastSosByUser.set(user.id,now);
    return res.status(201).json({ok:true,event:eventPublic(event),idempotencyKey:idem||null});
  } catch(error){ return res.status(502).json({ok:false,error:error.message}); }
});

app.post("/api/v1/sos/events/:id/location", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  const location=cleanLocation(req.body?.location); if(!location)return res.status(400).json({ok:false,error:"Valid location is required."});
  try {
    const existing=await supabaseRest("sos_events",{query:`?select=id,status&user_id=eq.${encodeURIComponent(user.id)}&id=eq.${encodeURIComponent(req.params.id)}`},tokenFrom(req));
    if(!existing?.[0]) return res.status(404).json({ok:false,error:"SOS event not found."});
    if(existing[0].status==="cancelled") return res.status(409).json({ok:false,error:"SOS is cancelled."});
    await supabaseRest("sos_event_locations",{method:"POST",body:{event_id:req.params.id,user_id:user.id,latitude:location.latitude,longitude:location.longitude,accuracy_m:location.accuracy_m,captured_at:location.captured_at}},tokenFrom(req));
    const data=await supabaseRest("sos_events",{method:"PATCH",query:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(user.id)}`,body:{latitude:location.latitude,longitude:location.longitude,accuracy_m:location.accuracy_m,location_captured_at:location.captured_at}},tokenFrom(req));
    return res.json({ok:true,event:eventPublic(data[0])});
  } catch(error){return res.status(502).json({ok:false,error:error.message});}
});

app.post("/api/v1/sos/events/:id/dispatch", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  try {
    const event=await dispatchEvent(req.params.id,user,tokenFrom(req));
    return res.json({ok:true,event});
  } catch(error){return res.status(502).json({ok:false,error:error.message});}
});

app.post("/api/v1/sos/events/:id/cancel", async (req,res) => {
  const user=await requireUser(req,res); if(!user)return;
  try {
    const existing=await supabaseRest("sos_events",{query:`?select=*&id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(user.id)}`},tokenFrom(req));
    const event=existing?.[0];
    if(!event)return res.status(404).json({ok:false,error:"SOS event not found."});
    if(event.status==="dispatched")return res.status(409).json({ok:false,error:"Already dispatched."});
    const data=await supabaseRest("sos_events",{method:"PATCH",query:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(user.id)}`,body:{status:"cancelled",cancelled_at:new Date().toISOString(),delivery_summary:"Cancelled before dispatch."}},tokenFrom(req));
    return res.json({ok:true,event:eventPublic(data[0]||event)});
  }catch(error){return res.status(502).json({ok:false,error:error.message});}
});

app.use((error,_req,res,_next)=>{
  if(error?.message?.includes("Origin"))return res.status(403).json({ok:false,error:error.message});
  console.error(error);
  return res.status(500).json({ok:false,error:"Unexpected server error."});
});

app.listen(PORT,()=>console.log(`VoicePrint Phase 4 API listening on port ${PORT}`));
