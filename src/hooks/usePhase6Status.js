import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com").replace(/\/$/, "");

export default function usePhase6Status() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(API_BASE_URL + "/api/v1/status", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Service status request failed.");
      setStatus(body);
    } catch (e) {
      setError(e?.name === "AbortError" ? "Service status check timed out." : e?.message || "Could not reach VoicePrint API.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
