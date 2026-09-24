import { useCallback, useState } from "react";
import { api } from "../lib/apiAuth";

function getPermission(name) {
  if (!navigator.permissions?.query) return Promise.resolve("unsupported");
  return navigator.permissions.query({ name })
    .then((result) => result.state || "unknown")
    .catch(() => "unsupported");
}

export default function usePhase12Drill({ user, online, location, contacts }) {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setRunning(true);
    setError("");

    try {
      const [micPermission, geoPermission, notificationPermission] = await Promise.all([
        getPermission("microphone"),
        getPermission("geolocation"),
        "Notification" in window ? Promise.resolve(Notification.permission) : Promise.resolve("unsupported"),
      ]);

      let cloud = null;
      if (user && online) {
        cloud = await api("/api/v1/safety/drill");
      }

      const browser = {
        secureContext: window.isSecureContext,
        online,
        microphoneSupported: Boolean(navigator.mediaDevices?.getUserMedia),
        microphonePermission: micPermission,
        locationSupported: "geolocation" in navigator,
        locationPermission: geoPermission,
        locationAvailable: Boolean(location),
        notifications: notificationPermission,
        serviceWorker: "serviceWorker" in navigator,
      };

      setReport({
        ranAt: new Date().toISOString(),
        browser,
        cloud,
        contacts: {
          signedIn: Boolean(user),
          count: Array.isArray(contacts) ? contacts.length : 0,
        },
        summary: {
          safeToRun: true,
          smsSent: false,
          sosCreated: false,
          emergencyServicesContacted: false,
        },
      });
    } catch (e) {
      setError(e?.message || "Safety drill could not complete.");
    } finally {
      setRunning(false);
    }
  }, [user, online, location, contacts]);

  return { report, running, error, run };
}
