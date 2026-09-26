import { useEffect, useState } from "react";

function eventAge(createdAt, now) {
  const timestamp = Date.parse(createdAt || "");
  if (!Number.isFinite(timestamp)) return "Unknown age";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  return minutes + "m ago";
}

function locationText(location) {
  if (!location) return "No saved location";
  return location.latitude.toFixed(5) + ", " + location.longitude.toFixed(5);
}

export default function Phase14RecoveryWatchPanel({
  events,
  loading,
  actionId,
  error,
  checkedAt,
  autoMonitoring,
  onRecover,
  onCancel,
  onRefresh,
  user,
  online,
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!events.length) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [events.length]);

  const hasEvents = Array.isArray(events) && events.length > 0;

  const safeCancel = (eventId) => {
    if (
      window.confirm(
        "Cancel this pending VoicePrint SOS event? No new alert will be created."
      )
    ) {
      onCancel(eventId);
    }
  };

  return (
    <section className="panel phase14-panel">
      <div className="phase14-head">
        <div>
          <span className="panel-kicker">PHASE 14 · RECOVERY WATCH</span>
          <h2>Stay ahead of interrupted SOS sessions</h2>
          <p>
            VoicePrint checks the authenticated recovery queue automatically so a pending
            SOS remains visible after a refresh or when it was created in another tab.
          </p>
        </div>
        <button
          className="ghost-btn"
          type="button"
          onClick={onRefresh}
          disabled={loading || !user || !online}
        >
          {loading ? "Checking…" : "↻ Check now"}
        </button>
      </div>

      <div className="phase14-monitor-row">
        <span className={autoMonitoring ? "phase14-monitor-pill live" : "phase14-monitor-pill"}>
          <span />
          {autoMonitoring ? "Automatic monitoring ON" : "Monitoring paused"}
        </span>
        <span>
          {checkedAt
            ? "Last checked " + new Date(checkedAt).toLocaleTimeString()
            : "Waiting for first cloud check"}
        </span>
      </div>

      {!user && (
        <div className="phase14-action-note">
          Sign in from Settings to monitor authenticated pending SOS sessions.
        </div>
      )}

      {user && !online && (
        <div className="phase14-action-note">
          Reconnect to the internet before checking the cloud recovery queue.
        </div>
      )}

      {user && online && !loading && !hasEvents && (
        <div className="phase14-empty">
          <span>✓</span>
          <div>
            <strong>No pending SOS sessions</strong>
            <small>The latest authenticated recovery check returned no active cloud event.</small>
          </div>
        </div>
      )}

      {hasEvents && (
        <div className="phase14-list">
          {events.map((event) => {
            const busy = actionId === event.id;
            const createdAt = Date.parse(event.createdAt || "");
            const remaining = Number(event.confirmationRemainingSeconds || 0);
            const liveRemaining = Number.isFinite(createdAt)
              ? Math.max(0, Math.ceil((10000 - (now - createdAt)) / 1000))
              : remaining;
            const gate = Math.max(0, Math.min(remaining, liveRemaining));

            return (
              <article className="phase14-event" key={event.id}>
                <div className="phase14-event-main">
                  <div className="phase14-event-badge">!</div>
                  <div>
                    <div className="phase14-event-topline">
                      <strong>Pending SOS</strong>
                      <span>{eventAge(event.createdAt, now)}</span>
                    </div>
                    <div className="phase14-event-meta">
                      <span>{event.source === "three-clap" ? "3-clap trigger" : "Manual trigger"}</span>
                      <span>{locationText(event.location)}</span>
                      <span>{event.contactsCount || 0} contact(s)</span>
                      <span>{gate > 0 ? gate + "s gate" : "Gate elapsed"}</span>
                    </div>
                    <small className="phase14-event-id">{event.id}</small>
                  </div>
                </div>

                <div className="phase14-actions">
                  <button
                    className="ghost-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => onRecover(event.id)}
                  >
                    {busy ? "Opening…" : "Review & recover"}
                  </button>
                  <button
                    className="cancel-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => safeCancel(event.id)}
                  >
                    Cancel event
                  </button>
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
