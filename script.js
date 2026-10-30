const firebaseConfig = {
  apiKey: "AIzaSyBX7DsJAXukNWpR6G0w_4n2XJ26OhBVu1w",
  authDomain: "fm-studio-f87cf.firebaseapp.com",
  projectId: "fm-studio-f87cf",
  storageBucket: "fm-studio-f87cf.firebasestorage.app",
  messagingSenderId: "719186626586",
  appId: "1:719186626586:web:4f4e3e73f93495931429a3"
};

// Bei ya picha moja (TZS) kwa kila size.
// Ukitaka kubadilisha bei au kuongeza size, badilisha hapa tu.
const PRICES = {
  "5x7": 1000,
  "A4": 10000
};

function priceOf(c) {
  return PRICES[c.size] || 1000;
}

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const col = db.collection("clients");
const eventsCol = db.collection("events");

let clients = [];
let events = [];
let filter = "all";

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const dateEl = document.getElementById("date");
const eventDateEl = document.getElementById("eventDate");
const eventSelectEl = document.getElementById("eventSelect");
const eventFilterEl = document.getElementById("eventFilter");
const eventsListEl = document.getElementById("eventsList");
const migrateCardEl = document.getElementById("migrateCard");
const migrateSelectEl = document.getElementById("migrateSelect");

// ---------- Msaada ----------
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

function showDate(s) {
  if (!s) return "-";
  const p = s.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function fmt(n) {
  return Number(n).toLocaleString();
}

dateEl.value = today();
eventDateEl.value = today();

// ---------- Firebase: Wateja ----------
col.onSnapshot(
  snap => {
    clients = snap.docs.map(d => d.data()).sort((a, b) => b.id - a.id);
    renderEvents();
    render();
  },
  err => alert("connection error: " + err.message)
);

// ---------- Firebase: Events ----------
eventsCol.onSnapshot(
  snap => {
    events = snap.docs.map(d => d.data()).sort((a, b) => b.id - a.id);
    fillEventSelects();
    renderEvents();
    render();
  },
  err => alert("connection error (events): " + err.message)
);

function saveClient(c) {
  return col.doc(String(c.id)).set(c).catch(err => {
    alert("Failed to save: " + err.message);
  });
}

// ---------- Hesabu ya pesa na salio ----------
// Pesa inaongezwa kwenye salio, kisha picha zinalipiwa kadri pesa inavyotosha.
// Kinachobaki kinakuwa salio la mteja.
function applyMoney(c, money) {
  const price = priceOf(c);
  c.balance = (c.balance || 0) + money;
  const unpaid = c.taken - c.paid;
  if (unpaid > 0) {
    const n = Math.min(unpaid, Math.floor(c.balance / price));
    c.paid += n;
    c.balance -= n * price;
  }
}

function debtOf(c) {
  const unpaid = c.taken - c.paid;
  return Math.max(0, unpaid * priceOf(c) - (c.balance || 0));
}

// ---------- Events ----------
function eventNameOf(id) {
  const e = events.find(x => x.id === id);
  return e ? e.name : "-";
}

// Jaza dropdown za event (form ya mteja + filter + kuhamisha)
function fillEventSelects() {
  const selVal = eventSelectEl.value;
  const filVal = eventFilterEl.value;

  if (events.length === 0) {
    eventSelectEl.innerHTML = '<option value="">-- Sajili event kwanza --</option>';
  } else {
    eventSelectEl.innerHTML =
      '<option value="">-- Chagua event --</option>' +
      events.map(e =>
        '<option value="' + e.id + '">' + e.name + " (" + showDate(e.date) + ")</option>"
      ).join("");
  }

  migrateSelectEl.innerHTML = events.map(e =>
    '<option value="' + e.id + '">' + e.name + " (" + showDate(e.date) + ")</option>"
  ).join("");

  eventFilterEl.innerHTML =
    '<option value="all">Events zote</option>' +
    events.map(e => '<option value="' + e.id + '">' + e.name + "</option>").join("");

  // Rudisha chaguo la awali kama bado lipo
  if (events.some(e => String(e.id) === selVal)) eventSelectEl.value = selVal;
  if (events.some(e => String(e.id) === filVal)) eventFilterEl.value = filVal;
}

// Kusajili event mpya
document.getElementById("addEventBtn").addEventListener("click", () => {
  const name = document.getElementById("eventName").value.trim();
  const location = document.getElementById("eventLocation").value.trim();
  const date = eventDateEl.value || today();

  if (!name) return alert("Weka jina la event");
  if (!location) return alert("Weka location ya event");

  const e = {
    id: Date.now(),
    name: name,
    location: location,
    date: date
  };

  eventsCol.doc(String(e.id)).set(e).catch(err => {
    alert("Failed to save event: " + err.message);
  });

  document.getElementById("eventName").value = "";
  document.getElementById("eventLocation").value = "";
  eventDateEl.value = today();
});

// Kuonyesha events pamoja na box za hesabu
function renderEvents() {
  // Onyesha kisanduku cha kuhamisha wateja wasio na event
  const orphans = clients.filter(c => !c.eventId);
  if (orphans.length > 0 && events.length > 0) {
    migrateCardEl.style.display = "block";
    document.getElementById("migrateInfo").textContent =
      "Kuna wateja " + orphans.length + " ambao hawana event.";
  } else {
    migrateCardEl.style.display = "none";
  }

  if (events.length === 0) {
    eventsListEl.innerHTML = "";
    return;
  }

  eventsListEl.innerHTML = events.map(e => {
    const list = clients.filter(c => c.eventId === e.id);

    let paidAmt = 0;
    let unpaidAmt = 0;
    let change = 0;

    list.forEach(c => {
      const price = priceOf(c);
      paidAmt += c.paid * price;
      unpaidAmt += (c.taken - c.paid) * price;
      change += (c.balance || 0);
    });

    const total = paidAmt + unpaidAmt;

    return `
      <div class="event">
        <h3>🎉 ${e.name}</h3>
        <p>📅 ${showDate(e.date)} &nbsp;|&nbsp; 📍 ${e.location} &nbsp;|&nbsp; 👥 Wateja: ${list.length}</p>
        <div class="stats">
          <div class="stat paid"><span>Paid Amount</span><b>TZS ${fmt(paidAmt)}</b></div>
          <div class="stat unpaid"><span>Unpaid Amount</span><b>TZS ${fmt(unpaidAmt)}</b></div>
          <div class="stat change"><span>Chenchi</span><b>TZS ${fmt(change)}</b></div>
          <div class="stat total"><span>Total Amount</span><b>TZS ${fmt(total)}</b></div>
        </div>
        <button onclick="viewEvent(${e.id})">View customers</button>
        <button class="btn-red" onclick="removeEvent(${e.id})">Delete Event</button>
      </div>
    `;
  }).join("");
}

// Kuchagua event kwenye filter ya orodha
function viewEvent(id) {
  eventFilterEl.value = String(id);
  render();
  eventFilterEl.scrollIntoView({ behavior: "smooth" });
}

// Kufuta event (pamoja na wateja wake)
function removeEvent(id) {
  const e = events.find(x => x.id === id);
  if (!e) return;
  const list = clients.filter(c => c.eventId === id);

  const ok = confirm(
    'Futa event "' + e.name + '"?\n' +
    "Wateja " + list.length + " wa event hii watafutwa pia. Hii haiwezi kurudishwa."
  );
  if (!ok) return;

  const batch = db.batch();
  list.forEach(c => batch.delete(col.doc(String(c.id))));
  batch.delete(eventsCol.doc(String(id)));

  batch.commit().catch(err => {
    alert("Imeshindwa kufuta event: " + err.message);
  });
}

// ---------- Hamisha wateja wa zamani kwenye event ----------
document.getElementById("migrateBtn").addEventListener("click", () => {
  const eventId = parseInt(migrateSelectEl.value) || 0;
  if (!eventId) return alert("Chagua event kwanza");

  const orphans = clients.filter(c => !c.eventId);
  if (orphans.length === 0) return alert("Hakuna wateja wa kuhamisha");

  if (!confirm("Hamisha wateja " + orphans.length + " kwenye event \"" + eventNameOf(eventId) + "\"?")) return;

  const batch = db.batch();
  orphans.forEach(c => {
    batch.update(col.doc(String(c.id)), { eventId: eventId });
  });

  batch.commit()
    .then(() => alert("Imekamilika! Wateja " + orphans.length + " wamehamishwa."))
    .catch(err => alert("Imeshindwa: " + err.message));
});

// ---------- Kusajili mteja ----------
document.getElementById("addBtn").addEventListener("click", () => {
  const eventId = parseInt(eventSelectEl.value) || 0;
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const size = document.getElementById("size").value;
  const date = dateEl.value || today();
  const taken = parseInt(document.getElementById("taken").value) || 0;
  const kawaida = parseInt(document.getElementById("kawaida").value) || 0;
  const editing = parseInt(document.getElementById("editing").value) || 0;
  let money = parseInt(document.getElementById("paid").value) || 0;

  if (!eventId) return alert("Chagua event kwanza");
  if (!name) return alert("Weka jina la mteja");
  if (taken <= 0) return alert("Weka idadi ya picha zote");
  if (kawaida + editing !== taken) {
    return alert(
      "Kawaida (" + kawaida + ") + Editing (" + editing + ") = " + (kawaida + editing) +
      ", lakini picha zote ni " + taken + ". Zinatakiwa zilingane."
    );
  }

  // Angalia kama mteja ana salio kutoka kwenye usajili wa zamani
  const old = clients.filter(r => {
    if ((r.balance || 0) <= 0) return false;
    if (phone) return r.phone === phone;
    return r.name.toLowerCase() === name.toLowerCase();
  });
  const oldTotal = old.reduce((s, r) => s + r.balance, 0);

  if (oldTotal > 0) {
    const useOld = confirm(name + " ana salio la TZS " + fmt(oldTotal) + ". Litumike kwenye usajili huu?");
    if (useOld) {
      money += oldTotal;
      old.forEach(r => {
        r.balance = 0;
        saveClient(r);
      });
    }
  }

  const c = {
    id: Date.now(),
    eventId: eventId,
    name: name,
    phone: phone,
    size: size,
    date: date,
    taken: taken,
    kawaida: kawaida,
    editing: editing,
    paid: 0,
    collected: 0,
    balance: 0
  };
  applyMoney(c, money);
  saveClient(c);

  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("taken").value = "";
  document.getElementById("kawaida").value = "";
  document.getElementById("editing").value = "";
  document.getElementById("paid").value = "";
  dateEl.value = today();
});

// ---------- Search na filters ----------
searchEl.addEventListener("input", render);
eventFilterEl.addEventListener("change", render);

document.getElementById("fAll").addEventListener("click", () => {
  filter = "all";
  document.getElementById("fAll").classList.add("active");
  document.getElementById("fDebt").classList.remove("active");
  render();
});

document.getElementById("fDebt").addEventListener("click", () => {
  filter = "debt";
  document.getElementById("fDebt").classList.add("active");
  document.getElementById("fAll").classList.remove("active");
  render();
});

// ---------- Kuonyesha orodha ----------
function render() {
  const q = searchEl.value.toLowerCase().trim();
  const evFilter = eventFilterEl.value;

  // Wateja wa event iliyochaguliwa (au wote)
  const inEvent = clients.filter(c =>
    evFilter === "all" || String(c.eventId) === evFilter
  );

  let totalDebt = 0;
  let debtors = 0;
  inEvent.forEach(c => {
    const d = debtOf(c);
    if (d > 0) {
      totalDebt += d;
      debtors++;
    }
  });
  document.getElementById("summary").innerHTML =
    "Madeni: <b>" + debtors + "</b> | Total Madeni: <b>TZS " + fmt(totalDebt) + "</b>";

  const filtered = inEvent.filter(c => {
    const match = c.name.toLowerCase().includes(q) || (c.phone || "").includes(q);
    const hasDebt = (c.taken - c.paid) > 0;
    return match && (filter === "all" || hasDebt);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = "<p style='text-align:center'>No Customer.</p>";
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const unpaid = c.taken - c.paid;
    const canCollect = c.paid - c.collected;
    const debt = debtOf(c);
    const balance = c.balance || 0;

    let badge = '<span class="badge no">Unpaid</span>';
    if (unpaid === 0) badge = '<span class="badge ok">Paid All</span>';
    else if (c.paid > 0 || balance > 0) badge = '<span class="badge part">Ana deni</span>';

    const callBtn = (unpaid > 0 && c.phone)
      ? `<a class="btn-call" href="tel:${c.phone}">📞 Call</a>`
      : "";

    const balanceLine = balance > 0
      ? `<p class="balance">Salio: <b>TZS ${fmt(balance)}</b></p>`
      : "";

    return `
      <div class="client">
        <h3>${c.name} ${badge}</h3>
        <p>🎉 Event: <b>${eventNameOf(c.eventId)}</b></p>
        <p>📞 ${c.phone || "-"}</p>
        <p>
          <span class="tag">Size:${c.size || "-"}</span>
          <span class="tag">📅 ${showDate(c.date)}</span>
        </p>
        <p>Kawaida: <b>${c.kawaida || 0}</b> | Editing: <b>${c.editing || 0}</b></p>
        <p>Bei ya picha moja: <b>TZS ${fmt(priceOf(c))}</b></p>
        <p>Zilizopigwa: <b>${c.taken}</b></p>
        <p>Paid: <b>${c.paid}</b> | Unpaid: <b>${unpaid}</b></p>
        <p>Zilizochukuliwa: <b>${c.collected}</b> | Anazoweza kuchukua: <b>${canCollect}</b></p>
        <p>Deni: <b>TZS ${fmt(debt)}</b></p>
        ${balanceLine}
        <button class="btn-green" onclick="collect(${c.id})">Collect</button>
        <button onclick="addPayment(${c.id})">Add Payment</button>
        ${callBtn}
        <button onclick="editClient(${c.id})">Edit</button>
        <button class="btn-red" onclick="removeClient(${c.id})">Delete</button>
      </div>
    `;
  }).join("");
}

function findClient(id) {
  return clients.find(c => c.id === id);
}

// ---------- Vitendo ----------
function collect(id) {
  const c = findClient(id);
  const canCollect = c.paid - c.collected;
  const n = parseInt(prompt("Anachukua picha ngapi? (Anaweza: " + canCollect + ")"));
  if (!n || n <= 0) return;

  if (n > canCollect) {
    return alert("Hawezi! Amelipia picha " + c.paid + ", ameshachukua " + c.collected + ". Anaweza kuchukua " + canCollect + " tu.");
  }

  c.collected += n;
  saveClient(c);
}

function addPayment(id) {
  const c = findClient(id);
  const n = parseInt(prompt("Amount? Deni lake: " + fmt(debtOf(c))));
  if (!n || n <= 0) return;

  applyMoney(c, n);
  saveClient(c);
}

function editClient(id) {
  const c = findClient(id);
  const name = prompt("Jina:", c.name);
  if (name === null) return;
  const phone = prompt("Simu:", c.phone || "");
  if (phone === null) return;
  const kawaida = parseInt(prompt("Picha za Kawaida:", c.kawaida || 0));
  if (isNaN(kawaida) || kawaida < 0) return;
  const editing = parseInt(prompt("Picha za Editing:", c.editing || 0));
  if (isNaN(editing) || editing < 0) return;

  const taken = kawaida + editing;
  if (taken < c.paid) return alert("Picha zote (" + taken + ") haziwezi kuwa chini ya zilizolipiwa (" + c.paid + ").");

  c.name = name.trim() || c.name;
  c.phone = phone.trim();
  c.kawaida = kawaida;
  c.editing = editing;
  c.taken = taken;
  saveClient(c);
}

function removeClient(id) {
  if (!confirm("Una uhakika unataka kumfuta mteja huyu?")) return;
  col.doc(String(id)).delete().catch(err => {
    alert("Imeshindwa kufuta: " + err.message);
  });
}
