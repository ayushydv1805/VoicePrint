export default function Phase5SafetyActions({
  location,
  online,
  wakeLockActive,
  canInstall,
  onInstall,
  onShare,
  onCall,
  onNotifications,
  notificationPermission,
}) {
  return (
    <section className="phase5-tools">
      <div className="phase5-tools-head">
        <div>
          <span className="panel-kicker">PHASE 5 · SAFETY TOOLS</span>
          <h2>Emergency-ready controls</h2>
          <p>Fast local actions remain available even when the cloud path is unavailable.</p>
        </div>
        <span className={online ? "network-pill online" : "network-pill offline"}>
          <span />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="phase5-action-grid">
        <button className="phase5-action call" type="button" onClick={onCall}>
          <span className="phase5-action-icon">☎</span>
          <div><strong>Call 112</strong><small>Open the phone dialer</small></div>
          <b>↗</b>
        </button>

        <button className="phase5-action" type="button" onClick={() => onShare(location)} disabled={!location}>
          <span className="phase5-action-icon">⌖</span>
          <div><strong>Share location</strong><small>{location ? "Send your current map link" : "Waiting for GPS"}</small></div>
          <b>↗</b>
        </button>

        <button className="phase5-action" type="button" onClick={onNotifications} disabled={notificationPermission === "unsupported"}>
          <span className="phase5-action-icon">◌</span>
          <div>
            <strong>{notificationPermission === "granted" ? "Notifications on" : "Enable alerts"}</strong>
            <small>{notificationPermission === "granted" ? "Browser safety alerts enabled" : "Get SOS state notifications"}</small>
          </div>
          <b>{notificationPermission === "granted" ? "✓" : "→"}</b>
        </button>

        {canInstall && (
          <button className="phase5-action" type="button" onClick={onInstall}>
            <span className="phase5-action-icon">＋</span>
            <div><strong>Install VoicePrint</strong><small>Add the safety app to your device</small></div>
            <b>→</b>
          </button>
        )}
      </div>

      <div className="phase5-safety-note">
        <span>!</span>
        <div>
          <strong>Important</strong>
          <p>VoicePrint cannot guarantee microphone monitoring while a browser is suspended or closed. For an active emergency, use the phone's emergency controls or call 112.</p>
        </div>
        <span className="wake-status">{wakeLockActive ? "Screen awake" : "Screen lock not active"}</span>
      </div>
    </section>
  );
}
