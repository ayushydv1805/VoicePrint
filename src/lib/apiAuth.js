import { getAccessToken, refreshSession } from "./auth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com").replace(/\/$/, "");

export async function api(path, options = {}, retry = true) {
  const token = getAccessToken();
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

  if (!response.ok) throw new Error(body?.error || "VoicePrint request failed.");
  return body;
}
