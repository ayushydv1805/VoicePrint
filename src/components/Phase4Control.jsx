export default function Phase4Control({user,listening,count,onStart,onTest}){
  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">CONTROL CENTER</span><h1>Safety control</h1><p>{user?"Cloud session connected.":"Local demo mode."}</p></div></div>
    <div className="emergency-layout"><div className="emergency-card">
      <div className="sos-symbol">✦</div><h2>{listening?`Pattern monitor · ${count}/3`:"System ready"}</h2>
      <p>{listening?"Make three distinct sharp claps within about three seconds.":"Start the microphone monitor to test the hands-free pattern."}</p>
      <button className="sos-btn" onClick={onStart}>{listening?"STOP LISTENING":"START LISTENING"}</button>
      <button className="manual-sos-link" onClick={onTest}>or run a manual test →</button>
    </div><div className="panel response-panel"><span className="panel-kicker">PHASE 4</span><h2>Cloud pipeline</h2><div className="flow-step"><span>01</span><div><strong>Listen</strong><p>Audio analysis remains local.</p></div><b>✓</b></div><div className="flow-step"><span>02</span><div><strong>Locate</strong><p>GPS coordinates are available during a test.</p></div><b>○</b></div><div className="flow-step"><span>03</span><div><strong>Persist</strong><p>Signed-in events appear in history.</p></div><b>{user?"✓":"○"}</b></div></div></div>
  </div>;
}
