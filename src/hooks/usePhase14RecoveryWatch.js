import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/apiAuth";

const POLL_MS = 15000;

export default function usePhase14RecoveryWatch({ user, online, onRecover, onOpen, open = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState(null);
  const [autoOpenedId, setAutoOpenedId] = useState("");
  const initialLoadRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user || !online) {
      setEvents([]);
      setCheckedAt(null);
      return [];
    }

    setLoading(true);
    setError("");

    try {
      const response = await api("/api/v1/sos/active");
      const nextEvents = Array.isArray(response.events) ? response.events : [];
      setEvents(nextEvents);
      setCheckedAt(new Date().toISOString());
      return nextEvents;
    } catch (e) {
      setError(e?.message || "Could not check for pending SOS sessions.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, online]);

  useEffect(() => {
    initialLoadRef.current = true;
    setAutoOpenedId("");
  }, [user?.id, online]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !online) return undefined;
    const timer = window.setInterval(() => {
      refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [user, online, refresh]);

  useEffect(() => {
    if (!user || !online || open || !initialLoadRef.current || !onOpen) return;
    initialLoadRef.current = false;

    refresh().then((nextEvents) => {
      if (nextEvents.length === 1 && nextEvents[0].id !== autoOpenedId) {
        setAutoOpenedId(nextEvents[0].id);
        onOpen(nextEvents[0]);
      }
    });
  }, [user, online, open, onOpen, refresh, autoOpenedId]);

  const recover = useCallback(
    async (eventId) => {
      if (!eventId || !onRecover) return false;
      setActionId(eventId);
      setError("");

      try {
        const recovered = await onRecover(eventId);
        if (!recovered) return false;
        await refresh();
        return true;
      } catch (e) {
        setError(e?.message || "Could not recover the SOS flow.");
        return false;
      } finally {
        setActionId("");
      }
    },
    [onRecover, refresh]
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
        setError(e?.message || "Could not cancel the pending SOS event.");
      } finally {
        setActionId("");
      }
    },
    [refresh]
  );

  return {
    events,
    loading,
    actionId,
    error,
    checkedAt,
    autoMonitoring: Boolean(user && online),
    refresh,
    recover,
    cancel,
    pollMs: POLL_MS,
  };
}
