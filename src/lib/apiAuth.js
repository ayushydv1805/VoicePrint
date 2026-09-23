import { getAccessToken, refreshSession } from "./auth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 12000;

function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() ||
    "vp-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

export async function api(path, options = {}, retry = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = getAccessToken();
  const requestId = makeRequestId();

  try {
    const response = await fetch(API_BASE_URL + path, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Request-ID": requestId,
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401 && retry) {
      try {
        const refreshed = await refreshSession();
        if (refreshed?.access_token) return api(path, options, false);
      } catch {}
    }

    if (!response.ok) {
      const error = new Error(body?.error || "VoicePrint request failed (" + response.status + ").");
      error.status = response.status;
      error.retryAfterSeconds = body?.retryAfterSeconds;
      error.requestId = response.headers.get("X-Request-ID") || body?.requestId || requestId;
      throw error;
    }

    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("VoicePrint backend timed out. The local safety flow can continue, but cloud delivery may be unavailable.");
      timeoutError.status = 408;
      timeoutError.requestId = requestId;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}