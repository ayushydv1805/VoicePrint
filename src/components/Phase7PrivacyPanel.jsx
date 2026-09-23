export default function Phase7PrivacyPanel({ user, history, onClearLocalData }) {
  function exportHistory() {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: user?.email || null,
      events: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `voiceprint-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel privacy-panel">
      <div className="privacy-head">
        <div>
          <span className="panel-kicker">PHASE 8 · PRIVACY</span>
          <h2>Data & privacy controls</h2>
          <p>See what this browser keeps locally and manage your safety data export.</p>
        </div>
      </div>
      <div className="privacy-grid">
        <div className="privacy-item"><span>Cloud account</span><strong>{user ? "Signed in" : "Not signed in"}</strong><small>{user ? user.email : "No account session is active."}</small></div>
        <div className="privacy-item"><span>Local device state</span><strong>Browser storage</strong><small>Protection preference, device identifier and session are stored locally by this web app.</small></div>
        <div className="privacy-item"><span>SOS history</span><strong>{history.length} event{history.length === 1 ? "" : "s"} loaded</strong><small>Export only includes history currently loaded into this session.</small></div>
      </div>
      <div className="privacy-actions">
        <button className="ghost-btn" onClick={exportHistory} disabled={!user || history.length === 0}>Export history</button>
        <button className="danger-outline-btn" onClick={onClearLocalData}>Clear this browser's VoicePrint data</button>
      </div>
      <div className="privacy-note">Clearing browser data signs you out and removes local VoicePrint state. It does not delete cloud contacts or SOS history.</div>
    </section>
  );
}