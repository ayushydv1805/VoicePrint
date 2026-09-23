export default function Phase4Home({user,active,listening,clapCount,contacts,location,watching,history,onEmergency,onMic,onLocation,onNav}){
  return <div className="page">
    <section className="hero"><div>
      <div className="eyebrow"><span className="eyebrow-line"/> HANDS-FREE SAFETY · PHASE 7</div>
      <h1>When you can't<br/><span>reach your phone.</span></h1>
      <p className="hero-copy">Signed-in cloud storage keeps trusted contacts and event history available across sessions. Clap detection and GPS still run in the browser.</p>
      <div className="hero-actions"><button className="primary-btn" onClick={onEmergency}>✦ Test SOS</button><button className={listening?"secondary-btn listening-btn":"secondary-btn"} onClick={onMic}><span className="mic-live-dot"/>{listening?`Listening · ${clapCount}/3`:"Start clap detection"}</button></div>
      <div className="hero-meta"><span>{user?"✓ Signed in":"◌ Local demo"}</span><span>{contacts.length} contacts</span><span>{history.length} cloud events</span></div>
    </div><div className="hero-orb"><div className="orb-ring ring-one"/><div className="orb-ring ring-two"/><div className={listening?"orb-core listening-core":"orb-core"}><span>✦</span><span>{listening?"LISTENING":"READY"}</span></div></div></section>

    <section className="status-grid">
      <Card title="Sound Detection" value={listening?"Listening":"Standby"} detail={listening?`${clapCount}/3 claps`:"3-clap trigger"} good={listening} onClick={onMic}/>
      <Card title="Location" value={watching?"Live":location?"Ready":"Off"} detail={watching?"High accuracy":"Tap to enable"} good={!!location} onClick={onLocation}/>
      <Card title="Trusted Contacts" value={String(contacts.length)} detail={user?"Cloud saved":"Sign in required"} good={contacts.length>0} onClick={()=>onNav("contacts")}/>
    </section>

    <section className="dashboard-grid"><div className="panel map-panel"><div className="panel-head"><div><span className="panel-kicker">LOCATION</span><h2>Device location</h2></div></div><Map location={location}/></div>
      <div className="panel checklist"><div className="panel-head"><div><span className="panel-kicker">PHASE 7</span><h2>Protection checklist</h2></div></div><Row done={listening} text="Clap detection"/><Row done={!!location} text="Location permission"/><Row done={contacts.length>0} text="Trusted contact"/><Row done={!!user} text="Cloud account"/><Row done={history.length>0} text="Persistent history"/></div></section>
    {!user&&<div className="phase-note"><span>04</span><div><strong>Cloud features are locked until sign in.</strong><br/>Local detection and GPS remain available for testing.</div></div>}
  </div>;
}
function Card({title,value,detail,good,onClick}){return <button className="status-card" onClick={onClick}><div className="status-card-icon">◉</div><div className="status-card-text"><span>{title}</span><strong><i className={good?"good-dot":"muted-dot"}/>{value}</strong><small>{detail}</small></div><span className="card-arrow">→</span></button>}
function Row({done,text}){return <div className="check-row"><span className={done?"check done":"check"}>{done?"✓":"!"}</span><span>{text}</span></div>}
function Map({location}){if(!location)return <div className="map-placeholder location-off"><div className="map-grid"/><div className="location-empty"><span>⌖</span><strong>Location not enabled</strong><small>Enable GPS from the dashboard.</small></div></div>;return <div className="map-placeholder"><div className="map-grid"/><div className="map-center"><div className="map-pulse"/><span>⌖</span></div><div className="coordinate-card"><span>DEVICE LOCATION</span><strong>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</strong><small>± {Math.round(location.accuracy||0)} m</small></div></div>}
