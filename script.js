const firebaseConfig = {
  apiKey: "AIzaSyBX7DsJAXukNWpR6G0w_4n2XJ26OhBVu1w",
  authDomain: "fm-studio-f87cf.firebaseapp.com",
  projectId: "fm-studio-f87cf",
  storageBucket: "fm-studio-f87cf.firebasestorage.app",
  messagingSenderId: "719186626586",
  appId: "1:719186626586:web:4f4e3e73f93495931429a3"
};
let clients = JSON.parse(localStorage.getItem("fmClients")) || [];

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const dateEl = document.getElementById("date");

let filter = "all";

// Tarehe ya leo (kwa saa za simu yako)
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

// 2026-10-19 -> 19/10/2026
function showDate(s) {
  if (!s) return "-";
  const p = s.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

dateEl.value = today();

function save() {
  localStorage.setItem("fmClients", JSON.stringify(clients));
}

function fmt(n) {
  return Number(n).toLocaleString();
}

document.getElementById("addBtn").addEventListener("click", () => {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const size = document.getElementById("size").value;
  const kind = document.getElementById("kind").value;
  const date = dateEl.value || today();
  const taken = parseInt(document.getElementById("taken").value) || 0;
  const paid = parseInt(document.getElementById("paid").value) || 0;
  const price = parseInt(document.getElementById("price").value) || 0;

  if (!name) return alert("Weka jina la mteja");
  if (taken <= 0) return alert("Weka idadi ya picha zilizopigwa");
  if (price <= 0) return alert("Weka bei ya picha moja");
  if (paid > taken) return alert("Alizolipia haziwezi kuzidi zilizopigwa");

  clients.unshift({
    id: Date.now(),
    name: name,
    phone: phone,
    size: size,
    kind: kind,
    date: date,
    taken: taken,
    paid: paid,
    price: price,
    collected: 0
  });

  save();
  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("taken").value = "";
  document.getElementById("paid").value = "";
  document.getElementById("price").value = "";
  dateEl.value = today();
  render();
});

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

function render() {
  const q = searchEl.value.toLowerCase().trim();

  // Jumla ya madeni
  let totalDebt = 0;
  let debtors = 0;
  clients.forEach(c => {
    const unpaid = c.taken - c.paid;
    if (unpaid > 0) {
      totalDebt += unpaid * (c.price || 0);
      debtors++;
    }
  });
  document.getElementById("summary").innerHTML =
    " Madeni: <b>" + debtors + "</b> | Total Madeni: <b>TZS " + fmt(totalDebt) + "</b>";

  const filtered = clients.filter(c => {
    const match = c.name.toLowerCase().includes(q) || c.phone.includes(q);
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
    const price = c.price || 0;
    const debt = unpaid * price;

    let badge = '<span class="badge no">Unpaid</span>';
    if (unpaid === 0) badge = '<span class="badge ok">Paid All</span>';
    else if (c.paid > 0) badge = '<span class="badge part">Ana deni</span>';

    const callBtn = (unpaid > 0 && c.phone)
      ? `<a class="btn-call" href="tel:${c.phone}">📞 Call</a>`
      : "";

    return `
      <div class="client">
        <h3>${c.name} ${badge}</h3>
        <p>📞 ${c.phone || "-"}</p>
        <p>
          <span class="tag">Size:${c.size || "-"}</span>
          <span class="tag">Service:${c.kind || "Kawaida"}</span>
          <span class="tag">📅 ${showDate(c.date)}</span>
        </p>
        <p>Bei ya picha moja: <b>TZS ${fmt(price)}</b></p>
        <p>Zilizopigwa: <b>${c.taken}</b></p>
        <p>Paid: <b>${c.paid}</b> | Unpaid: <b>${unpaid}</b></p>
        <p>Zilizochukuliwa: <b>${c.collected}</b> | Anazoweza kuchukua: <b>${canCollect}</b></p>
        <p>Deni: <b>TZS ${fmt(debt)}</b></p>
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

function collect(id) {
  const c = findClient(id);
  const canCollect = c.paid - c.collected;
  const n = parseInt(prompt("Anachukua picha ngapi? (Anaweza: " + canCollect + ")"));
  if (!n || n <= 0) return;

  if (n > canCollect) {
    return alert("Hawezi! Amelipia picha " + c.paid + ", ameshachukua " + c.collected + ". Anaweza kuchukua " + canCollect + " tu.");
  }

  c.collected += n;
  save();
  render();
}

function addPayment(id) {
  const c = findClient(id);
  const unpaid = c.taken - c.paid;
  const n = parseInt(prompt("Analipia picha ngapi? (Zilizobaki kulipiwa: " + unpaid + ")"));
  if (!n || n <= 0) return;

  if (n > unpaid) return alert("Zimebaki picha " + unpaid + " tu za kulipia.");

  c.paid += n;
  save();
  render();
}

function editClient(id) {
  const c = findClient(id);
  const name = prompt("Jina:", c.name);
  if (name === null) return;
  const phone = prompt("Simu:", c.phone);
  if (phone === null) return;
  const taken = parseInt(prompt("Picha zilizopigwa:", c.taken));
  if (isNaN(taken)) return;
  const price = parseInt(prompt("Bei ya picha moja:", c.price || 0));
  if (isNaN(price)) return;

  if (taken < c.paid) return alert("Zilizopigwa haziwezi kuwa chini ya zilizolipiwa.");

  c.name = name.trim() || c.name;
  c.phone = phone.trim();
  c.taken = taken;
  c.price = price;
  save();
  render();
}

function removeClient(id) {
  if (!confirm("Una uhakika unataka kumfuta mteja huyu?")) return;
  clients = clients.filter(c => c.id !== id);
  save();
  render();
}

render();
