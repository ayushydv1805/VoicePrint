function DrillCheck({ label, detail, state = "good" }) {
  const icon = state === "good" ? "✓" : state === "warn" ? "!" : "×";
  return (
    <div className="phase12-check">
      <span className={"check " + (state === "good" ? "done" : "") + (state === "warn" ? "phase12-warn" : "")}>{icon}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export default function Phase12DrillPanel({ report, running, error, onRun, user, online }) {
  const browser = report?.browser || {};
  const cloud = report?.cloud || {};
  const features = cloud?.features || {};
  const smsConfigured = cloud?.sms?.configured;

  const backendReady = Boolean(cloud?.ok && cloud?.drill && cloud?.phase === "14");
  const deviceReady = Boolean(browser.secureContext && browser.microphoneSupported && browser.locationSupported);
  const summary = report?.summary;

  return (
    <section className="panel phase12-panel">
      <div className="phase12-head">
        <div>
          <span className="panel-kicker">PHASE 14 · SAFETY DRILL</span>
          <h2>Run a safe end-to-end drill</h2>
          <p>Tests browser readiness and the cloud safety boundary without creating an SOS event or sending an SMS.</p>
        </div>
        <button className="primary-btn" onClick={onRun} disabled={running || !user || !online}>
          {running ? "Running…" : "Run safety drill"}
        </button>
      </div>

      <div className="phase12-safety-note">
        <span>✓</span>
        <div>
          <strong>No real alert is dispatched.</strong>
          <small>The drill does not create an SOS event, send Twilio SMS, or contact emergency services.</small>
        </div>
      </div>

      {!user && <div className="phase12-action-note">Sign in from Settings to run the cloud portion of the drill.</div>}
      {user && !online && <div className="phase12-action-note">Reconnect to the internet before running the cloud portion.</div>}

      {report && (
        <>
          <div className="phase12-result-banner">
            <div className="phase12-result-icon">✓</div>
            <div>
              <strong>Drill completed</strong>
              <span>{new Date(report.ranAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="phase12-grid">
            <div className="phase12-card">
              <span className="panel-kicker">DEVICE</span>
              <h3>Browser path</h3>
              <DrillCheck label="HTTPS / secure context" detail={browser.secureContext ? "Secure context detected." : "Use the HTTPS production site."} state={browser.secureContext ? "good" : "bad"} />
              <DrillCheck label="Microphone" detail={browser.microphoneSupported ? "Audio input is supported. Permission: " + browser.microphonePermission : "Microphone API unavailable."} state={browser.microphoneSupported && browser.microphonePermission !== "denied" ? "good" : "bad"} />
              <DrillCheck label="Location" detail={browser.locationSupported ? (browser.locationAvailable ? "A current location is available." : "Location API works but no current fix is loaded.") : "Geolocation API unavailable."} state={browser.locationSupported && (browser.locationAvailable ? "good" : "warn")} />
              <DrillCheck label="Network" detail={browser.online ? "Browser reports online." : "Browser reports offline."} state={browser.online ? "good" : "bad"} />
              <DrillCheck label="PWA support" detail={browser.serviceWorker ? "Service workers are supported." : "Service worker unavailable."} state={browser.serviceWorker ? "good" : "warn"} />
            </div>

            <div className="phase12-card">
              <span className="panel-kicker">CLOUD</span>
              <h3>Safe backend simulation</h3>
              <DrillCheck label="Drill endpoint" detail={backendReady ? "Authenticated Phase 14 drill response received." : "Cloud drill response not verified."} state={backendReady ? "good" : "bad"} />
              <DrillCheck label="Database RLS" detail={features.securityRlsEnforced ? "RLS is enforced." : "RLS is not confirmed."} state={features.securityRlsEnforced ? "good" : "bad"} />
              <DrillCheck label="Trusted contacts" detail={report.contacts.count + " contact(s) loaded for this account."} state={report.contacts.count > 0 ? "good" : "warn"} />
              <DrillCheck label="SMS provider" detail={smsConfigured ? "Twilio is configured, but this drill will not send SMS." : "Twilio is not configured; drill remains non-delivery."} state="warn" />
              <DrillCheck label="Delivery resilience" detail={features.deliveryResilience ? "Bounded retry layer is available." : "Retry layer not verified."} state={features.deliveryResilience ? "good" : "warn"} />
            </div>
          </div>

          <div className="phase12-foot">
            <span>SMS sent: {summary?.smsSent ? "YES" : "NO"}</span>
            <span>SOS created: {summary?.sosCreated ? "YES" : "NO"}</span>
            <span>Emergency services contacted: {summary?.emergencyServicesContacted ? "YES" : "NO"}</span>
          </div>
        </>
      )}

      {error && <div className="setting-error">{error}</div>}
    </section>
  );
}
