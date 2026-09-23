import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import twilio from "twilio";
import { cleanContact, cleanLocation, isValidIdempotencyKey } from "./validation.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

const ALERT_COOLDOWN_MS = Math.max(
  0,
  Number(process.env.ALERT_COOLDOWN_SECONDS || 30) * 1000
);
const LOCATION_UPDATE_MIN_MS = Math.max(
  1000,
  Number(process.env.LOCATION_UPDATE_MIN_SECONDS || 5) * 1000
);
const SUPABASE_RLS_ENFORCED = process.env.SUPABASE_RLS_ENFORCED === "true";
const RELEASE_VERSION = process.env.VOICEPRINT_RELEASE || "phase-8";
const CONFIRMATION_WINDOW_MS = Math.max(
  0,
  Number(process.env.CONFIRMATION_WINDOW_SECONDS || 10) * 1000
);

app.disable("x-powered-by");
app.set("trust proxy", 1);

const origins = new Set(
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const allowedOrigin = (origin) =>
  !origin ||
  origins.has(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
  /^https:\/\/voice-print-[a-z0-9-]+-ayush0018\.vercel\.app$/.test(origin) ||
  origin === "https://voice-print-eight.vercel.app";

app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(
  cors({
    origin: (origin, callback) =>
      allowedOrigin(origin)
        ? callback(null, true)
        : callback(new Error("Origin is not allowed.")),
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "X-VoicePrint-Device",
      "Authorization",
      "Idempotency-Key",
      "X-Request-ID",
    ],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: "32kb" }));

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, max-age=0");
  res.set("Pragma", "no-cache");
  next();
});

app.use((req, res, next) => {
  const incoming = String(req.header("X-Request-ID") || "");
  const requestId = /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();

  req.requestId = requestId;
  res.set("X-Request-ID", requestId);
  next();
});

app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);

app.use(
  "/api/v1/sos",
  rateLimit({
    windowMs: 600000,
    limit: 12,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);

const eventLocks = new Map();

const smsConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER
);

const smsClient = smsConfigured
  ? twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  : null;

async function authenticatedUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: header,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function requireUser(req, res) {
  try {
    const user = await authenticatedUser(req);

    if (!user) {
      res.status(401).json({
        ok: false,
        error: "Sign in is required for cloud VoicePrint features.",
        requestId: req.requestId,
      });
      return null;
    }

    return user;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      stage: "auth",
      message: error?.message || "Authentication lookup failed.",
    }));

    res.status(503).json({
      ok: false,
      error: "Authentication service is temporarily unavailable.",
      requestId: req.requestId,
    });
    return null;
  }
}

async function supabaseRest(
  table,
  { method = "GET", query = "", body } = {},
  token
) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase backend configuration is missing.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}${query}`,
    {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || "Supabase returned an invalid response." };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.hint || "Supabase request failed."
    );
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function tokenFrom(req) {
  return (req.headers.authorization || "").slice(7);
}

function eventPublic(row) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    dispatchedAt: row.dispatched_at,
    cancelledAt: row.cancelled_at,
    location:
      row.latitude == null
        ? null
        : {
            latitude: row.latitude,
            longitude: row.longitude,
            accuracy: row.accuracy_m,
            timestamp: row.location_captured_at
              ? Date.parse(row.location_captured_at)
              : null,
          },
    contactsCount: row.contacts_count,
    delivery: {
      mode: row.delivery_mode || "pending",
      attempted: Boolean(
        row.delivery_mode === "twilio" || row.delivery_mode === "not_configured"
      ),
      message: row.delivery_summary || "",
    },
  };
}

function publicDelivery(row) {
  return {
    id: row.id,
    contactName: row.contact_name,
    phoneE164: row.phone_e164,
    status: row.status,
    provider: row.provider,
    sentAt: row.sent_at,
    error: row.error_message || null,
  };
}

function alertMessage(event, location) {
  const loc = location
    ? `Location: ${location.latitude}, ${location.longitude}. Map: https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : "Location: unavailable.";

  return [
    "VOICEPRINT SOS ALERT",
    `Trigger: ${event.source === "three-clap" ? "3-clap pattern" : "manual SOS"}`,
    loc,
    "Please check on the VoicePrint user. This trusted-contact alert does not itself contact emergency services.",
  ].join("\n");
}

async function getLatestEvent(user, token) {
  const rows = await supabaseRest(
    "sos_events",
    {
      query: `?select=id,created_at&user_id=eq.${encodeURIComponent(
        user.id
      )}&order=created_at.desc&limit=1`,
    },
    token
  );

  return rows?.[0] || null;
}

async function getEventForUser(eventId, user, token) {
  const rows = await supabaseRest(
    "sos_events",
    {
      query: `?select=*&id=eq.${encodeURIComponent(
        eventId
      )}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    },
    token
  );

  return rows?.[0] || null;
}

async function dispatchEvent(eventId, user, token) {
  if (eventLocks.has(eventId)) {
    return eventLocks.get(eventId);
  }

  const work = (async () => {
    const event = await getEventForUser(eventId, user, token);

    if (!event) {
      throw Object.assign(new Error("SOS event not found."), {
        status: 404,
      });
    }

    if (event.status === "cancelled") {
      throw Object.assign(new Error("This SOS was cancelled."), {
        status: 409,
      });
    }

    if (event.status === "dispatched") {
      const deliveries = await supabaseRest(
        "sos_event_deliveries",
        {
          query: `?select=*&event_id=eq.${encodeURIComponent(
            eventId
          )}&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc`,
        },
        token
      );

      return {
        ...eventPublic(event),
        deliveries: (deliveries || []).map(publicDelivery),
      };
    }

    const createdAt = Date.parse(event.created_at || "");
    const remaining =
      CONFIRMATION_WINDOW_MS -
      (Number.isFinite(createdAt) ? Date.now() - createdAt : 0);

    if (remaining > 0) {
      const gateError = new Error(
        "Confirmation window is still active."
      );
      gateError.status = 409;
      gateError.retryAfterSeconds = Math.ceil(remaining / 1000);
      throw gateError;
    }

    const contacts = await supabaseRest(
      "sos_event_deliveries",
      {
        query: `?select=*&event_id=eq.${encodeURIComponent(
          eventId
        )}&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc`,
      },
      token
    );

    const location =
      event.latitude == null
        ? null
        : {
            latitude: event.latitude,
            longitude: event.longitude,
            accuracy: event.accuracy_m,
          };

    let deliveryMode = "not_configured";
    let summary = smsConfigured
      ? "No trusted contacts were configured."
      : "SMS provider is not configured on the backend.";

    let sent = 0;
    let failed = 0;

    if (smsConfigured && contacts.length) {
      deliveryMode = "twilio";

      const results = await Promise.allSettled(
        contacts.map((contact) =>
          smsClient.messages.create({
            body: alertMessage(event, location),
            from: process.env.TWILIO_FROM_NUMBER,
            to: contact.phone_e164,
          })
        )
      );

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];

        if (result.status === "fulfilled") {
          sent += 1;

          await supabaseRest(
            "sos_event_deliveries",
            {
              method: "PATCH",
              query: `?id=eq.${encodeURIComponent(
                contacts[index].id
              )}&user_id=eq.${encodeURIComponent(user.id)}`,
              body: {
                status: "sent",
                provider: "twilio",
                provider_message_id: result.value.sid,
                sent_at: new Date().toISOString(),
                error_message: null,
              },
            },
            token
          );
        } else {
          failed += 1;

          await supabaseRest(
            "sos_event_deliveries",
            {
              method: "PATCH",
              query: `?id=eq.${encodeURIComponent(
                contacts[index].id
              )}&user_id=eq.${encodeURIComponent(user.id)}`,
              body: {
                status: "failed",
                provider: "twilio",
                error_message:
                  result.reason?.message || "SMS failed.",
              },
            },
            token
          );
        }
      }

      summary = `${sent} SMS sent, ${failed} failed.`;
    }

    const updated = await supabaseRest(
      "sos_events",
      {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(
          eventId
        )}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
        body: {
          status: "dispatched",
          delivery_mode: deliveryMode,
          delivery_summary: summary,
          dispatched_at: new Date().toISOString(),
        },
      },
      token
    );

    const finalEvent = updated?.[0] || event;

    const deliveries = await supabaseRest(
      "sos_event_deliveries",
      {
        query: `?select=*&event_id=eq.${encodeURIComponent(
          eventId
        )}&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc`,
      },
      token
    );

    const publicEvent = eventPublic(finalEvent);

    publicEvent.delivery = {
      mode: deliveryMode,
      attempted: smsConfigured && contacts.length > 0,
      sent,
      failed,
      message: summary,
    };

    return {
      ...publicEvent,
      deliveries: (deliveries || []).map(publicDelivery),
    };
  })();

  eventLocks.set(eventId, work);

  try {
    return await work;
  } finally {
    eventLocks.delete(eventId);
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "voiceprint-api",
    version: RELEASE_VERSION,
    requestId: req.requestId,
    time: new Date().toISOString(),
    smsConfigured,
    authRequired: true,
  });
});

app.get("/api/v1/status", (req, res) => {
  res.json({
    ok: true,
    phase: "9",
    requestId: req.requestId,
    confirmationWindowSeconds: CONFIRMATION_WINDOW_MS / 1000,
    locationUpdateMinSeconds: LOCATION_UPDATE_MIN_MS / 1000,
    sms: {
      configured: smsConfigured,
      provider: smsConfigured ? "twilio" : null,
    },
    features: {
      authentication: true,
      persistentContacts: true,
      sosHistory: true,
      liveLocation: true,
      trustedContactSms: smsConfigured,
      durableIdempotency: true,
      serverSideLocationThrottle: true,
      emergencyServicesDispatch: false,
      requestTracing: true,
      securityRlsEnforced: SUPABASE_RLS_ENFORCED,
      apiNoStore: true,
      securityHeaders: true,
      incidentAudit: true,
      locationHistory: true,
      deliveryAudit: true,
    },
  });
});

app.get("/api/v1/contacts", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const data = await supabaseRest(
      "trusted_contacts",
      {
        query: `?select=id,name,phone_e164,relationship,created_at,updated_at&user_id=eq.${encodeURIComponent(
          user.id
        )}&order=created_at.asc`,
      },
      tokenFrom(req)
    );

    return res.json({
      ok: true,
      contacts: data || [],
      requestId: req.requestId,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      route: req.path,
      message: error?.message,
    }));

    return res.status(502).json({
      ok: false,
      error: "Could not load trusted contacts.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/v1/contacts", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const contact = cleanContact(req.body);

  if (!contact) {
    return res.status(400).json({
      ok: false,
      error: "Valid name and E.164 phone number are required.",
      requestId: req.requestId,
    });
  }

  try {
    const data = await supabaseRest(
      "trusted_contacts",
      {
        method: "POST",
        body: { ...contact, user_id: user.id },
      },
      tokenFrom(req)
    );

    return res.status(201).json({
      ok: true,
      contact: data?.[0],
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.payload?.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "This phone number is already saved as a trusted contact.",
        requestId: req.requestId,
      });
    }

    return res.status(502).json({
      ok: false,
      error: "Could not save trusted contact.",
      requestId: req.requestId,
    });
  }
});

app.delete("/api/v1/contacts/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    await supabaseRest(
      "trusted_contacts",
      {
        method: "DELETE",
        query: `?id=eq.${encodeURIComponent(
          req.params.id
        )}&user_id=eq.${encodeURIComponent(user.id)}`,
      },
      tokenFrom(req)
    );

    return res.json({
      ok: true,
      requestId: req.requestId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not remove trusted contact.",
      requestId: req.requestId,
    });
  }
});

app.get("/api/v1/history", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const data = await supabaseRest(
      "sos_events",
      {
        query: `?select=*&user_id=eq.${encodeURIComponent(
          user.id
        )}&order=created_at.desc&limit=50`,
      },
      tokenFrom(req)
    );

    return res.json({
      ok: true,
      events: (data || []).map(eventPublic),
      requestId: req.requestId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not load SOS history.",
      requestId: req.requestId,
    });
  }
});

app.get("/api/v1/sos/events/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const event = await getEventForUser(
      req.params.id,
      user,
      tokenFrom(req)
    );

    if (!event) {
      return res.status(404).json({
        ok: false,
        error: "SOS event not found.",
        requestId: req.requestId,
      });
    }

    const [deliveries, locations] = await Promise.all([
      supabaseRest(
        "sos_event_deliveries",
        {
          query: `?select=*&event_id=eq.${encodeURIComponent(
            event.id
          )}&user_id=eq.${encodeURIComponent(
            user.id
          )}&order=created_at.asc`,
        },
        tokenFrom(req)
      ),
      supabaseRest(
        "sos_event_locations",
        {
          query: `?select=id,latitude,longitude,accuracy_m,captured_at&event_id=eq.${encodeURIComponent(
            event.id
          )}&user_id=eq.${encodeURIComponent(
            user.id
          )}&order=captured_at.desc&limit=50`,
        },
        tokenFrom(req)
      ),
    ]);

    return res.json({
      ok: true,
      event: eventPublic(event),
      deliveries: (deliveries || []).map(publicDelivery),
      locations: locations || [],
      requestId: req.requestId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not load SOS event details.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/v1/sos/events", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const token = tokenFrom(req);
  const idem = req.header("Idempotency-Key");

  if (!isValidIdempotencyKey(idem)) {
    return res.status(400).json({
      ok: false,
      error: "A valid idempotency key is required.",
      requestId: req.requestId,
    });
  }

  const existing = await supabaseRest(
    "sos_events",
    {
      query: `?select=*&user_id=eq.${encodeURIComponent(
        user.id
      )}&idempotency_key=eq.${encodeURIComponent(idem)}&limit=1`,
    },
    token
  );

  if (existing?.[0]) {
    return res.status(200).json({
      ok: true,
      event: eventPublic(existing[0]),
      replayed: true,
      requestId: req.requestId,
    });
  }

  const latest = await getLatestEvent(user, token);

  if (latest) {
    const latestAt = Date.parse(latest.created_at || "");
    if (
      Number.isFinite(latestAt) &&
      Date.now() - latestAt < ALERT_COOLDOWN_MS
    ) {
      const retry = Math.ceil(
        (ALERT_COOLDOWN_MS - (Date.now() - latestAt)) / 1000
      );

      res.set("Retry-After", String(retry));

      return res.status(429).json({
        ok: false,
        error: `Please wait ${retry}s before creating another SOS event.`,
        retryAfterSeconds: retry,
        requestId: req.requestId,
      });
    }
  }

  const source =
    req.body?.source === "three-clap" ? "three-clap" : "manual";
  const location = cleanLocation(req.body?.location);

  let contacts = [];

  try {
    contacts = await supabaseRest(
      "trusted_contacts",
      {
        query: `?select=name,phone_e164,relationship&user_id=eq.${encodeURIComponent(
          user.id
        )}&order=created_at.asc&limit=5`,
      },
      token
    );
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not prepare trusted-contact deliveries.",
      requestId: req.requestId,
    });
  }

  try {
    const eventBody = {
      user_id: user.id,
      source,
      status: "pending",
      idempotency_key: idem,
      device_id:
        typeof req.body?.device_id === "string"
          ? req.body.device_id.slice(0, 128)
          : null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy_m: location?.accuracy_m ?? null,
      location_captured_at: location?.captured_at ?? null,
      contacts_count: contacts.length,
      delivery_summary:
        "10-second confirmation window started.",
    };

    const inserted = await supabaseRest(
      "sos_events",
      {
        method: "POST",
        body: eventBody,
      },
      token
    );

    const event = inserted?.[0];

    if (!event) {
      throw new Error("Could not create SOS event.");
    }

    if (location) {
      await supabaseRest(
        "sos_event_locations",
        {
          method: "POST",
          body: {
            event_id: event.id,
            user_id: user.id,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy_m: location.accuracy_m,
            captured_at: location.captured_at,
          },
        },
        token
      );
    }

    if (contacts.length) {
      await supabaseRest(
        "sos_event_deliveries",
        {
          method: "POST",
          body: contacts.map((contact) => ({
            event_id: event.id,
            user_id: user.id,
            contact_name: contact.name,
            phone_e164: contact.phone_e164,
            status: "pending",
          })),
        },
        token
      );
    }

    return res.status(201).json({
      ok: true,
      event: eventPublic(event),
      idempotencyKey: idem,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.payload?.code === "23505") {
      const replayed = await supabaseRest(
        "sos_events",
        {
          query: `?select=*&user_id=eq.${encodeURIComponent(
            user.id
          )}&idempotency_key=eq.${encodeURIComponent(idem)}&limit=1`,
        },
        token
      );

      if (replayed?.[0]) {
        return res.status(200).json({
          ok: true,
          event: eventPublic(replayed[0]),
          replayed: true,
          requestId: req.requestId,
        });
      }
    }

    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      route: req.path,
      message: error?.message,
    }));

    return res.status(502).json({
      ok: false,
      error: "Could not create the SOS event.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/v1/sos/events/:id/location", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const location = cleanLocation(req.body?.location);

  if (!location) {
    return res.status(400).json({
      ok: false,
      error: "Valid location is required.",
      requestId: req.requestId,
    });
  }

  const token = tokenFrom(req);

  try {
    const existing = await supabaseRest(
      "sos_events",
      {
        query: `?select=id,status,location_captured_at&user_id=eq.${encodeURIComponent(
          user.id
        )}&id=eq.${encodeURIComponent(req.params.id)}&limit=1`,
      },
      token
    );

    if (!existing?.[0]) {
      return res.status(404).json({
        ok: false,
        error: "SOS event not found.",
        requestId: req.requestId,
      });
    }

    if (existing[0].status === "cancelled") {
      return res.status(409).json({
        ok: false,
        error: "SOS is cancelled.",
        requestId: req.requestId,
      });
    }

    if (existing[0].status === "dispatched") {
      return res.status(409).json({
        ok: false,
        error: "SOS is already dispatched.",
        requestId: req.requestId,
      });
    }

    const lastCapturedAt = Date.parse(
      existing[0].location_captured_at || ""
    );

    if (
      Number.isFinite(lastCapturedAt) &&
      Date.now() - lastCapturedAt < LOCATION_UPDATE_MIN_MS
    ) {
      const retry = Math.ceil(
        (LOCATION_UPDATE_MIN_MS - (Date.now() - lastCapturedAt)) / 1000
      );

      res.set("Retry-After", String(retry));

      return res.status(429).json({
        ok: false,
        error: `Location updates are limited to one every ${Math.ceil(
          LOCATION_UPDATE_MIN_MS / 1000
        )} seconds.`,
        retryAfterSeconds: retry,
        requestId: req.requestId,
      });
    }

    await supabaseRest(
      "sos_event_locations",
      {
        method: "POST",
        body: {
          event_id: req.params.id,
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy_m: location.accuracy_m,
          captured_at: location.captured_at,
        },
      },
      token
    );

    const data = await supabaseRest(
      "sos_events",
      {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(
          req.params.id
        )}&user_id=eq.${encodeURIComponent(
          user.id
        )}&status=eq.pending`,
        body: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy_m: location.accuracy_m,
          location_captured_at: location.captured_at,
        },
      },
      token
    );

    return res.json({
      ok: true,
      event: eventPublic(data?.[0] || existing[0]),
      requestId: req.requestId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not update SOS location.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/v1/sos/events/:id/dispatch", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const event = await dispatchEvent(
      req.params.id,
      user,
      tokenFrom(req)
    );

    return res.json({
      ok: true,
      event,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.status) {
      if (error.retryAfterSeconds) {
        res.set("Retry-After", String(error.retryAfterSeconds));
      }

      return res.status(error.status).json({
        ok: false,
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
        requestId: req.requestId,
      });
    }

    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      route: req.path,
      message: error?.message,
    }));

    return res.status(502).json({
      ok: false,
      error: "Could not process SOS delivery.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/v1/sos/events/:id/cancel", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const event = await getEventForUser(
      req.params.id,
      user,
      tokenFrom(req)
    );

    if (!event) {
      return res.status(404).json({
        ok: false,
        error: "SOS event not found.",
        requestId: req.requestId,
      });
    }

    if (event.status === "dispatched") {
      return res.status(409).json({
        ok: false,
        error: "Already dispatched.",
        requestId: req.requestId,
      });
    }

    if (event.status === "cancelled") {
      return res.json({
        ok: true,
        event: eventPublic(event),
        requestId: req.requestId,
      });
    }

    const data = await supabaseRest(
      "sos_events",
      {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(
          req.params.id
        )}&user_id=eq.${encodeURIComponent(
          user.id
        )}&status=eq.pending`,
        body: {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          delivery_summary: "Cancelled before dispatch.",
        },
      },
      tokenFrom(req)
    );

    return res.json({
      ok: true,
      event: eventPublic(data?.[0] || event),
      requestId: req.requestId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Could not cancel the SOS event.",
      requestId: req.requestId,
    });
  }
});

app.use((error, req, res, _next) => {
  if (error?.message?.includes("Origin")) {
    return res.status(403).json({
      ok: false,
      error: error.message,
      requestId: req.requestId,
    });
  }

  console.error(JSON.stringify({
    level: "error",
    requestId: req.requestId,
    route: req.path,
    message: error?.message,
  }));

  return res.status(500).json({
    ok: false,
    error: "Unexpected server error.",
    requestId: req.requestId,
  });
});

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      message: "VoicePrint API listening",
      port: PORT,
      smsConfigured,
      confirmationWindowSeconds: CONFIRMATION_WINDOW_MS / 1000,
    })
  );
});
