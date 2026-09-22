export default function Phase4History({user,history,onRefresh}){
  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">EVENT ARCHIVE</span><h1>SOS history</h1><p>{user?"Persistent events from your cloud safety workspace.":"Sign in to keep history across sessions."}</p></div><button className="ghost-btn" onClick={onRefresh} disabled={!user}>↻ Refresh</button></div>
    <div className="panel history-panel">
      {!user?<div className="empty-state"><span>◷</span><strong>Cloud history is locked</strong><p>Sign in from Settings to enable persistent SOS history.</p></div>:
      !history.length?<div className="empty-state"><span>◷</span><strong>No SOS events yet</strong><p>Your authenticated tests will appear here.</p></div>:
      <div className="history-list">{history.map((event)=><div className="history-row" key={event.id}>
        <div className={`history-icon ${event.status}`}>✦</div>
        <div className="history-main"><strong>{event.source==="three-clap"?"3-clap SOS":"Manual SOS"}</strong><span>{event.createdAt?new Date(event.createdAt).toLocaleString():"Unknown time"}</span></div>
        <span className={`history-status ${event.status}`}>{event.status}</span>
        <div className="history-location">{event.location?`${event.location.latitude.toFixed(4)}, ${event.location.longitude.toFixed(4)}`:"No location"}</div>
      </div>)}</div>}
    </div>
  </div>;
}
