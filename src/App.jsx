import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelSosEvent,
  createSosEvent,
  dispatchSosEvent,
  updateSosLocation,
} from "./lib/sosApi";
import { useClapDetector, useDeviceLocation } from "./hooks/useSafetySensors";

const navItems = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "emergency", label: "Emergency", icon: "✦" },
  { id: "contacts", label: "Contacts", icon: "♧" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function ShieldIcon({ small = false }) {
  return <span className={small ? "shield small" : "shield"}>✦</span>;
}

function App() {
  const [page, setPage] = useState("home");
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSource, setSosSource] = useState("manual");
  const [sosEvent, setSosEvent] = useState(null);
  const [sosBackendError, setSosBackendError] = useState("");
  const [sosAutoWatching, setSosAutoWatching] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem("voiceprint-protection") !== "false");
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("voiceprint-contacts")) || []; } catch { return []; }
  });
  const lastLocationSyncRef = useRef(0);

  const { listening, clapCount, micError, start: startMic, stop: stopMic } =
    useClapDetector(() => activateEmergency("three-clap"));

  const { location, locationError, watching, requestLocation, startWatching, stopWatching } =
    useDeviceLocation();

  useEffect(() => localStorage.setItem("voiceprint-contacts", JSON.stringify(contacts)), [contacts]);

  useEffect(() => {
    localStorage.setItem("voiceprint-protection", String(active));
    if (!active) stopMic();
  }, [active, stopMic]);

  const activateEmergency = useCallback((source = "manual") => {
    setSosSource(source);
    setSosOpen(true);
    setSosEvent(null);
    setSosBackendError("");
    setSosAutoWatching(false);
    lastLocationSyncRef.current = 0;

    stopMic();

    if (watching) requestLocation();
    else {
      setSosAutoWatching(true);
      startWatching();
    }

    createSosEvent({ source, location, contacts })
      .then((response) => {
        setSosEvent(response.event);
      })
      .catch((error) => {
        setSosBackendError(error?.message || "Remote VoicePrint backend is unavailable right now.");
      });
  }, [contacts, location, requestLocation, startWatching, stopMic, watching]);

  const toggleMic = async () => {
    if (listening) stopMic();
    else if (active) await startMic();
  };

  const toggleLocation = () => {
    if (watching) stopWatching();
    else startWatching();
  };

  const addContact = (contact) => setContacts((items) => [...items, contact]);

  useEffect(() => {
    if (!sosOpen || !sosEvent?.id || !location) return;

    const now = Date.now();
    if (now - lastLocationSyncRef.current < 5000) return;
    lastLocationSyncRef.current = now;

    updateSosLocation(sosEvent.id, location)
      .then((response) => {
        if (response?.event) setSosEvent(response.event);
      })
      .catch((error) => {
        setSosBackendError(error?.message || "Live location sync failed.");
      });
  }, [location, sosEvent?.id, sosOpen]);

  const finishSos = useCallback(async () => {
    if (sosEvent?.id && sosEvent.status !== "dispatched") {
      try {
        const response = await cancelSosEvent(sosEvent.id);
        if (response?.event) setSosEvent(response.event);
      } catch (error) {
        setSosBackendError(error?.message || "The remote SOS event could not be cancelled.");
      }
    }

    if (sosAutoWatching) stopWatching();
    setSosAutoWatching(false);
    setSosOpen(false);
  }, [sosAutoWatching, sosEvent, stopWatching]);

  const dispatchSos = useCallback(async () => {
    if (!sosEvent?.id) return;

    try {
      const response = await dispatchSosEvent(sosEvent.id);
      if (response?.event) setSosEvent(response.event);
      setSosBackendError("");
    } catch (error) {
      setSosBackendError(error?.message || "Remote alert delivery failed.");
      if (error?.payload?.event) setSosEvent(error.payload.event);
    }
  }, [sosEvent]);

  const closeAfterDispatch = useCallback(() => {
    if (sosAutoWatching) stopWatching();
    setSosAutoWatching(false);
    setSosOpen(false);
  }, [sosAutoWatching, stopWatching]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")}>
          <span className="brand-mark"><ShieldIcon small /></span>
          <span><strong>VoicePrint</strong><small>Emergency Safety System</small></span>
        </button>
        <div className="top-status">
          <span className={active ? "live-pill" : "live-pill danger"}><span className="pulse" />{active ? "Protection Active" : "Protection Paused"}</span>
          <button className="avatar">A</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">CONTROL CENTER</div>
          <nav>{navItems.map((item) => (
            <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}</nav>
          <div className="sidebar-bottom">
            <div className="security-mini"><div className="mini-icon">✓</div><div><strong>Privacy first</strong><span>Remote alerts only when you trigger SOS.</span></div></div>
            <span className="version">VoicePrint v0.3 · Phase 3</span>
          </div>
        </aside>

        <main className="main-content">
          {page === "home" && <Home active={active} listening={listening} clapCount={clapCount} contacts={contacts} location={location} watching={watching} onEmergency={() => activateEmergency("manual")} onNavigate={setPage} onToggleMic={toggleMic} onToggleLocation={toggleLocation} />}
          {page === "emergency" && <Emergency active={active} listening={listening} clapCount={clapCount} location={location} locationError={locationError} onEmergency={() => activateEmergency("manual")} onToggleMic={toggleMic} />}
          {page === "contacts" && <Contacts contacts={contacts} onAdd={addContact} />}
          {page === "settings" && <Settings active={active} setActive={setActive} listening={listening} clapCount={clapCount} micError={micError} onToggleMic={toggleMic} watching={watching} location={location} locationError={locationError} onToggleLocation={toggleLocation} />}
        </main>
      </div>

      <nav className="mobile-nav">{navItems.map((item) => (
        <button key={item.id} className={page === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setPage(item.id)}>
          <span>{item.icon}</span><small>{item.label}</small>
        </button>
      ))}</nav>

      {sosOpen && (
        <SosOverlay
          contacts={contacts}
          source={sosSource}
          location={location}
          event={sosEvent}
          backendError={sosBackendError}
          onCancel={finishSos}
          onDispatch={dispatchSos}
          onCloseAfterDispatch={closeAfterDispatch}
        />
      )}
    </div>
  );
}

function Home({ active, listening, clapCount, contacts, location, watching, onEmergency, onNavigate, onToggleMic, onToggleLocation }) {
  return <div className="page">
    <section className="hero">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> HANDS-FREE SAFETY · PHASE 3</div>
        <h1>When you can't<br /><span>reach your phone.</span></h1>
        <p className="hero-copy">VoicePrint now connects the browser SOS flow to a dedicated backend event API, live location updates and a 10-second confirmation window. Trusted-contact SMS is provider-ready but only sends when the backend is configured with its private SMS credentials.</p>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onEmergency}>✦ Test SOS</button>
          <button className={listening ? "secondary-btn listening-btn" : "secondary-btn"} onClick={onToggleMic}>
            <span className="mic-live-dot" />{listening ? `Listening · ${clapCount}/3` : "Start clap detection"}
          </button>
        </div>
      </div>
      <div className="hero-orb">
        <div className={listening ? "orb-ring ring-one listening-ring" : "orb-ring ring-one"} /><div className="orb-ring ring-two" />
        <div className={listening ? "orb-core listening-core" : "orb-core"}><ShieldIcon /><span>{listening ? "LISTENING" : "READY"}</span></div>
        <div className="orb-badge badge-top">MIC <b>{listening ? "ON" : "OFF"}</b></div>
        <div className="orb-badge badge-bottom">GPS <b>{location ? "READY" : "OFF"}</b></div>
      </div>
    </section>

    <section className="status-grid">
      <StatusCard icon="◉" title="Sound Detection" value={listening ? "Listening" : "Standby"} detail={listening ? `${clapCount}/3 claps detected` : "3-clap trigger · tap to start"} good={listening} onClick={onToggleMic} />
      <StatusCard icon="⌖" title="Location" value={watching ? "Live" : location ? "Ready" : "Off"} detail={watching ? "High-accuracy location active" : "Tap to request GPS"} good={Boolean(location)} onClick={onToggleLocation} />
      <StatusCard icon="♧" title="Emergency Contacts" value={contacts.length ? String(contacts.length) : "0"} detail={contacts.length ? "Trusted contacts added" : "Add your first contact"} good={contacts.length > 0} onClick={() => onNavigate("contacts")} />
    </section>

    <section className="dashboard-grid">
      <div className="panel map-panel">
        <div className="panel-head"><div><span className="panel-kicker">EMERGENCY LOCATION</span><h2>Device location</h2></div><span className="status"><span className={location ? "status-dot" : "status-dot purple"} />{watching ? "Live" : location ? "Ready" : "Not enabled"}</span></div>
        <LocationPreview location={location} />
      </div>
      <div className="panel checklist">
        <div className="panel-head"><div><span className="panel-kicker">PHASE 3 SETUP</span><h2>Protection checklist</h2></div></div>
        <ChecklistRow done label="VoicePrint interface ready" />
        <ChecklistRow done={listening} label="Microphone + clap detector" action={!listening ? onToggleMic : null} />
        <ChecklistRow done={contacts.length > 0} label="Emergency contact added" action={!contacts.length ? () => onNavigate("contacts") : null} />
        <ChecklistRow done={Boolean(location)} label="Location permission" action={!location ? onToggleLocation : null} />
        <ChecklistRow done={false} label="Remote SMS provider configured" />
      </div>
    </section>

    <div className="phase-note"><span>03</span><div><strong>Phase 3 is connected</strong><br />SOS events are created on the backend, live coordinates can sync during an active event, and the visible 10-second confirmation gate is now backed by a dispatch API. Real SMS requires private Twilio credentials on the backend; emergency-service dispatch is still not connected.</div></div>
  </div>;
}

function LocationPreview({ location }) {
  if (!location) return <div className="map-placeholder location-off"><div className="map-grid" /><div className="location-empty"><span>⌖</span><strong>Location not enabled</strong><small>Allow location access from the dashboard or settings.</small></div></div>;
  return <div className="map-placeholder"><div className="map-grid" /><div className="map-center"><div className="map-pulse" /><span>⌖</span></div><div className="coordinate-card"><span>DEVICE LOCATION</span><strong>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</strong><small>± {Math.round(location.accuracy)} m accuracy</small></div></div>;
}

function StatusCard({ icon, title, value, detail, good, onClick }) {
  return <button className="status-card" onClick={onClick}><div className="status-card-icon">{icon}</div><div className="status-card-text"><span>{title}</span><strong><i className={good ? "good-dot" : "muted-dot"} />{value}</strong><small>{detail}</small></div>{onClick && <span className="card-arrow">→</span>}</button>;
}

function ChecklistRow({ done, label, action }) {
  return <div className="check-row"><span className={done ? "check done" : "check"}>{done ? "✓" : "!"}</span><span>{label}</span>{!done && action && <button onClick={action}>Set up →</button>}</div>;
}

function Emergency({ active, listening, clapCount, location, locationError, onEmergency, onToggleMic }) {
  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">EMERGENCY CENTER</span><h1>Emergency control</h1><p>Test the hands-free trigger and the remote SOS workflow before adding a real SMS account.</p></div><span className={active ? "state-badge" : "state-badge danger"}>{active ? "PROTECTED" : "PAUSED"}</span></div>
    <div className="emergency-layout">
      <div className="emergency-card">
        <div className="sos-symbol">✦</div>
        <h2>{listening ? `Clap detector ready · ${clapCount}/3` : "Emergency system ready"}</h2>
        <p>{listening ? "Make three distinct sharp claps within about three seconds to open the SOS flow." : "Start microphone detection to enable the hands-free prototype trigger."}</p>
        <button className={listening ? "sos-btn detector-active" : "sos-btn"} onClick={onToggleMic}><span>{listening ? "◉" : "🎙"}</span>{listening ? " STOP LISTENING" : " START LISTENING"}</button>
        <button className="manual-sos-link" onClick={onEmergency}>or test SOS manually →</button>
        <span className="safety-hint">Remote contact alerts are only attempted after the 10-second confirmation window.</span>
      </div>
      <div className="panel response-panel">
        <span className="panel-kicker">RESPONSE FLOW</span><h2>Phase 3 pipeline</h2>
        <FlowStep number="01" title="Listen" text="Browser microphone permission enables local clap analysis." done={listening} />
        <FlowStep number="02" title="Detect 3 claps" text="Three sharp sound spikes are recognized within a short window." done={clapCount > 0} />
        <FlowStep number="03" title="Locate" text={location ? "Current device coordinates are available." : "Location is requested when an SOS is triggered."} done={Boolean(location)} />
        <FlowStep number="04" title="Create event" text="The backend receives a short-lived SOS event and live-location updates." done />
        <FlowStep number="05" title="Dispatch" text="The backend can send trusted-contact SMS through Twilio when private credentials are configured." />
        {locationError && <div className="inline-error">⌖ {locationError}</div>}
      </div>
    </div>
  </div>;
}

function FlowStep({ number, title, text, done }) {
  return <div className="flow-step"><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div><b className={done ? "flow-check done" : "flow-check"}>{done ? "✓" : "○"}</b></div>;
}

function Contacts({ contacts, onAdd }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [relationship, setRelationship] = useState("Family");
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    onAdd({ id: Date.now(), name: name.trim(), phone: phone.trim(), relationship });
    setName(""); setPhone("");
  };
  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">TRUSTED NETWORK</span><h1>Emergency contacts</h1><p>Choose who should receive your trusted-contact alert after the confirmation window.</p></div><span className="count-badge">{contacts.length} saved</span></div>
    <div className="contacts-layout">
      <form className="panel contact-form" onSubmit={submit}><span className="panel-kicker">ADD CONTACT</span><h2>Build your safety circle</h2><p className="muted">Contacts remain in browser storage. When you trigger an SOS, the selected contact details are sent to the VoicePrint backend only for alert processing.</p>
        <label>Name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mom" /></label>
        <label>Phone<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
        <label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option>Family</option><option>Friend</option><option>Partner</option><option>Caregiver</option><option>Other</option></select></label>
        <button className="primary-btn wide" type="submit">+ Add emergency contact</button>
      </form>
      <div className="panel saved-contacts"><span className="panel-kicker">YOUR CONTACTS</span><h2>Trusted people</h2>
        {contacts.length === 0 ? <div className="empty-state"><span>♧</span><strong>No contacts yet</strong><p>Add someone you trust before enabling remote alert delivery.</p></div> : contacts.map((contact) => <div className="contact-row" key={contact.id}><div className="contact-avatar">{contact.name[0].toUpperCase()}</div><div><strong>{contact.name}</strong><span>{contact.relationship} · {contact.phone}</span></div><span className="contact-ok">✓</span></div>)}
      </div>
    </div>
  </div>;
}

function Settings({ active, setActive, listening, clapCount, micError, onToggleMic, watching, location, locationError, onToggleLocation }) {
  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">CONFIGURATION</span><h1>Protection settings</h1><p>Control the sensors and remote alert path used by the Phase 3 prototype.</p></div></div>
    <div className="settings-grid">
      <div className="panel settings-main">
        <SettingToggle title="Protection mode" description="Enable or pause the emergency trigger system." checked={active} onChange={() => setActive(!active)} />
        <div className="setting-divider" />
        <div className="setting-item"><div><strong>Microphone detector</strong><span>{listening ? `Listening locally · ${clapCount}/3 claps` : "Three-clap pattern · requires microphone permission"}</span></div><button className="ghost-btn" onClick={onToggleMic}>{listening ? "Stop" : "Start"}</button></div>
        {micError && <div className="setting-error">🎙 {micError}</div>}
        <div className="setting-divider" />
        <div className="setting-item"><div><strong>Location sharing</strong><span>{watching ? "High-accuracy location watch is active." : location ? "A recent device location is available." : "Request GPS permission to make a location available."}</span></div><button className="ghost-btn" onClick={onToggleLocation}>{watching ? "Stop" : "Enable"}</button></div>
        {locationError && <div className="setting-error">⌖ {locationError}</div>}
        <div className="setting-divider" />
        <div className="setting-item"><div><strong>Remote alert gateway</strong><span>VoicePrint can use Twilio from the backend after the account secrets are added to Render. Those secrets never belong in the browser.</span></div><span className="coming-badge">BACKEND READY</span></div>
        <div className="setting-divider" />
        <div className="setting-item"><div><strong>Emergency services</strong><span>Police/ambulance dispatch is not connected. Any production integration needs an approved workflow, authentication and service agreement.</span></div><span className="coming-badge">FUTURE</span></div>
      </div>
      <div className="panel privacy-card"><div className="privacy-icon">✓</div><span className="panel-kicker">PHASE 3 · PRIVACY</span><h2>Keep secrets on the server.</h2><p>Clap analysis stays local in the browser. Contact numbers are only sent when an SOS is created so the backend can process the alert. Twilio credentials are server-only.</p><div className="privacy-points"><span>✓</span> Local clap analysis</div><div className="privacy-points"><span>✓</span> Explicit browser permissions</div><div className="privacy-points"><span>✓</span> Backend validation + rate limiting</div><div className="privacy-points"><span>✓</span> Server-only SMS credentials</div></div>
    </div>
  </div>;
}

function SettingToggle({ title, description, checked, onChange }) {
  return <div className="setting-item"><div><strong>{title}</strong><span>{description}</span></div><button type="button" aria-label={`${title}: ${checked ? "on" : "off"}`} className={checked ? "toggle on" : "toggle"} onClick={onChange}><span /></button></div>;
}

function SosOverlay({ contacts, source, location, event, backendError, onCancel, onDispatch, onCloseAfterDispatch }) {
  const [seconds, setSeconds] = useState(10);
  const dispatchStartedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds !== 0 || !event?.id || dispatchStartedRef.current || event.status === "cancelled" || event.status === "dispatched") return;
    dispatchStartedRef.current = true;
    onDispatch();
  }, [event?.id, event?.status, onDispatch, seconds]);

  const sourceLabel = source === "three-clap" ? "3-CLAP PATTERN DETECTED" : "MANUAL SOS TEST";
  const delivery = event?.delivery;
  const dispatchDone = event?.status === "dispatched";
  const cancelled = event?.status === "cancelled";
  const deliveryText = dispatchDone
    ? delivery?.sent > 0 ? `${delivery.sent} SMS sent` : delivery?.mode === "not_configured" ? "SMS not configured" : delivery?.mode === "no_contacts" ? "No contacts" : delivery?.failed ? `${delivery.failed} failed` : "Processed"
    : cancelled ? "Cancelled" : event ? "Waiting for 10s gate" : "Backend unavailable";

  return <div className="sos-overlay"><div className="sos-modal"><div className="sos-modal-icon">✦</div><span className="danger-label">{sourceLabel}</span><h2>{dispatchDone ? "Alert processed" : cancelled ? "SOS cancelled" : "SOS flow activated"}</h2><p>{dispatchDone ? (delivery?.sent > 0 ? "The VoicePrint backend reports that trusted-contact SMS was sent." : delivery?.message || "The VoicePrint backend processed the event.") : backendError ? backendError : "This event is local until the 10-second confirmation window ends. No remote message is sent before dispatch."}</p>
    <div className="sos-summary"><div><span>LOCATION</span><strong>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "Waiting for permission"}</strong></div><div><span>CONTACTS</span><strong>{contacts.length ? `${contacts.length} trusted` : "None configured"}</strong></div><div><span>DELIVERY</span><strong>{deliveryText}</strong></div></div>
    <div className="countdown">{dispatchDone || cancelled ? "✓" : seconds}<small>{dispatchDone || cancelled ? "" : " sec"}</small></div>
    <div className="alert-list"><div><span>{event ? "✓" : "!"}</span> {event ? "Backend SOS event created" : "Remote backend event could not be created"}</div><div><span>{location ? "✓" : "!"}</span> {location ? "Current coordinates attached and eligible for live sync" : "Location still unavailable"}</div><div><span>{dispatchDone && delivery?.sent > 0 ? "✓" : "!"}</span> {dispatchDone && delivery?.sent > 0 ? "Trusted-contact SMS delivery reported by backend" : "Emergency services are not contacted by this prototype"}</div></div>
    {dispatchDone ? <button className="cancel-btn wide" onClick={onCloseAfterDispatch}>Close SOS screen</button> : <button className="cancel-btn wide" onClick={onCancel}>{cancelled ? "Close" : "I'm Safe — Cancel Before Dispatch"}</button>}
  </div></div>;
}

export default App;
