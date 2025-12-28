// app.js
const $ = (q) => document.querySelector(q);

const state = {
  view: "home",
  sidebarCollapsed: false,
  rawRows: [],
  rows: [],
  ann: [],
  charts: {
    monthly: null,
    byClass: null
  }
};

function setTheme(initial = false) {
  const saved = localStorage.getItem("theme");
  const isDark = saved ? saved === "dark" : false;
  document.documentElement.classList.toggle("dark", isDark);
  if (!initial) localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", !isDark);
  localStorage.setItem("theme", !isDark ? "dark" : "light");
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains("dark");
  const btn = $("#btnTheme");
  btn.innerHTML = isDark
    ? '<i data-lucide="sun" class="h-5 w-5"></i>'
    : '<i data-lucide="moon" class="h-5 w-5"></i>';
  lucide.createIcons();
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  const sidebar = $("#sidebar");
  const brandText = $("#brandText");
  const navTexts = document.querySelectorAll(".navText");
  const btn = $("#btnSidebar");

  if (collapsed) {
    sidebar.classList.remove("w-72");
    sidebar.classList.add("w-20");
    brandText.classList.add("hidden");
    navTexts.forEach(el => el.classList.add("hidden"));
    btn.innerHTML = '<i data-lucide="panel-left-open" class="h-5 w-5"></i>';
  } else {
    sidebar.classList.remove("w-20");
    sidebar.classList.add("w-72");
    brandText.classList.remove("hidden");
    navTexts.forEach(el => el.classList.remove("hidden"));
    btn.innerHTML = '<i data-lucide="panel-left-close" class="h-5 w-5"></i>';
  }
  lucide.createIcons();
  localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
}

function setView(view) {
  state.view = view;

  // update title
  const titles = {
    home: ["Dashboard", "Ringkasan & Statistik"],
    data: ["Data (CSV)", "Paparan Jadual + Filter + Graf"],
    ann: ["Pengumuman", "Makluman semasa (auto hide ikut tarikh tamat)"],
    calendar: ["Takwim", "Jadual & aktiviti sekolah"]
  };
  const [t, s] = titles[view] || ["Portal", ""];
  $("#pageTitle").textContent = t;
  $("#pageSubtitle").textContent = s;

  // toggle sections
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(`#view-${view}`).classList.remove("hidden");

  // nav active style
  document.querySelectorAll(".navItem").forEach(a => {
    const isActive = a.getAttribute("data-view") === view;
    a.classList.toggle("bg-slate-100", isActive);
    a.classList.toggle("dark:bg-slate-800", isActive);
  });
}

function parseDateISO(s) {
  // expected: YYYY-MM-DD
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function formatPct(x) {
  if (!isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function isWithin(d, start, end) {
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function startOfWeek(d) {
  // Monday as start
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0,0,0,0);
  return x;
}
function endOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23,59,59,999);
  return x;
}

function normalizeRow(r) {
  // Sokong pelbagai header Google Sheet / AppSheet
  const Tarikh =
    (r.Tarikh || r.tarikh || r.TARIKH || "").toString().trim();

  const Nama =
    (r.Nama ||
     r.nama ||
     r["Nama Murid"] ||
     r["NAMA MURID"] ||
     "").toString().trim();

  const Kelas =
    (r.Kelas || r.kelas || r.KELAS || "").toString().trim();

  const Status =
    (r.Status || r.status || r.STATUS || "").toString().trim();

  const Jantina =
    (r.Jantina || r.jantina || r.JANTINA || "").toString().trim();

  const dateObj = parseDateISO(Tarikh);
  const statusNorm = Status.toLowerCase();

  return {
    Tarikh,
    Nama,
    Kelas,
    Status,
    Jantina,
    dateObj,
    isHadir: statusNorm === "hadir",
    isTidakHadir:
      statusNorm === "tidak hadir" ||
      statusNorm === "tidakhadir" ||
      statusNorm === "absent" ||
      statusNorm === "x hadir"
  };
}


  const dateObj = parseDateISO(Tarikh);
  const statusNorm = Status.toLowerCase();

  return {
    Tarikh, Nama, Kelas, Status,
    dateObj,
    isHadir: statusNorm === "hadir" || statusNorm === "present",
    isTidakHadir: statusNorm === "tidak hadir" || statusNorm === "absent" || statusNorm === "x hadir"
  };
}

async function loadCSV() {
  const csvUrl = (window.PORTAL_CONFIG?.CSV_URL || "").trim() || "./data/kehadiran.csv";
  $("#csvSourceText").textContent = csvUrl;

  return new Promise((resolve, reject) => {
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []).map(normalizeRow).filter(x => x.Nama && x.Tarikh);
        state.rawRows = rows;
        resolve(rows);
      },
      error: reject
    });
  });
}

function populateClassDropdown(rows) {
  const sel = $("#fClass");
  const classes = Array.from(new Set(rows.map(r => r.Kelas).filter(Boolean))).sort();
  sel.innerHTML = `<option value="">Semua</option>` + classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function applyFilters() {
  const qName = ($("#fName").value || "").trim().toLowerCase();
  const qClass = ($("#fClass").value || "").trim();
  const start = parseDateISO($("#fStart").value);
  const end = parseDateISO($("#fEnd").value);

  const filtered = state.rawRows.filter(r => {
    if (qName && !r.Nama.toLowerCase().includes(qName)) return false;
    if (qClass && r.Kelas !== qClass) return false;
    if (!isWithin(r.dateObj, start, end)) return false;
    return true;
  });

  state.rows = filtered;
  renderTable(filtered);
  renderChartByClass(filtered);
  $("#rowCount").textContent = String(filtered.length);
}

function renderTable(rows) {
  const body = $("#dataBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="4">Tiada data untuk filter ini.</td></tr>`;
    return;
  }

  // sort by date desc
  const sorted = [...rows].sort((a,b) => (b.dateObj?.getTime()||0) - (a.dateObj?.getTime()||0));
  body.innerHTML = sorted.slice(0, 300).map(r => {
    const badge = r.isHadir
      ? `<span class="px-2 py-1 rounded-full text-xs bg-emerald-600/10 text-emerald-600">Hadir</span>`
      : `<span class="px-2 py-1 rounded-full text-xs bg-rose-500/10 text-rose-400">Tidak Hadir</span>`;
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-950">
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(r.Tarikh)}</td>
        <td class="px-4 py-3">${escapeHtml(r.Nama)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(r.Kelas)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${badge}</td>
      </tr>
    `;
  }).join("");

  if (sorted.length > 300) {
    body.innerHTML += `<tr><td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="4">Paparan dihadkan 300 rekod (untuk laju). Guna filter untuk kecilkan.</td></tr>`;
  }
}

function computeKPI(rows) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);

  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const countHadir = (arr) => arr.filter(r => r.isHadir).length;
  const countTotal = (arr) => arr.length;

  const todayRows = rows.filter(r => isWithin(r.dateObj, todayStart, todayEnd));
  const weekRows = rows.filter(r => isWithin(r.dateObj, weekStart, weekEnd));
  const monthRows = rows.filter(r => isWithin(r.dateObj, monthStart, monthEnd));

  $("#kpiToday").textContent = `${countHadir(todayRows)} / ${countTotal(todayRows) || 0}`;
  $("#kpiWeek").textContent = `${countHadir(weekRows)} / ${countTotal(weekRows) || 0}`;
  $("#kpiMonth").textContent = `${countHadir(monthRows)} / ${countTotal(monthRows) || 0}`;

  const allTotal = countTotal(rows);
  const allHadir = countHadir(rows);
  $("#kpiAllPct").textContent = allTotal ? formatPct(allHadir / allTotal) : "—";

  // monthly chart (hadir vs tidak hadir)
  const hadirM = countHadir(monthRows);
  const tidakM = monthRows.filter(r => r.isTidakHadir || !r.isHadir).length;

  $("#chartNote").textContent = `Bulan ini: ${hadirM} hadir, ${tidakM} tidak hadir`;
  renderMonthlyChart(hadirM, tidakM);
}

function renderMonthlyChart(hadir, tidak) {
  const ctx = $("#chartMonthly");
  if (state.charts.monthly) state.charts.monthly.destroy();

  state.charts.monthly = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Hadir", "Tidak Hadir"],
      datasets: [{
        label: "Bilangan",
        data: [hadir, tidak]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderChartByClass(rows) {
  const ctx = $("#chartByClass");
  if (!ctx) return;

  const counts = {};
  rows.forEach(r => {
    if (!r.Kelas) return;
    if (!counts[r.Kelas]) counts[r.Kelas] = { hadir: 0 };
    if (r.isHadir) counts[r.Kelas].hadir += 1;
  });

  const labels = Object.keys(counts).sort();
  const data = labels.map(k => counts[k].hadir);

  if (state.charts.byClass) state.charts.byClass.destroy();
  state.charts.byClass = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Hadir",
        data
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ======================
   ANNOUNCEMENTS
====================== */
function readAnnReadIds() {
  try { return JSON.parse(localStorage.getItem("ann_read") || "[]"); }
  catch { return []; }
}
function setAnnReadIds(ids) {
  localStorage.setItem("ann_read", JSON.stringify(ids));
}
function isAnnActive(a, now = new Date()) {
  const start = parseDateISO(a.start_date);
  const end = parseDateISO(a.end_date);
  // end_date inclusive
  const endInc = end ? new Date(end.getTime() + 24*60*60*1000 - 1) : null;
  if (start && now < start) return false;
  if (endInc && now > endInc) return false;
  return true;
}

async function loadAnnouncements() {
  const url = window.PORTAL_CONFIG?.ANN_URL || "./data/announcements.json";
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  const now = new Date();
  const active = (data || []).filter(a => isAnnActive(a, now))
    .sort((a,b) => (parseDateISO(b.start_date)?.getTime()||0) - (parseDateISO(a.start_date)?.getTime()||0));

  state.ann = active;
  renderAnnouncements();
  renderAnnPreview();
  updateAnnBadges();
}

function updateAnnBadges() {
  const readIds = new Set(readAnnReadIds());
  const unread = state.ann.filter(a => !readIds.has(a.id)).length;

  const badge = $("#annBadge");
  const dot = $("#bellDot");
  if (unread > 0) {
    badge.classList.remove("hidden");
    badge.textContent = String(unread);
    dot.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
    dot.classList.add("hidden");
  }
}

function renderAnnouncements() {
  const box = $("#annList");
  if (!box) return;

  if (!state.ann.length) {
    box.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400">Tiada pengumuman aktif.</div>`;
    return;
  }

  const readIds = new Set(readAnnReadIds());

  box.innerHTML = state.ann.map(a => {
    const isRead = readIds.has(a.id);
    return `
      <div class="rounded-2xl p-4 border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(a.start_date || "")}</div>
            <div class="font-semibold truncate">${escapeHtml(a.title || "")}</div>
          </div>
          <button class="px-3 py-1 rounded-xl text-xs border border-slate-200 hover:bg-white dark:border-slate-800 dark:hover:bg-slate-900"
                  data-annread="${escapeHtml(a.id)}">
            ${isRead ? "Dibaca" : "Tanda Baca"}
          </button>
        </div>
        ${a.note ? `<div class="mt-2 text-sm text-slate-700 dark:text-slate-200">${escapeHtml(a.note)}</div>` : ""}
        ${a.url ? `<div class="mt-2"><a class="text-sm text-emerald-600 hover:underline" target="_blank" rel="noopener" href="${escapeHtml(a.url)}">Buka pautan</a></div>` : ""}
      </div>
    `;
  }).join("");

  // bind buttons
  box.querySelectorAll("[data-annread]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-annread");
      const ids = new Set(readAnnReadIds());
      ids.add(id);
      setAnnReadIds([...ids]);
      renderAnnouncements();
      renderAnnPreview();
      updateAnnBadges();
    });
  });
}

function renderAnnPreview() {
  const box = $("#annPreview");
  if (!box) return;

  if (!state.ann.length) {
    box.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400">Tiada pengumuman aktif.</div>`;
    return;
  }

  const readIds = new Set(readAnnReadIds());
  const top = state.ann.slice(0, 4);

  box.innerHTML = top.map(a => {
    const unread = !readIds.has(a.id);
    return `
      <div class="rounded-2xl p-3 border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(a.start_date || "")}</div>
            <div class="text-sm font-semibold truncate">${escapeHtml(a.title || "")}</div>
          </div>
          ${unread ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white">BARU</span>` : ""}
        </div>
        ${a.note ? `<div class="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">${escapeHtml(a.note)}</div>` : ""}
      </div>
    `;
  }).join("");
}

/* ======================
   INIT
====================== */
async function init() {
  // Theme + sidebar persisted
  const savedCollapsed = localStorage.getItem("sidebarCollapsed") === "1";
  setSidebarCollapsed(savedCollapsed);
  setTheme(true);

  // Click handlers
  $("#btnTheme").addEventListener("click", toggleTheme);

  $("#btnSidebar").addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
  $("#btnSidebarMobile").addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));

  document.querySelectorAll(".navItem").forEach(a => {
    a.addEventListener("click", () => setView(a.getAttribute("data-view")));
  });
  document.querySelectorAll("[data-viewlink]").forEach(b => {
    b.addEventListener("click", () => setView(b.getAttribute("data-viewlink")));
  });

  $("#btnBell").addEventListener("click", () => setView("ann"));
  $("#btnMarkAllRead").addEventListener("click", () => {
    const ids = state.ann.map(a => a.id);
    setAnnReadIds(ids);
    renderAnnouncements();
    renderAnnPreview();
    updateAnnBadges();
  });

  // Data filters events
  ["#fName", "#fClass", "#fStart", "#fEnd"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
    $(id).addEventListener("change", applyFilters);
  });

  $("#btnClear").addEventListener("click", () => {
    $("#fName").value = "";
    $("#fClass").value = "";
    $("#fStart").value = "";
    $("#fEnd").value = "";
    applyFilters();
  });

  $("#btnReload").addEventListener("click", async () => {
    await reloadAll();
  });

  // Load announcements + csv
  await reloadAll();

  // Default view
  setView("home");
}

async function reloadAll() {
  try {
    // announcements
    await loadAnnouncements();
  } catch (e) {
    console.error(e);
    const box = $("#annList");
    if (box) box.innerHTML = `<div class="text-sm text-rose-400">Gagal load pengumuman. Semak fail announcements.json</div>`;
  }

  try {
    // csv
    const rows = await loadCSV();
    populateClassDropdown(rows);
    state.rows = rows;

    // initial KPIs based on all rows
    computeKPI(rows);

    // initial table based on all rows
    renderTable(rows);
    $("#rowCount").textContent = String(rows.length);

    // initial by class chart uses filtered (current filter) so call applyFilters
    applyFilters();
  } catch (e) {
    console.error(e);
    $("#dataBody").innerHTML = `<tr><td class="px-4 py-4 text-rose-400" colspan="4">
      Gagal load CSV. Pastikan fail ./data/kehadiran.csv wujud atau PORTAL_CONFIG.CSV_URL betul.
    </td></tr>`;
  }
}

init();
