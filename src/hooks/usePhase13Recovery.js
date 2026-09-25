import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/apiAuth";

export default function usePhase13Recovery({ user, online, onRecover }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user || !online) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api("/api/v1/sos/active");
      setEvents(Array.isArray(response.events) ? response.events : []);
    } catch (e) {
      setError(e?.message || "Could not check for recoverable SOS events.");
    } finally {
      setLoading(false);
    }
  }, [user, online]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recover = useCallback(
    async (eventId) => {
      if (!eventId || !onRecover) return false;
      setActionId(eventId);
      setError("");

      try {
        const recovered = await onRecover(eventId);
        if (!recovered) return false;
        return true;
      } catch (e) {
        setError(e?.message || "Could not recover the SOS flow.");
        return false;
      } finally {
        setActionId("");
      }
    },
    [onRecover]
  );

  const cancel = useCallback(
    async (eventId) => {
      if (!eventId) return;
      setActionId(eventId);
      setError("");

      try {
        await api("/api/v1/sos/events/" + encodeURIComponent(eventId) + "/cancel", {
          method: "POST",
        });
        await refresh();
      } catch (e) {
        setError(e?.message || "Could not cancel the recoverable SOS event.");
      } finally {
        setActionId("");
      }
    },
    [refresh]
  );

  return { events, loading, actionId, error, refresh, recover, cancel };
}
