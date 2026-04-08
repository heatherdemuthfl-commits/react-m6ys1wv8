 import { useState, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const STAGES = ["New Lead","Contacted","Showing","Offer Made","Under Contract","Closed","Lost"];
const STAGE_COLORS = {
  "New Lead":"#3b82f6","Contacted":"#8b5cf6","Showing":"#f59e0b",
  "Offer Made":"#ef4444","Under Contract":"#10b981","Closed":"#059669","Lost":"#475569",
};

const INITIAL_LEADS = [
  { id:1, name:"Sarah & Tom Mitchell", phone:"386-555-0123", email:"mitchells@email.com", stage:"Showing", propertyInterest:"3BR Single Family, $380K–$430K", source:"Zillow", budget:430000, notes:"Pre-approved. Prefer Port Orange area. Kids start school in August.", lastContact:"2026-03-18", aiSummary:"", tasks:[], attachments:[] },
  { id:2, name:"David Nguyen", phone:"386-555-0456", email:"dnguyen@email.com", stage:"Offer Made", propertyInterest:"2BR Condo, $220K–$260K", source:"Referral", budget:260000, notes:"First-time buyer. Needs closing cost assistance.", lastContact:"2026-03-19", aiSummary:"", tasks:[], attachments:[] },
  { id:3, name:"Carla Reyes", phone:"386-555-0789", email:"creyes@email.com", stage:"New Lead", propertyInterest:"4BR Pool Home, $500K+", source:"Instagram", budget:600000, notes:"Relocating from Miami in Q3.", lastContact:"2026-03-15", aiSummary:"", tasks:[], attachments:[] },
  { id:4, name:"James & Linda Park", phone:"386-555-0321", email:"parkfamily@email.com", stage:"Under Contract", propertyInterest:"3BR, $340K", source:"Open House", budget:350000, notes:"Close date: April 15. Inspection done.", lastContact:"2026-03-20", aiSummary:"", tasks:[{id:"t1",text:"Send closing docs",done:false,due:"2026-03-25"}], attachments:[] },
  { id:5, name:"Marcus Thompson", phone:"386-555-0654", email:"mthompson@email.com", stage:"Contacted", propertyInterest:"Investment duplex, $300K–$350K", source:"Website", budget:350000, notes:"Cash buyer. Looking for rental income.", lastContact:"2026-03-17", aiSummary:"", tasks:[], attachments:[] },
  { id:6, name:"Emily Foster", phone:"386-555-0987", email:"efoster@email.com", stage:"Closed", propertyInterest:"2BR Townhouse, $280K", source:"Referral", budget:280000, notes:"Closed March 10. Very smooth transaction!", lastContact:"2026-03-10", aiSummary:"", tasks:[], attachments:[] },
];

const fmt = (n) => n ? "$" + Number(n).toLocaleString() : "—";
const daysSince = (d) => Math.floor((new Date() - new Date(d)) / 86400000);
const today = () => new Date().toISOString().split("T")[0];

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "re_pipeline_leads_v2";
const loadLeads = () => {
  try {
    const raw = window.storage ? null : localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};
const saveLeads = (leads) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch {}
  try { window.storage?.set(STORAGE_KEY, JSON.stringify(leads)); } catch {}
};

// ─── Tiny components ──────────────────────────────────────────────────────────
const Btn = ({ onClick, children, color="#3b82f6", outline, small, disabled, style={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outline ? "transparent" : color, color: outline ? color : "#fff",
    border: outline ? `1.5px solid ${color}` : "none", borderRadius: 8,
    padding: small ? "5px 12px" : "9px 18px", fontSize: small ? 12 : 13,
    fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily:"inherit",
    opacity: disabled ? 0.6 : 1, display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    transition:"all 0.15s", ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type="text", multiline, rows=3, style={} }) => {
  const base = { width:"100%", background:"#111827", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"8px 11px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none", ...style };
  return multiline
    ? <textarea value={value} onChange={onChange} rows={rows} style={{...base, resize:"vertical"}} placeholder={placeholder} />
    : <input value={value} onChange={onChange} type={type} placeholder={placeholder} style={base} />;
};

const Badge = ({ stage }) => (
  <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:STAGE_COLORS[stage]+"22", color:STAGE_COLORS[stage], fontWeight:700 }}>{stage}</span>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize:11, color:"#64748b", fontWeight:700, marginBottom:6, textTransform:"uppercase", letterSpacing:0.6 }}>{children}</div>
);

// ─── AI caller ────────────────────────────────────────────────────────────────
const callAI = async (prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }),
  });
  const data = await res.json();
  return data.content?.map(b=>b.text||"").join("") || "No response.";
};

// ─── Tasks Panel ──────────────────────────────────────────────────────────────
function TasksPanel({ tasks, onChange }) {
  const [newText, setNewText] = useState("");
  const [newDue, setNewDue] = useState("");
  const add = () => {
    if (!newText.trim()) return;
    onChange([...tasks, { id: "t"+Date.now(), text:newText.trim(), done:false, due:newDue }]);
    setNewText(""); setNewDue("");
  };
  const toggle = (id) => onChange(tasks.map(t => t.id===id ? {...t,done:!t.done} : t));
  const remove = (id) => onChange(tasks.filter(t=>t.id!==id));
  const overdue = (t) => t.due && !t.done && new Date(t.due) < new Date();

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <Input value={newText} onChange={e=>setNewText(e.target.value)} placeholder="New task..." style={{flex:1}} />
        <Input value={newDue} onChange={e=>setNewDue(e.target.value)} type="date" style={{width:130}} />
        <Btn small onClick={add} color="#3b82f6">+ Add</Btn>
      </div>
      {tasks.length === 0 && <div style={{fontSize:12,color:"#334155",textAlign:"center",padding:"12px 0"}}>No tasks yet</div>}
      {tasks.map(t => (
        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid #1e293b" }}>
          <input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)} style={{accentColor:"#10b981",width:15,height:15,cursor:"pointer"}} />
          <div style={{ flex:1, fontSize:13, color: t.done ? "#475569" : "#f1f5f9", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</div>
          {t.due && <span style={{ fontSize:11, color: overdue(t) ? "#ef4444" : "#64748b" }}>{t.due}</span>}
          <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:15,padding:0}}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Attachments Panel ────────────────────────────────────────────────────────
function AttachmentsPanel({ attachments, onChange }) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const newAtts = Array.from(files).map(f => ({
      id: "a"+Date.now()+Math.random(),
      name: f.name,
      size: f.size,
      type: f.type,
      dataUrl: null,
      added: today(),
    }));
    // Read as dataURL for images, otherwise store metadata
    const promises = Array.from(files).map((f, i) => new Promise(res => {
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = e => { newAtts[i].dataUrl = e.target.result; res(); };
        reader.readAsDataURL(f);
      } else res();
    }));
    Promise.all(promises).then(() => onChange([...attachments, ...newAtts]));
  };

  const fmtSize = (b) => b > 1048576 ? (b/1048576).toFixed(1)+"MB" : (b/1024).toFixed(0)+"KB";
  const icon = (type) => type?.startsWith("image/") ? "🖼️" : type?.includes("pdf") ? "📄" : type?.includes("word") ? "📝" : "📎";

  return (
    <div>
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
        style={{ border:`2px dashed ${dragOver?"#3b82f6":"#1e293b"}`, borderRadius:10, padding:"16px", textAlign:"center", marginBottom:10, cursor:"pointer", transition:"border-color 0.2s", background: dragOver?"#1e293b22":"transparent" }}
        onClick={()=>document.getElementById("att-upload").click()}
      >
        <div style={{fontSize:22,marginBottom:4}}>📎</div>
        <div style={{fontSize:12,color:"#64748b"}}>Drop files here or click to upload</div>
        <input id="att-upload" type="file" multiple style={{display:"none"}} onChange={e=>handleFiles(e.target.files)} />
      </div>
      {attachments.length === 0 && <div style={{fontSize:12,color:"#334155",textAlign:"center",padding:"8px 0"}}>No attachments yet</div>}
      {attachments.map(a => (
        <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #1e293b" }}>
          {a.dataUrl ? <img src={a.dataUrl} style={{width:36,height:36,borderRadius:6,objectFit:"cover"}} /> : <span style={{fontSize:22}}>{icon(a.type)}</span>}
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13,color:"#f1f5f9",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</div>
            <div style={{fontSize:11,color:"#64748b"}}>{fmtSize(a.size)} · {a.added}</div>
          </div>
          <button onClick={()=>onChange(attachments.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:15}}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Email Draft Modal ─────────────────────────────────────────────────────────
function EmailDraftModal({ lead, onClose }) {
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const text = await callAI(`You are a warm, professional residential real estate agent. Write a follow-up email to this client:
Name: ${lead.name}
Email: ${lead.email}
Stage: ${lead.stage}
Interest: ${lead.propertyInterest}
Budget: ${fmt(lead.budget)}
Notes: ${lead.notes}
Last contact: ${daysSince(lead.lastContact)} days ago
Source: ${lead.source}

Write:
Subject: [subject line]
---
[email body, 3–4 paragraphs, warm but professional, no salesy clichés]

Sign off as "Your Agent"`);
      const lines = text.split("\n");
      const subjectLine = lines.find(l=>l.toLowerCase().startsWith("subject:"))?.replace(/^subject:\s*/i,"") || `Following up – ${lead.name}`;
      const bodyStart = lines.findIndex(l=>l.trim()==="---");
      const body = bodyStart > -1 ? lines.slice(bodyStart+1).join("\n").trim() : text;
      setSubject(subjectLine);
      setDraft(body);
      setGenerated(true);
    } catch { setDraft("Error generating email. Please try again."); }
    setLoading(false);
  };

  useEffect(() => { generate(); }, []);

  const openInMail = () => {
    window.open(`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000095",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto",padding:28,fontFamily:"inherit"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:18,color:"#f1f5f9"}}>📧 Email Draft</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>To: {lead.name} · {lead.email}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:"40px 0",color:"#64748b"}}>
            <div style={{fontSize:28,marginBottom:10}}>✦</div>
            <div style={{fontSize:13}}>AI is drafting your email...</div>
          </div>
        ) : (
          <>
            <div style={{marginBottom:12}}>
              <SectionLabel>Subject</SectionLabel>
              <Input value={subject} onChange={e=>setSubject(e.target.value)} />
            </div>
            <div style={{marginBottom:20}}>
              <SectionLabel>Body</SectionLabel>
              <Input value={draft} onChange={e=>setDraft(e.target.value)} multiline rows={12} />
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
              <Btn onClick={generate} color="#6366f1" outline small>↺ Regenerate</Btn>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>navigator.clipboard?.writeText(`Subject: ${subject}\n\n${draft}`)} color="#475569" outline small>Copy</Btn>
                <Btn onClick={openInMail} color="#3b82f6">Open in Mail ↗</Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Lead Modal ────────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onUpdate, onDelete }) {
  const [ed, setEd] = useState({...lead, tasks: lead.tasks||[], attachments: lead.attachments||[]});
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeAI, setActiveAI] = useState(null);
  const [tab, setTab] = useState("details"); // details | tasks | attachments
  const [showEmail, setShowEmail] = useState(false);

  const set = (k,v) => setEd(p=>({...p,[k]:v}));

  const runAI = async (type) => {
    setAiLoading(true); setActiveAI(type);
    try {
      let prompt = "";
      if (type==="summary") prompt = `Summarize this real estate lead in 2–3 sentences for a CRM. Key opportunities, risks, next steps:\nName: ${ed.name}\nStage: ${ed.stage}\nInterest: ${ed.propertyInterest}\nBudget: ${fmt(ed.budget)}\nNotes: ${ed.notes}`;
      if (type==="strategy") prompt = `Give a 3-step action plan to move this lead from "${ed.stage}" to the next stage. Be specific:\nName: ${ed.name}\nInterest: ${ed.propertyInterest}\nBudget: ${fmt(ed.budget)}\nNotes: ${ed.notes}`;
      if (type==="tasks") prompt = `Suggest 3–5 concrete follow-up tasks for this real estate lead. Return as a plain numbered list:\nName: ${ed.name}\nStage: ${ed.stage}\nInterest: ${ed.propertyInterest}\nNotes: ${ed.notes}`;
      const result = await callAI(prompt);
      setAiOut(result);
      if (type==="summary") set("aiSummary", result);
      if (type==="tasks") {
        // Parse numbered list into tasks
        const lines = result.split("\n").filter(l=>/^\d+\./.test(l.trim()));
        if (lines.length) {
          const newTasks = lines.map(l=>({ id:"t"+Date.now()+Math.random(), text:l.replace(/^\d+\.\s*/,"").trim(), done:false, due:"" }));
          set("tasks", [...(ed.tasks||[]), ...newTasks]);
          setTab("tasks");
        }
      }
    } catch { setAiOut("Error. Try again."); }
    setAiLoading(false);
  };

  const save = () => { onUpdate(ed); onClose(); };
  const openTask = ed.tasks?.filter(t=>!t.done).length || 0;
  const overdueTask = ed.tasks?.filter(t=>!t.done&&t.due&&new Date(t.due)<new Date()).length || 0;

  return (
    <>
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:720,maxHeight:"92vh",overflowY:"auto",padding:28,fontFamily:"inherit"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:"#f1f5f9"}}>{lead.name}</div>
            <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              <Badge stage={lead.stage} />
              <span style={{fontSize:11,color:"#64748b",padding:"3px 8px",background:"#1e293b",borderRadius:20}}>{lead.source}</span>
              {openTask > 0 && <span style={{fontSize:11,color: overdueTask?"#ef4444":"#f59e0b",padding:"3px 8px",background: overdueTask?"#ef444418":"#f59e0b18",borderRadius:20}}>📋 {openTask} task{openTask>1?"s":""}{overdueTask?" (overdue)":""}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Btn small onClick={()=>setShowEmail(true)} color="#3b82f6">📧 Email</Btn>
            <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid #1e293b",paddingBottom:0}}>
          {[["details","Details"],["tasks","Tasks"+(openTask?` (${openTask})`:"")],["attachments","Files"+(ed.attachments?.length?` (${ed.attachments.length})`:"")]].map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===k?"#3b82f6":"transparent"}`,color:tab===k?"#3b82f6":"#64748b",padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {tab==="details" && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {[["Name","name"],["Phone","phone"],["Email","email"],["Source","source"],["Budget ($)","budget"],["Last Contact","lastContact"]].map(([label,key])=>(
                <div key={key}>
                  <SectionLabel>{label}</SectionLabel>
                  <Input value={ed[key]||""} onChange={e=>set(key,e.target.value)} type={key==="lastContact"?"date":"text"} />
                </div>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <SectionLabel>Property Interest</SectionLabel>
              <Input value={ed.propertyInterest||""} onChange={e=>set("propertyInterest",e.target.value)} />
            </div>
            <div style={{marginBottom:12}}>
              <SectionLabel>Stage</SectionLabel>
              <select value={ed.stage} onChange={e=>set("stage",e.target.value)} style={{width:"100%",background:"#111827",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"8px 11px",fontSize:13,fontFamily:"inherit"}}>
                {STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <SectionLabel>Notes</SectionLabel>
              <Input value={ed.notes||""} onChange={e=>set("notes",e.target.value)} multiline rows={3} />
            </div>

            {/* AI panel */}
            <div style={{background:"#111827",borderRadius:12,padding:16,border:"1px solid #1e293b",marginBottom:16}}>
              <div style={{fontSize:12,color:"#8b5cf6",fontWeight:700,marginBottom:12}}>✦ AI ASSISTANT</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                {[["summary","Summarize"],["strategy","Action Plan"],["tasks","Generate Tasks"]].map(([type,label])=>(
                  <Btn key={type} small onClick={()=>runAI(type)} disabled={aiLoading} color="#6366f1">
                    {aiLoading&&activeAI===type?"⏳":"✦"} {label}
                  </Btn>
                ))}
              </div>
              {aiOut && <div style={{background:"#0d1117",borderRadius:8,padding:12,fontSize:13,color:"#cbd5e1",lineHeight:1.75,whiteSpace:"pre-wrap",border:"1px solid #1e293b",maxHeight:180,overflowY:"auto"}}>{aiOut}</div>}
            </div>
          </>
        )}

        {/* Tasks Tab */}
        {tab==="tasks" && (
          <TasksPanel tasks={ed.tasks||[]} onChange={v=>set("tasks",v)} />
        )}

        {/* Attachments Tab */}
        {tab==="attachments" && (
          <AttachmentsPanel attachments={ed.attachments||[]} onChange={v=>set("attachments",v)} />
        )}

        {/* Footer */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:"1px solid #1e293b"}}>
          <Btn onClick={()=>{onDelete(lead.id);onClose();}} color="#ef4444" outline>Delete</Btn>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={onClose} color="#475569" outline>Cancel</Btn>
            <Btn onClick={save} color="#10b981">Save Changes</Btn>
          </div>
        </div>
      </div>
    </div>
    {showEmail && <EmailDraftModal lead={ed} onClose={()=>setShowEmail(false)} />}
    </>
  );
}

// ─── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name:"", phone:"", email:"", stage:"New Lead", propertyInterest:"", budget:"", source:"", notes:"", lastContact:today(), tasks:[], attachments:[] });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const submit = () => { if (!f.name.trim()) return; onAdd({...f, id:Date.now(), budget:Number(f.budget)||0}); onClose(); };
  return (
    <div style={{position:"fixed",inset:0,background:"#00000090",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:28,fontFamily:"inherit"}}>
        <div style={{fontWeight:800,fontSize:20,color:"#f1f5f9",marginBottom:20}}>Add New Lead</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {[["Full Name *","name"],["Phone","phone"],["Email","email"],["Source","source"],["Budget ($)","budget"],["Last Contact","lastContact"]].map(([label,key])=>(
            <div key={key}>
              <SectionLabel>{label}</SectionLabel>
              <Input value={f[key]} onChange={e=>set(key,e.target.value)} type={key==="lastContact"?"date":"text"} />
            </div>
          ))}
        </div>
        <div style={{marginBottom:12}}>
          <SectionLabel>Property Interest</SectionLabel>
          <Input value={f.propertyInterest} onChange={e=>set("propertyInterest",e.target.value)} />
        </div>
        <div style={{marginBottom:12}}>
          <SectionLabel>Stage</SectionLabel>
          <select value={f.stage} onChange={e=>set("stage",e.target.value)} style={{width:"100%",background:"#111827",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"8px 11px",fontSize:13,fontFamily:"inherit"}}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{marginBottom:20}}>
          <SectionLabel>Notes</SectionLabel>
          <Input value={f.notes} onChange={e=>set("notes",e.target.value)} multiline />
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} color="#475569" outline>Cancel</Btn>
          <Btn onClick={submit} color="#3b82f6">Add Lead</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onSelect }) {
  const days = daysSince(lead.lastContact);
  const urgent = days >= 3 && !["Closed","Lost"].includes(lead.stage);
  const openTasks = lead.tasks?.filter(t=>!t.done).length || 0;
  const overdueTasks = lead.tasks?.filter(t=>!t.done&&t.due&&new Date(t.due)<new Date()).length || 0;
  return (
    <div onClick={()=>onSelect(lead)} style={{background:"#0f172a",border:`1px solid ${urgent?"#ef444430":"#1e293b"}`,borderRadius:12,padding:"13px 15px",cursor:"pointer",marginBottom:9,transition:"border-color 0.15s",position:"relative",overflow:"hidden"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=STAGE_COLORS[lead.stage]+"70"}
      onMouseLeave={e=>e.currentTarget.style.borderColor=urgent?"#ef444430":"#1e293b"}>
      <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:STAGE_COLORS[lead.stage]}} />
      <div style={{paddingLeft:8}}>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <div style={{fontWeight:700,color:"#f1f5f9",fontSize:14}}>{lead.name}</div>
          <div style={{fontSize:11,color:urgent?"#ef4444":"#64748b",fontWeight:600}}>{days===0?"Today":`${days}d ago`}</div>
        </div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{lead.propertyInterest}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,flexWrap:"wrap",gap:4}}>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <Badge stage={lead.stage} />
            {openTasks>0 && <span style={{fontSize:10,color:overdueTasks?"#ef4444":"#f59e0b",background:overdueTasks?"#ef444418":"#f59e0b18",padding:"2px 7px",borderRadius:20}}>📋 {openTasks}</span>}
            {(lead.attachments?.length||0)>0 && <span style={{fontSize:10,color:"#64748b",background:"#1e293b",padding:"2px 7px",borderRadius:20}}>📎 {lead.attachments.length}</span>}
          </div>
          <span style={{fontSize:12,color:"#10b981",fontWeight:700}}>{fmt(lead.budget)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Reminders Panel ──────────────────────────────────────────────────────────
function RemindersPanel({ leads, onSelectLead }) {
  const allTasks = leads.flatMap(l => (l.tasks||[]).filter(t=>!t.done).map(t=>({...t, leadName:l.name, leadId:l.id, lead:l})));
  const overdue = allTasks.filter(t=>t.due&&new Date(t.due)<new Date());
  const today_ = allTasks.filter(t=>t.due===today());
  const upcoming = allTasks.filter(t=>t.due&&t.due>today()).sort((a,b)=>a.due>b.due?1:-1);
  const coldLeads = leads.filter(l=>daysSince(l.lastContact)>=3&&!["Closed","Lost"].includes(l.stage)).sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact));

  const Section = ({title,items,color}) => items.length===0?null:(
    <div style={{marginBottom:20}}>
      <div style={{fontSize:12,fontWeight:700,color,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{title} ({items.length})</div>
      {items.map(t=>(
        <div key={t.id} onClick={()=>onSelectLead(t.lead)} style={{background:"#0d1117",border:`1px solid ${color}30`,borderRadius:10,padding:"10px 13px",marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=color+"80"}
          onMouseLeave={e=>e.currentTarget.style.borderColor=color+"30"}>
          <div>
            <div style={{fontSize:13,color:"#f1f5f9",fontWeight:600}}>{t.text}</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{t.leadName}</div>
          </div>
          {t.due&&<div style={{fontSize:11,color,fontWeight:600,whiteSpace:"nowrap",marginLeft:8}}>{t.due}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <Section title="⚠️ Overdue" items={overdue} color="#ef4444" />
      <Section title="📅 Due Today" items={today_} color="#f59e0b" />
      <Section title="🔜 Upcoming" items={upcoming.slice(0,5)} color="#3b82f6" />
      {coldLeads.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8b5cf6",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>🧊 Going Cold ({coldLeads.length})</div>
          {coldLeads.map(l=>(
            <div key={l.id} onClick={()=>onSelectLead(l)} style={{background:"#0d1117",border:"1px solid #8b5cf630",borderRadius:10,padding:"10px 13px",marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#8b5cf680"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#8b5cf630"}>
              <div>
                <div style={{fontSize:13,color:"#f1f5f9",fontWeight:600}}>{l.name}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{l.stage} · {l.propertyInterest}</div>
              </div>
              <div style={{fontSize:11,color:"#ef4444",fontWeight:700}}>{daysSince(l.lastContact)}d ago</div>
            </div>
          ))}
        </div>
      )}
      {allTasks.length===0&&coldLeads.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#334155",fontSize:13}}>🎉 All caught up! No reminders.</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState(() => loadLeads() || INITIAL_LEADS);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [aiReport, setAiReport] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);

  // Persist on change
  useEffect(() => { saveLeads(leads); }, [leads]);

  const updateLead = (u) => setLeads(p=>p.map(l=>l.id===u.id?u:l));
  const deleteLead = (id) => setLeads(p=>p.filter(l=>l.id!==id));
  const addLead = (l) => setLeads(p=>[l,...p]);

  // Reopen updated lead if open
  useEffect(() => {
    if (selectedLead) setSelectedLead(leads.find(l=>l.id===selectedLead.id)||null);
  }, [leads]);

  const filtered = leads.filter(l => {
    const ms = l.name.toLowerCase().includes(search.toLowerCase()) || l.propertyInterest.toLowerCase().includes(search.toLowerCase());
    const mst = stageFilter==="All" || l.stage===stageFilter;
    return ms && mst;
  });

  const totalPipeline = leads.filter(l=>!["Closed","Lost"].includes(l.stage)).reduce((s,l)=>s+l.budget,0);
  const closedRevenue = leads.filter(l=>l.stage==="Closed").reduce((s,l)=>s+l.budget,0);
  const activeLeads = leads.filter(l=>!["Closed","Lost"].includes(l.stage)).length;
  const urgentLeads = leads.filter(l=>daysSince(l.lastContact)>=3&&!["Closed","Lost"].includes(l.stage)).length;
  const allOpenTasks = leads.flatMap(l=>(l.tasks||[]).filter(t=>!t.done));
  const overdueTasks = allOpenTasks.filter(t=>t.due&&new Date(t.due)<new Date()).length;

  const generateReport = async () => {
    setLoadingReport(true);
    const summary = leads.map(l=>`${l.name} | ${l.stage} | ${fmt(l.budget)} | Last: ${daysSince(l.lastContact)}d ago | Tasks: ${(l.tasks||[]).filter(t=>!t.done).length} open`).join("\n");
    try {
      const r = await callAI(`You are a real estate sales coach. Analyze this residential pipeline and give a short executive summary (3–4 paragraphs): overall health, top opportunities, risks/leads going cold, and 3 priority actions for this week.\n\nPipeline:\n${summary}\n\nTotal pipeline: ${fmt(totalPipeline)}\nClosed: ${fmt(closedRevenue)}\nActive: ${activeLeads}\nOverdue tasks: ${overdueTasks}`);
      setAiReport(r);
    } catch { setAiReport("Error generating report."); }
    setLoadingReport(false);
  };

  const NAV = [
    {k:"pipeline",label:"Pipeline"},
    {k:"contacts",label:"Contacts"},
    {k:"reminders",label:"Reminders"+(overdueTasks?` ⚠️`:"")},
    {k:"forecast",label:"Forecast"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#060b14",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#f1f5f9"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{borderBottom:"1px solid #1e293b",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d1117",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏡</div>
          <div>
            <div style={{fontWeight:800,fontSize:18,color:"#f8fafc",letterSpacing:-0.3}}>Pipeline Pro</div>
            <div style={{fontSize:11,color:"#64748b"}}>Residential Real Estate CRM</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {NAV.map(({k,label})=>(
            <button key={k} onClick={()=>setView(k)} style={{background:view===k?"#1e293b":"none",border:"none",color:view===k?"#f1f5f9":"#64748b",borderRadius:8,padding:"7px 13px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {label}
            </button>
          ))}
        </div>
        <Btn onClick={()=>setShowAdd(true)} color="#3b82f6">+ Add Lead</Btn>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,padding:"16px 24px",borderBottom:"1px solid #1e293b"}}>
        {[
          {label:"Active Leads",value:activeLeads,color:"#3b82f6",icon:"👥"},
          {label:"Pipeline Value",value:fmt(totalPipeline),color:"#8b5cf6",icon:"📊"},
          {label:"Closed Revenue",value:fmt(closedRevenue),color:"#10b981",icon:"🏆"},
          {label:overdueTasks?"Overdue Tasks":"Need Follow-Up",value:overdueTasks||urgentLeads,color:(overdueTasks||urgentLeads)>0?"#ef4444":"#10b981",icon:overdueTasks?"⚠️":"⚡"},
        ].map(s=>(
          <div key={s.label} style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{padding:"20px 24px"}}>

        {/* Pipeline */}
        {view==="pipeline" && (
          <>
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search leads..." style={{flex:1,minWidth:180}} />
              <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:10,color:"#f1f5f9",padding:"9px 14px",fontSize:13,fontFamily:"inherit"}}>
                <option>All</option>{STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:16}}>
              {STAGES.map(stage=>{
                const sl = filtered.filter(l=>l.stage===stage);
                if (sl.length===0&&stageFilter!=="All") return null;
                return (
                  <div key={stage}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:STAGE_COLORS[stage]}} />
                        <span style={{fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5}}>{stage}</span>
                      </div>
                      <span style={{fontSize:11,background:"#1e293b",color:"#64748b",padding:"2px 8px",borderRadius:20,fontWeight:600}}>{sl.length}</span>
                    </div>
                    {sl.map(l=><LeadCard key={l.id} lead={l} onSelect={setSelectedLead} />)}
                    {sl.length===0&&<div style={{fontSize:12,color:"#334155",textAlign:"center",padding:"20px 0",border:"1px dashed #1e293b",borderRadius:10}}>Empty</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Contacts */}
        {view==="contacts" && (
          <>
            <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search contacts..." style={{marginBottom:16}} />
            <div style={{background:"#0d1117",borderRadius:14,border:"1px solid #1e293b",overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1.2fr 1fr 90px",padding:"10px 16px",borderBottom:"1px solid #1e293b",fontSize:11,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>
                <div>Contact</div><div>Interest</div><div>Budget</div><div>Stage</div><div>Last Contact</div><div></div>
              </div>
              {filtered.map(l=>(
                <div key={l.id} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1.2fr 1fr 90px",padding:"12px 16px",borderBottom:"1px solid #0f172a",alignItems:"center",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#111827"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{l.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>{l.email}</div>
                  </div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{l.propertyInterest}</div>
                  <div style={{fontWeight:700,color:"#10b981",fontSize:13}}>{fmt(l.budget)}</div>
                  <Badge stage={l.stage} />
                  <div style={{fontSize:12,color:daysSince(l.lastContact)>=3?"#ef4444":"#64748b"}}>{daysSince(l.lastContact)}d ago</div>
                  <button onClick={()=>setSelectedLead(l)} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Open</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Reminders */}
        {view==="reminders" && (
          <RemindersPanel leads={leads} onSelectLead={setSelectedLead} />
        )}

        {/* Forecast */}
        {view==="forecast" && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14,marginBottom:20}}>
              {STAGES.filter(s=>s!=="Lost").map(stage=>{
                const sl = leads.filter(l=>l.stage===stage);
                const val = sl.reduce((s,l)=>s+l.budget,0);
                const max = leads.reduce((s,l)=>s+l.budget,0);
                return (
                  <div key={stage} style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{stage}</div>
                        <div style={{fontSize:12,color:"#64748b"}}>{sl.length} lead{sl.length!==1?"s":""}</div>
                      </div>
                      <div style={{fontSize:17,fontWeight:800,color:STAGE_COLORS[stage]}}>{fmt(val)}</div>
                    </div>
                    <div style={{background:"#1e293b",borderRadius:6,height:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:max?`${(val/max)*100}%`:"0%",background:STAGE_COLORS[stage],borderRadius:6,transition:"width 0.6s ease"}} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>AI Pipeline Report</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Executive analysis of your pipeline health</div>
                </div>
                <Btn onClick={generateReport} disabled={loadingReport} color="#6366f1">
                  {loadingReport?"⏳ Generating...":"✦ Generate Report"}
                </Btn>
              </div>
              {aiReport
                ? <div style={{background:"#111827",borderRadius:10,padding:16,fontSize:14,color:"#cbd5e1",lineHeight:1.8,whiteSpace:"pre-wrap",border:"1px solid #1e293b"}}>{aiReport}</div>
                : <div style={{textAlign:"center",padding:"30px 0",color:"#334155",fontSize:13}}>Click "Generate Report" to get AI insights</div>
              }
            </div>
          </>
        )}
      </div>

      {selectedLead && <LeadModal lead={selectedLead} onClose={()=>setSelectedLead(null)} onUpdate={updateLead} onDelete={deleteLead} />}
      {showAdd && <AddLeadModal onClose={()=>setShowAdd(false)} onAdd={addLead} />}
    </div>
  );
}
