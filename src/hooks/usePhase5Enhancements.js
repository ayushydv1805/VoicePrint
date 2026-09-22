import { useCallback, useEffect, useRef, useState } from "react";

const NOTIFICATION_KEY = "voiceprint-notifications";

export default function usePhase5Enhancements({ enabled = false, listening = false, sosActive = false } = {}) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [canInstall, setCanInstall] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [toast, setToast] = useState("");
  const installEventRef = useRef(null);
  const wakeLockRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleInstallPrompt = (event) => {
      event.preventDefault();
      installEventRef.current = event;
      setCanInstall(true);
    };

    const handleInstalled = () => {
      installEventRef.current = null;
      setCanInstall(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const installApp = useCallback(async () => {
    const prompt = installEventRef.current;
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    installEventRef.current = null;
    setCanInstall(false);
    return choice?.outcome === "accepted";
  }, []);

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") {
      showToast("Browser notifications are not supported here.");
      return "unsupported";
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      localStorage.setItem(NOTIFICATION_KEY, "true");
      showToast("Safety notifications enabled.");
    }
    return permission;
  }, [showToast]);

  const notify = useCallback((title, body) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    try {
      new Notification(title, {
        body,
        icon: "/voiceprint-icon.svg",
        badge: "/voiceprint-icon.svg",
        tag: "voiceprint-sos",
        renotify: true,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const shareLocation = useCallback(async (location) => {
    if (!location) {
      showToast("Location is not available yet.");
      return false;
    }
    const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    const text = `My VoicePrint safety location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "VoicePrint safety location", text, url: mapUrl });
        showToast("Location share opened.");
        return true;
      }
      await navigator.clipboard.writeText(`${text}\n${mapUrl}`);
      showToast("Location link copied to clipboard.");
      return true;
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Could not open location sharing.");
      return false;
    }
  }, [showToast]);

  const callEmergency = useCallback(() => {
    window.location.href = "tel:112";
  }, []);

  useEffect(() => {
    const shouldHoldScreenAwake = enabled && (listening || sosActive);
    if (!shouldHoldScreenAwake || !("wakeLock" in navigator)) {
      setWakeLockActive(false);
      return undefined;
    }

    let cancelled = false;

    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener("release", () => setWakeLockActive(false), { once: true });
      } catch {
        setWakeLockActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && shouldHoldScreenAwake) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) lock.release().catch(() => {});
      setWakeLockActive(false);
    };
  }, [enabled, listening, sosActive]);

  return {
    online,
    canInstall,
    installApp,
    notificationPermission,
    requestNotifications,
    notify,
    shareLocation,
    callEmergency,
    wakeLockActive,
    toast,
  };
}
