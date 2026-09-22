const DEFAULT_API_URL = "https://voiceprint-api-v4.onrender.com";

function getAccessToken() {
  try { return JSON.parse(localStorage.getItem("voiceprint-auth-session"))?.access_token || ""; } catch { return ""; }
}

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
).replace(/\/$/, "");

function getStoredDeviceId() {
  const key = "voiceprint-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const generated = globalThis.crypto?.randomUUID?.() ||
    `vp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, generated);
  return generated;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        "X-VoicePrint-Device": getStoredDeviceId(),
        ...(options.headers || {}),
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(payload?.error || `VoicePrint API returned ${response.status}.`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("VoicePrint backend timed out. The local SOS flow can continue, but remote delivery is unavailable.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createSosEvent({ source, location, contacts }) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() ||
    `sos-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return request("/api/v1/sos/events", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ source, location, contacts }),
  });
}

export function updateSosLocation(eventId, location) {
  return request(`/api/v1/sos/events/${encodeURIComponent(eventId)}/location`, {
    method: "POST",
    body: JSON.stringify({ location }),
  });
}

export function dispatchSosEvent(eventId) {
  return request(`/api/v1/sos/events/${encodeURIComponent(eventId)}/dispatch`, {
    method: "POST",
  });
}

export function cancelSosEvent(eventId) {
  return request(`/api/v1/sos/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
  });
}

export function getSosStatus() {
  return request("/api/v1/status");
}
