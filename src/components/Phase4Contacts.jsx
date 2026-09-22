import { useState } from "react";

export default function Phase4Contacts({user,contacts,onAdd,onRemove}){
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [relationship,setRelationship]=useState("Family");
  const [message,setMessage]=useState("");

  async function submit(e){
    e.preventDefault();
    if(!user){setMessage("Sign in from Settings to save contacts to the cloud.");return;}
    try{
      const normalizedPhone = phone.trim().replace(/[()\s-]/g, "");
      if(!/^\\+[1-9][0-9]{7,14}$/.test(normalizedPhone)) throw new Error("Use E.164 format, e.g. +919876543210.");
      await onAdd({name:name.trim(),phone:normalizedPhone,relationship});
      setName("");setPhone("");setMessage("Contact saved to your account.");
    }catch(error){setMessage(error.message||"Could not save contact.");}
  }

  return <div className="page">
    <div className="page-heading"><div><span className="panel-kicker">TRUSTED NETWORK</span><h1>Emergency contacts</h1><p>{user?"Saved to your authenticated cloud workspace.":"Sign in before adding real alert contacts."}</p></div><span className="count-badge">{contacts.length} saved</span></div>
    <div className="contacts-layout">
      <form className="panel contact-form" onSubmit={submit}>
        <span className="panel-kicker">ADD CONTACT</span><h2>Build your safety circle</h2>
        <label>Name<input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Mom"/></label>
        <label>Phone<input required value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></label>
        <label>Relationship<select value={relationship} onChange={(e)=>setRelationship(e.target.value)}><option>Family</option><option>Friend</option><option>Partner</option><option>Caregiver</option><option>Other</option></select></label>
        <button className="primary-btn wide" type="submit">+ Add emergency contact</button>
        {message&&<div className="auth-message">{message}</div>}
      </form>
      <div className="panel saved-contacts"><span className="panel-kicker">YOUR CONTACTS</span><h2>Trusted people</h2>
        {contacts.length===0?<div className="empty-state"><span>♧</span><strong>No contacts yet</strong><p>{user?"Add someone you trust before testing dispatch.":"Sign in to enable persistent contacts."}</p></div>:
        contacts.map((c)=><div className="contact-row" key={c.id}><div className="contact-avatar">{c.name[0].toUpperCase()}</div><div><strong>{c.name}</strong><span>{c.relationship} · {c.phone}</span></div><button type="button" className="delete-mini" onClick={()=>onRemove(c.id)}>×</button></div>)}
      </div>
    </div>
  </div>;
}
