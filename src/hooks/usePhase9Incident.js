import { useCallback, useState } from "react";
import { api } from "../lib/apiAuth";

export default function usePhase9Incident() {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadEvent = useCallback(async (eventId) => {
    if (!eventId) return null;
    setLoading(true);
    setError("");
    try {
      const response = await api("/api/v1/sos/events/" + encodeURIComponent(eventId));
      setDetail({
        event: response.event || null,
        deliveries: response.deliveries || [],
        locations: response.locations || [],
      });
      return response;
    } catch (e) {
      setError(e?.message || "Could not load incident details.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setDetail(null);
    setError("");
  }, []);

  const exportReport = useCallback(() => {
    if (!detail?.event) return false;
    const payload = {
      exportedAt: new Date().toISOString(),
      event: detail.event,
      deliveries: detail.deliveries,
      locations: detail.locations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "voiceprint-incident-" + detail.event.id + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  }, [detail]);

  const copyMapLink = useCallback(async () => {
    const location = detail?.event?.location;
    if (!location) return false;
    const url = "https://www.google.com/maps?q=" + location.latitude + "," + location.longitude;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, [detail]);

  return { detail, loading, error, loadEvent, close, exportReport, copyMapLink };
}
