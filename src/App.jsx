import { useEffect, useState } from "react";

const navItems = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "emergency", label: "Emergency", icon: "✦" },
  { id: "contacts", label: "Contacts", icon: "♧" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function ShieldIcon({ small = false }) {
  return <span className={small ? "shield small" : "shield"}>✦</span>;
}

function StatusDot({ children }) {
  return <span className="status"><span className="status-dot" />{children}</span>;
}

function App() {
  const [page, setPage] = useState("home");
  const [sosOpen, setSosOpen] = useState(false);
  const [active, setActive] = useState(true);
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("voiceprint-contacts")) || []; }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("voiceprint-contacts", JSON.stringify(contacts));
  }, [contacts]);

  const addContact = (contact) => setContacts((current) => [...current, contact]);
  const activateDemo = () => { setSosOpen(true); setActive(false); };
  const cancelSos = () => { setSosOpen(false); setActive(true); };

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")} aria-label="VoicePrint home">
          <span className="brand-mark"><ShieldIcon small /></span>
          <span><strong>VoicePrint</strong><small>Emergency Safety System</small></span>
        </button>
        <div className="top-status">
          <span className={active ? "live-pill" : "live-pill danger"}>
            <span className="pulse" />{active ? "Protection Active" : "SOS Active"}
          </span>
          <button className="avatar">A</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">CONTROL CENTER</div>
          <nav>
            {navItems.map((item) => (
              <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="security-mini">
              <div className="mini-icon">✓</div>
              <div><strong>Privacy first</strong><span>Your controls stay yours.</span></div>
            </div>
            <span className="version">VoicePrint v0.1</span>
          </div>
        </aside>

        <main className="main-content">
          {page === "home" && <Home active={active} contacts={contacts} onEmergency={activateDemo} onNavigate={setPage} />}
          {page === "emergency" && <Emergency active={active} onEmergency={activateDemo} onCancel={cancelSos} />}
          {page === "contacts" && <Contacts contacts={contacts} onAdd={addContact} />}
          {page === "settings" && <Settings active={active} setActive={setActive} />}
        </main>
      </div>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setPage(item.id)}>
            <span>{item.icon}</span><small>{item.label}</small>
          </button>
        ))}
      </nav>

      {sosOpen && <SosOverlay contacts={contacts} onCancel={cancelSos} />}
    </div>
  );
}

function Home({ active, contacts, onEmergency, onNavigate }) {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR SAFETY, ALWAYS WITH YOU</div>
          <h1>When you can't<br /><span>reach your phone.</span></h1>
          <p className="hero-copy">VoicePrint is being built to trigger an emergency response without requiring you to unlock, hold, or type on your phone.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onEmergency}><span className="btn-icon">✦</span> Test SOS</button>
            <button className="secondary-btn" onClick={() => onNavigate("settings")}>Configure protection <span>→</span></button>
          </div>
        </div>

        <div className="hero-orb">
          <div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
          <div className="orb-core"><ShieldIcon /><span>READY</span></div>
          <div className="orb-badge badge-top">MIC <b>ON</b></div>
          <div className="orb-badge badge-bottom">GPS <b>READY</b></div>
        </div>
      </section>

      <section className="status-grid">
        <StatusCard icon="◉" title="Sound Detection" value={active ? "Ready" : "Paused"} detail="3-clap trigger configured" good={active} />
        <StatusCard icon="⌖" title="Location" value="Ready" detail="Permission can be enabled" good />
        <StatusCard icon="♧" title="Emergency Contacts" value={contacts.length ? String(contacts.length) : "0"} detail={contacts.length ? "Trusted contacts added" : "Add your first contact"} good={contacts.length > 0} onClick={() => onNavigate("contacts")} />
      </section>

      <section className="dashboard-grid">
        <div className="panel map-panel">
          <div className="panel-head"><div><span className="panel-kicker">EMERGENCY LOCATION</span><h2>Location sharing</h2></div><StatusDot>Standby</StatusDot></div>
          <div className="map-placeholder">
            <div className="map-grid" /><div className="map-center"><div className="map-pulse" /><span>⌖</span></div>
            <div className="map-caption">Live location will appear here during an active SOS</div>
          </div>
        </div>

        <div className="panel checklist">
          <div className="panel-head"><div><span className="panel-kicker">SETUP</span><h2>Protection checklist</h2></div></div>
          <ChecklistRow done label="VoicePrint account created" />
          <ChecklistRow done label="SOS trigger selected" />
          <ChecklistRow done={contacts.length > 0} label="Emergency contact added" action={!contacts.length ? () => onNavigate("contacts") : null} />
          <ChecklistRow label="Location permission" action={() => onNavigate("settings")} />
        </div>
      </section>

      <div className="prototype-note"><span>●</span><div><strong>Prototype mode</strong><br />The SOS button currently demonstrates the emergency flow. Police, ambulance, SMS, live GPS and background microphone features will be connected in later phases.</div></div>
    </div>
  );
}

function StatusCard({ icon, title, value, detail, good, onClick }) {
  return (
    <button className="status-card" onClick={onClick}>
      <div className="status-card-icon">{icon}</div>
      <div className="status-card-text"><span>{title}</span><strong><i className={good ? "good-dot" : "muted-dot"} />{value}</strong><small>{detail}</small></div>
      {onClick && <span className="card-arrow">→</span>}
    </button>
  );
}

function ChecklistRow({ done, label, action }) {
  return <div className="check-row"><span className={done ? "check done" : "check"}>{done ? "✓" : "!"}</span><span>{label}</span>{!done && action && <button onClick={action}>Set up →</button>}</div>;
}

function Emergency({ active, onEmergency, onCancel }) {
  return (
    <div className="page">
      <div className="page-heading"><div><span className="panel-kicker">EMERGENCY CENTER</span><h1>Emergency control</h1><p>Test the response flow now. Real emergency integrations come later.</p></div><span className={active ? "state-badge" : "state-badge danger"}>{active ? "STANDBY" : "SOS ACTIVE"}</span></div>
      <div className="emergency-layout">
        <div className="emergency-card">
          <div className="emergency-glow" /><div className="sos-symbol">✦</div>
          <h2>{active ? "Emergency system ready" : "Emergency active"}</h2>
          <p>{active ? "Press the button below to simulate the SOS trigger." : "Your emergency flow is currently active."}</p>
          {active ? <button className="sos-btn" onClick={onEmergency}><span>✦</span> ACTIVATE SOS</button> : <button className="cancel-btn" onClick={onCancel}>I'm Safe — Cancel SOS</button>}
          <span className="safety-hint">Demo action only · no real emergency call is placed</span>
        </div>

        <div className="panel response-panel">
          <span className="panel-kicker">RESPONSE FLOW</span><h2>What happens next</h2>
          <FlowStep number="01" title="Detect" text="Configured sound pattern is recognized." />
          <FlowStep number="02" title="Verify" text="The trigger is checked before activation." />
          <FlowStep number="03" title="Locate" text="Device location is collected with permission." />
          <FlowStep number="04" title="Alert" text="Authorized contacts and emergency services can be notified through supported integrations." />
        </div>
      </div>
    </div>
  );
}

function FlowStep({ number, title, text }) {
  return <div className="flow-step"><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function Contacts({ contacts, onAdd }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("Family");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    onAdd({ id: Date.now(), name: name.trim(), phone: phone.trim(), relationship });
    setName(""); setPhone("");
  };

  return (
    <div className="page">
      <div className="page-heading"><div><span className="panel-kicker">TRUSTED NETWORK</span><h1>Emergency contacts</h1><p>Choose who should receive your emergency alert.</p></div><span className="count-badge">{contacts.length} saved</span></div>
      <div className="contacts-layout">
        <form className="panel contact-form" onSubmit={submit}>
          <span className="panel-kicker">ADD CONTACT</span><h2>Build your safety circle</h2><p className="muted">Only contacts you add will be stored in this prototype.</p>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mom" /></label>
          <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
          <label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option>Family</option><option>Friend</option><option>Partner</option><option>Caregiver</option><option>Other</option></select></label>
          <button className="primary-btn wide" type="submit">+ Add emergency contact</button>
        </form>

        <div className="panel saved-contacts">
          <span className="panel-kicker">YOUR CONTACTS</span><h2>Trusted people</h2>
          {contacts.length === 0 ? <div className="empty-state"><span>♧</span><strong>No contacts yet</strong><p>Add someone you trust before enabling real alerts.</p></div> : contacts.map((contact) => (
            <div className="contact-row" key={contact.id}><div className="contact-avatar">{contact.name[0].toUpperCase()}</div><div><strong>{contact.name}</strong><span>{contact.relationship} · {contact.phone}</span></div><span className="contact-ok">✓</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Settings({ active, setActive }) {
  return (
    <div className="page">
      <div className="page-heading"><div><span className="panel-kicker">CONFIGURATION</span><h1>Protection settings</h1><p>Control how your VoicePrint prototype behaves.</p></div></div>
      <div className="settings-grid">
        <div className="panel settings-main">
          <SettingToggle title="Protection mode" description="Enable or pause the emergency trigger system." checked={active} onChange={() => setActive(!active)} />
          <div className="setting-divider" />
          <div className="setting-item"><div><strong>SOS trigger</strong><span>3 distinct claps · prototype detector</span></div><button className="ghost-btn">Configure</button></div>
          <div className="setting-divider" />
          <div className="setting-item"><div><strong>Location sharing</strong><span>Ask for device permission before collecting location.</span></div><button className="ghost-btn">Permission</button></div>
          <div className="setting-divider" />
          <div className="setting-item"><div><strong>Emergency services</strong><span>Official emergency integrations will be configured in a later phase.</span></div><span className="coming-badge">COMING SOON</span></div>
        </div>

        <div className="panel privacy-card">
          <div className="privacy-icon">✓</div><span className="panel-kicker">PRIVACY</span><h2>Your data, your control.</h2>
          <p>VoicePrint will be designed to collect and share emergency information only when required for the features you enable.</p>
          <div className="privacy-points"><span>✓</span> Explicit permissions</div>
          <div className="privacy-points"><span>✓</span> Authorized contacts</div>
          <div className="privacy-points"><span>✓</span> Limited emergency sharing</div>
        </div>
      </div>
    </div>
  );
}

function SettingToggle({ title, description, checked, onChange }) {
  return <div className="setting-item"><div><strong>{title}</strong><span>{description}</span></div><button className={checked ? "toggle on" : "toggle"} onClick={onChange} aria-label="Toggle protection"><span /></button></div>;
}

function SosOverlay({ contacts, onCancel }) {
  return (
    <div className="sos-overlay">
      <div className="sos-modal">
        <div className="sos-modal-icon">✦</div><span className="danger-label">SOS ACTIVATED</span><h2>Emergency flow is active</h2>
        <p>This prototype is simulating the response sequence. No police, ambulance, or SMS request has been sent.</p>
        <div className="alert-list"><div><span>✓</span> SOS event created</div><div><span>✓</span> Location step ready</div><div><span>{contacts.length ? "✓" : "!"}</span> {contacts.length ? contacts.length + " trusted contact(s) ready" : "No emergency contacts configured"}</div></div>
        <button className="cancel-btn" onClick={onCancel}>I'm Safe — End Test</button>
      </div>
    </div>
  );
}

export default App;
