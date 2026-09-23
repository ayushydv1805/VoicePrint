export default function Phase8OperationsPanel({ report, loading, error, onCheck }) {
  const frontend = report?.frontend || {};
  const api = report?.api || {};

  const checks = [
    ["Vercel headers", frontend.contentType && frontend.frame && frontend.referrer],
    ["Permissions policy", frontend.permissions],
    ["Content security policy", frontend.csp],
    ["Transport security", frontend.hsts],
    ["API reachable", api.reachable],
    ["API release parity", api.releaseParity],
    ["API no-store", api.noStore],
    ["API request tracing", api.requestTracing],
  ];

  return (
    <section className="panel phase8-panel">
      <div className="phase8-head">
        <div>
          <span className="panel-kicker">PHASE 8 · OPERATIONS</span>
          <h2>Production guardrails</h2>
          <p>Live verification for the Vercel shell and VoicePrint API boundary.</p>
        </div>
        <button className="ghost-btn" onClick={onCheck} disabled={loading}>
          {loading ? "Checking…" : "↻ Verify"}
        </button>
      </div>

      <div className="phase8-release-row">
        <div><span>Frontend</span><strong>Vercel production</strong></div>
        <div><span>Backend release</span><strong>{api.phase || "Not checked"}</strong></div>
        <div><span>Last check</span><strong>{report?.checkedAt ? new Date(report.checkedAt).toLocaleTimeString() : "—"}</strong></div>
      </div>

      <div className="phase8-grid">
        {checks.map(([label, ok]) => (
          <div className="phase8-check" key={label}>
            <span className={ok ? "check done" : "check"}>{ok ? "✓" : "!"}</span>
            <div><strong>{label}</strong><small>{ok ? "Verified" : "Action required / not verified"}</small></div>
          </div>
        ))}
      </div>

      <div className="phase8-note">
        <span>i</span>
        <div>
          <strong>Database security</strong>
          <p>RLS remains a Supabase-side control and is intentionally shown separately. The browser build cannot enable database RLS by itself.</p>
        </div>
      </div>

      {error && <div className="setting-error">{error}</div>}
    </section>
  );
}
