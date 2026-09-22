import { getAccessToken } from "./auth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com").replace(/\/$/, "");

export async function api(path, options = {}) {
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getAccessToken(),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "VoicePrint request failed.");
  return body;
}
