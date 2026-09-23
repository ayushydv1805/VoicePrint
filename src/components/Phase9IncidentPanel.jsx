export default function Phase9IncidentPanel({
  detail,
  loading,
  error,
  onClose,
  onRefresh,
  onExport,
  onCopyMap,
}) {
  if (!detail && !loading && !error) return null;

  const event = detail?.event;
  const deliveries = detail?.deliveries || [];
  const locations = detail?.locations || [];
  const location = event?.location;

  return (
    <div className="incident-overlay" role="dialog" aria-modal="true" aria-label="SOS incident details">
      <div className="incident-panel">
        <div className="incident-head">
          <div>
            <span className="panel-kicker">PHASE 9 · INCIDENT CENTER</span>
            <h2>SOS incident details</h2>
            <p>Audit the stored event, delivery outcomes and location snapshots.</p>
          </div>
          <button className="incident-close" onClick={onClose} aria-label="Close incident details">×</button>
        </div>

        {loading && !event && <div className="incident-loading">Loading incident details…</div>}

        {error && <div className="setting-error">{error}</div>}

        {event && (
          <>
            <div className="incident-summary">
              <div><span>TYPE</span><strong>{event.source === "three-clap" ? "3-clap SOS" : "Manual SOS"}</strong></div>
              <div><span>STATUS</span><strong className={"incident-status " + event.status}>{event.status}</strong></div>
              <div><span>CREATED</span><strong>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Unknown"}</strong></div>
              <div><span>CONTACTS</span><strong>{event.contactsCount ?? 0}</strong></div>
            </div>

            <div className="incident-grid">
              <section className="incident-card">
                <div className="incident-card-head"><div><span className="panel-kicker">LOCATION</span><h3>Latest coordinates</h3></div></div>
                {location ? (
                  <>
                    <strong className="incident-coordinates">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</strong>
                    <small>Accuracy ± {Math.round(location.accuracy || 0)} m</small>
                    <div className="incident-actions">
                      <button className="ghost-btn" onClick={onCopyMap}>Copy map link</button>
                    </div>
                  </>
                ) : (
                  <div className="incident-empty">No location was saved for this event.</div>
                )}
              </section>

              <section className="incident-card">
                <div className="incident-card-head"><div><span className="panel-kicker">DELIVERY</span><h3>Trusted-contact results</h3></div></div>
                <div className="incident-delivery-summary">
                  <strong>{event.delivery?.message || "No delivery summary recorded."}</strong>
                  <small>Mode: {event.delivery?.mode || "pending"}</small>
                </div>
                {!deliveries.length ? (
                  <div className="incident-empty">No delivery records are attached to this event.</div>
                ) : (
                  <div className="incident-list">
                    {deliveries.map((item) => (
                      <div className="incident-row" key={item.id}>
                        <span className={"incident-status-dot " + item.status}>{item.status === "sent" ? "✓" : item.status === "failed" ? "!" : "•"}</span>
                        <div><strong>{item.contactName || "Trusted contact"}</strong><small>{item.phoneE164 || "Phone hidden"} · {item.provider || "No provider"}</small></div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="incident-card incident-locations">
              <div className="incident-card-head"><div><span className="panel-kicker">LOCATION AUDIT</span><h3>{locations.length} snapshot{locations.length === 1 ? "" : "s"}</h3></div></div>
              {!locations.length ? (
                <div className="incident-empty">No location snapshots were stored.</div>
              ) : (
                <div className="incident-location-table">
                  {locations.map((item) => (
                    <div className="incident-location-row" key={item.id}>
                      <strong>{Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}</strong>
                      <span>± {Math.round(item.accuracy_m || 0)} m</span>
                      <small>{item.captured_at ? new Date(item.captured_at).toLocaleTimeString() : "Unknown time"}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="incident-footer">
              <span>Event ID: {event.id}</span>
              <div>
                <button className="ghost-btn" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh"}</button>
                <button className="primary-btn" onClick={onExport}>Export incident</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
