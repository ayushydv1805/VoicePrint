export default function Phase6ReliabilityPanel({ status, loading, error, onRefresh, online }) {
  const features = status?.features || {};
  const checks = [
    ["Authentication", features.authentication],
    ["Persistent contacts", features.persistentContacts],
    ["SOS history", features.sosHistory],
    ["Live location", features.liveLocation],
    ["Durable idempotency", features.durableIdempotency],
    ["Server location throttle", features.serverSideLocationThrottle],
    ["Database RLS", features.securityRlsEnforced],
  ];

  return (
    <section className="panel reliability-panel">
      <div className="reliability-head">
        <div>
          <span className="panel-kicker">PHASE 6 · RELIABILITY</span>
          <h2>Service readiness</h2>
          <p>Live checks for the cloud safety pipeline.</p>
        </div>
        <button className="ghost-btn" onClick={onRefresh} disabled={loading}>
          {loading ? "Checking…" : "↻ Check"}
        </button>
      </div>

      <div className="reliability-summary">
        <div>
          <span className="reliability-dot" />
          <strong>{error ? "Cloud unreachable" : status?.ok ? "API online" : "Not checked"}</strong>
          <small>{status ? "VoicePrint API responded successfully." : "Waiting for first status check."}</small>
        </div>
        <div className={online ? "reliability-network online" : "reliability-network offline"}>
          <strong>{online ? "Browser online" : "Browser offline"}</strong>
          <small>{online ? "Network path is available." : "Cloud requests may fail."}</small>
        </div>
      </div>

      {status && (
        <div className="reliability-grid">
          {checks.map(([label, enabled]) => (
            <div className="reliability-check" key={label}>
              <span className={enabled ? "check done" : "check"}>{enabled ? "✓" : "!"}</span>
              <div><strong>{label}</strong><small>{enabled ? "Enabled" : label === "Database RLS" ? "Action required" : "Unavailable"}</small></div>
            </div>
          ))}
        </div>
      )}

      <div className="reliability-foot">
        <span>Confirmation gate: {status?.confirmationWindowSeconds ?? "—"}s</span>
        <span>Location interval: {status?.locationUpdateMinSeconds ?? "—"}s</span>
        <span>SMS: {status?.sms?.configured ? "Twilio configured" : "Provider not configured"}</span>
      </div>

      {error && <div className="setting-error">{error}</div>}
    </section>
  );
}
