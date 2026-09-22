import { useEffect, useState } from "react";
import { getCurrentUser, getAccessToken, signIn, signUp, signOut } from "./lib/auth";
import { api } from "./lib/apiAuth";

export default function Phase4Bridge({children}){
  const [user,setUser]=useState(null);
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    const original=window.fetch.bind(window);
    window.fetch=(input,init={})=>{
      try{
        const url=typeof input==="string"?input:input.url;
        if(url.includes("voiceprint-api.onrender.com")&&getAccessToken()){
          const target=url.replace("https://voiceprint-api.onrender.com","https://voiceprint-api-v4.onrender.com");
          const headers=new Headers(init.headers||{});
          headers.set("Authorization","Bearer "+getAccessToken());
          return original(target,{...init,headers,credentials:"omit"});
        }
      }catch{}
      return original(input,init);
    };
    getCurrentUser().then(setUser).catch(()=>{});
    return ()=>{window.fetch=original};
  },[]);

  async function auth(){
    try{
      setMsg("");
      const result=mode==="signup"?await signUp(email,password):await signIn(email,password);
      if(mode==="signup"&&!result?.access_token){setMsg("Account created. Confirm email if required, then sign in.");return}
      setUser(await getCurrentUser());setMsg("Signed in.");
      await syncLocalContacts();
    }catch(e){setMsg(e.message||"Authentication failed.")}
  }
  async function syncLocalContacts(){
    const raw=localStorage.getItem("voiceprint-contacts");
    if(!raw||!getAccessToken())return;
    let items=[];try{items=JSON.parse(raw)||[]}catch{return}
    const done=JSON.parse(localStorage.getItem("voiceprint-synced-contacts")||"[]");
    for(const c of items){
      if(done.includes(String(c.id)))continue;
      if(!c.name||!/^\+[1-9][0-9]{7,14}$/.test(String(c.phone||"")))continue;
      try{await api("/api/v1/contacts",{method:"POST",body:JSON.stringify({name:c.name,phone_e164:c.phone,relationship:c.relationship||"Other"})});done.push(String(c.id))}catch{}
    }
    localStorage.setItem("voiceprint-synced-contacts",JSON.stringify(done));
  }
  async function logout(){await signOut();setUser(null);setMsg("Signed out.");}

  return <div className="phase4-bridge">{children}<button className="cloud-fab" onClick={()=>setOpen(v=>!v)}>{user?"☁ Cloud":"☁ Sign in"}</button>{open&&<div className="cloud-popover">
    <div className="cloud-popover-head"><div><span className="panel-kicker">PHASE 4</span><h3>Cloud safety</h3></div><button onClick={()=>setOpen(false)}>×</button></div>
    {user?<><strong>{user.email}</strong><p>Authenticated backend, contacts and history are enabled.</p><button className="ghost-btn wide" onClick={syncLocalContacts}>Sync local contacts</button><button className="ghost-btn wide" onClick={logout}>Sign out</button></>:
    <><div className="auth-tabs"><button className={mode==="signin"?"active":""} onClick={()=>setMode("signin")}>Sign in</button><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>Create account</button></div><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" minLength="8"/></label><button className="primary-btn wide" onClick={auth}>{mode==="signin"?"Sign in":"Create account"}</button>{msg&&<div className="auth-message">{msg}</div>}</>}
  </div>}</div>;
}
