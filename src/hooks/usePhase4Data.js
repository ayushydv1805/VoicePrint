import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, signIn, signOut, signUp } from "../lib/auth";
import { api } from "../lib/apiAuth";

export function usePhase4Data() {
  const [user,setUser]=useState(null);
  const [ready,setReady]=useState(false);
  const [contacts,setContacts]=useState([]);
  const [history,setHistory]=useState([]);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!user)return;
    try{
      const [c,h]=await Promise.all([api("/api/v1/contacts"),api("/api/v1/history")]);
      setContacts((c.contacts||[]).map(x=>({id:x.id,name:x.name,phone:x.phone_e164,relationship:x.relationship})));
      setHistory(h.events||[]);
      setError("");
    }catch(e){setError(e.message||"Cloud data could not be loaded.");}
  },[user]);

  useEffect(()=>{
    let alive=true;
    getCurrentUser().then((u)=>{if(alive)setUser(u);}).finally(()=>{if(alive)setReady(true);});
    return ()=>{alive=false;};
  },[]);

  useEffect(()=>{ if(user)refresh(); },[user,refresh]);

  const authenticate=useCallback(async(mode,email,password)=>{
    if(mode==="signup"){
      const result=await signUp(email,password);
      if(result?.access_token){
        setUser(await getCurrentUser());
        return "Account created and signed in.";
      }
      return "Account created. Check your email if confirmation is required, then sign in.";
    }
    await signIn(email,password);
    setUser(await getCurrentUser());
    return "Signed in successfully.";
  },[]);

  const logout=useCallback(async()=>{await signOut();setUser(null);setContacts([]);setHistory([]);},[]);

  const addContact=useCallback(async(contact)=>{
    if(!user) return null;
    const result=await api("/api/v1/contacts",{method:"POST",body:JSON.stringify({name:contact.name,phone_e164:contact.phone,relationship:contact.relationship})});
    const c=result.contact;
    const next={id:c.id,name:c.name,phone:c.phone_e164,relationship:c.relationship};
    setContacts((items)=>[...items,next]);
    return next;
  },[user]);

  const removeContact=useCallback(async(id)=>{
    if(!user)return;
    await api("/api/v1/contacts/"+encodeURIComponent(id),{method:"DELETE"});
    setContacts((items)=>items.filter(x=>x.id!==id));
  },[user]);

  return {user,ready,contacts,history,error,setError,refresh,authenticate,logout,addContact,removeContact};
}
