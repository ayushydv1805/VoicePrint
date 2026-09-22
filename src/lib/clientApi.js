export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://voiceprint-api-v4b.onrender.com"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error || `VoicePrint API returned ${response.status}.`);
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return body;
}

export const getSession = () => request("/api/v1/auth/me");
export const signIn = (email, password) => request("/api/v1/auth/signin", { method:"POST", body:JSON.stringify({email,password}) });
export const signUp = (email, password) => request("/api/v1/auth/signup", { method:"POST", body:JSON.stringify({email,password}) });
export const signOut = () => request("/api/v1/auth/logout", { method:"POST" });

export const getContacts = () => request("/api/v1/contacts");
export const addContact = (contact) => request("/api/v1/contacts", { method:"POST", body:JSON.stringify(contact) });
export const removeContact = (id) => request(`/api/v1/contacts/${encodeURIComponent(id)}`, { method:"DELETE" });
export const getHistory = () => request("/api/v1/history");

export const createSosEvent = ({ source, location, deviceId }) => request("/api/v1/sos/events", {
  method:"POST",
  headers:{ "Idempotency-Key": globalThis.crypto?.randomUUID?.() || `sos-${Date.now()}` },
  body:JSON.stringify({ source, location, device_id:deviceId }),
});
export const updateSosLocation = (id, location) => request(`/api/v1/sos/events/${encodeURIComponent(id)}/location`, { method:"POST", body:JSON.stringify({location}) });
export const dispatchSosEvent = (id) => request(`/api/v1/sos/events/${encodeURIComponent(id)}/dispatch`, { method:"POST" });
export const cancelSosEvent = (id) => request(`/api/v1/sos/events/${encodeURIComponent(id)}/cancel`, { method:"POST" });
