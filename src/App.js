import React, { useState, useEffect } from "react";

const STAGES = ["New Lead","Contacted","Showing","Listing","Active Listing","Offer Made","Under Contract","Inspection","Appraisal","Financing Contingency","Clear to Close","Closed","Lost"];
const STAGE_COLORS = {
  "New Lead":"#3b82f6","Contacted":"#8b5cf6","Showing":"#f59e0b","Listing":"#ec4899","Active Listing":"#14b8a6",
  "Offer Made":"#ef4444","Under Contract":"#10b981","Inspection":"#f97316","Appraisal":"#eab308",
  "Financing Contingency":"#06b6d4","Clear to Close":"#8b5cf6","Closed":"#059669","Lost":"#475569",
};
const LEAD_TYPES = ["Buyer","Seller","Buyer & Seller"];
const TYPE_COLORS = { "Buyer":"#06b6d4","Seller":"#f97316","Buyer & Seller":"#a855f7" };
const TYPE_ICONS = { "Buyer":"🏠","Seller":"🏷️","Buyer & Seller":"🔄" };
const LEAD_SOURCES = ["Zillow","Realtor.com","Referral","Instagram","Facebook","Open House","Website","Lofty","Dotloop","Cold Call","Sign Call","Past Client","Sphere","Other"];
const SOURCE_COLORS = { "Zillow":"#006AFF","Realtor.com":"#D92228","Referral":"#10b981","Instagram":"#E1306C","Facebook":"#1877F2","Open House":"#f59e0b","Website":"#8b5cf6","Lofty":"#0ea5e9","Dotloop":"#f97316","Cold Call":"#64748b","Sign Call":"#ec4899","Past Client":"#059669","Sphere":"#14b8a6","Other":"#475569" };
const CAP_AMOUNT = 12000;
const SPLIT_RATE = 0.15;
const CAP_YEAR_START = 6;
const SUPABASE_URL = "https://tjpjyltxxdoyfhtrxesu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcGp5bHR4eGRveWZodHJ4ZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NTYyOTUsImV4cCI6MjA1ODEzMjI5NX0.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const SB_HEADERS = { "Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Prefer":"return=representation" };

var parseBudget = function(n) { if (!n && n!==0) return 0; return parseFloat(String(n).replace(/[$,\s]/g,"")) || 0; };
var fmt = function(n) { var v=parseBudget(n); return v ? "$"+v.toLocaleString() : "—"; };
var fmtShort = function(n) { var v=parseBudget(n); if(!v) return "—"; if(v>=1000000) return "$"+(v/1000000).toFixed(1)+"M"; if(v>=1000) return "$"+(v/1000).toFixed(0)+"K"; return "$"+v; };
var calcComm = function(budget,pct) { var b=parseBudget(budget),p=parseFloat(pct)||0; return b&&p ? b*p/100 : 0; };
var daysSince = function(d) { return Math.floor((new Date()-new Date(d))/86400000); };
var todayStr = function() { return new Date().toISOString().split("T")[0]; };
var getCapYear = function() { var n=new Date(),m=n.getMonth(),y=n.getFullYear(); return m>=CAP_YEAR_START?y:y-1; };
var getCapLabel = function() { var y=getCapYear(); return "Jul "+y+" \u2014 Jun "+(y+1); };

function sbFetch(path, opts) {
  return fetch(SUPABASE_URL+"/rest/v1/"+path, Object.assign({ headers: SB_HEADERS }, opts||{}));
}
function dbToLead(r) {
  return {
    id: r.db_id||r.id||Date.now(), db_id: r.db_id,
    name: r.name||"", type: r.type||"Buyer", phone: r.phone||"", email: r.email||"",
    stage: r.stage||"New Lead", propertyInterest: r.property_interest||"",
    source: r.source||"", budget: r.budget||0, commission: r.commission||3,
    notes: r.notes||"", lastContact: r.last_contact||todayStr(),
    aiSummary: r.ai_summary||"", linkedDeal: r.linked_deal||"",
    tasks: r.tasks ? (typeof r.tasks==="string"?JSON.parse(r.tasks):r.tasks) : [],
    attachments: r.attachments ? (typeof r.attachments==="string"?JSON.parse(r.attachments):r.attachments) : [],
  };
}
function leadToDb(lead) {
  return {
    name: lead.name||"", type: lead.type||"Buyer", phone: lead.phone||"", email: lead.email||"",
    stage: lead.stage||"New Lead", property_interest: lead.propertyInterest||"",
    source: lead.source||"", budget: parseBudget(lead.budget)||0, commission: parseFloat(lead.commission)||3,
    notes: lead.notes||"", last_contact: lead.lastContact||todayStr(),
    ai_summary: lead.aiSummary||"", linked_deal: lead.linkedDeal||"",
    tasks: JSON.stringify(lead.tasks||[]), attachments: JSON.stringify(lead.attachments||[]),
  };
}
function upsertLead(lead, onSuccess, onError) {
  var payload = leadToDb(lead);
  if (lead.db_id) payload.db_id = lead.db_id;
  sbFetch("leads", { method:"POST", headers: Object.assign({},SB_HEADERS,{"Prefer":"return=representation,resolution=merge-duplicates"}), body: JSON.stringify(payload) })
    .then(function(r){return r.json();})
    .then(function(d){ var s=Array.isArray(d)?d[0]:d; onSuccess&&onSuccess(s); })
    .catch(onError||function(){});
}
function deleteLeadDb(dbId, onSuccess) {
  if(!dbId) return;
  sbFetch("leads?db_id=eq."+dbId,{method:"DELETE"}).then(function(){onSuccess&&onSuccess();}).catch(function(){});
}
function callAI(prompt) {
  return fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]}),
  }).then(function(r){return r.json();}).then(function(d){return (d.content||[]).map(function(b){return b.text||"";}).join("")||"No response.";});
}
function exportLeads(leads) {
  var blob=new Blob([JSON.stringify(leads,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="pipeline-leads-"+todayStr()+".json"; a.click(); URL.revokeObjectURL(url);
}
function importLeads(file, onSuccess) {
  var reader=new FileReader();
  reader.onload=function(e){ try{ var d=JSON.parse(e.target.result); if(Array.isArray(d)) onSuccess(d); else alert("Invalid file format."); }catch(err){ alert("Could not read file."); } };
  reader.readAsText(file);
}

function iSty(extra) { return Object.assign({width:"100%",background:"#111827",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"8px 11px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"},extra||{}); }

function StageBadge(p) {
  var c=STAGE_COLORS[p.stage]||"#64748b";
  return React.createElement("span",{style:{fontSize:11,padding:"3px 9px",borderRadius:20,background:c+"22",color:c,fontWeight:700}},p.stage);
}
function TypeBadge(p) {
  if(!p.type) return null;
  var c=TYPE_COLORS[p.type]||"#64748b";
  return React.createElement("span",{style:{fontSize:11,padding:"3px 8px",borderRadius:20,background:c+"22",color:c,fontWeight:700,border:"1px solid "+c+"44"}},TYPE_ICONS[p.type]+" "+p.type);
}
function SourceBadge(p) {
  if(!p.source) return null;
  var c=SOURCE_COLORS[p.source]||"#64748b";
  return React.createElement("span",{style:{fontSize:10,padding:"2px 8px",borderRadius:20,background:c+"22",color:c,fontWeight:600}},p.source);
}

function TasksPanel(p) {
  var tasks=p.tasks, onChange=p.onChange;
  var ntS=React.useState(""), ndS=React.useState("");
  var newText=ntS[0],setNewText=ntS[1],newDue=ndS[0],setNewDue=ndS[1];
  function add() { if(!newText.trim()) return; onChange(tasks.concat([{id:"t"+Date.now(),text:newText.trim(),done:false,due:newDue}])); setNewText(""); setNewDue(""); }
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",gap:8,marginBottom:10}},
      React.createElement("input",{value:newText,onChange:function(e){setNewText(e.target.value);},placeholder:"New task...",style:iSty({flex:1})}),
      React.createElement("input",{value:newDue,onChange:function(e){setNewDue(e.target.value);},type:"date",style:iSty({width:130})}),
      React.createElement("button",{onClick:add,style:{background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"+ Add")
    ),
    tasks.length===0?React.createElement("div",{style:{fontSize:12,color:"#334155",textAlign:"center",padding:"12px 0"}},"No tasks yet"):null,
    tasks.map(function(t) {
      var od=t.due&&!t.done&&new Date(t.due)<new Date();
      return React.createElement("div",{key:t.id,style:{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #1e293b"}},
        React.createElement("input",{type:"checkbox",checked:t.done,onChange:function(){onChange(tasks.map(function(x){return x.id===t.id?Object.assign({},x,{done:!x.done}):x;}));},style:{accentColor:"#10b981",width:15,height:15,cursor:"pointer"}}),
        React.createElement("div",{style:{flex:1,fontSize:13,color:t.done?"#475569":"#f1f5f9",textDecoration:t.done?"line-through":"none"}},t.text),
        t.due?React.createElement("span",{style:{fontSize:11,color:od?"#ef4444":"#64748b"}},t.due):null,
        React.createElement("button",{onClick:function(){onChange(tasks.filter(function(x){return x.id!==t.id;}));},style:{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:15}},"x")
      );
    })
  );
}

function EmailModal(p) {
  var lead=p.lead, onClose=p.onClose;
  var subS=React.useState(""),bodyS=React.useState(""),loadS=React.useState(true);
  var subject=subS[0],setSubject=subS[1],body=bodyS[0],setBody=bodyS[1],loading=loadS[0],setLoading=loadS[1];
  React.useEffect(function(){
    callAI("Write a warm professional follow-up email.\nName: "+lead.name+"\nType: "+(lead.type||"Buyer")+"\nStage: "+lead.stage+"\nInterest: "+lead.propertyInterest+"\nBudget: "+fmt(lead.budget)+"\nSource: "+(lead.source||"")+"\nNotes: "+lead.notes+"\n\nFormat:\nSubject: [subject line]\n---\n[3-4 paragraph warm professional email]")
      .then(function(text){
        var lines=text.split("\n");
        var sl=lines.find(function(l){return l.toLowerCase().startsWith("subject:");});
        sl=sl?sl.replace(/^subject:\s*/i,""):"Following up";
        var idx=lines.findIndex(function(l){return l.trim()==="---";});
        setSubject(sl); setBody(idx>-1?lines.slice(idx+1).join("\n").trim():text); setLoading(false);
      }).catch(function(){setBody("Error generating email.");setLoading(false);});
  },[]);
  return React.createElement("div",{style:{position:"fixed",inset:0,background:"#000000aa",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},onClick:function(e){if(e.target===e.currentTarget)onClose();}},
    React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto",padding:28,fontFamily:"inherit"}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:20}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:800,fontSize:18,color:"#f1f5f9"}},"Email Draft"),
          React.createElement("div",{style:{fontSize:12,color:"#64748b",marginTop:2}},"To: "+lead.name+(lead.email?" - "+lead.email:""))
        ),
        React.createElement("button",{onClick:onClose,style:{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}},"x")
      ),
      loading?React.createElement("div",{style:{textAlign:"center",padding:"40px 0",color:"#64748b"}},"Drafting your email..."):
      React.createElement("div",null,
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Subject"),
          React.createElement("input",{value:subject,onChange:function(e){setSubject(e.target.value);},style:iSty()})
        ),
        React.createElement("div",{style:{marginBottom:20}},
          React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Body"),
          React.createElement("textarea",{value:body,onChange:function(e){setBody(e.target.value);},rows:10,style:iSty({resize:"vertical"})})
        ),
        React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
          React.createElement("button",{onClick:function(){navigator.clipboard&&navigator.clipboard.writeText("Subject: "+subject+"\n\n"+body);},style:{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}},"Copy"),
          React.createElement("a",{href:"mailto:"+lead.email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body),style:{background:"#3b82f6",color:"#fff",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,textDecoration:"none"}},"Open in Mail")
        )
      )
    )
  );
}

function LeadModal(p) {
  var lead=p.lead,onClose=p.onClose,onUpdate=p.onUpdate,onDelete=p.onDelete,leads=p.leads,setSelected=p.setSelected;
  var edS=React.useState(Object.assign({},lead,{tasks:lead.tasks||[],attachments:lead.attachments||[],type:lead.type||"Buyer",linkedDeal:lead.linkedDeal||""}));
  var ed=edS[0],setEd=edS[1];
  var aiS=React.useState(""),aiLS=React.useState(false),tabS=React.useState("details"),emS=React.useState(false);
  var aiOut=aiS[0],setAiOut=aiS[1],aiLoad=aiLS[0],setAiLoad=aiLS[1],tab=tabS[0],setTab=tabS[1],showEm=emS[0],setShowEm=emS[1];
  function set(k,v){setEd(function(prev){var o=Object.assign({},prev);o[k]=v;return o;});}
  function runAI(type){
    setAiLoad(true);
    var pr={
      summary:"Summarize this lead in 2-3 sentences with key opportunities and next steps:\nName: "+ed.name+"\nType: "+ed.type+"\nStage: "+ed.stage+"\nInterest: "+ed.propertyInterest+"\nBudget: "+fmt(ed.budget)+"\nSource: "+ed.source+"\nNotes: "+ed.notes,
      strategy:"Give a 3-step action plan to move this "+ed.type+" lead from "+ed.stage+" to next stage:\nName: "+ed.name+"\nInterest: "+ed.propertyInterest+"\nBudget: "+fmt(ed.budget)+"\nNotes: "+ed.notes,
      tasks:"Suggest 3-5 follow-up tasks. Numbered list only:\nName: "+ed.name+"\nType: "+ed.type+"\nStage: "+ed.stage+"\nNotes: "+ed.notes,
    };
    callAI(pr[type]).then(function(res){
      setAiOut(res);
      if(type==="tasks"){
        var lines=res.split("\n").filter(function(l){return /^\d+\./.test(l.trim());});
        if(lines.length) set("tasks",(ed.tasks||[]).concat(lines.map(function(l){return{id:"t"+Date.now()+Math.random(),text:l.replace(/^\d+\.\s*/,"").trim(),done:false,due:""};})));
        setTab("tasks");
      }
      setAiLoad(false);
    }).catch(function(){setAiOut("Error. Try again.");setAiLoad(false);});
  }
  var openTasks=(ed.tasks||[]).filter(function(t){return !t.done;}).length;
  var comm=calcComm(ed.budget,ed.commission);
  var linkedLead=ed.linkedDeal?leads.find(function(l){return String(l.id)===String(ed.linkedDeal)||String(l.db_id)===String(ed.linkedDeal);}):null;

  return React.createElement(React.Fragment,null,
    React.createElement("div",{style:{position:"fixed",inset:0,background:"#000000aa",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},onClick:function(e){if(e.target===e.currentTarget)onClose();}},
      React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:720,maxHeight:"92vh",overflowY:"auto",padding:28,fontFamily:"inherit"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:800,fontSize:20,color:"#f1f5f9"}},lead.name),
            React.createElement("div",{style:{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}},
              React.createElement(StageBadge,{stage:ed.stage}),
              React.createElement(TypeBadge,{type:ed.type}),
              React.createElement(SourceBadge,{source:ed.source}),
              openTasks>0?React.createElement("span",{style:{fontSize:11,color:"#f59e0b",background:"#f59e0b18",padding:"3px 8px",borderRadius:20}},"Tasks: "+openTasks):null,
              comm>0?React.createElement("span",{style:{fontSize:11,color:"#10b981",background:"#10b98118",padding:"3px 8px",borderRadius:20,fontWeight:700}},"Comm: "+fmt(comm)):null,
              linkedLead?React.createElement("span",{style:{fontSize:11,color:"#f59e0b",background:"#f59e0b18",padding:"3px 8px",borderRadius:20}},"Linked"):null
            )
          ),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:function(){setShowEm(true);},style:{background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Email"),
            React.createElement("button",{onClick:onClose,style:{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}},"x")
          )
        ),
        React.createElement("div",{style:{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid #1e293b"}},
          ["details","tasks","files"].map(function(t){
            return React.createElement("button",{key:t,onClick:function(){setTab(t);},style:{background:"none",border:"none",borderBottom:"2px solid "+(tab===t?"#3b82f6":"transparent"),color:tab===t?"#3b82f6":"#64748b",padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:-1,textTransform:"capitalize"}},
              t==="tasks"?"Tasks"+(openTasks?" ("+openTasks+")":""):t==="files"?"Files"+((ed.attachments||[]).length?" ("+(ed.attachments||[]).length+")":""):"Details"
            );
          })
        ),
        tab==="details"?React.createElement("div",null,
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}},
            [["Name","name"],["Phone","phone"],["Email","email"],["Budget ($)","budget"],["Commission (%)","commission"],["Last Contact","lastContact"]].map(function(pair){
              return React.createElement("div",{key:pair[1]},
                React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},pair[0]),
                React.createElement("input",{value:ed[pair[1]]||"",onChange:function(e){set(pair[1],e.target.value);},type:pair[1]==="lastContact"?"date":"text",style:iSty()})
              );
            })
          ),
          React.createElement("div",{style:{marginBottom:12}},
            React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Property Interest"),
            React.createElement("input",{value:ed.propertyInterest||"",onChange:function(e){set("propertyInterest",e.target.value);},style:iSty()})
          ),
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Stage"),
              React.createElement("select",{value:ed.stage,onChange:function(e){set("stage",e.target.value);},style:iSty()},STAGES.map(function(s){return React.createElement("option",{key:s},s);}))
            ),
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Lead Type"),
              React.createElement("select",{value:ed.type||"Buyer",onChange:function(e){set("type",e.target.value);},style:iSty()},LEAD_TYPES.map(function(t){return React.createElement("option",{key:t},t);}))
            ),
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Lead Source"),
              React.createElement("select",{value:ed.source||"",onChange:function(e){set("source",e.target.value);},style:iSty()},
                [React.createElement("option",{key:"b",value:""},"Select source...")].concat(LEAD_SOURCES.map(function(s){return React.createElement("option",{key:s,value:s},s);}))
              )
            )
          ),
          React.createElement("div",{style:{marginBottom:12}},
            React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Notes"),
            React.createElement("textarea",{value:ed.notes||"",onChange:function(e){set("notes",e.target.value);},rows:3,style:iSty({resize:"vertical"})})
          ),
          React.createElement("div",{style:{marginBottom:16,background:"#111827",borderRadius:10,padding:14,border:"1px solid #1e293b"}},
            React.createElement("div",{style:{fontSize:12,color:"#f59e0b",fontWeight:700,marginBottom:6}},"Linked Deal"),
            React.createElement("div",{style:{fontSize:11,color:"#64748b",marginBottom:8}},"Connect buy + sell sides for the same client"),
            React.createElement("select",{value:ed.linkedDeal||"",onChange:function(e){set("linkedDeal",e.target.value);},style:iSty()},
              [React.createElement("option",{key:"none",value:""},"No linked deal")].concat(
                leads.filter(function(l){return l.id!==ed.id;}).map(function(l){return React.createElement("option",{key:l.id,value:l.id},l.name+" ("+l.type+" - "+l.stage+")");})
              )
            ),
            linkedLead?React.createElement("div",{onClick:function(){onUpdate(ed);onClose();setTimeout(function(){setSelected(linkedLead);},100);},style:{marginTop:10,background:"#1e293b",borderRadius:8,padding:"8px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}},
              React.createElement("div",null,
                React.createElement("div",{style:{fontSize:12,color:"#f1f5f9",fontWeight:600}},linkedLead.name),
                React.createElement("div",{style:{fontSize:11,color:"#64748b"}},linkedLead.type+" - "+linkedLead.stage+" - "+fmt(linkedLead.budget))
              ),
              React.createElement("span",{style:{fontSize:12,color:"#f59e0b",fontWeight:700}},"Open")
            ):null
          ),
          React.createElement("div",{style:{background:"#111827",borderRadius:12,padding:16,border:"1px solid #1e293b",marginBottom:16}},
            React.createElement("div",{style:{fontSize:12,color:"#8b5cf6",fontWeight:700,marginBottom:12}},"AI ASSISTANT"),
            React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}},
              [["summary","Summarize"],["strategy","Action Plan"],["tasks","Generate Tasks"]].map(function(pair){
                return React.createElement("button",{key:pair[0],onClick:function(){runAI(pair[0]);},disabled:aiLoad,style:{background:aiLoad?"#1e293b":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:aiLoad?"not-allowed":"pointer",fontFamily:"inherit"}},aiLoad?"...":pair[1]);
              })
            ),
            aiOut?React.createElement("div",{style:{background:"#0d1117",borderRadius:8,padding:12,fontSize:13,color:"#cbd5e1",lineHeight:1.75,whiteSpace:"pre-wrap",border:"1px solid #1e293b",maxHeight:180,overflowY:"auto"}},aiOut):null
          )
        ):null,
        tab==="tasks"?React.createElement(TasksPanel,{tasks:ed.tasks||[],onChange:function(v){set("tasks",v);}}):null,
        tab==="files"?React.createElement("div",{style:{textAlign:"center",padding:"30px 0",color:"#64748b",fontSize:13}},"File uploads available when hosted on a server."):null,
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:"1px solid #1e293b"}},
          React.createElement("button",{onClick:function(){onDelete(lead.id);onClose();},style:{background:"transparent",color:"#ef4444",border:"1.5px solid #ef4444",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Delete"),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:onClose,style:{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}},"Cancel"),
            React.createElement("button",{onClick:function(){onUpdate(ed);onClose();},style:{background:"#10b981",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save Changes")
          )
        )
      )
    ),
    showEm?React.createElement(EmailModal,{lead:ed,onClose:function(){setShowEm(false);}}):null
  );
}

function LeadCard(p) {
  var lead=p.lead,onSelect=p.onSelect;
  var days=daysSince(lead.lastContact);
  var urgent=days>=3&&!["Closed","Lost"].includes(lead.stage);
  var openTasks=(lead.tasks||[]).filter(function(t){return !t.done;}).length;
  var comm=calcComm(lead.budget,lead.commission);
  return React.createElement("div",{
    onClick:function(){onSelect(lead);},
    style:{background:"#0f172a",border:"1px solid "+(urgent?"#ef444430":"#1e293b"),borderRadius:12,padding:"13px 15px",cursor:"pointer",marginBottom:9,position:"relative",overflow:"hidden"},
    onMouseEnter:function(e){e.currentTarget.style.borderColor=(STAGE_COLORS[lead.stage]||"#64748b")+"70";},
    onMouseLeave:function(e){e.currentTarget.style.borderColor=urgent?"#ef444430":"#1e293b";}
  },
    React.createElement("div",{style:{position:"absolute",top:0,left:0,width:3,height:"100%",background:STAGE_COLORS[lead.stage]||"#64748b"}}),
    React.createElement("div",{style:{paddingLeft:8}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between"}},
        React.createElement("div",{style:{fontWeight:700,color:"#f1f5f9",fontSize:14}},lead.name),
        React.createElement("div",{style:{fontSize:11,color:urgent?"#ef4444":"#64748b",fontWeight:600}},days===0?"Today":days+"d ago")
      ),
      lead.propertyInterest?React.createElement("div",{style:{fontSize:12,color:"#94a3b8",marginTop:2}},lead.propertyInterest):null,
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,flexWrap:"wrap",gap:4}},
        React.createElement("div",{style:{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}},
          React.createElement(StageBadge,{stage:lead.stage}),
          React.createElement(TypeBadge,{type:lead.type}),
          React.createElement(SourceBadge,{source:lead.source}),
          openTasks>0?React.createElement("span",{style:{fontSize:10,color:"#f59e0b",background:"#f59e0b18",padding:"2px 7px",borderRadius:20}},"Tasks: "+openTasks):null,
          lead.linkedDeal?React.createElement("span",{style:{fontSize:10,color:"#f59e0b",background:"#f59e0b18",padding:"2px 7px",borderRadius:20}},"Linked"):null
        ),
        React.createElement("div",{style:{textAlign:"right"}},
          React.createElement("div",{style:{fontSize:12,color:"#10b981",fontWeight:700}},fmt(lead.budget)),
          comm>0?React.createElement("div",{style:{fontSize:10,color:"#f59e0b",fontWeight:600}},fmtShort(comm)+" comm"):null
        )
      )
    )
  );
}

function CapTracker(p) {
  var leads=p.leads;
  var closed=leads.filter(function(l){return l.stage==="Closed";});
  var totalGross=closed.reduce(function(s,l){return s+calcComm(l.budget,l.commission);},0);
  var totalSplit=Math.min(totalGross*SPLIT_RATE,CAP_AMOUNT);
  var capPct=Math.min((totalSplit/CAP_AMOUNT)*100,100);
  var remaining=Math.max(0,CAP_AMOUNT-totalSplit);
  var isCapped=totalSplit>=CAP_AMOUNT;
  var agentNet=totalGross-totalSplit;
  var srcMap={};
  leads.forEach(function(l){
    var s=l.source||"Other";
    if(!srcMap[s]) srcMap[s]={count:0,closed:0,value:0};
    srcMap[s].count++;
    if(l.stage==="Closed") srcMap[s].closed++;
    srcMap[s].value+=parseBudget(l.budget);
  });
  var sources=Object.keys(srcMap).sort(function(a,b){return srcMap[b].count-srcMap[a].count;});
  var maxCount=sources.length?Math.max.apply(null,sources.map(function(s){return srcMap[s].count;})):1;

  return React.createElement("div",null,
    React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:20,marginBottom:16}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:800,fontSize:18,color:"#f1f5f9"}},"Real Broker Cap Tracker"),
          React.createElement("div",{style:{fontSize:12,color:"#64748b",marginTop:2}},getCapLabel()+" - 15% split - $12,000 cap")
        ),
        isCapped?React.createElement("div",{style:{background:"#059669",color:"#fff",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700}},"CAPPED!"):null
      ),
      React.createElement("div",{style:{marginBottom:16}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:6}},
          React.createElement("span",{style:{fontSize:12,color:"#64748b",fontWeight:600}},"Brokerage split paid"),
          React.createElement("span",{style:{fontSize:12,color:"#f1f5f9",fontWeight:700}},fmt(totalSplit)+" / "+fmt(CAP_AMOUNT))
        ),
        React.createElement("div",{style:{background:"#1e293b",borderRadius:8,height:16,overflow:"hidden"}},
          React.createElement("div",{style:{height:"100%",width:capPct+"%",background:isCapped?"#059669":"linear-gradient(90deg,#3b82f6,#8b5cf6)",borderRadius:8,transition:"width 0.8s ease"}})
        ),
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginTop:6}},
          React.createElement("span",{style:{fontSize:11,color:"#64748b"}},"0%"),
          React.createElement("span",{style:{fontSize:11,color:isCapped?"#059669":"#8b5cf6",fontWeight:700}},Math.round(capPct)+"%"),
          React.createElement("span",{style:{fontSize:11,color:"#64748b"}},"100%")
        )
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}},
        [{label:"Gross Commission",value:fmt(totalGross),color:"#f59e0b"},{label:"Brokerage Split",value:fmt(totalSplit),color:"#ef4444"},{label:"Your Net",value:fmt(agentNet),color:"#10b981"},{label:isCapped?"Status":"Left to Cap",value:isCapped?"CAPPED!":fmt(remaining),color:isCapped?"#059669":"#8b5cf6"}]
        .map(function(s){
          return React.createElement("div",{key:s.label,style:{background:"#111827",borderRadius:10,padding:12}},
            React.createElement("div",{style:{fontSize:18,fontWeight:800,color:s.color}},s.value),
            React.createElement("div",{style:{fontSize:10,color:"#64748b",fontWeight:600,marginTop:2}},s.label)
          );
        })
      )
    ),
    closed.length>0?React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:20,marginBottom:16}},
      React.createElement("div",{style:{fontWeight:700,fontSize:15,color:"#f1f5f9",marginBottom:12}},"Closed Transactions"),
      closed.map(function(l,i){
        var gross=calcComm(l.budget,l.commission);
        var split=gross*SPLIT_RATE;
        return React.createElement("div",{key:l.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<closed.length-1?"1px solid #1e293b":"none"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:600,fontSize:13,color:"#f1f5f9"}},l.name),
            React.createElement("div",{style:{fontSize:11,color:"#64748b"}},fmt(l.budget)+" at "+l.commission+"%")
          ),
          React.createElement("div",{style:{textAlign:"right"}},
            React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#10b981"}},fmt(gross)+" gross"),
            React.createElement("div",{style:{fontSize:11,color:"#64748b"}},"Net: "+fmt(gross-split))
          )
        );
      })
    ):null,
    React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:20}},
      React.createElement("div",{style:{fontWeight:700,fontSize:15,color:"#f1f5f9",marginBottom:16}},"Lead Sources"),
      sources.length===0?React.createElement("div",{style:{textAlign:"center",padding:"20px 0",color:"#334155",fontSize:13}},"No leads yet"):
      sources.map(function(src){
        var data=srcMap[src];
        var color=SOURCE_COLORS[src]||"#64748b";
        return React.createElement("div",{key:src,style:{marginBottom:14}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
              React.createElement(SourceBadge,{source:src}),
              data.closed>0?React.createElement("span",{style:{fontSize:11,color:"#059669"}},data.closed+" closed"):null
            ),
            React.createElement("span",{style:{fontSize:12,color:"#f1f5f9",fontWeight:700}},data.count+" lead"+(data.count!==1?"s":""))
          ),
          React.createElement("div",{style:{background:"#1e293b",borderRadius:6,height:6,overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",width:(data.count/maxCount*100)+"%",background:color,borderRadius:6}})
          )
        );
      })
    )
  );
}

export default function App() {
  var leadsS=React.useState([]),leads=leadsS[0],setLeads=leadsS[1];
  var selS=React.useState(null),selected=selS[0],setSelected=selS[1];
  var addS=React.useState(false),showAdd=addS[0],setShowAdd=addS[1];
  var viewS=React.useState("pipeline"),view=viewS[0],setView=viewS[1];
  var srchS=React.useState(""),search=srchS[0],setSearch=srchS[1];
  var stgS=React.useState("All"),stageFilter=stgS[0],setStageFilter=stgS[1];
  var typS=React.useState("All Types"),typeFilter=typS[0],setTypeFilter=typS[1];
  var srcS=React.useState("All Sources"),sourceFilter=srcS[0],setSourceFilter=srcS[1];
  var rptS=React.useState(""),aiReport=rptS[0],setAiReport=rptS[1];
  var rptLS=React.useState(false),loadRpt=rptLS[0],setLoadRpt=rptLS[1];
  var dbLS=React.useState(false),dbLoaded=dbLS[0],setDbLoaded=dbLS[1];
  var dbES=React.useState(false),dbError=dbES[0],setDbError=dbES[1];
  var nlS=React.useState({name:"",phone:"",email:"",stage:"New Lead",type:"Buyer",propertyInterest:"",budget:"",commission:3,source:"",notes:"",linkedDeal:"",lastContact:todayStr()});
  var newLead=nlS[0],setNewLead=nlS[1];

  React.useEffect(function(){
    sbFetch("leads?select=*&order=created_at.desc")
      .then(function(r){return r.json();})
      .then(function(data){
        if(Array.isArray(data)){setLeads(data.map(dbToLead));setDbLoaded(true);}
        else{setDbError(true);setDbLoaded(true);}
      }).catch(function(){setDbError(true);setDbLoaded(true);});
  },[]);

  function updateL(u){
    setLeads(function(p){return p.map(function(l){return l.id===u.id?u:l;});});
    upsertLead(u,function(saved){if(saved&&saved.db_id)setLeads(function(p){return p.map(function(l){return l.id===u.id?Object.assign({},u,{db_id:saved.db_id}):l;});});});
  }
  function deleteL(id){
    var lead=leads.find(function(l){return l.id===id;});
    setLeads(function(p){return p.filter(function(l){return l.id!==id;});});
    if(lead&&lead.db_id)deleteLeadDb(lead.db_id);
  }
  function addL(){
    if(!newLead.name.trim())return;
    var tid=Date.now();
    var obj=Object.assign({},newLead,{id:tid,budget:parseBudget(newLead.budget)||0,commission:parseFloat(newLead.commission)||3,tasks:[],attachments:[],aiSummary:""});
    setLeads(function(p){return [obj].concat(p);});
    setShowAdd(false);
    setNewLead({name:"",phone:"",email:"",stage:"New Lead",type:"Buyer",propertyInterest:"",budget:"",commission:3,source:"",notes:"",linkedDeal:"",lastContact:todayStr()});
    upsertLead(obj,function(saved){if(saved&&saved.db_id)setLeads(function(p){return p.map(function(l){return l.id===tid?Object.assign({},obj,{db_id:saved.db_id}):l;});});});
  }

  var filtered=leads.filter(function(l){
    return (l.name.toLowerCase().indexOf(search.toLowerCase())>-1||l.propertyInterest.toLowerCase().indexOf(search.toLowerCase())>-1)&&
      (stageFilter==="All"||l.stage===stageFilter)&&
      (typeFilter==="All Types"||l.type===typeFilter)&&
      (sourceFilter==="All Sources"||l.source===sourceFilter);
  });

  var pipeline=leads.filter(function(l){return !["Closed","Lost"].includes(l.stage);});
  var totalPipeline=pipeline.reduce(function(s,l){return s+parseBudget(l.budget);},0);
  var closedRevenue=leads.filter(function(l){return l.stage==="Closed";}).reduce(function(s,l){return s+parseBudget(l.budget);},0);
  var activeLeads=pipeline.length;
  var urgentLeads=pipeline.filter(function(l){return daysSince(l.lastContact)>=3;}).length;
  var allTasks=leads.reduce(function(acc,l){return acc.concat((l.tasks||[]).filter(function(t){return !t.done;}));},[]); 
  var overdueTasks=allTasks.filter(function(t){return t.due&&new Date(t.due)<new Date();}).length;
  var potComm=pipeline.reduce(function(s,l){return s+calcComm(l.budget,l.commission);},0);
  var earnComm=leads.filter(function(l){return l.stage==="Closed";}).reduce(function(s,l){return s+calcComm(l.budget,l.commission);},0);
  var splitPaid=Math.min(earnComm*SPLIT_RATE,CAP_AMOUNT);
  var capPct=Math.min((splitPaid/CAP_AMOUNT)*100,100);
  var isCapped=splitPaid>=CAP_AMOUNT;

  var sel2={background:"#0d1117",border:"1px solid #1e293b",borderRadius:10,color:"#f1f5f9",padding:"9px 14px",fontSize:13,fontFamily:"inherit"};

  return React.createElement("div",{style:{minHeight:"100vh",background:"#060b14",fontFamily:"'Segoe UI',sans-serif",color:"#f1f5f9"}},
    React.createElement("div",{style:{borderBottom:"1px solid #1e293b",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d1117",flexWrap:"wrap",gap:10}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:12}},
        React.createElement("div",{style:{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}},"🏡"),
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:800,fontSize:18,color:"#f8fafc"}},"Pipeline Pro"),
          React.createElement("div",{style:{fontSize:11,color:"#64748b"}},"Heather DeMuth Group - Real Broker")
        )
      ),
      React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
        [["pipeline","Pipeline"],["contacts","Contacts"],["reminders","Reminders"+(overdueTasks?" !":"")],["forecast","Forecast"],["cap","Cap Tracker"]].map(function(pair){
          return React.createElement("button",{key:pair[0],onClick:function(){setView(pair[0]);},style:{background:view===pair[0]?"#1e293b":"none",border:"none",color:view===pair[0]?"#f1f5f9":"#64748b",borderRadius:8,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}},pair[1]);
        })
      ),
      React.createElement("div",{style:{display:"flex",gap:6}},
        React.createElement("button",{onClick:function(){exportLeads(leads);},style:{background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Export"),
        React.createElement("label",{style:{background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},
          "Import",
          React.createElement("input",{type:"file",accept:".json",style:{display:"none"},onChange:function(e){if(e.target.files[0])importLeads(e.target.files[0],function(data){setLeads(data);});}})
        ),
        React.createElement("button",{onClick:function(){setShowAdd(true);},style:{background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"+ Add Lead")
      )
    ),
    dbError?React.createElement("div",{style:{background:"#7f1d1d",color:"#fca5a5",padding:"8px 20px",fontSize:12,fontWeight:600,textAlign:"center"}},"Database connection issue - check Supabase settings."):null,
    !dbLoaded?React.createElement("div",{style:{background:"#1e293b",color:"#94a3b8",padding:"8px 20px",fontSize:12,fontWeight:600,textAlign:"center"}},"Loading your leads..."):null,
    React.createElement("div",{style:{background:"#0d1117",borderBottom:"1px solid #1e293b",padding:"8px 20px",display:"flex",alignItems:"center",gap:12}},
      React.createElement("span",{style:{fontSize:11,color:"#64748b",fontWeight:600,whiteSpace:"nowrap"}},"CAP "+getCapLabel()),
      React.createElement("div",{style:{flex:1,background:"#1e293b",borderRadius:6,height:8,overflow:"hidden"}},
        React.createElement("div",{style:{height:"100%",width:capPct+"%",background:isCapped?"#059669":"linear-gradient(90deg,#3b82f6,#8b5cf6)",borderRadius:6,transition:"width 0.8s ease"}})
      ),
      React.createElement("span",{style:{fontSize:11,color:isCapped?"#059669":"#f1f5f9",fontWeight:700,whiteSpace:"nowrap"}},isCapped?"CAPPED!":fmt(splitPaid)+" / "+fmt(CAP_AMOUNT))
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,padding:"12px 20px",borderBottom:"1px solid #1e293b"}},
      [{label:"Active Leads",value:activeLeads,color:"#3b82f6",icon:"👥"},{label:"Pipeline Value",value:fmtShort(totalPipeline),color:"#8b5cf6",icon:"📊"},{label:"Closed Revenue",value:fmtShort(closedRevenue),color:"#10b981",icon:"🏆"},{label:overdueTasks?"Overdue":"Follow Up",value:overdueTasks||urgentLeads,color:(overdueTasks||urgentLeads)>0?"#ef4444":"#10b981",icon:"⚡"},{label:"Potential Comm",value:fmtShort(potComm),color:"#f59e0b",icon:"💰"},{label:"Earned Comm",value:fmtShort(earnComm),color:"#059669",icon:"🎯"}]
      .map(function(s){
        return React.createElement("div",{key:s.label,style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:12,padding:"12px 14px"}},
          React.createElement("div",{style:{fontSize:16,marginBottom:4}},s.icon),
          React.createElement("div",{style:{fontSize:18,fontWeight:800,color:s.color}},s.value),
          React.createElement("div",{style:{fontSize:10,color:"#64748b",fontWeight:600,marginTop:2}},s.label)
        );
      })
    ),
    React.createElement("div",{style:{padding:"16px 20px"}},
      view==="pipeline"?React.createElement("div",null,
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}},
          React.createElement("input",{value:search,onChange:function(e){setSearch(e.target.value);},placeholder:"Search leads...",style:iSty({flex:1,minWidth:150})}),
          React.createElement("select",{value:stageFilter,onChange:function(e){setStageFilter(e.target.value);},style:sel2},[React.createElement("option",{key:"all"},"All")].concat(STAGES.map(function(s){return React.createElement("option",{key:s},s);}))),
          React.createElement("select",{value:typeFilter,onChange:function(e){setTypeFilter(e.target.value);},style:sel2},[React.createElement("option",{key:"all"},"All Types")].concat(LEAD_TYPES.map(function(t){return React.createElement("option",{key:t},t);}))),
          React.createElement("select",{value:sourceFilter,onChange:function(e){setSourceFilter(e.target.value);},style:sel2},[React.createElement("option",{key:"all"},"All Sources")].concat(LEAD_SOURCES.map(function(s){return React.createElement("option",{key:s},s);})))
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}},
          STAGES.map(function(stage){
            var sl=filtered.filter(function(l){return l.stage===stage;});
            if(sl.length===0&&stageFilter!=="All")return null;
            var stageVal=sl.reduce(function(s,l){return s+parseBudget(l.budget);},0);
            return React.createElement("div",{key:stage},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
                React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                  React.createElement("div",{style:{width:8,height:8,borderRadius:"50%",background:STAGE_COLORS[stage]||"#64748b"}}),
                  React.createElement("span",{style:{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5}},stage)
                ),
                React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center"}},
                  stageVal>0?React.createElement("span",{style:{fontSize:10,color:"#64748b"}},fmtShort(stageVal)):null,
                  React.createElement("span",{style:{fontSize:11,background:"#1e293b",color:"#64748b",padding:"2px 8px",borderRadius:20,fontWeight:600}},sl.length)
                )
              ),
              sl.map(function(l){return React.createElement(LeadCard,{key:l.id,lead:l,onSelect:setSelected});}),
              sl.length===0?React.createElement("div",{style:{fontSize:12,color:"#334155",textAlign:"center",padding:"20px 0",border:"1px dashed #1e293b",borderRadius:10}},"Empty"):null
            );
          })
        )
      ):null,
      view==="contacts"?React.createElement("div",null,
        React.createElement("input",{value:search,onChange:function(e){setSearch(e.target.value);},placeholder:"Search...",style:iSty({marginBottom:16})}),
        React.createElement("div",{style:{background:"#0d1117",borderRadius:14,border:"1px solid #1e293b",overflow:"hidden"}},
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr 80px",padding:"10px 16px",borderBottom:"1px solid #1e293b",fontSize:11,color:"#64748b",fontWeight:700,textTransform:"uppercase"}},
            ["Contact","Interest","Budget","Stage","Last",""].map(function(h){return React.createElement("div",{key:h},h);})
          ),
          filtered.map(function(l){
            var comm=calcComm(l.budget,l.commission);
            return React.createElement("div",{key:l.id,style:{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr 80px",padding:"12px 16px",borderBottom:"1px solid #0f172a",alignItems:"center"},onMouseEnter:function(e){e.currentTarget.style.background="#111827";},onMouseLeave:function(e){e.currentTarget.style.background="";}},
              React.createElement("div",null,
                React.createElement("div",{style:{fontWeight:600,fontSize:14}},l.name),
                React.createElement("div",{style:{display:"flex",gap:5,marginTop:3}},React.createElement(TypeBadge,{type:l.type}),React.createElement(SourceBadge,{source:l.source}))
              ),
              React.createElement("div",{style:{fontSize:12,color:"#94a3b8"}},l.propertyInterest),
              React.createElement("div",null,React.createElement("div",{style:{fontWeight:700,color:"#10b981",fontSize:13}},fmt(l.budget)),comm>0?React.createElement("div",{style:{fontSize:10,color:"#f59e0b"}},fmt(comm)+" comm"):null),
              React.createElement(StageBadge,{stage:l.stage}),
              React.createElement("div",{style:{fontSize:12,color:daysSince(l.lastContact)>=3?"#ef4444":"#64748b"}},daysSince(l.lastContact)+"d ago"),
              React.createElement("button",{onClick:function(){setSelected(l);},style:{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}},"Open")
            );
          })
        )
      ):null,
      view==="reminders"?React.createElement("div",null,
        (function(){
          var at=leads.reduce(function(acc,l){return acc.concat((l.tasks||[]).filter(function(t){return !t.done;}).map(function(t){return Object.assign({},t,{leadName:l.name,lead:l});}));},[]); 
          var ov=at.filter(function(t){return t.due&&new Date(t.due)<new Date();});
          var td=at.filter(function(t){return t.due===todayStr();});
          var up=at.filter(function(t){return t.due&&t.due>todayStr();}).sort(function(a,b){return a.due>b.due?1:-1;});
          var cold=leads.filter(function(l){return daysSince(l.lastContact)>=3&&!["Closed","Lost"].includes(l.stage);});
          function Sec(title,items,color){
            if(!items.length)return null;
            return React.createElement("div",{style:{marginBottom:20}},
              React.createElement("div",{style:{fontSize:12,fontWeight:700,color:color,marginBottom:8,textTransform:"uppercase"}},title+" ("+items.length+")"),
              items.map(function(t){
                return React.createElement("div",{key:t.id,onClick:function(){setSelected(t.lead);},style:{background:"#0d1117",border:"1px solid "+color+"30",borderRadius:10,padding:"10px 13px",marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between"}},
                  React.createElement("div",null,React.createElement("div",{style:{fontSize:13,color:"#f1f5f9",fontWeight:600}},t.text),React.createElement("div",{style:{fontSize:11,color:"#64748b",marginTop:2}},t.leadName)),
                  t.due?React.createElement("div",{style:{fontSize:11,color:color,fontWeight:600}},t.due):null
                );
              })
            );
          }
          return React.createElement("div",null,
            Sec("Overdue",ov,"#ef4444"),Sec("Due Today",td,"#f59e0b"),Sec("Upcoming",up.slice(0,8),"#3b82f6"),
            cold.length>0?React.createElement("div",{style:{marginBottom:20}},
              React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#8b5cf6",marginBottom:8,textTransform:"uppercase"}},"Going Cold ("+cold.length+")"),
              cold.map(function(l){
                return React.createElement("div",{key:l.id,onClick:function(){setSelected(l);},style:{background:"#0d1117",border:"1px solid #8b5cf630",borderRadius:10,padding:"10px 13px",marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}},
                  React.createElement("div",null,React.createElement("div",{style:{fontSize:13,color:"#f1f5f9",fontWeight:600}},l.name),React.createElement("div",{style:{display:"flex",gap:6,marginTop:3}},React.createElement(TypeBadge,{type:l.type}),React.createElement(SourceBadge,{source:l.source}))),
                  React.createElement("div",{style:{fontSize:11,color:"#ef4444",fontWeight:700}},daysSince(l.lastContact)+"d ago")
                );
              })
            ):null,
            at.length===0&&cold.length===0?React.createElement("div",{style:{textAlign:"center",padding:"40px 0",color:"#334155",fontSize:13}},"All caught up!"):null
          );
        })()
      ):null,
      view==="forecast"?React.createElement("div",null,
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}},
          LEAD_TYPES.map(function(type){
            var tl=pipeline.filter(function(l){return l.type===type;});
            var c=TYPE_COLORS[type];
            return React.createElement("div",{key:type,style:{background:"#0d1117",border:"1px solid "+c+"44",borderRadius:14,padding:16}},
              React.createElement(TypeBadge,{type:type}),
              React.createElement("div",{style:{fontSize:20,fontWeight:800,color:c,marginTop:8}},tl.length+" active"),
              React.createElement("div",{style:{fontSize:12,color:"#64748b"}},fmtShort(tl.reduce(function(s,l){return s+parseBudget(l.budget);},0))+" pipeline")
            );
          })
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:16}},
          STAGES.filter(function(s){return s!=="Lost";}).map(function(stage){
            var sl=leads.filter(function(l){return l.stage===stage;});
            var val=sl.reduce(function(s,l){return s+parseBudget(l.budget);},0);
            var max=leads.reduce(function(s,l){return s+parseBudget(l.budget);},0);
            var comm=sl.reduce(function(s,l){return s+calcComm(l.budget,l.commission);},0);
            return React.createElement("div",{key:stage,style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:14}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:8}},
                React.createElement("div",null,React.createElement("div",{style:{fontWeight:700,fontSize:12}},stage),React.createElement("div",{style:{fontSize:11,color:"#64748b"}},sl.length+" leads")),
                React.createElement("div",{style:{textAlign:"right"}},React.createElement("div",{style:{fontSize:14,fontWeight:800,color:STAGE_COLORS[stage]||"#64748b"}},fmtShort(val)),comm>0?React.createElement("div",{style:{fontSize:10,color:"#f59e0b"}},fmtShort(comm)+" comm"):null)
              ),
              React.createElement("div",{style:{background:"#1e293b",borderRadius:5,height:5,overflow:"hidden"}},React.createElement("div",{style:{height:"100%",width:max?(val/max*100)+"%":"0%",background:STAGE_COLORS[stage]||"#64748b",borderRadius:5}}))
            );
          })
        ),
        React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:14,padding:20}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}},
            React.createElement("div",null,React.createElement("div",{style:{fontWeight:800,fontSize:16}},"AI Pipeline Report"),React.createElement("div",{style:{fontSize:12,color:"#64748b",marginTop:2}},"Executive analysis of your pipeline")),
            React.createElement("button",{
              onClick:function(){
                setLoadRpt(true);
                var sum=leads.map(function(l){return l.name+" | "+l.type+" | "+l.stage+" | "+fmt(l.budget)+" | "+(l.source||"")+" | "+daysSince(l.lastContact)+"d ago";}).join("\n");
                callAI("Analyze this real estate pipeline. 3-4 paragraph executive summary: health, buyer/seller mix, top opportunities, risks, 3 priority actions this week.\n\nLeads:\n"+sum+"\n\nPipeline: "+fmt(totalPipeline)+"\nClosed: "+fmt(closedRevenue)+"\nEarned commission: "+fmt(earnComm))
                  .then(function(r){setAiReport(r);setLoadRpt(false);}).catch(function(){setAiReport("Error.");setLoadRpt(false);});
              },
              disabled:loadRpt,
              style:{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:loadRpt?"not-allowed":"pointer",fontFamily:"inherit"}
            },loadRpt?"Generating...":"Generate Report")
          ),
          aiReport?React.createElement("div",{style:{background:"#111827",borderRadius:10,padding:16,fontSize:14,color:"#cbd5e1",lineHeight:1.8,whiteSpace:"pre-wrap",border:"1px solid #1e293b"}},aiReport):
          React.createElement("div",{style:{textAlign:"center",padding:"30px 0",color:"#334155",fontSize:13}},"Click Generate Report for AI insights")
        )
      ):null,
      view==="cap"?React.createElement(CapTracker,{leads:leads}):null
    ),
    showAdd?React.createElement("div",{style:{position:"fixed",inset:0,background:"#000000aa",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},onClick:function(e){if(e.target===e.currentTarget)setShowAdd(false);}},
      React.createElement("div",{style:{background:"#0d1117",border:"1px solid #1e293b",borderRadius:20,width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto",padding:28,fontFamily:"inherit"}},
        React.createElement("div",{style:{fontWeight:800,fontSize:20,color:"#f1f5f9",marginBottom:20}},"Add New Lead"),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}},
          [["Full Name *","name"],["Phone","phone"],["Email","email"],["Budget ($)","budget"],["Commission (%)","commission"],["Last Contact","lastContact"]].map(function(pair){
            return React.createElement("div",{key:pair[1]},
              React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},pair[0]),
              React.createElement("input",{value:newLead[pair[1]]||"",onChange:function(e){var v=e.target.value,k=pair[1];setNewLead(function(p){var o=Object.assign({},p);o[k]=v;return o;});},type:pair[1]==="lastContact"?"date":"text",style:iSty()})
            );
          })
        ),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Property Interest"),
          React.createElement("input",{value:newLead.propertyInterest,onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{propertyInterest:v});});},style:iSty()})
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Stage"),
            React.createElement("select",{value:newLead.stage,onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{stage:v});});},style:iSty()},STAGES.map(function(s){return React.createElement("option",{key:s},s);}))
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Lead Type"),
            React.createElement("select",{value:newLead.type,onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{type:v});});},style:iSty()},LEAD_TYPES.map(function(t){return React.createElement("option",{key:t},t);}))
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Lead Source"),
            React.createElement("select",{value:newLead.source||"",onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{source:v});});},style:iSty()},
              [React.createElement("option",{key:"b",value:""},"Select source...")].concat(LEAD_SOURCES.map(function(s){return React.createElement("option",{key:s,value:s},s);}))
            )
          )
        ),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase"}},"Notes"),
          React.createElement("textarea",{value:newLead.notes,onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{notes:v});});},rows:3,style:iSty({resize:"vertical"})})
        ),
        React.createElement("div",{style:{marginBottom:20,background:"#111827",borderRadius:10,padding:14,border:"1px solid #1e293b"}},
          React.createElement("div",{style:{fontSize:12,color:"#f59e0b",fontWeight:700,marginBottom:6}},"Linked Deal (Optional)"),
          React.createElement("div",{style:{fontSize:11,color:"#64748b",marginBottom:8}},"Connect buy + sell sides for the same client"),
          React.createElement("select",{value:newLead.linkedDeal||"",onChange:function(e){var v=e.target.value;setNewLead(function(p){return Object.assign({},p,{linkedDeal:v});});},style:iSty()},
            [React.createElement("option",{key:"none",value:""},"No linked deal")].concat(leads.map(function(l){return React.createElement("option",{key:l.id,value:l.id},l.name+" ("+l.type+" - "+l.stage+")");}))
          )
        ),
        React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
          React.createElement("button",{onClick:function(){setShowAdd(false);},style:{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}},"Cancel"),
          React.createElement("button",{onClick:addL,style:{background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Add Lead")
        )
      )
    ):null,
    selected?React.createElement(LeadModal,{lead:selected,onClose:function(){setSelected(null);},onUpdate:updateL,onDelete:deleteL,leads:leads,setSelected:setSelected}):null
  );
}
