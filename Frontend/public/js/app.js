// frontend/public/js/app.js
const API_BASE = (location.origin.indexOf("http") === 0 ? location.origin : "") || "http://127.0.0.1:5000";
const socket = io(API_BASE);

// Utility
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function showMsg(container, text, cls="bot") {
  const d = document.createElement("div"); d.className = "msg " + cls; d.textContent = text;
  container.appendChild(d); container.scrollTop = container.scrollHeight;
}

/* ----------------- User portal logic ----------------- */
if (qs("#complaintForm")) {
  // init map
  const map = L.map('map').setView([12.97, 77.59], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  let marker = null;

  const latInput = qs("#lat"), lngInput = qs("#lng");
  function updateMarker() {
    const lat = parseFloat(latInput.value || 0);
    const lng = parseFloat(lngInput.value || 0);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (!marker) marker = L.marker([lat, lng]).addTo(map);
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 15);
    }
  }
  latInput.addEventListener("change", updateMarker);
  lngInput.addEventListener("change", updateMarker);

  qs("#locFromBrowser").addEventListener("click", () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(p => {
      latInput.value = p.coords.latitude.toFixed(6);
      lngInput.value = p.coords.longitude.toFixed(6);
      updateMarker();
    }, e => alert("Couldn't get location: " + e.message));
  });

  qs("#complaintForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = {
      title: qs("#title").value,
      description: qs("#description").value,
      priority: qs("#priority").value,
      reporter: qs("#reporter").value || "anonymous",
      location: { lat: parseFloat(latInput.value||0), lng: parseFloat(lngInput.value||0) }
    };
    qs("#submitBtn").disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data)
      });
      const j = await res.json();
      if (j.success) {
        alert("Complaint submitted. ID: " + j.complaint._id);
        qs("#complaintForm").reset();
        if (marker) { map.removeLayer(marker); marker = null; }
      } else {
        alert("Error: " + JSON.stringify(j));
      }
    } catch (err) {
      console.error(err); alert("Network error");
    } finally { qs("#submitBtn").disabled = false; }
  });

  // Chatbot basic
  const messages = qs("#messages");
  const chatInput = qs("#chatInput");
  const sendChat = qs("#sendChat");
  function botReply(text) {
    showMsg(messages, text, "bot");
  }
  sendChat.addEventListener("click", () => handleUserChat(chatInput.value));
  chatInput.addEventListener("keypress", (e)=>{ if (e.key === "Enter") handleUserChat(chatInput.value); });

  let reported = {};
  function handleUserChat(txt) {
    if (!txt || !txt.trim()) return;
    showMsg(messages, txt, "user");
    chatInput.value = "";

    const low = txt.toLowerCase();
    if (low.includes("report") || low.includes("complaint") || low.includes("dump") || low.includes("bin")) {
      botReply("I can file a complaint for you. What's the title?");
      reported.stage = "await_title";
      return;
    }

    if (reported.stage === "await_title") {
      reported.title = txt;
      reported.stage = "await_desc";
      botReply("Got it. Describe the issue in a sentence.");
      return;
    }
    if (reported.stage === "await_desc") {
      reported.description = txt;
      reported.stage = "await_priority";
      botReply("Priority? (low / medium / high).");
      return;
    }
    if (reported.stage === "await_priority") {
      const p = (txt.match(/high|medium|low/) || ["medium"])[0];
      reported.priority = p;
      botReply("If you want, provide your name. Or type 'skip'.");
      reported.stage = "await_reporter";
      return;
    }
    if (reported.stage === "await_reporter") {
      if (txt.toLowerCase() !== "skip") reported.reporter = txt;
      reported.stage = "confirm";
      botReply(`I'll submit: [${reported.title}] (${reported.priority}). Say "yes" to submit or "no" to cancel.`);
      return;
    }
    if (reported.stage === "confirm") {
      if (txt.toLowerCase().startsWith("y")) {
        // attempt to use browser location
        navigator.geolocation.getCurrentPosition(async pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          try {
            const res = await fetch(`${API_BASE}/api/complaints`, {
              method: "POST", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({
                title: reported.title, description: reported.description,
                priority: reported.priority || "medium", reporter: reported.reporter || "anonymous",
                location: loc
              })
            });
            const j = await res.json();
            if (j.success) botReply("Submitted. Thank you! Your complaint ID: " + j.complaint._id);
            else botReply("Sorry, failed to submit.");
          } catch (e) { botReply("Network error while submitting."); }
        }, async () => {
          // fallback: submit without location
          try {
            const res = await fetch(`${API_BASE}/api/complaints`, {
              method: "POST", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({
                title: reported.title, description: reported.description,
                priority: reported.priority || "medium", reporter: reported.reporter || "anonymous",
                location: {lat:0,lng:0}
              })
            });
            const j = await res.json();
            if (j.success) botReply("Submitted. Your complaint ID: " + j.complaint._id);
            else botReply("Failed to submit.");
          } catch (e) { botReply("Network error while submitting."); }
        });
      } else {
        botReply("Okay, canceled.");
      }
      reported = {};
      return;
    }

    // default reply
    botReply("I can help file complaints quickly — just type 'report' to start.");
  }

  // Socket updates
  socket.on("connected", () => console.log("connected to backend"));
  socket.on("new_complaint", (c) => {
    // show a small toast in chat
    showMsg(messages, `New complaint added: ${c.title}`, "bot");
  });
  socket.on("status_update", (c) => {
    showMsg(messages, `Status update: ${c.title} → ${c.status}`, "bot");
  });
}

/* --------------- Manager dashboard logic --------------- */
if (qs("#complaintList") && qs("#managerMap")) {
  const listEl = qs("#complaintList");
  const map = L.map('managerMap').setView([12.97, 77.59], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  let markers = {};

  async function fetchComplaints() {
    const p = qs("#filterPriority").value;
    const q = p ? `?priority=${p}` : "";
    const res = await fetch(`${API_BASE}/api/complaints${q}`);
    const j = await res.json();
    return j.complaints || [];
  }

  function clearList() { listEl.innerHTML = ""; }
  function clearMarkers() { for (const k in markers) map.removeLayer(markers[k]); markers = {}; }

  function priorityScore(p) {
    if (p === "high") return 3;
    if (p === "medium") return 2;
    return 1;
  }

  function createItem(c) {
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `
      <h4>${c.title}</h4>
      <small>Priority: ${c.priority} • Status: ${c.status}</small>
      <p style="margin:8px 0">${c.description || ""}</p>
      <div style="display:flex;gap:8px;">
        <button data-id="${c._id}" class="assign">Assign</button>
        <button data-id="${c._id}" class="start">Start</button>
        <button data-id="${c._id}" class="finish">Finish</button>
      </div>
    `;
    return el;
  }

  async function refresh() {
    clearList(); clearMarkers();
    const complaints = await fetchComplaints();
    // sort: priority desc, created_at asc
    complaints.sort((a,b) => {
      const pa = priorityScore(a.priority||"medium"), pb = priorityScore(b.priority||"medium");
      if (pa !== pb) return pb - pa;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    complaints.forEach(c => {
      const el = createItem(c);
      listEl.appendChild(el);
      // marker
      if (c.location && c.location.lat && c.location.lng) {
        const m = L.marker([c.location.lat, c.location.lng]).addTo(map).bindPopup(`<b>${c.title}</b><br>${c.priority} • ${c.status}`);
        markers[c._id] = m;
      }
    });
  }

  qs("#refresh").addEventListener("click", refresh);
  qs("#filterPriority").addEventListener("change", refresh);

  // Delegated click handlers (assign/start/finish)
  listEl.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains("assign")) {
      const worker = prompt("Assign to (worker name or vehicle id):", "team-1");
      if (!worker) return;
      await fetch(`${API_BASE}/api/complaint/${id}/status`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({status:"assigned", assigned_to: worker})
      });
      await refresh();
    }
    if (btn.classList.contains("start")) {
      await fetch(`${API_BASE}/api/complaint/${id}/status`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({status:"in_progress"})
      });
      await refresh();
    }
    if (btn.classList.contains("finish")) {
      await fetch(`${API_BASE}/api/complaint/${id}/status`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({status:"finished"})
      });
      await refresh();
    }
  });

  // compute route
  qs("#computeRoute").addEventListener("click", async () => {
    const startLat = parseFloat(qs("#startLat").value || 0);
    const startLng = parseFloat(qs("#startLng").value || 0);
    // choose all new/assigned/in_progress complaints visible
    const complaints = await fetchComplaints();
    const ids = complaints.map(c => c._id);
    const res = await fetch(`${API_BASE}/api/compute_route`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({start:{lat:startLat,lng:startLng}, complaint_ids: ids})
    });
    const j = await res.json();
    if (j.route) {
      // draw polyline & popup steps
      clearMarkers();
      const latlngs = [];
      j.route.forEach((step, idx) => {
        const lat = step.location.lat, lng = step.location.lng;
        latlngs.push([lat,lng]);
        const mk = L.marker([lat,lng]).addTo(map).bindPopup(`<b>Step ${idx+1}</b><br>${step.title}<br>${step.priority}`);
        markers[step._id] = mk;
      });
      if (latlngs.length) {
        const poly = L.polyline(latlngs, {weight:3}).addTo(map);
        map.fitBounds(poly.getBounds().pad(0.8));
        setTimeout(()=>poly.remove(), 60000); // remove temporary polyline after 60s
      }
      alert("Route computed and shown on map.");
    }
  });

  // socket realtime update
  socket.on("new_complaint", (c) => {
    refresh();
  });
  socket.on("status_update", (c) => {
    refresh();
  });

  // initial fetch
  refresh();
}
