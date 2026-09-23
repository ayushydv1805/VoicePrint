import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/apiAuth";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com"
).replace(/\/$/, "");

async function permissionState(name) {
  if (!navigator.permissions?.query) return "unsupported";
  try {
    const result = await navigator.permissions.query({ name });
    return result.state || "unknown";
  } catch {
    return "unsupported";
  }
}

export default function usePhase10Readiness({ user, contacts, online }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [healthResponse, microphone, geolocation, notifications] = await Promise.all([
        fetch(API_BASE_URL + "/api/health", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        permissionState("microphone"),
        permissionState("geolocation"),
        "Notification" in window ? Promise.resolve(Notification.permission) : Promise.resolve("unsupported"),
      ]);

      const health = await healthResponse.json().catch(() => ({}));
      let status = null;

      if (user) {
        try {
          status = await api("/api/v1/status");
        } catch (statusError) {
          status = { ok: false, error: statusError?.message || "Could not load authenticated service status." };
        }
      }

      setReport({
        checkedAt: new Date().toISOString(),
        browser: {
          secureContext: window.isSecureContext,
          microphone: microphone !== "denied" && "mediaDevices" in navigator,
          microphonePermission: microphone,
          geolocation: "geolocation" in navigator && geolocation !== "denied",
          geolocationPermission: geolocation,
          notifications: notifications !== "denied",
          notificationPermission: notifications,
          serviceWorker: "serviceWorker" in navigator,
          localStorage: (() => {
            try {
              const key = "__voiceprint_readiness__";
              localStorage.setItem(key, "1");
              localStorage.removeItem(key);
              return true;
            } catch {
              return false;
            }
          })(),
          online,
        },
        cloud: {
          reachable: healthResponse.ok && health?.ok === true,
          release: health?.version || "unknown",
          releaseParity: health?.version === "phase-10",
          requestTracing: Boolean(health?.requestId),
          authReady: Boolean(user),
          status,
        },
        contacts: {
          count: Array.isArray(contacts) ? contacts.length : 0,
          ready: Boolean(user) && Array.isArray(contacts) && contacts.length > 0,
        },
      });
    } catch (e) {
      setError(e?.message || "Could not complete the Phase 10 readiness check.");
    } finally {
      setLoading(false);
    }
  }, [user, contacts, online]);

  useEffect(() => {
    check();
  }, [check]);

  return { report, loading, error, check };
}
