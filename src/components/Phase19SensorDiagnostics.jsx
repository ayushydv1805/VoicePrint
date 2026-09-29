export default function Phase19SensorDiagnostics({
  active,
  listening,
  calibrating,
  micRecovering,
  signalLevel,
  clapCount,
  lastClapAt,
  micError,
}) {
  const level = Math.max(0, Math.min(100, Number(signalLevel) || 0));
  const lastClap = lastClapAt ? new Date(lastClapAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "No clap detected yet";
  const state = !active ? "Protection paused" : micRecovering ? "Reconnecting microphone" : calibrating ? "Calibrating room sound" : listening ? "Sensor armed" : "Starting sensor";

  return (
    <section className="panel phase19-sensor-panel" aria-label="Sensor diagnostics">
      <div className="phase19-sensor-head">
        <div>
          <span className="panel-kicker">PHASE 19 · SENSOR TELEMETRY</span>
          <h2>Microphone diagnostics</h2>
          <p>Live status only. VoicePrint does not upload or store microphone audio.</p>
        </div>
        <span className={listening && !micRecovering ? "phase19-state good" : "phase19-state"}>{state}</span>
      </div>

      <div className="phase19-meter-card">
        <div className="phase19-meter-top">
          <span>LIVE INPUT LEVEL</span>
          <strong>{level}%</strong>
        </div>
        <div className="phase19-meter-track" aria-hidden="true"><span style={{ width: level + "%" }} /></div>
        <div className="phase19-meter-meta">
          <span>{calibrating ? "Learning ambient sound…" : micRecovering ? "Waiting for a fresh mic stream…" : "Clap transient filter active"}</span>
          <span>Pattern {clapCount}/3</span>
        </div>
      </div>

      <div className="phase19-facts">
        <div><span>Protection</span><strong>{active ? "ON" : "PAUSED"}</strong></div>
        <div><span>Microphone</span><strong>{micRecovering ? "RECOVERING" : listening ? "READY" : "STARTING"}</strong></div>
        <div><span>Last clap</span><strong>{lastClap}</strong></div>
      </div>

      {micError && <div className="phase19-error">🎙 {micError}</div>}
    </section>
  );
}
