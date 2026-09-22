import { useState } from "react";

export default function Phase4Account({user,message,onSubmit,onSignOut}) {
  const [mode,setMode]=useState("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");

  const submit=(e)=>{e.preventDefault();onSubmit(mode,email,password);};

  if(user) return <div className="panel account-card">
    <span className="panel-kicker">ACCOUNT & CLOUD</span>
    <h2>Signed in</h2>
    <p className="muted">{user.email}</p>
    <div className="privacy-points"><span>✓</span> Trusted contacts persist</div>
    <div className="privacy-points"><span>✓</span> SOS history persists</div>
    <button className="ghost-btn wide account-signout" onClick={onSignOut}>Sign out</button>
  </div>;

  return <div className="panel account-card">
    <span className="panel-kicker">ACCOUNT & CLOUD</span>
    <h2>Unlock cloud safety</h2>
    <p className="muted">Create an account or sign in to persist contacts and SOS history.</p>
    <div className="auth-tabs">
      <button className={mode==="signin"?"active":""} onClick={()=>setMode("signin")}>Sign in</button>
      <button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>Create account</button>
    </div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input type="password" minLength={8} required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="8+ characters"/></label>
      <button className="primary-btn wide" type="submit">{mode==="signin"?"Sign in":"Create account"}</button>
    </form>
    {message&&<div className="auth-message">{message}</div>}
    <small className="auth-note">Authentication is handled by Supabase Auth.</small>
  </div>;
}
