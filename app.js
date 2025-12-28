const $ = (q) => document.querySelector(q);

const state = {
  raw: [],
  trendMode: "pct",
  charts: { gender: null, genderByClass: null, trend: null }
};

// ---------- DEBUG BOX ----------
function showDebug(msg) {
  let el = document.getElementById("debugBox");
  if (!el) {
    el = document.createElement("div");
    el.id = "debugBox";
    el.style.cssText =
      "position:fixed;bottom:12px;right:12px;max-width:520px;z-index:9999;" +
      "background:#0b1220;color:#e5e7eb;border:1px solid #334155;border-radius:14px;" +
      "padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:12px/1.4 system-ui;" +
      "white-space:pre-wrap";
    el.innerHTML = "DEBUG:\n";
    document.body.appendChild(el);
  }
  el.textContent = "DEBUG:\n" + msg;
}

// ---------- HELPERS ----------
function parseDateSmart(s) {
  if (!s) return null;
  const str = String(s).trim();

  // DD/MM/YYYY
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const dd = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      const yyyy = parseInt(parts[2], 10);
      if (yyyy && mm && dd) return new Date(yyyy, mm - 1, dd);
    }
  }

  // YYYY-MM-DD
  if (str.includes("-")) {
    const d = new Date(str + "T00:00:00");
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function normJantina(x) {
  const s = String(x || "").trim().toLowerCase();
  if (s === "l" || s === "lelaki" || s === "male") return "Lelaki";
  if (s === "p" || s === "perempuan" || s === "female") return "Perempuan";
  return "";
}

function normStatus(x) {
  const s = String(x || "").trim().toLowerCase();
  if (s === "hadir" || s === "present") return "Hadir";
  if (s === "tidak hadir" || s === "tidakhadir" || s === "absent" || s === "x hadir") return "Tidak Hadir";
  return String(x || "").trim();
}

function normalizeRow(r) {
  // try multiple header variants
  const Tarikh = r.Tarikh ?? r.tarikh ?? r.TARIKH ?? r["Tarikh "] ?? r[" tarikh"];
  const Kelas = r.Kelas ?? r.kelas ?? r.KELAS ?? r["Kelas "] ?? r[" kelas"];
  const Nama =
    r["Nama Murid"] ?? r["Nama_Murid"] ?? r["NAMA MURID"] ?? r.Nama ?? r.nama ?? r["Nama "] ?? r[" Nama Murid"];
  const Status = r.Status ?? r.status ?? r.STATUS ?? r["Status "] ?? r[" status"];
  const Jantina = r.Jantina ?? r.jantina ?? r.JANTINA ?? r["Jantina "] ?? r[" jantina"];

  const dateObj = parseDateSmart(Tarikh);
  const statusNorm = normStatus(Status);
  const isHadir = String(statusNorm).toLowerCase() === "hadir";
  const isTidak = String(statusNorm).toLowerCase().includes("tidak") || String(statusNorm).toLowerCase().includes("absent");

  return {
    tarikhRaw: Tarikh ? String(Tarikh).trim() : "",
    dateObj,
    kelas: Kelas ? String(Kelas).trim() : "",
    nama: Nama ? String(Nama).trim() : "",
    status: statusNorm,
    jantina: normJantina(Jantina),
    isHadir,
    isTidak
  };
}

function ymFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, m, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDaysInMonth(range) {
  const days = [];
  const d = new Date(range.start);
  while (d <= range.end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function uniqueMurid(rows) {
  return new Set(rows.map(r => `${r.nama}|||${r.kelas}`)).size;
}

function setWarn(show) {
  const w = $("#warnBox");
  if (w) w.classList.toggle("hidden", !show);
}

// ---------- LOAD CSV via fetch (debuggable) ----------
async function loadCSV() {
  const url =
    (window.PORTAL_CONFIG?.CSV_URL && String(window.PORTAL_CONFIG.CSV_URL).trim())
      ? String(window.PORTAL_CONFIG.CSV_URL).trim()
      : "./data/kehadiran.csv";

  const sourceEl = $("#csvSourceText");
  if (sourceEl) sourceEl.textContent = url;

  let status = "—";
  let ctype = "—";
  let text = "";

  try {
    const res = await fetch(url, { cache: "no-store" });
    status = `${res.status} ${res.statusText}`;
    ctype = res.headers.get("content-type") || "—";
    text = await res.text();
  } catch (e) {
    showDebug(
      `URL digunakan: ${url}\nFETCH ERROR: ${String(e)}\n\nPunca biasa:\n- URL tak boleh akses (403/redirect)\n- Internet block / permission`
    );
    throw e;
  }

  // show first lines
  const lines = text.split(/\r?\n/).slice(0, 3).join("\n");
  showDebug(
    `URL digunakan: ${url}\nFetch status: ${status}\nContent-Type: ${ctype}\n\n3 baris pertama:\n${lines}\n\nNota: Jika baris pertama bukan header CSV, portal memang jadi kosong.`
  );

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const raw = (parsed.data || []).map(normalizeRow);

  // filter valid rows
  state.raw = raw.filter(x => x.nama && x.kelas && x.dateObj);

  // extra debug summary
  showDebug(
    `URL digunakan: ${url}\nFetch status: ${status}\nContent-Type: ${ctype}\n\n3 baris pertama:\n${lines}\n\nParsed rows: ${raw.length}\nValid rows (nama+kelas+tarikh): ${state.raw.length}\n\nKalau Valid rows = 0:\n- Header mungkin lain (contoh 'NamaMurid' bukan 'Nama Murid')\n- Tarikh format pelik\n- Data sebenarnya HTML (bukan CSV)`
  );

  return state.raw;
}

// ---------- RENDER ----------
function populateClassDropdown(rows) {
  const sel = $("#classPick");
  if (!sel) return;
  const classes = Array.from(new Set(rows.map(r => r.kelas))).sort();
  sel.innerHTML = `<option value="">Semua Kelas</option>` + classes.map(c => `<option value="${c}">${c}</option>`).join("");
}

function autoSetMonthToLatest(rows) {
  const pick = $("#monthPick");
  if (!pick) return;
  let max = null;
  for (const r of rows) if (!max || r.dateObj > max) max = r.dateObj;
  pick.value = max ? ymFromDate(max) : ymFromDate(new Date());
}

function filterByMonthClass(rows) {
  const ym = $("#monthPick").value;
  const cls = $("#classPick").value;
  const range = getMonthRange(ym);

  const filtered = rows.filter(r =>
    r.dateObj >= range.start && r.dateObj <= range.end && (!cls || r.kelas === cls)
  );
  return { filtered, range };
}

function renderKPI(rows) {
  $("#kpiMurid").textContent = uniqueMurid(rows) || "0";
  $("#kpiRekod").textContent = rows.length || "0";

  const L = rows.filter(r => r.jantina === "Lelaki").length;
  const P = rows.filter(r => r.jantina === "Perempuan").length;
  $("#kpiL").textContent = String(L);
  $("#kpiP").textContent = String(P);

  const hadir = rows.filter(r => r.isHadir).length;
  const pct = rows.length ? (hadir / rows.length * 100).toFixed(1) + "%" : "—";
  $("#kpiPct").textContent = pct;
}

function renderTrend(rows, range) {
  const days = getDaysInMonth(range);
  const dayMap = new Map();
  days.forEach(d => dayMap.set(d.toISOString().slice(0,10), { hadir: 0, total: 0 }));

  rows.forEach(r => {
    const k = r.dateObj.toISOString().slice(0,10);
    if (!dayMap.has(k)) return;
    const v = dayMap.get(k);
    v.total++;
    if (r.isHadir) v.hadir++;
  });

  const labels = days.map(d => String(d.getDate()));
  let data, label, yMax;

  if (state.trendMode === "hadir") {
    label = "Hadir"; yMax = undefined;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? v.hadir : 0;
    });
  } else if (state.trendMode === "tidak") {
    label = "Tidak Hadir"; yMax = undefined;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? (v.total - v.hadir) : 0;
    });
  } else {
    label = "% Kehadiran"; yMax = 100;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? +(v.hadir / v.total * 100).toFixed(1) : null;
    });
  }

  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart($("#chartTrend"), {
    type: "line",
    data: { labels, datasets: [{ label, data, tension: 0.25, spanGaps: false }] },
    options: { responsive: true, scales: { y: yMax ? { beginAtZero: true, max: yMax } : { beginAtZero: true } } }
  });
}

function renderTopAbsent(rows) {
  const map = {};
  rows.filter(r => r.isTidak).forEach(r => {
    const key = `${r.nama}|||${r.kelas}`;
    if (!map[key]) map[key] = { nama: r.nama, kelas: r.kelas, cnt: 0 };
    map[key].cnt++;
  });

  const top = Object.values(map).sort((a,b) => b.cnt - a.cnt).slice(0,5);
  const body = $("#topAbsentBody");
  if (!body) return;

  body.innerHTML = top.length
    ? top.map(x => `<tr><td class="py-2">${x.nama}</td><td class="py-2">${x.kelas}</td><td class="py-2 font-semibold">${x.cnt}</td></tr>`).join("")
    : `<tr><td colspan="3" class="py-2 text-slate-500 dark:text-slate-400">Tiada data</td></tr>`;
}

function renderRanking(rows) {
  const map = {};
  rows.forEach(r => {
    const key = `${r.nama}|||${r.kelas}`;
    if (!map[key]) map[key] = { nama: r.nama, kelas: r.kelas, total: 0, hadir: 0 };
    map[key].total++;
    if (r.isHadir) map[key].hadir++;
  });

  const list = Object.values(map)
    .map(x => ({ ...x, pct: x.total ? (x.hadir/x.total*100) : 0 }))
    .sort((a,b) => b.pct - a.pct)
    .slice(0,10);

  const body = $("#rankBody");
  if (!body) return;

  body.innerHTML = list.length
    ? list.map((x,i)=>`<tr><td class="py-2">${i+1}</td><td class="py-2">${x.nama}</td><td class="py-2">${x.kelas}</td><td class="py-2 font-semibold">${x.pct.toFixed(1)}%</td></tr>`).join("")
    : `<tr><td colspan="4" class="py-2 text-slate-500 dark:text-slate-400">Tiada data</td></tr>`;
}

function renderGender(rows) {
  const L = rows.filter(r => r.jantina === "Lelaki").length;
  const P = rows.filter(r => r.jantina === "Perempuan").length;
  if (state.charts.gender) state.charts.gender.destroy();
  state.charts.gender = new Chart($("#chartGender"), {
    type: "bar",
    data: { labels: ["Lelaki","Perempuan"], datasets: [{ label: "Bilangan Rekod", data: [L,P] }] },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function renderGenderByClass(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.kelas]) map[r.kelas] = { L: 0, P: 0 };
    if (r.jantina === "Lelaki") map[r.kelas].L++;
    if (r.jantina === "Perempuan") map[r.kelas].P++;
  });
  const labels = Object.keys(map).sort();
  const dataL = labels.map(k => map[k].L);
  const dataP = labels.map(k => map[k].P);

  if (state.charts.genderByClass) state.charts.genderByClass.destroy();
  state.charts.genderByClass = new Chart($("#chartGenderByClass"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Lelaki", data: dataL }, { label: "Perempuan", data: dataP }] },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function renderAll() {
  const { filtered, range } = filterByMonthClass(state.raw);
  setWarn(filtered.length === 0);

  renderKPI(filtered);
  renderGender(filtered);
  renderGenderByClass(filtered);
  renderTrend(filtered, range);
  renderTopAbsent(filtered);
  renderRanking(filtered);
}

// ---------- INIT ----------
async function init() {
  // trend toggle
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".trendBtn");
    if (!btn) return;
    state.trendMode = btn.dataset.mode;
    document.querySelectorAll(".trendBtn").forEach(b => b.classList.remove("bg-emerald-600","text-white"));
    btn.classList.add("bg-emerald-600","text-white");
    renderAll();
  });

  // load
  const data = await loadCSV();
  if (!data.length) {
    // still render, warn will show
    renderAll();
    return;
  }

  populateClassDropdown(data);
  autoSetMonthToLatest(data);

  $("#monthPick")?.addEventListener("change", renderAll);
  $("#classPick")?.addEventListener("change", renderAll);

  // default active %
  document.querySelectorAll(".trendBtn")[0]?.classList.add("bg-emerald-600","text-white");

  renderAll();
}

init().catch(console.error);
