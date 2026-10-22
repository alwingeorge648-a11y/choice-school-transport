import React, { useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail
} from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  BusFront, ShieldCheck, Users, Wrench, UserRound, LogOut, Plus, Search, Bell,
  Clock3, CheckCircle2, XCircle, RotateCcw, MapPin, CalendarDays, ChevronRight,
  FileText, ArrowUpRight, AlertCircle, X, Menu, LoaderCircle, LockKeyhole, Download
} from "lucide-react";
import { auth, db, functions, isFirebaseConfigured } from "./firebase";

const ROLE_LABEL = { staff:"Staff", hod:"HOD", facility_manager:"Facility Manager", principal:"Principal" };
const STATUS = {
  pending_hod:{label:"Awaiting HOD",tone:"amber"},
  pending_facility:{label:"Awaiting Facility Manager",tone:"blue"},
  pending_principal:{label:"Awaiting Principal",tone:"violet"},
  approved:{label:"Approved",tone:"green"},
  rejected:{label:"Rejected",tone:"red"},
  returned:{label:"Returned for changes",tone:"slate"}
};
const STAGES = ["pending_hod","pending_facility","pending_principal","approved"];
const prettyDate = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const prettyTime = (v) => v || "—";
const errText = (e) => e?.code === "auth/invalid-credential" ? "Email or password is incorrect." : (e?.message || "Something went wrong. Please try again.").replace("Firebase: ","");

function Mark({children,tone="slate"}) { return <span className={`mark ${tone}`}>{children}</span>; }
function Brand() { return <div className="brand"><div className="brand-mark"><BusFront size={22}/></div><div><b>CHOICE SCHOOL</b><span>TRANSPORT PORTAL · THIRUVALLA</span></div></div>; }

function Login({onLogin,toast}) {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false); const [reset,setReset] = useState(false);
  async function submit(e) {
    e.preventDefault(); if (!isFirebaseConfigured) { toast("Connect your Firebase project using .env before signing in.","error"); return; }
    setBusy(true);
    try {
      if (reset) { await sendPasswordResetEmail(auth,email); toast("Password reset email sent."); setReset(false); }
      else await onLogin(email,password);
    } catch(e) { toast(errText(e),"error"); } finally { setBusy(false); }
  }
  return <main className="login-wrap">
    <section className="login-visual"><div className="visual-top"><Brand/><Mark tone="light">SECURE WORKSPACE</Mark></div>
      <div className="visual-copy"><span className="eyebrow">THE CHOICE SCHOOL · THIRUVALLA</span><h1>Every journey<br/>starts with a<br/><em>clear approval.</em></h1><p>One reliable place to request, review and approve school conveyance arrangements.</p>
        <div className="visual-stats"><div><span>01</span><b>Submit a request</b></div><div><span>02</span><b>Review in sequence</b></div><div><span>03</span><b>Travel with clarity</b></div></div>
      </div><div className="visual-foot">CONVEYANCE FACILITY REQUEST <span>•</span> DIGITAL WORKFLOW</div>
    </section>
    <section className="login-panel"><div className="mobile-brand"><Brand/></div><div className="login-card">
      <div className="login-icon"><LockKeyhole size={22}/></div><span className="eyebrow">{reset?"ACCOUNT RECOVERY":"WELCOME BACK"}</span>
      <h2>{reset?"Reset your password":"Sign in to your portal"}</h2><p className="muted">{reset?"We'll email you a secure password reset link.":"Use your school account to continue."}</p>
      {!isFirebaseConfigured && <div className="notice"><AlertCircle size={17}/><span>Setup required: add your Firebase project values to <code>.env</code> and deploy the backend.</span></div>}
      <form onSubmit={submit} className="form-stack">
        <label>School email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@choiceschool.in" required/></label>
        {!reset && <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required minLength={6}/></label>}
        {!reset && <button type="button" className="text-button forgot" onClick={()=>setReset(true)}>Forgot password?</button>}
        <button className="primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}{reset?"Send reset link":"Sign in"} <ChevronRight size={17}/></button>
        {reset && <button type="button" className="secondary full" onClick={()=>setReset(false)}>Back to sign in</button>}
      </form>
      <div className="login-security"><ShieldCheck size={16}/><span>Protected access · Role-based permissions</span></div>
    </div><div className="login-bottom">Need access? Contact your school administrator.</div></section>
  </main>;
}

function RequestForm({profile,onClose,onCreated,toast}) {
  const [form,setForm] = useState({department:profile.department||"",requesterName:profile.name||"",purpose:"",requiredDate:"",departureTime:"",returnTime:"",stops:[{place:"",passengers:1,vehicleType:"School bus",distanceKm:"",remarks:""}]});
  const [busy,setBusy] = useState(false);
  const update = (k,v) => setForm(f=>({...f,[k]:v}));
  const updateStop = (i,k,v) => setForm(f=>({...f,stops:f.stops.map((s,n)=>n===i?{...s,[k]:v}:s)}));
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { const fn=httpsCallable(functions,"createConveyanceRequest"); const result=await fn(form); toast(`Request ${result.data.requestNo} submitted to your HOD.`); onCreated(); onClose(); }
    catch(e){toast(errText(e),"error");} finally{setBusy(false);}
  }
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal">
    <div className="modal-head"><div><span className="eyebrow">NEW CONVEYANCE REQUEST</span><h2>Request school transport</h2><p className="muted">Complete the details below to start the approval process.</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <form onSubmit={submit} className="modal-body">
      <div className="section-title"><span>01</span> Request details</div>
      <div className="field-grid">
        <label>Department<input required value={form.department} onChange={e=>update("department",e.target.value)} placeholder="e.g. Administration" /></label>
        <label>Staff name<input required value={form.requesterName} onChange={e=>update("requesterName",e.target.value)} placeholder="Full name"/></label>
        <label className="span-2">Purpose of travel<textarea required rows="2" value={form.purpose} onChange={e=>update("purpose",e.target.value)} placeholder="Explain why conveyance is required"/></label>
        <label>Travel date<input type="date" required min={new Date().toISOString().slice(0,10)} value={form.requiredDate} onChange={e=>update("requiredDate",e.target.value)}/></label>
        <div className="field-grid nested"><label>Departure time<input type="time" required value={form.departureTime} onChange={e=>update("departureTime",e.target.value)}/></label><label>Return time<input type="time" required value={form.returnTime} onChange={e=>update("returnTime",e.target.value)}/></label></div>
      </div>
      <div className="section-title stop-title"><span>02</span> Journey destinations <small>Up to 5 places</small></div>
      {form.stops.map((s,i)=><div className="stop-card" key={i}><div className="stop-card-head"><b><MapPin size={15}/> Destination {i+1}</b>{form.stops.length>1&&<button type="button" className="text-button danger-text" onClick={()=>setForm(f=>({...f,stops:f.stops.filter((_,n)=>n!==i)}))}>Remove</button>}</div>
        <div className="field-grid">
          <label className="span-2">Place / destination<input required value={s.place} onChange={e=>updateStop(i,"place",e.target.value)} placeholder="Destination address or place"/></label>
          <label>No. of passengers<input required type="number" min="1" max="500" value={s.passengers} onChange={e=>updateStop(i,"passengers",e.target.value)}/></label>
          <label>Type of vehicle<select value={s.vehicleType} onChange={e=>updateStop(i,"vehicleType",e.target.value)}><option>School bus</option><option>Mini bus</option><option>Car</option><option>Van</option><option>Other</option></select></label>
          <label>Approx. distance (km)<input type="number" min="0" step="0.1" value={s.distanceKm} onChange={e=>updateStop(i,"distanceKm",e.target.value)} placeholder="Optional"/></label>
          <label>Remarks<input value={s.remarks} onChange={e=>updateStop(i,"remarks",e.target.value)} placeholder="Optional details"/></label>
        </div>
      </div>)}
      {form.stops.length<5&&<button type="button" className="add-stop" onClick={()=>setForm(f=>({...f,stops:[...f.stops,{place:"",passengers:1,vehicleType:"School bus",distanceKm:"",remarks:""}]}))}><Plus size={16}/> Add another destination</button>}
      <div className="workflow-note"><ShieldCheck size={18}/><span>After submission, this request goes to your HOD, then the Facility Manager, and finally the Principal.</span></div>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<ArrowUpRight size={16}/>} Submit request</button></div>
    </form>
  </section></div>;
}

function RequestDetail({item,profile,onClose,onRefresh,toast}) {
  const [decision,setDecision] = useState("approve"); const [comment,setComment] = useState(""); const [busy,setBusy] = useState(false);
  const status=STATUS[item.status]||STATUS.pending_hod;
  const stageRole={pending_hod:"hod",pending_facility:"facility_manager",pending_principal:"principal"}[item.status];
  const canAct=profile.role===stageRole && (profile.role!=="hod"||profile.department===item.department);
  const canResubmit=profile.role==="staff"&&item.createdBy===auth.currentUser?.uid&&item.status==="returned";
  async function act(e) {
    e.preventDefault(); if((decision==="reject"||decision==="return")&&!comment.trim()){toast("Add a reason or comment before continuing.","error");return;}
    setBusy(true);
    try { if(canResubmit) { await httpsCallable(functions,"resubmitConveyanceRequest")({requestId:item.id,updates:{purpose:item.purpose,requiredDate:item.requiredDate,departureTime:item.departureTime,returnTime:item.returnTime}}); toast("Request resubmitted to HOD."); }
      else { await httpsCallable(functions,"decideConveyanceRequest")({requestId:item.id,decision,comment}); toast(decision==="approve"?"Approval recorded.":"Request updated."); }
      onRefresh(); onClose();
    } catch(e){toast(errText(e),"error");} finally{setBusy(false);}
  }
  const stageIndex=item.status==="pending_hod"?0:item.status==="pending_facility"?1:item.status==="pending_principal"?2:item.status==="approved"?3:-1;
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal detail-modal">
    <div className="modal-head"><div><span className="eyebrow">{item.requestNo||"CONVEYANCE REQUEST"}</span><h2>{item.purpose}</h2><p className="muted">{item.requesterName} · {item.department}</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="modal-body">
      <div className="detail-summary"><Mark tone={status.tone}>{status.label}</Mark><span><CalendarDays size={15}/>{prettyDate(item.requiredDate)}</span><span><Clock3 size={15}/>{prettyTime(item.departureTime)} – {prettyTime(item.returnTime)}</span></div>
      <div className="approval-track">{["HOD","Facility Manager","Principal"].map((name,i)=><div className={`track-step ${stageIndex>i?"done":stageIndex===i?"active":""}`} key={name}><div className="track-dot">{stageIndex>i?<CheckCircle2 size={16}/>:i+1}</div><span>{name}</span></div>)}</div>
      <div className="section-title"><span>01</span> Journey details</div>
      {item.stops?.map((s,i)=><div className="destination-row" key={i}><div className="dest-pin"><MapPin size={17}/></div><div className="dest-main"><b>{s.place}</b><span>{s.passengers} passengers · {s.vehicleType} · {s.distanceKm||"—"} km</span>{s.remarks&&<p>{s.remarks}</p>}</div></div>)}
      <div className="section-title"><span>02</span> Approval history</div>
      {item.approvals?.length?<div className="history">{item.approvals.map((a,i)=><div className="history-row" key={i}><div className={`history-icon ${a.decision}`}><CheckCircle2 size={16}/></div><div><b>{ROLE_LABEL[a.role]||a.role} · {a.decision}</b><p>{a.actorName} · {a.at?new Date(a.at).toLocaleString("en-IN"):"Time recorded"}</p>{a.comment&&<p className="history-comment">{a.comment}</p>}</div></div>)}</div>:<p className="empty-inline">No approval actions yet.</p>}
      {(canAct||canResubmit)&&<form onSubmit={act} className="decision-box"><div className="section-title"><span>03</span>{canResubmit?"Resubmit request":"Your decision"}</div>
        {!canResubmit&&<div className="decision-options"><button type="button" className={decision==="approve"?"decision-selected":""} onClick={()=>setDecision("approve")}><CheckCircle2 size={16}/> Approve</button><button type="button" className={decision==="return"?"decision-selected":""} onClick={()=>setDecision("return")}><RotateCcw size={16}/> Return</button><button type="button" className={decision==="reject"?"decision-selected":""} onClick={()=>setDecision("reject")}><XCircle size={16}/> Reject</button></div>}
        {(!canResubmit&&decision!=="approve")&&<label>Comment / reason<textarea rows="3" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Explain the reason so the requester knows what to do."/></label>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<CheckCircle2 size={16}/>} {canResubmit?"Resubmit to HOD":decision==="approve"?"Confirm approval":decision==="return"?"Return to staff":"Reject request"}</button></div>
      </form>}
    </div>
  </section></div>;
}

function App() {
  const [user,setUser]=useState(null); const [profile,setProfile]=useState(null);
  const [requests,setRequests]=useState([]); const [active,setActive]=useState("overview");
  const [search,setSearch]=useState(""); const [filter,setFilter]=useState("all");
  const [showForm,setShowForm]=useState(false); const [selected,setSelected]=useState(null);
  const [toastState,setToastState]=useState(null); const [mobileNav,setMobileNav]=useState(false);
  const toast=(message,type="success")=>{setToastState({message,type});window.setTimeout(()=>setToastState(null),4200);};
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,u=>{setUser(u);setProfile(null);if(!u)setRequests([]);});},[]);
  useEffect(()=>{if(!user||!db)return;return onSnapshot(doc(db,"users",user.uid),s=>{if(s.exists())setProfile({...s.data(),uid:user.uid});else setProfile(null);},e=>toast(errText(e),"error"));},[user?.uid]);
  useEffect(()=>{
    if(!profile||!db)return;
    const role=profile.role; let q;
    if(role==="staff")q=query(collection(db,"requests"),where("createdBy","==",profile.uid));
    else if(role==="hod")q=query(collection(db,"requests"),where("department","==",profile.department));
    else q=query(collection(db,"requests"),orderBy("createdAt","desc"));
    return onSnapshot(q,s=>setRequests(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))),e=>toast(errText(e),"error"));
  },[profile?.uid,profile?.role,profile?.department]);
  const visible=useMemo(()=>requests.filter(r=>{
    const hay=[r.requestNo,r.purpose,r.requesterName,r.department,...(r.stops||[]).map(s=>s.place)].join(" ").toLowerCase();
    const match=hay.includes(search.toLowerCase());
    const stageMatch=filter==="all"||r.status===filter;
    const inbox=active==="inbox" ? (profile?.role==="hod"?r.status==="pending_hod"&&r.department===profile.department:profile?.role==="facility_manager"?r.status==="pending_facility":profile?.role==="principal"?r.status==="pending_principal":false) : true;
    return match&&stageMatch&&inbox;
  }),[requests,search,filter,active,profile]);
  const pending=visible.filter(r=>r.status.startsWith("pending_")).length;
  const actionable=profile?.role==="hod"?"pending_hod":profile?.role==="facility_manager"?"pending_facility":profile?.role==="principal"?"pending_principal":null;
  const myActionQueue=requests.filter(r=>r.status===actionable&&(profile?.role!=="hod"||r.department===profile?.department)).length;
  const login=async(email,password)=>{await signInWithEmailAndPassword(auth,email,password);toast("Signed in successfully.");};
  const logout=async()=>{await signOut(auth);setActive("overview");};
  function exportCsv() {
    const cols=["requestNo","department","requesterName","purpose","requiredDate","departureTime","returnTime","status","destinations"];
    const rows=[cols.join(","),...visible.map(r=>cols.map(c=>{let v=c==="destinations"?(r.stops||[]).map(s=>`${s.place} (${s.passengers})`).join("; "):(r[c]??"");return `"${String(v).replaceAll('"','""')}"`}).join(","))];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8;"}));a.download="choice-school-conveyance-requests.csv";a.click();URL.revokeObjectURL(a.href);
  }
  if(!user)return <><Login onLogin={login} toast={toast}/>{toastState&&<Toast state={toastState}/>}</>;
  if(!profile)return <div className="loading-screen"><LoaderCircle className="spin" size={28}/><b>Loading your school workspace…</b><span>If this takes too long, ask your administrator to assign your account a role.</span></div>;
  const isApprover=profile.role!=="staff";
  const nav=[{id:"overview",label:"Overview",icon:FileText},{id:"requests",label:profile.role==="staff"?"My requests":"All requests",icon:BusFront},{id:"inbox",label:"Approval inbox",icon:ShieldCheck,badge:myActionQueue>0?myActionQueue:null}];
  const selectedItem=selected?requests.find(r=>r.id===selected.id)||selected:null;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"nav-open":""}`}><Brand/><div className="school-chip"><span className="school-dot"></span> THIRUVALLA CAMPUS</div><div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.id} className={`nav-item ${active===n.id?"active":""}`} onClick={()=>{setActive(n.id);setMobileNav(false);}}><n.icon size={18}/><span>{n.label}</span>{n.badge&&<b className="nav-badge">{n.badge}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="support-card"><ShieldCheck size={18}/><b>Approval workflow</b><span>HOD → Facility Manager → Principal</span></div><div className="user-mini"><div className="avatar">{(profile.name||"U").slice(0,1).toUpperCase()}</div><div className="user-mini-text"><b>{profile.name||profile.email}</b><span>{ROLE_LABEL[profile.role]}</span></div><button className="icon-button mini" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area"><header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div className="breadcrumbs">Transport <ChevronRight size={14}/><b>{nav.find(n=>n.id===active)?.label||"Overview"}</b></div><div className="topbar-right"><span className="online-pill"><span/> Online workspace</span><div className="avatar small">{(profile.name||"U").slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow">CONVEYANCE FACILITY REQUEST</span><h1>{active==="overview"?"Good day, "+(profile.name||"there").split(" ")[0]:active==="inbox"?"Approval inbox":profile.role==="staff"?"My requests":"All conveyance requests"}</h1><p>{active==="overview"?"Manage school travel arrangements with a clear approval trail.":active==="inbox"?"Review requests awaiting your action.":"Track every request and its current approval stage."}</p></div><div className="heading-actions">{isApprover&&<button className="secondary export-button" onClick={exportCsv}><Download size={16}/> Export CSV</button>}{profile.role==="staff"&&<button className="primary" onClick={()=>setShowForm(true)}><Plus size={17}/> New request</button>}</div></div>
      {active==="overview"&&<><div className="welcome-banner"><div><Mark tone="light">YOUR WORKSPACE</Mark><h2>Transport, without the back-and-forth.</h2><p>Every request follows the same transparent route, from department review to final approval.</p></div><div className="banner-art"><div className="banner-circle"><BusFront size={48}/></div><div className="banner-line"></div></div></div>
        <div className="stats-grid"><Stat icon={FileText} label={profile.role==="staff"?"Requests submitted":"Requests visible"} value={requests.length} detail="Across your workspace" tone="navy"/><Stat icon={Clock3} label="Pending" value={requests.filter(r=>r.status.startsWith("pending_")).length} detail="Awaiting a decision" tone="amber"/><Stat icon={CheckCircle2} label="Approved" value={requests.filter(r=>r.status==="approved").length} detail="Fully approved" tone="green"/><Stat icon={ShieldCheck} label="Needs your action" value={myActionQueue} detail="In your approval queue" tone="violet"/></div>
        <div className="content-grid"><section className="panel"><div className="panel-head"><div><h3>Recent requests</h3><p>Latest activity in your workspace</p></div><button className="text-button" onClick={()=>setActive("requests")}>View all <ArrowUpRight size={15}/></button></div><RequestList items={requests.slice(0,5)} onSelect={setSelected}/></section>
          <section className="panel workflow-panel"><div className="panel-head"><div><h3>Approval journey</h3><p>Three clear review stages</p></div><ShieldCheck size={20} className="muted-icon"/></div><div className="mini-steps">{[{n:"01",title:"HOD review",desc:"Department recommendation"},{n:"02",title:"Facility Manager",desc:"Transport and feasibility review"},{n:"03",title:"Principal",desc:"Final authorization"}].map((s,i)=><div className="mini-step" key={s.n}><div className="mini-step-num">{s.n}</div><div><b>{s.title}</b><span>{s.desc}</span></div>{i<2&&<div className="step-connector"/>}</div>)}</div><div className="workflow-footer"><ShieldCheck size={17}/><span>Decisions and comments are recorded in the request history.</span></div></section></div>
      </>}
      {active!=="overview"&&<section className="panel table-panel"><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search request, staff, destination…"/></div><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS).map(([k,v])=><option value={k} key={k}>{v.label}</option>)}</select><span className="result-count">{visible.length} result{visible.length===1?"":"s"}</span></div><RequestList items={visible} onSelect={setSelected} emptyMessage={active==="inbox"?"No requests are waiting for your approval.":"No requests match your filters."}/></section>}
      <footer className="app-footer"><span>THE CHOICE SCHOOL, THIRUVALLA</span><span>Conveyance Facility Request · Secure workflow</span></footer></div></main>
    {showForm&&<RequestForm profile={profile} onClose={()=>setShowForm(false)} onCreated={()=>{}} toast={toast}/>}
    {selectedItem&&<RequestDetail item={selectedItem} profile={profile} onClose={()=>setSelected(null)} onRefresh={()=>{}} toast={toast}/>}
    {toastState&&<Toast state={toastState}/>}
  </div>;
}
function Stat({icon:Icon,label,value,detail,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><span className="stat-label">{label}</span><b className="stat-value">{value}</b><span className="stat-detail">{detail}</span></div>}
function RequestList({items,onSelect,emptyMessage="No requests yet. Submit a request to get started."}) {
  if(!items.length)return <div className="empty-state"><div className="empty-icon"><BusFront size={24}/></div><b>Nothing to show yet</b><span>{emptyMessage}</span></div>;
  return <div className="request-list">{items.map(r=>{const s=STATUS[r.status]||STATUS.pending_hod;return <button className="request-row" key={r.id} onClick={()=>onSelect(r)}><div className="request-icon"><BusFront size={18}/></div><div className="request-main"><b>{r.purpose||"Conveyance request"}</b><span>{r.requestNo||"Pending ID"} · {r.requesterName} · {r.department}</span><small><MapPin size={13}/>{r.stops?.[0]?.place||"No destination"}{r.stops?.length>1?` +${r.stops.length-1} more`:""} <i>·</i> <CalendarDays size={13}/>{prettyDate(r.requiredDate)}</small></div><div className="request-end"><Mark tone={s.tone}>{s.label}</Mark><ChevronRight size={17} className="row-chevron"/></div></button>})}</div>;
}
function Toast({state}){return <div className={`toast ${state.type==="error"?"toast-error":""}`}>{state.type==="error"?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}<span>{state.message}</span></div>}

export default App;