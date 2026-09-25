function RecoveryAction({ children, onClick, disabled, danger = false }) {
  return (
    <button
      className={danger ? "cancel-btn" : "ghost-btn"}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

function formatLocation(location) {
  if (!location) return "No saved location";
  return location.latitude.toFixed(5) + ", " + location.longitude.toFixed(5);
}

function eventAge(createdAt) {
  const timestamp = Date.parse(createdAt || "");
  if (!Number.isFinite(timestamp)) return "Unknown age";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  return minutes + "m ago";
}

export default function Phase13RecoveryPanel({
  events,
  loading,
  actionId,
  error,
  onRecover,
  onCancel,
  onRefresh,
  user,
  online,
}) {
  const hasEvents = Array.isArray(events) && events.length > 0;

  return (
    <section className="panel phase13-panel">
      <div className="phase13-head">
        <div>
          <span className="panel-kicker">PHASE 13 · RECOVERY</span>
          <h2>Recover an interrupted safety session</h2>
          <p>
            VoicePrint can find pending SOS events left behind after a refresh,
            crash, or closed tab. Recovery is a review step, not a new alert.
          </p>
        </div>
        <button className="ghost-btn" onClick={onRefresh} disabled={loading || !user || !online}>
          {loading ? "Checking…" : "↻ Check again"}
        </button>
      </div>

      <div className="phase13-safety-note">
        <span>✓</span>
        <div>
          <strong>Recovery never sends an alert by itself.</strong>
          <small>
            Reopening a pending event starts a fresh local confirmation window.
            SMS delivery still waits for the normal server-side dispatch gate.
          </small>
        </div>
      </div>

      {!user && (
        <div className="phase13-action-note">
          Sign in from Settings to recover authenticated SOS sessions.
        </div>
      )}

      {user && !online && (
        <div className="phase13-action-note">
          Reconnect to the internet before checking the cloud recovery queue.
        </div>
      )}

      {user && online && !loading && !hasEvents && (
        <div className="phase13-empty">
          <span>✓</span>
          <div>
            <strong>No pending SOS events found</strong>
            <small>
              The authenticated recovery check returned no active cloud event.
            </small>
          </div>
        </div>
      )}

      {hasEvents && (
        <div className="phase13-list">
          {events.map((event) => {
            const busy = actionId === event.id;
            const remaining = Number(event.confirmationRemainingSeconds || 0);

            return (
              <article className="phase13-event" key={event.id}>
                <div className="phase13-event-main">
                  <div className="phase13-event-badge">!</div>
                  <div>
                    <div className="phase13-event-topline">
                      <strong>Pending SOS</strong>
                      <span>{eventAge(event.createdAt)}</span>
                    </div>
                    <div className="phase13-event-meta">
                      <span>{event.source === "three-clap" ? "3-clap trigger" : "Manual trigger"}</span>
                      <span>{formatLocation(event.location)}</span>
                      <span>{event.contactsCount || 0} contact(s)</span>
                    </div>
                    <small className="phase13-event-id">{event.id}</small>
                  </div>
                </div>

                <div className="phase13-event-state">
                  <span className="phase13-countdown">
                    {remaining > 0 ? remaining + "s gate" : "Gate elapsed"}
                  </span>
                  <div className="phase13-actions">
                    <RecoveryAction disabled={busy} onClick={() => onRecover(event.id)}>
                      {busy ? "Opening…" : "Recover flow"}
                    </RecoveryAction>
                    <RecoveryAction danger disabled={busy} onClick={() => onCancel(event.id)}>
                      {busy ? "Working…" : "Cancel event"}
                    </RecoveryAction>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {error && <div className="setting-error">{error}</div>}
    </section>
  );
}
