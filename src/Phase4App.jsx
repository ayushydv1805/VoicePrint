import { useState } from "react";
import usePhase4Core from "./hooks/usePhase4Core";
import Home from "./components/Phase4Home";
import Contacts from "./components/Phase4Contacts";
import History from "./components/Phase4History";
import Control from "./components/Phase4Control";
import Account from "./components/Phase4Account";
import Modal from "./components/Phase4Modal";

const tabs = [
  ["home","Home","⌂"],
  ["control","Safety","✦"],
  ["contacts","Contacts","♧"],
  ["history","History","◷"],
  ["settings","Settings","⚙"],
];

export default function Phase4App(){
  const c = usePhase4Core();
  const [page,setPage] = useState("home");

  if(!c.ready) return <div className="app-shell app-loading"><div className="loading-card"><div className="loading-spinner"/><strong>Starting VoicePrint</strong><span>Checking your account…</span></div></div>;

  const settings = <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">ACCOUNT & SETTINGS</span><h1>Protection settings</h1><p>Control sensors and your cloud account.</p></div></div>
    <div className="settings-grid">
      <div className="panel settings-main">
        <div className="setting-item"><div><strong>Protection mode</strong><span>Enable or pause the trigger system.</span></div><button className={c.active?"toggle on":"toggle"} onClick={()=>c.setActive(v=>!v)}><span/></button></div>
        <div className="setting-divider"/>
        <div className="setting-item"><div><strong>Microphone</strong><span>{c.listening?c.clapCount + "/3 claps detected":"Ready for three-clap detection"}</span></div><button className="ghost-btn" onClick={()=>c.listening?c.stopMic():c.startMic()}>{c.listening?"Stop":"Start"}</button></div>
        {c.micError&&<div className="setting-error">🎙 {c.micError}</div>}
        <div className="setting-divider"/>
        <div className="setting-item"><div><strong>Location</strong><span>{c.watching?"Live watch active":c.location?"Recent location available":"Not enabled"}</span></div><button className="ghost-btn" onClick={()=>c.watching?c.stopWatching():c.startWatching()}>{c.watching?"Stop":"Enable"}</button></div>
        {c.locationError&&<div className="setting-error">⌖ {c.locationError}</div>}
      </div>
      <Account user={c.user} message={c.authMsg} onSubmit={c.auth} onSignOut={c.logout}/>
    </div>
  </div>;

  return <div className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <button className="brand" onClick={()=>setPage("home")}><span className="brand-mark"><span className="shield small">✦</span></span><span><strong>VoicePrint</strong><small>Emergency Safety System</small></span></button>
      <div className="top-status"><span className={c.active?"live-pill":"live-pill danger"}><span className="pulse"/>{c.active?"Protection Active":"Protection Paused"}</span><button className="avatar" onClick={()=>setPage("settings")}>{c.user?(c.user.email||"A")[0].toUpperCase():"A"}</button></div>
    </header>
    <div className="layout">
      <aside className="sidebar"><div className="sidebar-label">CONTROL CENTER</div><nav>{tabs.map(([id,label,icon])=><button key={id} className={page===id?"nav-item active":"nav-item"} onClick={()=>setPage(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><div className="security-mini"><div className="mini-icon">✓</div><div><strong>{c.user?"Cloud protected":"Local demo"}</strong><span>{c.user?"Signed in":"Sign in to save data"}</span></div></div><span className="version">VoicePrint v0.4 · Phase 4</span></div></aside>
      <main className="main-content">
        {page==="home"&&<Home user={c.user} active={c.active} listening={c.listening} clapCount={c.clapCount} contacts={c.contacts} location={c.location} watching={c.watching} history={c.history} onEmergency={()=>c.startFlow("manual")} onMic={()=>c.listening?c.stopMic():c.startMic()} onLocation={()=>c.watching?c.stopWatching():c.startWatching()} onNav={setPage}/>}
        {page==="control"&&<Control user={c.user} listening={c.listening} count={c.clapCount} onStart={()=>c.listening?c.stopMic():c.startMic()} onTest={()=>c.startFlow("manual")}/>}
        {page==="contacts"&&<Contacts user={c.user} contacts={c.contacts} onAdd={c.add} onRemove={c.remove}/>}
        {page==="history"&&<History user={c.user} history={c.history} onRefresh={()=>c.refresh().catch(e=>c.setError(e.message))}/>}
        {page==="settings"&&settings}
        {c.error&&<div className="global-error"><span>!</span>{c.error}<button onClick={()=>c.setError("")}>×</button></div>}
      </main>
    </div>
    <nav className="mobile-nav">{tabs.map(([id,label,icon])=><button key={id} className={page===id?"mobile-nav-item active":"mobile-nav-item"} onClick={()=>setPage(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>
    {c.open&&<Modal user={c.user} event={c.event} location={c.location} onClose={c.closeFlow} onFinish={c.finish}/>}
  </div>;
}
