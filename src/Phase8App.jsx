import { useEffect, useRef, useState } from "react";
import usePhase4Core from "./hooks/usePhase4Core";
import usePhase5Enhancements from "./hooks/usePhase5Enhancements";
import usePhase6Status from "./hooks/usePhase6Status";
import ReliabilityPanel from "./components/Phase6ReliabilityPanel";
import Home from "./components/Phase4Home";
import Contacts from "./components/Phase4Contacts";
import History from "./components/Phase4History";
import Control from "./components/Phase4Control";
import Account from "./components/Phase4Account";
import Modal from "./components/Phase4Modal";
import SafetyActions from "./components/Phase5SafetyActions";
import PrivacyPanel from "./components/Phase7PrivacyPanel";
import Phase8OperationsPanel from "./components/Phase8OperationsPanel";
import usePhase8DeploymentStatus from "./hooks/usePhase8DeploymentStatus";
import usePhase9Incident from "./hooks/usePhase9Incident";
import Phase9IncidentPanel from "./components/Phase9IncidentPanel";
import usePhase10Readiness from "./hooks/usePhase10Readiness";
import Phase10ReadinessPanel from "./components/Phase10ReadinessPanel";

const tabs = [
  ["home", "Home", "⌂"],
  ["control", "Safety", "✦"],
  ["contacts", "Contacts", "♧"],
  ["history", "History", "◷"],
  ["settings", "Settings", "⚙"],
];

export default function Phase8App() {
  const c = usePhase4Core();
  const [page, setPage] = useState("home");
  const lastNotificationRef = useRef("");

  const p6 = usePhase6Status();
  const p8 = usePhase8DeploymentStatus();
  const p9 = usePhase9Incident();

  const clearLocalData = async () => {
    const confirmed = window.confirm("Clear this browser VoicePrint data and sign out? Cloud contacts and SOS history will remain untouched.");
    if (!confirmed) return;
    try { await c.logout(); } finally {
      localStorage.removeItem("voiceprint-protection");
      localStorage.removeItem("voiceprint-notifications");
      localStorage.removeItem("voiceprint-device-id");
      window.location.reload();
    }
  };

  const p5 = usePhase5Enhancements({
    enabled: c.active,
    listening: c.listening,
    sosActive: c.open,
  });
  const p10 = usePhase10Readiness({ user: c.user, contacts: c.contacts, online: p5.online });

  useEffect(() => {
    if (!c.open || !c.event?.id || !c.user) return;
    const key = `${c.event.id}:${c.event.status}`;
    if (lastNotificationRef.current === key) return;
    lastNotificationRef.current = key;

    if (c.event.status === "pending") {
      p5.notify("VoicePrint SOS is active", "Your confirmation window is running.");
    }
    if (c.event.status === "dispatched") {
      p5.notify("VoicePrint alert processed", c.event.delivery?.message || "The trusted-contact delivery flow was processed.");
    }
    if (c.event.status === "cancelled") {
      p5.notify("VoicePrint SOS cancelled", "The alert was cancelled before dispatch.");
    }
  }, [c.open, c.event?.id, c.event?.status, c.event?.delivery?.message, c.user, p5.notify]);

  if (!c.ready) {
    return (
      <div className="app-shell app-loading">
        <div className="loading-card">
          <div className="loading-spinner" />
          <strong>Starting VoicePrint</strong>
          <span>Checking your account and safety services…</span>
        </div>
      </div>
    );
  }

  const settings = (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="panel-kicker">PHASE 9 · OPERATIONS</span>
          <h1>Safety & reliability</h1>
          <p>Control detection, device readiness and cloud account access.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="panel settings-main">
          <div className="setting-item">
            <div>
              <strong>Protection mode</strong>
              <span>Enable or pause the local trigger system.</span>
            </div>
            <button
              className={c.active ? "toggle on" : "toggle"}
              onClick={() => c.setActive((value) => !value)}
              aria-label="Toggle protection mode"
            >
              <span />
            </button>
          </div>

          <div className="setting-divider" />

          <div className="setting-item">
            <div>
              <strong>Microphone</strong>
              <span>{c.listening ? `${c.clapCount}/3 claps detected` : "Ready for three-clap detection"}</span>
            </div>
            <button className="ghost-btn" onClick={() => (c.listening ? c.stopMic() : c.startMic())} disabled={!c.active}>
              {c.listening ? "Stop" : "Start"}
            </button>
          </div>
          {c.micError && <div className="setting-error">🎙 {c.micError}</div>}

          <div className="setting-divider" />

          <div className="setting-item">
            <div>
              <strong>Location</strong>
              <span>{c.watching ? "Live watch active" : c.location ? "Recent location available" : "Not enabled"}</span>
            </div>
            <button className="ghost-btn" onClick={() => (c.watching ? c.stopWatching() : c.startWatching())}>
              {c.watching ? "Stop" : "Enable"}
            </button>
          </div>
          {c.locationError && <div className="setting-error">⌖ {c.locationError}</div>}

          <div className="setting-divider" />

          <div className="setting-item">
            <div>
              <strong>Browser safety notifications</strong>
              <span>
                {p5.notificationPermission === "granted"
                  ? "Enabled for important VoicePrint state changes."
                  : "Optional alerts while this browser session is open."}
              </span>
            </div>
            <button
              className="ghost-btn"
              onClick={p5.requestNotifications}
              disabled={p5.notificationPermission === "unsupported" || p5.notificationPermission === "granted"}
            >
              {p5.notificationPermission === "granted" ? "Enabled" : "Enable"}
            </button>
          </div>

          <div className="setting-divider" />

          <div className="setting-item">
            <div>
              <strong>Keep screen awake</strong>
              <span>
                {p5.wakeLockActive
                  ? "Wake Lock is active while protection needs it."
                  : "The browser will request Wake Lock while listening or handling an SOS."}
              </span>
            </div>
            <span className={p5.wakeLockActive ? "setting-state good" : "setting-state"}>{p5.wakeLockActive ? "ACTIVE" : "READY"}</span>
          </div>

          <div className="setting-divider" />

          <div className="setting-item">
            <div>
              <strong>Install VoicePrint</strong>
              <span>{p5.canInstall ? "Add the app to your device for a standalone interface." : "Install prompt is available when supported by the browser."}</span>
            </div>
            <button className="ghost-btn" onClick={p5.installApp} disabled={!p5.canInstall}>
              Install
            </button>
          </div>
        </div>

        <Account user={c.user} message={c.authMsg} onSubmit={c.auth} onSignOut={c.logout} />
      </div>

      <SafetyActions
        location={c.location}
        online={p5.online}
        wakeLockActive={p5.wakeLockActive}
        canInstall={p5.canInstall}
        onInstall={p5.installApp}
        onShare={p5.shareLocation}
        onCall={p5.callEmergency}
        onNotifications={p5.requestNotifications}
        notificationPermission={p5.notificationPermission}
      />
      <PrivacyPanel user={c.user} history={c.history} onClearLocalData={clearLocalData} />
      <ReliabilityPanel
        status={p6.status}
        loading={p6.loading}
        error={p6.error}
        onRefresh={p6.refresh}
        online={p5.online}
      />
      <Phase8OperationsPanel
        report={p8.report}
        loading={p8.loading}
        error={p8.error}
        onCheck={p8.check}
      />
      <Phase10ReadinessPanel
        report={p10.report}
        loading={p10.loading}
        error={p10.error}
        onCheck={p10.check}
      />
    </div>
  );

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")} aria-label="Go to VoicePrint home">
          <span className="brand-mark">
            <span className="shield small">✦</span>
          </span>
          <span>
            <strong>VoicePrint</strong>
            <small>Hands-Free Emergency Safety</small>
          </span>
        </button>

        <div className="top-status">
          <span className={p5.online ? "network-pill online" : "network-pill offline"}>
            <span />
            {p5.online ? "Online" : "Offline"}
          </span>
          <span className={c.active ? "live-pill" : "live-pill danger"}>
            <span className="pulse" />
            {c.active ? "Protection Active" : "Protection Paused"}
          </span>
          <button className="avatar" onClick={() => setPage("settings")} aria-label="Open settings">
            {c.user ? (c.user.email || "A")[0].toUpperCase() : "A"}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">CONTROL CENTER</div>
          <nav>
            {tabs.map(([id, label, icon]) => (
              <button
                key={id}
                className={page === id ? "nav-item active" : "nav-item"}
                onClick={() => setPage(id)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="security-mini">
              <div className="mini-icon">✓</div>
              <div>
                <strong>{c.user ? "Cloud protected" : "Local demo"}</strong>
                <span>{c.user ? "Signed in" : "Sign in to save data"}</span>
              </div>
            </div>
            <span className="version">VoicePrint v0.10 · Phase 10</span>
          </div>
        </aside>

        <main className="main-content">
          {page === "home" && (
            <>
              <Home
                user={c.user}
                active={c.active}
                listening={c.listening}
                clapCount={c.clapCount}
                contacts={c.contacts}
                location={c.location}
                watching={c.watching}
                history={c.history}
                onEmergency={() => c.startFlow("manual")}
                onMic={() => (c.listening ? c.stopMic() : c.startMic())}
                onLocation={() => (c.watching ? c.stopWatching() : c.startWatching())}
                onNav={setPage}
              />
              <SafetyActions
                location={c.location}
                online={p5.online}
                wakeLockActive={p5.wakeLockActive}
                canInstall={p5.canInstall}
                onInstall={p5.installApp}
                onShare={p5.shareLocation}
                onCall={p5.callEmergency}
                onNotifications={p5.requestNotifications}
                notificationPermission={p5.notificationPermission}
              />
            </>
          )}

          {page === "control" && (
            <>
              <Control
                user={c.user}
                listening={c.listening}
                count={c.clapCount}
                onStart={() => (c.listening ? c.stopMic() : c.startMic())}
                onTest={() => c.startFlow("manual")}
              />
              <SafetyActions
                location={c.location}
                online={p5.online}
                wakeLockActive={p5.wakeLockActive}
                canInstall={p5.canInstall}
                onInstall={p5.installApp}
                onShare={p5.shareLocation}
                onCall={p5.callEmergency}
                onNotifications={p5.requestNotifications}
                notificationPermission={p5.notificationPermission}
              />
            </>
          )}

          {page === "contacts" && <Contacts user={c.user} contacts={c.contacts} onAdd={c.add} onRemove={c.remove} />}
          {page === "history" && <History user={c.user} history={c.history} onRefresh={() => c.refresh().catch((e) => c.setError(e.message))} onOpenDetails={p9.loadEvent} />}
          {page === "settings" && settings}

          {!p5.online && (
            <div className="offline-banner">
              <span>!</span>
              Cloud actions may be unavailable while offline. Local emergency actions such as opening the phone dialer can still be attempted.
            </div>
          )}

          {c.error && (
            <div className="global-error">
              <span>!</span>
              {c.error}
              <button onClick={() => c.setError("")}>×</button>
            </div>
          )}
        </main>
      </div>

      <nav className="mobile-nav">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            className={page === id ? "mobile-nav-item active" : "mobile-nav-item"}
            onClick={() => setPage(id)}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {p5.toast && <div className="phase5-toast">{p5.toast}</div>}

      {p9.detail?.event || p9.loading || p9.error ? (
        <Phase9IncidentPanel
          detail={p9.detail}
          loading={p9.loading}
          error={p9.error}
          onClose={p9.close}
          onRefresh={() => p9.detail?.event?.id && p9.loadEvent(p9.detail.event.id)}
          onExport={p9.exportReport}
          onCopyMap={async () => {
            const copied = await p9.copyMapLink();
            if (!copied) window.alert("Could not copy the map link.");
          }}
        />
      ) : null}

      {c.open && (
        <Modal
          user={c.user}
          event={c.event}
          location={c.location}
          onClose={c.closeFlow}
          onFinish={c.finish}
        />
      )}
    </div>
  );
}
