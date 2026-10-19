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

let clients = [];
let filter = "all";

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const dateEl = document.getElementById("date");

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

// ---------- Firebase ----------
col.onSnapshot(
  snap => {
    clients = snap.docs.map(d => d.data()).sort((a, b) => b.id - a.id);
    render();
  },
  err => alert("connection error: " + err.message)
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

// ---------- Kusajili mteja ----------
document.getElementById("addBtn").addEventListener("click", () => {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const size = document.getElementById("size").value;
  const date = dateEl.value || today();
  const taken = parseInt(document.getElementById("taken").value) || 0;
  const kawaida = parseInt(document.getElementById("kawaida").value) || 0;
  const editing = parseInt(document.getElementById("editing").value) || 0;
  let money = parseInt(document.getElementById("paid").value) || 0;

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

  let totalDebt = 0;
  let debtors = 0;
  clients.forEach(c => {
    const d = debtOf(c);
    if (d > 0) {
      totalDebt += d;
      debtors++;
    }
  });
  document.getElementById("summary").innerHTML =
    "Madeni: <b>" + debtors + "</b> | Total Madeni: <b>TZS " + fmt(totalDebt) + "</b>";

  const filtered = clients.filter(c => {
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
