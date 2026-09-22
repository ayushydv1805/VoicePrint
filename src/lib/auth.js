const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORAGE_KEY = "voiceprint-auth-session";

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function save(value) {
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  else localStorage.removeItem(STORAGE_KEY);
}

async function request(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Cloud account is not configured.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.msg || body?.message || body?.error_description || "Authentication failed.");
  return body;
}

export function getSession() { return load(); }

export async function signIn(email, password) {
  const body = await request("token?grant_type=password", { method:"POST", body:JSON.stringify({email,password}) });
  const session = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    user: body.user,
    expires_at: Date.now() + Number(body.expires_in || 3600) * 1000,
  };
  save(session);
  return session;
}

export async function signUp(email, password) {
  const body = await request("signup", { method:"POST", body:JSON.stringify({email,password}) });
  if (body?.access_token) {
    save({ access_token:body.access_token, refresh_token:body.refresh_token, user:body.user, expires_at:Date.now()+Number(body.expires_in||3600)*1000 });
  }
  return body;
}

export async function refreshSession() {
  const session = load();
  if (!session?.refresh_token) return null;
  const body = await request("token?grant_type=refresh_token", { method:"POST", body:JSON.stringify({refresh_token:session.refresh_token}) });
  const next = { ...session, access_token:body.access_token, refresh_token:body.refresh_token || session.refresh_token, user:body.user || session.user, expires_at:Date.now()+Number(body.expires_in||3600)*1000 };
  save(next);
  return next;
}

export async function getCurrentUser() {
  const session = load();
  if (!session?.access_token) return null;
  let response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${session.access_token}` } });
  if (response.ok) return response.json();
  try {
    const next = await refreshSession();
    if (!next?.access_token) return null;
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${next.access_token}` } });
    if (response.ok) return response.json();
  } catch {}
  save(null);
  return null;
}

export async function signOut() {
  const session = load();
  if (session?.access_token && SUPABASE_URL && SUPABASE_KEY) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${session.access_token}` } }).catch(()=>{});
  }
  save(null);
}

export function getAccessToken() { return load()?.access_token || ""; }
