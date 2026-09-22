import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import twilio from "twilio";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ALERT_COOLDOWN_MS = Math.max(0, Number(process.env.ALERT_COOLDOWN_SECONDS || 30) * 1000);
const LOCATION_UPDATE_MIN_MS = Math.max(1000, Number(process.env.LOCATION_UPDATE_MIN_SECONDS || 5) * 1000);

app.disable("x-powered-by");
app.set("trust proxy", 1);

const exactOrigins = new Set(
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const isAllowedOrigin = (origin) =>
  !origin ||
  exactOrigins.has(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
  /^https:\/\/voice-print-[a-z0-9-]+-ayush0018\.vercel\.app$/.test(origin) ||
  origin === "https://voice-print-eight.vercel.app";

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by VoicePrint API CORS policy."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "X-VoicePrint-Device", "Idempotency-Key"],
  maxAge: 86400,
}));
app.use(express.json({ limit: "32kb" }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const sosLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.use("/api", globalLimiter);
app.use("/api/v1/sos", sosLimiter);

const events = new Map();
const lastSosByDevice = new Map();
const idempotency = new Map();

const smsConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER
);

const smsClient = smsConfigured
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function isValidDeviceId(deviceId) {
  return typeof deviceId === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(deviceId);
}

function normaliseLocation(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Number(location.accuracy);
  const timestamp = Number(location.timestamp || Date.now());

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Number(accuracy.toFixed(1)) : null,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
}

function sanitiseContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .slice(0, 5)
    .map((contact) => ({
      name: typeof contact?.name === "string" ? contact.name.trim().slice(0, 80) : "Trusted contact",
      phone: typeof contact?.phone === "string" ? contact.phone.trim() : "",
    }))
    .filter((contact) => /^\+[1-9]\d{7,14}$/.test(contact.phone));
}

function eventSnapshot(event) {
  return {
    id: event.id,
    status: event.status,
    source: event.source,
    createdAt: event.createdAt,
    dispatchedAt: event.dispatchedAt || null,
    cancelledAt: event.cancelledAt || null,
    location: event.location || null,
    contactsCount: event.contactsCount,
    delivery: event.delivery || {
      mode: smsConfigured ? "configured" : "not_configured",
      attempted: false,
      sent: 0,
      failed: 0,
      message: smsConfigured
        ? "SMS delivery is configured."
        : "SMS provider credentials are not configured on the server.",
    },
  };
}

function buildAlertMessage(event) {
  const location = event.location;
  const locationText = location
    ? `Location: ${location.latitude}, ${location.longitude}${location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : ""}.\nMap: https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : "Location: currently unavailable.";

  return [
    "VOICEPRINT SOS ALERT",
    `Trigger: ${event.source === "three-clap" ? "3-clap pattern" : "manual SOS"}`,
    locationText,
    "Please check on the VoicePrint user. This alert is to a trusted contact; it does not itself contact emergency services.",
  ].join("\n");
}

async function dispatchEvent(event) {
  if (event.status === "cancelled") {
    return eventSnapshot(event);
  }
  if (event.status === "dispatched") {
    return eventSnapshot(event);
  }

  event.status = "dispatching";
  const message = buildAlertMessage(event);

  if (!smsConfigured || event.contacts.length === 0) {
    event.status = "dispatched";
    event.dispatchedAt = new Date().toISOString();
    event.delivery = {
      mode: smsConfigured ? "no_contacts" : "not_configured",
      attempted: false,
      sent: 0,
      failed: 0,
      message: smsConfigured
        ? "No valid trusted contacts were provided for this alert."
        : "SMS provider credentials are not configured on the server. No SMS was sent.",
    };
    return eventSnapshot(event);
  }

  const results = await Promise.allSettled(
    event.contacts.map((contact) =>
      smsClient.messages.create({
        body: message,
        from: process.env.TWILIO_FROM_NUMBER,
        to: contact.phone,
      })
    )
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  event.status = "dispatched";
  event.dispatchedAt = new Date().toISOString();
  event.delivery = {
    mode: "twilio",
    attempted: true,
    sent,
    failed,
    message: failed
      ? "SMS delivery completed with some failures."
      : "SMS delivery completed.",
  };

  return eventSnapshot(event);
}

function getEvent(req, res) {
  const event = events.get(req.params.id);
  if (!event) {
    res.status(404).json({ ok: false, error: "SOS event not found." });
    return null;
  }
  if (event.deviceId !== req.header("X-VoicePrint-Device")) {
    res.status(403).json({ ok: false, error: "This event does not belong to this device." });
    return null;
  }
  return event;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "voiceprint-api",
    version: "phase-3",
    time: new Date().toISOString(),
    smsConfigured,
  });
});

app.get("/api/v1/status", (_req, res) => {
  res.json({
    ok: true,
    sms: {
      configured: smsConfigured,
      provider: smsConfigured ? "twilio" : null,
    },
    features: {
      sosEvents: true,
      liveLocationUpdates: true,
      trustedContactSms: smsConfigured,
      emergencyServicesDispatch: false,
    },
  });
});

app.post("/api/v1/sos/events", (req, res) => {
  const deviceId = req.header("X-VoicePrint-Device") || req.body?.deviceId;
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ ok: false, error: "A valid VoicePrint device id is required." });
  }

  const key = req.header("Idempotency-Key");
  if (key && !/^[a-zA-Z0-9._:-]{8,128}$/.test(key)) {
    return res.status(400).json({ ok: false, error: "Invalid idempotency key." });
  }

  if (key) {
    const idempotentEventId = idempotency.get(`${deviceId}:${key}`);
    if (idempotentEventId && events.has(idempotentEventId)) {
      return res.json({ ok: true, event: eventSnapshot(events.get(idempotentEventId)), replayed: true });
    }
  }

  const lastSos = lastSosByDevice.get(deviceId) || 0;
  if (Date.now() - lastSos < ALERT_COOLDOWN_MS) {
    const retryAfter = Math.ceil((ALERT_COOLDOWN_MS - (Date.now() - lastSos)) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      ok: false,
      error: `Please wait ${retryAfter}s before creating another SOS event.`,
    });
  }

  const source = req.body?.source === "three-clap" ? "three-clap" : "manual";
  const event = {
    id: crypto.randomUUID(),
    deviceId,
    source,
    status: "pending",
    createdAt: new Date().toISOString(),
    location: normaliseLocation(req.body?.location),
    contacts: sanitiseContacts(req.body?.contacts),
    contactsCount: Array.isArray(req.body?.contacts) ? Math.min(req.body.contacts.length, 5) : 0,
    delivery: {
      mode: smsConfigured ? "configured" : "not_configured",
      attempted: false,
      sent: 0,
      failed: 0,
      message: "10-second confirmation window started. No SMS is sent until dispatch is confirmed.",
    },
  };

  events.set(event.id, event);
  lastSosByDevice.set(deviceId, Date.now());
  if (key) idempotency.set(`${deviceId}:${key}`, event.id);

  setTimeout(() => {
    const current = events.get(event.id);
    if (!current || current.status !== "pending") return;
    // Safety default: the browser must explicitly confirm dispatch after the 10-second countdown.
  }, 11000);

  return res.status(201).json({
    ok: true,
    event: eventSnapshot(event),
  });
});

app.get("/api/v1/sos/events/:id", (req, res) => {
  const event = getEvent(req, res);
  if (!event) return;
  return res.json({ ok: true, event: eventSnapshot(event) });
});

app.post("/api/v1/sos/events/:id/location", (req, res) => {
  const event = getEvent(req, res);
  if (!event) return;

  if (event.status === "cancelled") {
    return res.status(409).json({ ok: false, error: "Cannot update location for a cancelled SOS event." });
  }

  const now = Date.now();
  if (event.lastLocationUpdateAt && now - event.lastLocationUpdateAt < LOCATION_UPDATE_MIN_MS) {
    return res.json({ ok: true, event: eventSnapshot(event), throttled: true });
  }

  const nextLocation = normaliseLocation(req.body?.location);
  if (!nextLocation) {
    return res.status(400).json({ ok: false, error: "Valid latitude and longitude are required." });
  }

  event.location = nextLocation;
  event.lastLocationUpdateAt = now;
  return res.json({ ok: true, event: eventSnapshot(event) });
});

app.post("/api/v1/sos/events/:id/dispatch", async (req, res) => {
  const event = getEvent(req, res);
  if (!event) return;

  if (event.status === "cancelled") {
    return res.status(409).json({ ok: false, error: "This SOS was cancelled before dispatch." });
  }

  if (event.status === "pending") {
    // The client is responsible for waiting through the visible 10-second safety window.
  }

  try {
    const snapshot = await dispatchEvent(event);
    return res.json({ ok: true, event: snapshot });
  } catch (error) {
    event.status = "pending";
    event.delivery = {
      mode: "twilio_error",
      attempted: true,
      sent: 0,
      failed: event.contactsCount,
      message: error?.message || "SMS provider error.",
    };
    return res.status(502).json({
      ok: false,
      error: "SMS delivery failed. The SOS event remains available for review.",
      event: eventSnapshot(event),
    });
  }
});

app.post("/api/v1/sos/events/:id/cancel", (req, res) => {
  const event = getEvent(req, res);
  if (!event) return;

  if (event.status === "dispatched") {
    return res.status(409).json({
      ok: false,
      error: "This SOS was already dispatched and cannot be recalled.",
      event: eventSnapshot(event),
    });
  }

  event.status = "cancelled";
  event.cancelledAt = new Date().toISOString();
  event.contacts = [];
  return res.json({ ok: true, event: eventSnapshot(event) });
});

app.use((error, _req, res, _next) => {
  if (error?.message?.includes("CORS")) {
    return res.status(403).json({ ok: false, error: error.message });
  }
  console.error(error);
  return res.status(500).json({ ok: false, error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`VoicePrint API listening on port ${PORT}`);
});
