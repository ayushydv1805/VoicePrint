function Check({ label, detail, state = "good" }) {
  const icon = state === "good" ? "✓" : state === "warn" ? "!" : "×";
  return (
    <div className="phase10-check">
      <span className={"check " + (state === "good" ? "done" : "") + (state === "warn" ? " phase10-warn" : "")}>
        {icon}
      </span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function permissionText(value) {
  if (value === "granted") return "Granted";
  if (value === "denied") return "Denied";
  if (value === "prompt") return "Permission will be requested when needed";
  if (value === "unsupported") return "Browser does not expose this permission state";
  return value || "Unknown";
}

export default function Phase10ReadinessPanel({ report, loading, error, onCheck }) {
  const browser = report?.browser || {};
  const cloud = report?.cloud || {};
  const status = cloud.status?.features || {};
  const smsConfigured = cloud.status?.sms?.configured;

  const browserReady = browser.secureContext && browser.online && browser.localStorage && browser.microphone && browser.geolocation;
  const cloudReady = cloud.reachable && cloud.releaseParity && cloud.requestTracing;
  const dataReady = Boolean(status.securityRlsEnforced);
  const contactsReady = Boolean(report?.contacts?.ready);

  return (
    <section className="panel phase10-panel">
      <div className="phase10-head">
        <div>
          <span className="panel-kicker">PHASE 10 · READINESS</span>
          <h2>Safety pre-flight check</h2>
          <p>Run a local browser and cloud readiness check before relying on the VoicePrint workflow.</p>
        </div>
        <button className="ghost-btn" onClick={onCheck} disabled={loading}>
          {loading ? "Checking…" : "↻ Run check"}
        </button>
      </div>

      <div className="phase10-banner">
        <div className={"phase10-banner-icon " + (browserReady && cloudReady && dataReady && contactsReady ? "ready" : "attention")}>
          {browserReady && cloudReady && dataReady && contactsReady ? "✓" : "!"}
        </div>
        <div>
          <strong>
            {browserReady && cloudReady && dataReady && contactsReady ? "Core safety path is ready" : "Attention needed before relying on cloud safety"}
          </strong>
          <span>
            {report?.checkedAt ? "Checked " + new Date(report.checkedAt).toLocaleTimeString() : "No readiness check has completed yet."}
          </span>
        </div>
      </div>

      <div className="phase10-grid">
        <div className="phase10-card">
          <span className="panel-kicker">DEVICE</span>
          <h3>Browser readiness</h3>
          <Check label="Secure context" detail={browser.secureContext ? "HTTPS context detected." : "Use the deployed HTTPS app."} state={browser.secureContext ? "good" : "bad"} />
          <Check label="Microphone" detail={permissionText(browser.microphonePermission)} state={browser.microphone ? (browser.microphonePermission === "denied" ? "bad" : "good") : "bad"} />
          <Check label="Location" detail={permissionText(browser.geolocationPermission)} state={browser.geolocation ? "good" : "bad"} />
          <Check label="Notifications" detail={permissionText(browser.notificationPermission)} state={browser.notifications ? (browser.notificationPermission === "unsupported" ? "warn" : browser.notificationPermission === "denied" ? "warn" : "good") : "warn"} />
          <Check label="Offline state" detail={browser.online ? "Browser reports an active network connection." : "Browser is offline."} state={browser.online ? "good" : "bad"} />
        </div>

        <div className="phase10-card">
          <span className="panel-kicker">CLOUD</span>
          <h3>Backend readiness</h3>
          <Check label="API reachable" detail={cloud.reachable ? "VoicePrint API responded." : "Backend is unavailable."} state={cloud.reachable ? "good" : "bad"} />
          <Check label="Release parity" detail={cloud.release ? "Backend reports " + cloud.release + "." : "Backend release not verified."} state={cloud.releaseParity ? "good" : "bad"} />
          <Check label="Request tracing" detail={cloud.requestTracing ? "Request IDs are active." : "Request tracing not verified."} state={cloud.requestTracing ? "good" : "warn"} />
          <Check label="Database RLS" detail={dataReady ? "Row Level Security is enforced." : "RLS is not confirmed as enforced."} state={dataReady ? "good" : "bad"} />
          <Check label="Trusted contact" detail={contactsReady ? report.contacts.count + " saved contact(s)." : userStatus(report?.contacts, cloud.authReady)} state={contactsReady ? "good" : "warn"} />
          <Check label="SMS provider" detail={smsConfigured ? "Twilio is configured server-side." : "Optional provider is not configured."} state={smsConfigured ? "good" : "warn"} />
        </div>
      </div>

      <div className="phase10-foot">
        <span>{browser.serviceWorker ? "PWA service worker supported" : "PWA service worker unavailable"}</span>
        <span>{cloud.status?.confirmationWindowSeconds ?? "—"}s confirmation gate</span>
        <span>{cloud.status?.locationUpdateMinSeconds ?? "—"}s location interval</span>
      </div>

      {error && <div className="setting-error">{error}</div>}
    </section>
  );
}

function userStatus(contacts, authReady) {
  if (!authReady) return "Sign in to save trusted contacts.";
  if (!contacts?.count) return "Add at least one trusted contact.";
  return "Contacts are not ready for cloud alerts.";
}
