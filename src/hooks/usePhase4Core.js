import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signIn, signUp, signOut } from "../lib/auth";
import { api } from "../lib/apiAuth";
import { useClapDetector, useDeviceLocation } from "./useSafetySensors";

function getDeviceId() {
  const key = "voiceprint-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() || "vp-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  localStorage.setItem(key, value);
  return value;
}

export default function usePhase4Core() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(() => localStorage.getItem("voiceprint-protection") !== "false");
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState(null);
  const [source, setSource] = useState("manual");
  const [error, setError] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [sosWatch, setSosWatch] = useState(false);
  const lastLocationSyncAt = useRef(0);
  const flowLockRef = useRef(false);
  const cancelRequestedRef = useRef(false);

  const { listening, clapCount, micError, start: startMic, stop: stopMic } =
    useClapDetector(() => startFlow("three-clap"));
  const { location, locationError, watching, startWatching, stopWatching } = useDeviceLocation();

  useEffect(() => {
    getDeviceId();
    getCurrentUser().then(setUser).catch(() => {}).finally(() => setReady(true));
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [contactsResponse, historyResponse] = await Promise.all([
      api("/api/v1/contacts"),
      api("/api/v1/history"),
    ]);
    setContacts((contactsResponse.contacts || []).map((item) => ({
      id: item.id,
      name: item.name,
      phone: item.phone_e164,
      relationship: item.relationship,
    })));
    setHistory(historyResponse.events || []);
  }, [user]);

  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
    else {
      setContacts([]);
      setHistory([]);
    }
  }, [user, refresh]);

  useEffect(() => {
    localStorage.setItem("voiceprint-protection", String(active));
    if (!active) stopMic();
  }, [active, stopMic]);

  const startFlow = useCallback((src) => {
    if (!active || open || flowLockRef.current) return false;

    flowLockRef.current = true;
    cancelRequestedRef.current = false;
    setSource(src);
    setOpen(true);
    setEvent(null);
    setError("");
    setSosWatch(true);
    lastLocationSyncAt.current = 0;
    stopMic();
    startWatching();

    if (!user) return true;

    const idempotencyKey = globalThis.crypto?.randomUUID?.() ||
      "vp-" + Date.now() + "-" + Math.random().toString(36).slice(2);

    api("/api/v1/sos/events", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        source: src,
        location,
        device_id: getDeviceId(),
      }),
    })
      .then(async (response) => {
        setEvent(response.event);

        if (cancelRequestedRef.current && response.event?.id) {
          try {
            const cancelled = await api(
              "/api/v1/sos/events/" + encodeURIComponent(response.event.id) + "/cancel",
              { method: "POST" }
            );
            setEvent(cancelled.event);
            await refresh();
          } catch (e) {
            setError(e.message);
          }
        }
      })
      .catch((e) => {
        if (!cancelRequestedRef.current) setError(e.message);
      });

    return true;
  }, [active, open, user, location, startWatching, stopMic]);

  useEffect(() => {
    if (!open || !event?.id || event.status === "cancelled" || event.status === "dispatched" ||
        !location || Date.now() - lastLocationSyncAt.current < 5000) return;

    lastLocationSyncAt.current = Date.now();
    api("/api/v1/sos/events/" + encodeURIComponent(event.id) + "/location", {
      method: "POST",
      body: JSON.stringify({ location }),
    })
      .then((response) => setEvent(response.event))
      .catch((e) => setError(e.message));
  }, [open, event?.id, event?.status, location]);

  const closeFlow = useCallback(async () => {
    cancelRequestedRef.current = true;

    if (event?.id && event.status !== "dispatched" && event.status !== "cancelled") {
      try {
        const response = await api("/api/v1/sos/events/" + encodeURIComponent(event.id) + "/cancel", {
          method: "POST",
        });
        setEvent(response.event);
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    }
    if (sosWatch) stopWatching();
    setSosWatch(false);
    setOpen(false);
    flowLockRef.current = false;
  }, [event, sosWatch, stopWatching, refresh]);

  const finish = useCallback(async () => {
    if (!event?.id || event.status === "dispatched" || event.status === "cancelled") return;
    try {
      const response = await api("/api/v1/sos/events/" + encodeURIComponent(event.id) + "/dispatch", {
        method: "POST",
      });
      setEvent(response.event);
      stopWatching();
      setSosWatch(false);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }, [event, refresh, stopWatching]);

  const add = useCallback(async (contact) => {
    if (!user) throw new Error("Sign in from Settings first.");
    const response = await api("/api/v1/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: contact.name,
        phone_e164: contact.phone,
        relationship: contact.relationship,
      }),
    });
    const item = response.contact;
    setContacts((value) => [...value, {
      id: item.id,
      name: item.name,
      phone: item.phone_e164,
      relationship: item.relationship,
    }]);
  }, [user]);

  const remove = useCallback(async (id) => {
    await api("/api/v1/contacts/" + encodeURIComponent(id), { method: "DELETE" });
    setContacts((value) => value.filter((contact) => contact.id !== id));
  }, []);

  const auth = useCallback(async (mode, email, password) => {
    try {
      const response = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
      if (mode === "signup" && !response?.access_token) {
        setAuthMsg("Account created. Confirm your email if required, then sign in.");
        return;
      }
      setUser(await getCurrentUser());
      setAuthMsg("Signed in successfully.");
    } catch (e) {
      setAuthMsg(e.message);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setContacts([]);
    setHistory([]);
    setAuthMsg("Signed out.");
  }, []);

  return {
    ready, user, contacts, history, active, setActive, open, event, source, error, setError,
    authMsg, auth, logout, listening, clapCount, micError, location, locationError, watching,
    sosWatch, startFlow, closeFlow, finish, startMic, stopMic, startWatching, stopWatching,
    add, remove, refresh,
  };
}
