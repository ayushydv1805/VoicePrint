export default function Phase14RecoveryBanner({
  event,
  actionId,
  onRecover,
  onCancel,
}) {
  if (!event) return null;

  const busy = actionId === event.id;
  const source = event.source === "three-clap" ? "3-clap trigger" : "manual trigger";
  const location = event.location
    ? event.location.latitude.toFixed(4) + ", " + event.location.longitude.toFixed(4)
    : "Location not saved";
  const remaining = Number(event.confirmationRemainingSeconds || 0);

  return (
    <aside className="phase14-recovery-banner" role="alert">
      <div className="phase14-recovery-icon">!</div>
      <div className="phase14-recovery-copy">
        <strong>Pending VoicePrint SOS session detected</strong>
        <span>
          {source} · {remaining > 0 ? remaining + "s confirmation gate remaining" : "confirmation gate elapsed"} · {location}
        </span>
      </div>
      <div className="phase14-recovery-actions">
        <button
          className="primary-btn"
          type="button"
          onClick={() => onRecover(event.id)}
          disabled={busy}
        >
          {busy ? "Opening…" : "Review"}
        </button>
        <button
          className="ghost-btn"
          type="button"
          onClick={() => {
            if (window.confirm("Cancel this pending VoicePrint SOS event? No new alert will be created.")) {
              onCancel(event.id);
            }
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </aside>
  );
}
