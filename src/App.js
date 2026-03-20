import React, { useState, useEffect } from "react";

const STAGES = ["New Lead","Contacted","Showing","Listing","Active Listing","Offer Made","Under Contract","Inspection","Appraisal","Financing Contingency","Clear to Close","Closed","Lost"];
const STAGE_COLORS = {
  "New Lead":"#3b82f6","Contacted":"#8b5cf6","Showing":"#f59e0b","Listing":"#ec4899","Active Listing":"#14b8a6",
  "Offer Made":"#ef4444","Under Contract":"#10b981","Inspection":"#f97316","Appraisal":"#eab308","Financing Contingency":"#06b6d4","Clear to Close":"#8b5cf6","Closed":"#059669","Lost":"#475569",
};
const LEAD_TYPES = ["Buyer","Seller","Buyer & Seller"];
const TYPE_COLORS = { "Buyer":"#06b6d4","Seller":"#f97316","Buyer & Seller":"#a855f7" };
const TYPE_ICONS = { "Buyer":"🏠","Seller":"🏷️","Buyer & Seller":"🔄" };

const INITIAL_LEADS = [
  { id:1, name:"Sarah & Tom Mitchell", type:"Buyer", phone:"386-555-0123", email:"mitchells@email.com", stage:"Showing", propertyInterest:"3BR Single Family, $380K-$430K", source:"Zillow", budget:430000, notes:"Pre-approved. Prefer Port Orange area.", commission:3, lastContact:"2026-03-18", aiSummary:"", tasks:[], attachments:[] },
  { id:2, name:"David Nguyen", type:"Buyer", phone:"386-555-0456", email:"dnguyen@email.com", stage:"Offer Made", propertyInterest:"2BR Condo, $220K-$260K", source:"Referral", budget:260000, notes:"First-time buyer. Needs closing cost assistance.", commission:3, lastContact:"2026-03-19", aiSummary:"", tasks:[], attachments:[] },
  { id:3, name:"Carla Reyes", type:"Seller", phone:"386-555-0789", email:"creyes@email.com", stage:"New Lead", propertyInterest:"4BR Pool Home, $500K+", source:"Instagram", budget:600000, notes:"Relocating from Miami in Q3.", commission:3, lastContact:"2026-03-15", aiSummary:"", tasks:[], attachments:[] },
  { id:4, name:"James & Linda Park", type:"Buyer", phone:"386-555-0321", email:"parkfamily@email.com", stage:"Under Contract", propertyInterest:"3BR, $340K", source:"Open House", budget:350000, notes:"Close date: April 15. Inspection done.", commission:3, lastContact:"2026-03-20", aiSummary:"", tasks:[{id:"t1",text:"Send closing docs",done:false,due:"2026-03-25"}], attachments:[] },
  { id:5, name:"Marcus Thompson", type:"Buyer & Seller", phone:"386-555-0654", email:"mthompson@email.com", stage:"Contacted", propertyInterest:"Investment duplex, $300K-$350K", source:"Website", budget:350000, notes:"Cash buyer. Looking for rental income.", commission:3, lastContact:"2026-03-17", aiSummary:"", tasks:[], attachments:[] },
  { id:6, name:"Emily Foster", type:"Seller", phone:"386-555-0987", email:"efoster@email.com", stage:"Closed", propertyInterest:"2BR Townhouse, $280K", source:"Referral", budget:280000, notes:"Closed March 10. Very smooth transaction!", commission:3, lastContact:"2026-03-10", aiSummary:"", tasks:[], attachments:[] },
];

const parseBudget = (n) => { if (!n && n !== 0) return 0; var s = String(n).replace(/[$,\s]/g, ""); return parseFloat(s) || 0; };
const fmt = (n) => { var v = parseBudget(n); return v ? "$" + v.toLocaleString() : "—"; };
const calcCommission = (budget, commission) => { var b = parseBudget(budget); var c = parseFloat(commission) || 0; return b && c ? (b * c / 100) : 0; };
const daysSince = (d) => Math.floor((new Date() - new Date(d)) / 86400000);
const todayStr = () => new Date().toISOString().split("T")[0];
const STORAGE_KEY = "re_pipeline_v4";


function exportLeads(leads) {
  var data = JSON.stringify(leads, null, 2);
  var blob = new Blob([data], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "my-pipeline-leads-" + todayStr() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importLeads(file, onSuccess) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        onSuccess(data);
        alert("Successfully imported " + data.length + " leads!");
      } else {
        alert("Invalid file format. Please use a file exported from Pipeline Pro.");
      }
    } catch(err) {
      alert("Could not read file. Please try again.");
    }
  };
  reader.readAsText(file);
}

function callAI(prompt) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  }).then(r => r.json()).then(d => d.content?.map(b => b.text || "").join("") || "No response.");
}

function StageBadge(props) {
  var stage = props.stage;
  return React.createElement("span", {
    style: { fontSize: 11, padding: "3px 9px", borderRadius: 20, background: STAGE_COLORS[stage] + "22", color: STAGE_COLORS[stage], fontWeight: 700 }
  }, stage);
}

function TypeBadge(props) {
  var type = props.type;
  if (!type) return null;
  var color = TYPE_COLORS[type] || "#64748b";
  var icon = TYPE_ICONS[type] || "";
  return React.createElement("span", {
    style: { fontSize: 11, padding: "3px 9px", borderRadius: 20, background: color + "22", color: color, fontWeight: 700, border: "1px solid " + color + "44" }
  }, icon + " " + type);
}

function TasksPanel(props) {
  var tasks = props.tasks;
  var onChange = props.onChange;
  var newText = React.useState("")[0];
  var setNewText = React.useState("")[1];
  var newTextState = React.useState("");
  var newDueState = React.useState("");
  newText = newTextState[0]; setNewText = newTextState[1];
  var newDue = newDueState[0];
  var setNewDue = newDueState[1];

  function add() {
    if (!newText.trim()) return;
    onChange([...tasks, { id: "t" + Date.now(), text: newText.trim(), done: false, due: newDue }]);
    setNewText(""); setNewDue("");
  }

  return React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
      React.createElement("input", { value: newText, onChange: function(e) { setNewText(e.target.value); }, placeholder: "New task...", style: { flex: 1, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit" } }),
      React.createElement("input", { value: newDue, onChange: function(e) { setNewDue(e.target.value); }, type: "date", style: { width: 130, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit" } }),
      React.createElement("button", { onClick: add, style: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "+ Add")
    ),
    tasks.length === 0 ? React.createElement("div", { style: { fontSize: 12, color: "#334155", textAlign: "center", padding: "12px 0" } }, "No tasks yet") : null,
    tasks.map(function(t) {
      return React.createElement("div", { key: t.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #1e293b" } },
        React.createElement("input", { type: "checkbox", checked: t.done, onChange: function() { onChange(tasks.map(function(x) { return x.id === t.id ? Object.assign({}, x, {done: !x.done}) : x; })); }, style: { accentColor: "#10b981", width: 15, height: 15, cursor: "pointer" } }),
        React.createElement("div", { style: { flex: 1, fontSize: 13, color: t.done ? "#475569" : "#f1f5f9", textDecoration: t.done ? "line-through" : "none" } }, t.text),
        t.due ? React.createElement("span", { style: { fontSize: 11, color: "#64748b" } }, t.due) : null,
        React.createElement("button", { onClick: function() { onChange(tasks.filter(function(x) { return x.id !== t.id; })); }, style: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 15 } }, "x")
      );
    })
  );
}

function EmailModal(props) {
  var lead = props.lead;
  var onClose = props.onClose;
  var subjectState = React.useState("");
  var bodyState = React.useState("");
  var loadingState = React.useState(true);
  var subject = subjectState[0]; var setSubject = subjectState[1];
  var body = bodyState[0]; var setBody = bodyState[1];
  var loading = loadingState[0]; var setLoading = loadingState[1];

  React.useEffect(function() {
    callAI("Write a follow-up email for this real estate lead.\nName: " + lead.name + "\nType: " + (lead.type || "Buyer") + "\nStage: " + lead.stage + "\nInterest: " + lead.propertyInterest + "\nBudget: " + fmt(lead.budget) + "\nNotes: " + lead.notes + "\n\nFormat:\nSubject: [subject]\n---\n[email body, 3-4 paragraphs, warm and professional]")
      .then(function(text) {
        var lines = text.split("\n");
        var subLine = "";
        for (var i = 0; i < lines.length; i++) { if (lines[i].toLowerCase().startsWith("subject:")) { subLine = lines[i].replace(/^subject:\s*/i, ""); break; } }
        if (!subLine) subLine = "Following up";
        var idx = -1;
        for (var j = 0; j < lines.length; j++) { if (lines[j].trim() === "---") { idx = j; break; } }
        setSubject(subLine);
        setBody(idx > -1 ? lines.slice(idx + 1).join("\n").trim() : text);
        setLoading(false);
      }).catch(function() { setBody("Error generating email."); setLoading(false); });
  }, []);

  return React.createElement("div", {
    style: { position: "fixed", inset: 0, background: "#000000aa", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    onClick: function(e) { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement("div", { style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 20, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: 28, fontFamily: "inherit" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 20 } },
        React.createElement("div", { style: { fontWeight: 800, fontSize: 18, color: "#f1f5f9" } }, "Email Draft"),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" } }, "x")
      ),
      loading
        ? React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: "#64748b" } }, "Drafting your email...")
        : React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } },
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" } }, "Subject"),
            React.createElement("input", { value: subject, onChange: function(e) { setSubject(e.target.value); }, style: { width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" } })
          ),
          React.createElement("div", { style: { marginBottom: 20 } },
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" } }, "Body"),
            React.createElement("textarea", { value: body, onChange: function(e) { setBody(e.target.value); }, rows: 10, style: { width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" } })
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
            React.createElement("button", { onClick: function() { navigator.clipboard && navigator.clipboard.writeText("Subject: " + subject + "\n\n" + body); }, style: { background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "Copy"),
            React.createElement("a", { href: "mailto:" + lead.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body), style: { background: "#3b82f6", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" } }, "Open in Mail")
          )
        )
    )
  );
}

function LeadModal(props) {
  var lead = props.lead; var onClose = props.onClose; var onUpdate = props.onUpdate; var onDelete = props.onDelete;
  var edState = React.useState(Object.assign({}, lead, { tasks: lead.tasks || [], attachments: lead.attachments || [], type: lead.type || "Buyer" }));
  var ed = edState[0]; var setEd = edState[1];
  var aiOutState = React.useState(""); var aiOut = aiOutState[0]; var setAiOut = aiOutState[1];
  var aiLoadingState = React.useState(false); var aiLoading = aiLoadingState[0]; var setAiLoading = aiLoadingState[1];
  var tabState = React.useState("details"); var tab = tabState[0]; var setTab = tabState[1];
  var showEmailState = React.useState(false); var showEmail = showEmailState[0]; var setShowEmail = showEmailState[1];

  function set(k, v) { setEd(function(p) { var o = Object.assign({}, p); o[k] = v; return o; }); }

  function runAI(type) {
    setAiLoading(true);
    var prompt = "";
    if (type === "summary") prompt = "Summarize this real estate lead in 2-3 sentences:\nName: " + ed.name + "\nType: " + ed.type + "\nStage: " + ed.stage + "\nInterest: " + ed.propertyInterest + "\nBudget: " + fmt(ed.budget) + "\nNotes: " + ed.notes;
    if (type === "strategy") prompt = "Give a 3-step action plan to move this " + ed.type + " lead from " + ed.stage + " to next stage:\nName: " + ed.name + "\nInterest: " + ed.propertyInterest + "\nBudget: " + fmt(ed.budget) + "\nNotes: " + ed.notes;
    if (type === "tasks") prompt = "Suggest 3-5 follow-up tasks for this " + ed.type + " lead. Numbered list only:\nName: " + ed.name + "\nStage: " + ed.stage + "\nNotes: " + ed.notes;
    callAI(prompt).then(function(result) {
      setAiOut(result);
      if (type === "tasks") {
        var lines = result.split("\n").filter(function(l) { return /^\d+\./.test(l.trim()); });
        if (lines.length) set("tasks", (ed.tasks || []).concat(lines.map(function(l) { return { id: "t" + Date.now() + Math.random(), text: l.replace(/^\d+\.\s*/, "").trim(), done: false, due: "" }; })));
      }
      setAiLoading(false);
    }).catch(function() { setAiOut("Error. Try again."); setAiLoading(false); });
  }

  var openTasks = (ed.tasks || []).filter(function(t) { return !t.done; }).length;
  var iStyle = { width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

  return React.createElement(React.Fragment, null,
    React.createElement("div", {
      style: { position: "fixed", inset: 0, background: "#000000aa", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
      onClick: function(e) { if (e.target === e.currentTarget) onClose(); }
    },
      React.createElement("div", { style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 20, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", padding: 28, fontFamily: "inherit" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontWeight: 800, fontSize: 20, color: "#f1f5f9" } }, lead.name),
            React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" } },
              React.createElement(StageBadge, { stage: ed.stage }),
              React.createElement(TypeBadge, { type: ed.type }),
              openTasks > 0 ? React.createElement("span", { style: { fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "3px 8px", borderRadius: 20 } }, "Tasks: " + openTasks) : null,
              ed.commission && ed.budget ? React.createElement("span", { style: { fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "3px 8px", borderRadius: 20, fontWeight: 700 } }, "💰 " + fmt(calcCommission(ed.budget, ed.commission))) : null
            )
          ),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", { onClick: function() { setShowEmail(true); }, style: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "Email"),
            React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" } }, "x")
          )
        ),
        React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b" } },
          ["details","tasks","attachments"].map(function(t) {
            return React.createElement("button", { key: t, onClick: function() { setTab(t); }, style: { background: "none", border: "none", borderBottom: "2px solid " + (tab === t ? "#3b82f6" : "transparent"), color: tab === t ? "#3b82f6" : "#64748b", padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: -1, textTransform: "capitalize" } },
              t === "tasks" ? ("Tasks" + (openTasks ? " (" + openTasks + ")" : "")) : (t === "attachments" ? ("Files" + ((ed.attachments || []).length ? " (" + ed.attachments.length + ")" : "")) : "Details")
            );
          })
        ),
        tab === "details" ? React.createElement("div", null,
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } },
            [["Name","name"],["Phone","phone"],["Email","email"],["Source","source"],["Budget ($)","budget"],["Commission (%)","commission"],["Last Contact","lastContact"]].map(function(pair) {
              var label = pair[0]; var key = pair[1];
              return React.createElement("div", { key: key },
                React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, label),
                React.createElement("input", { value: ed[key] || "", onChange: function(e) { set(key, e.target.value); }, type: key === "lastContact" ? "date" : "text", style: iStyle })
              );
            })
          ),
          React.createElement("div", { style: { marginBottom: 12 } },
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Property Interest"),
            React.createElement("input", { value: ed.propertyInterest || "", onChange: function(e) { set("propertyInterest", e.target.value); }, style: iStyle })
          ),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Stage"),
              React.createElement("select", { value: ed.stage, onChange: function(e) { set("stage", e.target.value); }, style: iStyle },
                STAGES.map(function(s) { return React.createElement("option", { key: s }, s); })
              )
            ),
            React.createElement("div", null,
              React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Lead Type"),
              React.createElement("select", { value: ed.type || "Buyer", onChange: function(e) { set("type", e.target.value); }, style: iStyle },
                LEAD_TYPES.map(function(t) { return React.createElement("option", { key: t }, t); })
              )
            )
          ),
          React.createElement("div", { style: { marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Notes"),
            React.createElement("textarea", { value: ed.notes || "", onChange: function(e) { set("notes", e.target.value); }, rows: 3, style: Object.assign({}, iStyle, { resize: "vertical" }) })
          ),
          React.createElement("div", { style: { background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1e293b", marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 12, color: "#8b5cf6", fontWeight: 700, marginBottom: 12 } }, "AI ASSISTANT"),
            React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
              [["summary","Summarize"],["strategy","Action Plan"],["tasks","Generate Tasks"]].map(function(pair) {
                var type = pair[0]; var label = pair[1];
                return React.createElement("button", { key: type, onClick: function() { runAI(type); }, disabled: aiLoading, style: { background: aiLoading ? "#1e293b" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer", fontFamily: "inherit" } }, aiLoading ? "..." : label);
              })
            ),
            aiOut ? React.createElement("div", { style: { background: "#0d1117", borderRadius: 8, padding: 12, fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, whiteSpace: "pre-wrap", border: "1px solid #1e293b", maxHeight: 180, overflowY: "auto" } }, aiOut) : null
          )
        ) : null,
        tab === "tasks" ? React.createElement(TasksPanel, { tasks: ed.tasks || [], onChange: function(v) { set("tasks", v); } }) : null,
        tab === "attachments" ? React.createElement("div", { style: { textAlign: "center", padding: "30px 0", color: "#64748b", fontSize: 13 } }, "File uploads available when hosted on a server.") : null,
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b" } },
          React.createElement("button", { onClick: function() { onDelete(lead.id); onClose(); }, style: { background: "transparent", color: "#ef4444", border: "1.5px solid #ef4444", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "Delete"),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", { onClick: onClose, style: { background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "Cancel"),
            React.createElement("button", { onClick: function() { onUpdate(ed); onClose(); }, style: { background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "Save Changes")
          )
        )
      )
    ),
    showEmail ? React.createElement(EmailModal, { lead: ed, onClose: function() { setShowEmail(false); } }) : null
  );
}

function LeadCard(props) {
  var lead = props.lead; var onSelect = props.onSelect;
  var days = daysSince(lead.lastContact);
  var urgent = days >= 3 && lead.stage !== "Closed" && lead.stage !== "Lost";
  var openTasks = (lead.tasks || []).filter(function(t) { return !t.done; }).length;
  return React.createElement("div", {
    onClick: function() { onSelect(lead); },
    style: { background: "#0f172a", border: "1px solid " + (urgent ? "#ef444430" : "#1e293b"), borderRadius: 12, padding: "13px 15px", cursor: "pointer", marginBottom: 9, position: "relative", overflow: "hidden" },
    onMouseEnter: function(e) { e.currentTarget.style.borderColor = STAGE_COLORS[lead.stage] + "70"; },
    onMouseLeave: function(e) { e.currentTarget.style.borderColor = urgent ? "#ef444430" : "#1e293b"; }
  },
    React.createElement("div", { style: { position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: STAGE_COLORS[lead.stage] } }),
    React.createElement("div", { style: { paddingLeft: 8 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
        React.createElement("div", { style: { fontWeight: 700, color: "#f1f5f9", fontSize: 14 } }, lead.name),
        React.createElement("div", { style: { fontSize: 11, color: urgent ? "#ef4444" : "#64748b", fontWeight: 600 } }, days === 0 ? "Today" : days + "d ago")
      ),
      React.createElement("div", { style: { fontSize: 12, color: "#94a3b8", marginTop: 2 } }, lead.propertyInterest),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 4 } },
        React.createElement("div", { style: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" } },
          React.createElement(StageBadge, { stage: lead.stage }),
          React.createElement(TypeBadge, { type: lead.type }),
          openTasks > 0 ? React.createElement("span", { style: { fontSize: 10, color: "#f59e0b", background: "#f59e0b18", padding: "2px 7px", borderRadius: 20 } }, "Tasks: " + openTasks) : null
        ),
        React.createElement("div", { style: { textAlign: "right" } },
          React.createElement("div", { style: { fontSize: 12, color: "#10b981", fontWeight: 700 } }, fmt(lead.budget)),
          lead.commission ? React.createElement("div", { style: { fontSize: 11, color: "#f59e0b", fontWeight: 600 } }, fmt(calcCommission(lead.budget, lead.commission)) + " comm") : null
        )
      )
    )
  );
}

export default function App() {
  var leadsState = React.useState(function() {
    try { var s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : INITIAL_LEADS; } catch(e) { return INITIAL_LEADS; }
  });
  var leads = leadsState[0]; var setLeads = leadsState[1];
  var selectedState = React.useState(null); var selected = selectedState[0]; var setSelected = selectedState[1];
  var showAddState = React.useState(false); var showAdd = showAddState[0]; var setShowAdd = showAddState[1];
  var viewState = React.useState("pipeline"); var view = viewState[0]; var setView = viewState[1];
  var searchState = React.useState(""); var search = searchState[0]; var setSearch = searchState[1];
  var stageFilterState = React.useState("All"); var stageFilter = stageFilterState[0]; var setStageFilter = stageFilterState[1];
  var typeFilterState = React.useState("All Types"); var typeFilter = typeFilterState[0]; var setTypeFilter = typeFilterState[1];
  var aiReportState = React.useState(""); var aiReport = aiReportState[0]; var setAiReport = aiReportState[1];
  var loadingReportState = React.useState(false); var loadingReport = loadingReportState[0]; var setLoadingReport = loadingReportState[1];
  var newLeadState = React.useState({ name:"",phone:"",email:"",stage:"New Lead",type:"Buyer",propertyInterest:"",budget:"",commission:3,source:"",notes:"",lastContact:todayStr() });
  var newLead = newLeadState[0]; var setNewLead = newLeadState[1];

  React.useEffect(function() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch(e) {} }, [leads]);

  function updateLead(u) { setLeads(function(p) { return p.map(function(l) { return l.id === u.id ? u : l; }); }); }
  function deleteLead(id) { setLeads(function(p) { return p.filter(function(l) { return l.id !== id; }); }); }
  function addLead() {
    if (!newLead.name.trim()) return;
    setLeads(function(p) { return [Object.assign({}, newLead, { id: Date.now(), budget: Number(newLead.budget) || 0, tasks: [], attachments: [], aiSummary: "" })].concat(p); });
    setShowAdd(false);
    setNewLead({ name:"",phone:"",email:"",stage:"New Lead",type:"Buyer",propertyInterest:"",budget:"",commission:3,source:"",notes:"",lastContact:todayStr() });
  }

  var filtered = leads.filter(function(l) {
    return (l.name.toLowerCase().indexOf(search.toLowerCase()) > -1 || l.propertyInterest.toLowerCase().indexOf(search.toLowerCase()) > -1) &&
      (stageFilter === "All" || l.stage === stageFilter) &&
      (typeFilter === "All Types" || l.type === typeFilter);
  });

  var totalPipeline = leads.filter(function(l) { return l.stage !== "Closed" && l.stage !== "Lost"; }).reduce(function(s,l) { return s + parseBudget(l.budget); }, 0);
  var closedRevenue = leads.filter(function(l) { return l.stage === "Closed"; }).reduce(function(s,l) { return s + parseBudget(l.budget); }, 0);
  var activeLeads = leads.filter(function(l) { return l.stage !== "Closed" && l.stage !== "Lost"; }).length;
  var urgentLeads = leads.filter(function(l) { return daysSince(l.lastContact) >= 3 && l.stage !== "Closed" && l.stage !== "Lost"; }).length;
  var allOpenTasks = leads.reduce(function(acc, l) { return acc.concat((l.tasks || []).filter(function(t) { return !t.done; })); }, []);
  var overdueTasks = allOpenTasks.filter(function(t) { return t.due && new Date(t.due) < new Date(); }).length;
  var potentialIncome = leads.filter(function(l) { return l.stage !== "Closed" && l.stage !== "Lost"; }).reduce(function(s,l) { return s + calcCommission(l.budget, l.commission); }, 0);
  var earnedIncome = leads.filter(function(l) { return l.stage === "Closed"; }).reduce(function(s,l) { return s + calcCommission(l.budget, l.commission); }, 0);
  var iStyle = { width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", padding: "8px 11px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

  return React.createElement("div", { style: { minHeight: "100vh", background: "#060b14", fontFamily: "'Segoe UI',sans-serif", color: "#f1f5f9" } },
    React.createElement("div", { style: { borderBottom: "1px solid #1e293b", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", flexWrap: "wrap", gap: 10 } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
        React.createElement("div", { style: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, "🏡"),
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 800, fontSize: 18, color: "#f8fafc" } }, "Pipeline Pro"),
          React.createElement("div", { style: { fontSize: 11, color: "#64748b" } }, "Residential Real Estate CRM")
        )
      ),
      React.createElement("div", { style: { display: "flex", gap: 4 } },
        [["pipeline","Pipeline"],["contacts","Contacts"],["reminders","Reminders" + (overdueTasks ? " !" : "")],["forecast","Forecast"]].map(function(pair) {
          var k = pair[0]; var label = pair[1];
          return React.createElement("button", { key: k, onClick: function() { setView(k); }, style: { background: view === k ? "#1e293b" : "none", border: "none", color: view === k ? "#f1f5f9" : "#64748b", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, label);
        })
      ),
      React.createElement("div", { style: { display: "flex", gap: 8 } },
      React.createElement("button", { onClick: function() { exportLeads(leads); }, style: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "⬇ Export"),
      React.createElement("label", { style: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } },
        "⬆ Import",
        React.createElement("input", { type: "file", accept: ".json", style: { display: "none" }, onChange: function(e) { if (e.target.files[0]) importLeads(e.target.files[0], function(data) { setLeads(data); }); } })
      ),
      React.createElement("button", { onClick: function() { setShowAdd(true); }, style: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "+ Add Lead")
    )
    ),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, padding: "16px 24px", borderBottom: "1px solid #1e293b" } },
      [
        { label: "Active Leads", value: activeLeads, color: "#3b82f6", icon: "👥" },
        { label: "Pipeline Value", value: fmt(totalPipeline), color: "#8b5cf6", icon: "📊" },
        { label: "Closed Revenue", value: fmt(closedRevenue), color: "#10b981", icon: "🏆" },
        { label: overdueTasks ? "Overdue Tasks" : "Need Follow-Up", value: overdueTasks || urgentLeads, color: (overdueTasks || urgentLeads) > 0 ? "#ef4444" : "#10b981", icon: "⚡" },
        { label: "Potential Commission", value: fmt(potentialIncome), color: "#f59e0b", icon: "💰" },
        { label: "Earned Commission", value: fmt(earnedIncome), color: "#10b981", icon: "🏆" },
      ].map(function(s) {
        return React.createElement("div", { key: s.label, style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px" } },
          React.createElement("div", { style: { fontSize: 18, marginBottom: 6 } }, s.icon),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: s.color } }, s.value),
          React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 } }, s.label)
        );
      })
    ),
    React.createElement("div", { style: { padding: "20px 24px" } },
      view === "pipeline" ? React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" } },
          React.createElement("input", { value: search, onChange: function(e) { setSearch(e.target.value); }, placeholder: "Search leads...", style: Object.assign({}, iStyle, { flex: 1, minWidth: 160 }) }),
          React.createElement("select", { value: stageFilter, onChange: function(e) { setStageFilter(e.target.value); }, style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 10, color: "#f1f5f9", padding: "9px 14px", fontSize: 13, fontFamily: "inherit" } },
            [React.createElement("option", { key: "all" }, "All")].concat(STAGES.map(function(s) { return React.createElement("option", { key: s }, s); }))
          ),
          React.createElement("select", { value: typeFilter, onChange: function(e) { setTypeFilter(e.target.value); }, style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 10, color: "#f1f5f9", padding: "9px 14px", fontSize: 13, fontFamily: "inherit" } },
            [React.createElement("option", { key: "all" }, "All Types")].concat(LEAD_TYPES.map(function(t) { return React.createElement("option", { key: t }, t); }))
          )
        ),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(255px,1fr))", gap: 16 } },
          STAGES.map(function(stage) {
            var sl = filtered.filter(function(l) { return l.stage === stage; });
            if (sl.length === 0 && stageFilter !== "All") return null;
            return React.createElement("div", { key: stage },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                  React.createElement("div", { style: { width: 8, height: 8, borderRadius: "50%", background: STAGE_COLORS[stage] } }),
                  React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 } }, stage)
                ),
                React.createElement("span", { style: { fontSize: 11, background: "#1e293b", color: "#64748b", padding: "2px 8px", borderRadius: 20, fontWeight: 600 } }, sl.length)
              ),
              sl.map(function(l) { return React.createElement(LeadCard, { key: l.id, lead: l, onSelect: setSelected }); }),
              sl.length === 0 ? React.createElement("div", { style: { fontSize: 12, color: "#334155", textAlign: "center", padding: "20px 0", border: "1px dashed #1e293b", borderRadius: 10 } }, "Empty") : null
            );
          })
        )
      ) : null,
      view === "contacts" ? React.createElement("div", null,
        React.createElement("input", { value: search, onChange: function(e) { setSearch(e.target.value); }, placeholder: "Search...", style: Object.assign({}, iStyle, { marginBottom: 16 }) }),
        React.createElement("div", { style: { background: "#0d1117", borderRadius: 14, border: "1px solid #1e293b", overflow: "hidden" } },
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px", padding: "10px 16px", borderBottom: "1px solid #1e293b", fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" } },
            ["Contact","Interest","Budget","Stage / Type","Last Contact",""].map(function(h) { return React.createElement("div", { key: h }, h); })
          ),
          filtered.map(function(l) {
            return React.createElement("div", { key: l.id, style: { display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px", padding: "12px 16px", borderBottom: "1px solid #0f172a", alignItems: "center" } },
              React.createElement("div", null,
                React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, l.name),
                React.createElement("div", { style: { fontSize: 12, color: "#64748b" } }, l.email)
              ),
              React.createElement("div", { style: { fontSize: 12, color: "#94a3b8" } }, l.propertyInterest),
              React.createElement("div", { style: { fontWeight: 700, color: "#10b981", fontSize: 13 } }, fmt(l.budget)),
              React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
                React.createElement(StageBadge, { stage: l.stage }),
                React.createElement(TypeBadge, { type: l.type })
              ),
              React.createElement("div", { style: { fontSize: 12, color: daysSince(l.lastContact) >= 3 ? "#ef4444" : "#64748b" } }, daysSince(l.lastContact) + "d ago"),
              React.createElement("button", { onClick: function() { setSelected(l); }, style: { background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" } }, "Open")
            );
          })
        )
      ) : null,
      view === "reminders" ? React.createElement("div", null,
        (function() {
          var allTasks = leads.reduce(function(acc, l) { return acc.concat((l.tasks || []).filter(function(t) { return !t.done; }).map(function(t) { return Object.assign({}, t, { leadName: l.name, lead: l }); })); }, []);
          var overdue = allTasks.filter(function(t) { return t.due && new Date(t.due) < new Date(); });
          var todayTasks = allTasks.filter(function(t) { return t.due === todayStr(); });
          var upcoming = allTasks.filter(function(t) { return t.due && t.due > todayStr(); }).sort(function(a,b) { return a.due > b.due ? 1 : -1; });
          var cold = leads.filter(function(l) { return daysSince(l.lastContact) >= 3 && l.stage !== "Closed" && l.stage !== "Lost"; });

          function Section(title, items, color) {
            if (items.length === 0) return null;
            return React.createElement("div", { style: { marginBottom: 20 } },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: color, marginBottom: 8, textTransform: "uppercase" } }, title + " (" + items.length + ")"),
              items.map(function(t) {
                return React.createElement("div", { key: t.id, onClick: function() { setSelected(t.lead); }, style: { background: "#0d1117", border: "1px solid " + color + "30", borderRadius: 10, padding: "10px 13px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between" } },
                  React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, color: "#f1f5f9", fontWeight: 600 } }, t.text),
                    React.createElement("div", { style: { fontSize: 11, color: "#64748b", marginTop: 2 } }, t.leadName)
                  ),
                  t.due ? React.createElement("div", { style: { fontSize: 11, color: color, fontWeight: 600 } }, t.due) : null
                );
              })
            );
          }

          return React.createElement("div", null,
            Section("Overdue", overdue, "#ef4444"),
            Section("Due Today", todayTasks, "#f59e0b"),
            Section("Upcoming", upcoming.slice(0,5), "#3b82f6"),
            cold.length > 0 ? React.createElement("div", { style: { marginBottom: 20 } },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 8, textTransform: "uppercase" } }, "Going Cold (" + cold.length + ")"),
              cold.map(function(l) {
                return React.createElement("div", { key: l.id, onClick: function() { setSelected(l); }, style: { background: "#0d1117", border: "1px solid #8b5cf630", borderRadius: 10, padding: "10px 13px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, color: "#f1f5f9", fontWeight: 600 } }, l.name),
                    React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4 } },
                      React.createElement(TypeBadge, { type: l.type }),
                      React.createElement("span", { style: { fontSize: 11, color: "#64748b" } }, l.stage)
                    )
                  ),
                  React.createElement("div", { style: { fontSize: 11, color: "#ef4444", fontWeight: 700 } }, daysSince(l.lastContact) + "d ago")
                );
              })
            ) : null,
            allTasks.length === 0 && cold.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: "#334155", fontSize: 13 } }, "All caught up!") : null
          );
        })()
      ) : null,
      view === "forecast" ? React.createElement("div", null,
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 } },
          LEAD_TYPES.map(function(type) {
            var tl = leads.filter(function(l) { return l.type === type && l.stage !== "Closed" && l.stage !== "Lost"; });
            var color = TYPE_COLORS[type];
            return React.createElement("div", { key: type, style: { background: "#0d1117", border: "1px solid " + color + "44", borderRadius: 14, padding: 16 } },
              React.createElement(TypeBadge, { type: type }),
              React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: color, marginTop: 8 } }, tl.length + " active"),
              React.createElement("div", { style: { fontSize: 12, color: "#64748b" } }, fmt(tl.reduce(function(s,l) { return s+parseBudget(l.budget); }, 0)) + " pipeline")
            );
          })
        ),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14, marginBottom: 20 } },
          STAGES.filter(function(s) { return s !== "Lost"; }).map(function(stage) {
            var sl = leads.filter(function(l) { return l.stage === stage; });
            var val = sl.reduce(function(s,l) { return s+parseBudget(l.budget); }, 0);
            var max = leads.reduce(function(s,l) { return s+parseBudget(l.budget); }, 0);
            return React.createElement("div", { key: stage, style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 14, padding: 16 } },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 10 } },
                React.createElement("div", null,
                  React.createElement("div", { style: { fontWeight: 700, fontSize: 13 } }, stage),
                  React.createElement("div", { style: { fontSize: 12, color: "#64748b" } }, sl.length + " lead" + (sl.length !== 1 ? "s" : ""))
                ),
                React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: STAGE_COLORS[stage] } }, fmt(val))
              ),
              React.createElement("div", { style: { background: "#1e293b", borderRadius: 6, height: 5, overflow: "hidden" } },
                React.createElement("div", { style: { height: "100%", width: max ? (val/max*100) + "%" : "0%", background: STAGE_COLORS[stage], borderRadius: 6 } })
              )
            );
          })
        ),
        React.createElement("div", { style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 14, padding: 20 } },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 800, fontSize: 16 } }, "AI Pipeline Report"),
              React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginTop: 2 } }, "Executive analysis of your pipeline")
            ),
            React.createElement("button", {
              onClick: function() {
                setLoadingReport(true);
                var buyers = leads.filter(function(l) { return l.type === "Buyer"; }).length;
                var sellers = leads.filter(function(l) { return l.type === "Seller"; }).length;
                var summary = leads.map(function(l) { return l.name + " | " + (l.type||"Buyer") + " | " + l.stage + " | " + fmt(l.budget) + " | " + daysSince(l.lastContact) + "d ago"; }).join("\n");
                callAI("Analyze this real estate pipeline. 3-4 paragraph executive summary: health, buyer/seller breakdown, opportunities, risks, 3 priority actions.\n\nLeads:\n" + summary + "\n\nBuyers: " + buyers + " Sellers: " + sellers + "\nPipeline: " + fmt(totalPipeline) + " Closed: " + fmt(closedRevenue))
                  .then(function(r) { setAiReport(r); setLoadingReport(false); })
                  .catch(function() { setAiReport("Error."); setLoadingReport(false); });
              },
              disabled: loadingReport,
              style: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: loadingReport ? "not-allowed" : "pointer", fontFamily: "inherit" }
            }, loadingReport ? "Generating..." : "Generate Report")
          ),
          aiReport
            ? React.createElement("div", { style: { background: "#111827", borderRadius: 10, padding: 16, fontSize: 14, color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid #1e293b" } }, aiReport)
            : React.createElement("div", { style: { textAlign: "center", padding: "30px 0", color: "#334155", fontSize: 13 } }, "Click Generate Report for AI insights")
        )
      ) : null
    ),
    showAdd ? React.createElement("div", {
      style: { position: "fixed", inset: 0, background: "#000000aa", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
      onClick: function(e) { if (e.target === e.currentTarget) setShowAdd(false); }
    },
      React.createElement("div", { style: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 28, fontFamily: "inherit" } },
        React.createElement("div", { style: { fontWeight: 800, fontSize: 20, color: "#f1f5f9", marginBottom: 20 } }, "Add New Lead"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } },
          [["Full Name *","name"],["Phone","phone"],["Email","email"],["Source","source"],["Budget ($)","budget"],["Commission (%)","commission"],["Last Contact","lastContact"]].map(function(pair) {
            var label = pair[0]; var key = pair[1];
            return React.createElement("div", { key: key },
              React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, label),
              React.createElement("input", { value: newLead[key] || "", onChange: function(e) { var v = e.target.value; setNewLead(function(p) { var o = Object.assign({}, p); o[key] = v; return o; }); }, type: key === "lastContact" ? "date" : "text", style: iStyle })
            );
          })
        ),
        React.createElement("div", { style: { marginBottom: 12 } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Property Interest"),
          React.createElement("input", { value: newLead.propertyInterest, onChange: function(e) { var v = e.target.value; setNewLead(function(p) { return Object.assign({}, p, { propertyInterest: v }); }); }, style: iStyle })
        ),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Stage"),
            React.createElement("select", { value: newLead.stage, onChange: function(e) { var v = e.target.value; setNewLead(function(p) { return Object.assign({}, p, { stage: v }); }); }, style: iStyle },
              STAGES.map(function(s) { return React.createElement("option", { key: s }, s); })
            )
          ),
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Lead Type"),
            React.createElement("select", { value: newLead.type, onChange: function(e) { var v = e.target.value; setNewLead(function(p) { return Object.assign({}, p, { type: v }); }); }, style: iStyle },
              LEAD_TYPES.map(function(t) { return React.createElement("option", { key: t }, t); })
            )
          )
        ),
        React.createElement("div", { style: { marginBottom: 20 } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" } }, "Notes"),
          React.createElement("textarea", { value: newLead.notes, onChange: function(e) { var v = e.target.value; setNewLead(function(p) { return Object.assign({}, p, { notes: v }); }); }, rows: 3, style: Object.assign({}, iStyle, { resize: "vertical" }) })
        ),
        React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
          React.createElement("button", { onClick: function() { setShowAdd(false); }, style: { background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "Cancel"),
          React.createElement("button", { onClick: addLead, style: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "Add Lead")
        )
      )
    ) : null,
    selected ? React.createElement(LeadModal, { lead: selected, onClose: function() { setSelected(null); }, onUpdate: updateLead, onDelete: deleteLead }) : null
  );
}
                
