import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://voiceprint-api-v4.onrender.com"
).replace(/\/$/, "");

function headerReport(headers) {
  const permissions = headers.get("Permissions-Policy") || "";
  const csp = headers.get("Content-Security-Policy") || "";

  return {
    contentType: headers.get("X-Content-Type-Options") === "nosniff",
    frame: headers.get("X-Frame-Options") === "DENY",
    referrer: headers.get("Referrer-Policy") === "no-referrer",
    permissions:
      permissions.includes("microphone=(self)") &&
      permissions.includes("geolocation=(self)") &&
      permissions.includes("camera=()"),
    csp: csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"),
    hsts: window.location.protocol !== "https:" || Boolean(headers.get("Strict-Transport-Security")),
  };
}

export default function usePhase8DeploymentStatus() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    setLoading(true);
    setError("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    try {
      const [frontendResponse, apiResponse] = await Promise.all([
        fetch(`${window.location.origin}/?phase8-check=1`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "text/html" },
        }),
        fetch(`${API_BASE_URL}/api/health`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }),
      ]);

      const apiBody = await apiResponse.json().catch(() => ({}));
      if (!frontendResponse.ok) {
        throw new Error("Vercel frontend health check failed.");
      }

      setReport({
        frontend: headerReport(frontendResponse.headers),
        api: {
          reachable: apiResponse.ok && apiBody?.ok === true,
          phase: apiBody?.version || "unknown",
          releaseParity: apiBody?.version === "phase-8",
          noStore: (apiResponse.headers.get("Cache-Control") || "").toLowerCase().includes("no-store"),
          requestTracing: Boolean(apiBody?.requestId),
        },
        checkedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(
        e?.name === "AbortError"
          ? "Production checks timed out."
          : e?.message || "Could not complete deployment checks."
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { report, loading, error, check };
}
