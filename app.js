const $ = q => document.querySelector(q);

const state = {
  raw: [],
  trendMode: "pct",
  charts: { gender: null, genderByClass: null, trend: null }
};

// ---- THEME
function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains("dark");
  $("#btnTheme").innerHTML = isDark
    ? '<i data-lucide="sun" class="h-5 w-5"></i>'
    : '<i data-lucide="moon" class="h-5 w-5"></i>';
  lucide.createIcons();
}
function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", !isDark);
  updateThemeIcon();
}

// ---- DATE PARSER: support 02/03/2025 AND 2025-03-02
function parseDateSmart(s) {
  if (!s) return null;
  const str = String(s).trim();

  // DD/MM/YYYY
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/").map(n => parseInt(n, 10));
    if (yyyy && mm && dd) return new Date(yyyy, mm - 1, dd);
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
  return ""; // unknown
}

function normStatus(x) {
  const s = String(x || "").trim().toLowerCase();
  if (s === "hadir" || s === "present") return "Hadir";
  if (s === "tidak hadir" || s === "tidakhadir" || s === "absent" || s === "x hadir") return "Tidak Hadir";
  return s ? x : "";
}

function normalizeRow(r) {
  const Tarikh = r.Tarikh ?? r.tarikh ?? r.TARIKH;
  const Kelas = r.Kelas ?? r.kelas ?? r.KELAS;
  const Nama = r["Nama Murid"] ?? r["Nama_Murid"] ?? r.Nama ?? r.nama ?? r["NAMA MURID"];
  const Status = r.Status ?? r.status ?? r.STATUS;
  const Jantina = r.Jantina ?? r.jantina ?? r.JANTINA;

  const dateObj = parseDateSmart(Tarikh);
  const statusNorm = normStatus(Status);
  const isHadir = String(statusNorm).toLowerCase() === "hadir";
  const isTidak = !isHadir && !!statusNorm;

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

async function loadCSV() {
  const url = (window.PORTAL_CONFIG?.CSV_URL && String(window.PORTAL_CONFIG.CSV_URL).trim())
    ? String(window.PORTAL_CONFIG.CSV_URL).trim()
    : "./data/kehadiran.csv";

  $("#csvSourceText").textContent = url;

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data || [])
          .map(normalizeRow)
          .filter(x => x.nama && x.kelas && x.dateObj);

        state.raw = rows;
        resolve(rows);
      },
      error: reject
    });
  });
}

function ymFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getMonthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  start.setHours(0,0,0,0);
  const end = new Date(y, m, 0);
  end.setHours(23,59,59,999);
  return { start, end };
}

function getDaysInMonth(range) {
  const days = [];
  const d = new Date(range.start);
  d.setHours(0,0,0,0);
  while (d <= range.end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function uniqueMurid(rows) {
  // Unique by Nama + Kelas (lebih selamat)
  const set = new Set(rows.map(r => `${r.nama}|||${r.kelas}`));
  return set.size;
}

function setWarn(show) {
  $("#warnBox").classList.toggle("hidden", !show);
}

function populateClassDropdown(rows) {
  const classes = Array.from(new Set(rows.map(r => r.kelas))).sort();
  $("#classPick").innerHTML = `<option value="">Semua Kelas</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");
}

function autoSetMonthToLatest(rows) {
  // Ambil tarikh paling baru dalam data
  let max = null;
  for (const r of rows) {
    if (!max || r.dateObj > max) max = r.dateObj;
  }
  const latestYM = max ? ymFromDate(max) : ymFromDate(new Date());
  $("#monthPick").value = latestYM;
}

function filterByMonthClass(rows) {
  const ym = $("#monthPick").value;
  const cls = $("#classPick").value;
  const range = getMonthRange(ym);

  const filtered = rows.filter(r =>
    r.dateObj >= range.start &&
    r.dateObj <= range.end &&
    (!cls || r.kelas === cls)
  );

  return { filtered, range, cls };
}

function renderKPI(rows) {
  const totalRekod = rows.length;
  const totalMurid = uniqueMurid(rows);

  const L = rows.filter(r => r.jantina === "Lelaki").length;
  const P = rows.filter(r => r.jantina === "Perempuan").length;

  const hadir = rows.filter(r => r.isHadir).length;
  const pct = totalRekod ? (hadir / totalRekod * 100) : 0;

  $("#kpiMurid").textContent = String(totalMurid);
  $("#kpiRekod").textContent = String(totalRekod);
  $("#kpiL").textContent = String(L);
  $("#kpiP").textContent = String(P);
  $("#kpiPct").textContent = totalRekod ? `${pct.toFixed(1)}%` : "—";
}

function renderGenderChart(rows) {
  const L = rows.filter(r => r.jantina === "Lelaki").length;
  const P = rows.filter(r => r.jantina === "Perempuan").length;

  if (state.charts.gender) state.charts.gender.destroy();
  state.charts.gender = new Chart($("#chartGender"), {
    type: "bar",
    data: { labels: ["Lelaki", "Perempuan"], datasets: [{ label: "Bilangan Rekod", data: [L, P] }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
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
    data: {
      labels,
      datasets: [
        { label: "Lelaki", data: dataL },
        { label: "Perempuan", data: dataP }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

function renderTrend(rows, range) {
  const days = getDaysInMonth(range);
  const dayMap = new Map();
  days.forEach(d => dayMap.set(d.toISOString().slice(0,10), { hadir: 0, total: 0 }));

  rows.forEach(r => {
    const key = r.dateObj.toISOString().slice(0,10);
    if (!dayMap.has(key)) return;
    const v = dayMap.get(key);
    v.total++;
    if (r.isHadir) v.hadir++;
  });

  const labels = days.map(d => String(d.getDate())); // 1..31

  let data;
  let yMax = 100;
  let label = "% Kehadiran";

  if (state.trendMode === "hadir") {
    label = "Hadir";
    yMax = undefined;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? v.hadir : 0;
    });
  } else if (state.trendMode === "tidak") {
    label = "Tidak Hadir";
    yMax = undefined;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? (v.total - v.hadir) : 0;
    });
  } else {
    label = "% Kehadiran";
    yMax = 100;
    data = days.map(d => {
      const v = dayMap.get(d.toISOString().slice(0,10));
      return v.total ? +(v.hadir / v.total * 100).toFixed(1) : null; // gap if no data
    });
  }

  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart($("#chartTrend"), {
    type: "line",
    data: { labels, datasets: [{ label, data, tension: 0.25, spanGaps: false }] },
    options: {
      responsive: true,
      scales: {
        y: yMax ? { beginAtZero: true, max: yMax } : { beginAtZero: true }
      }
    }
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

  if (!top.length) {
    body.innerHTML = `<tr><td colspan="3" class="py-2 text-slate-500 dark:text-slate-400">Tiada data</td></tr>`;
    return;
  }

  body.innerHTML = top.map(x => `
    <tr class="hover:bg-white/60 dark:hover:bg-slate-900/40">
      <td class="py-2">${x.nama}</td>
      <td class="py-2">${x.kelas}</td>
      <td class="py-2 font-semibold">${x.cnt}</td>
    </tr>
  `).join("");
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
    .map(x => ({ ...x, pct: x.total ? (x.hadir / x.total * 100) : 0 }))
    .sort((a,b) => b.pct - a.pct)
    .slice(0,10);

  const body = $("#rankBody");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="4" class="py-2 text-slate-500 dark:text-slate-400">Tiada data</td></tr>`;
    return;
  }

  body.innerHTML = list.map((x,i) => `
    <tr class="hover:bg-white/60 dark:hover:bg-slate-900/40">
      <td class="py-2">${i+1}</td>
      <td class="py-2">${x.nama}</td>
      <td class="py-2">${x.kelas}</td>
      <td class="py-2 font-semibold">${x.pct.toFixed(1)}%</td>
    </tr>
  `).join("");
}

function exportPDF(summary) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const school = window.PORTAL_CONFIG?.SCHOOL_NAME || "PPKI";
  const ym = $("#monthPick").value;
  const cls = $("#classPick").value || "Semua Kelas";

  pdf.setFontSize(14);
  pdf.text(`Laporan Bulanan Kehadiran`, 10, 12);
  pdf.setFontSize(11);
  pdf.text(`${school}`, 10, 20);
  pdf.text(`Bulan: ${ym} | Kelas: ${cls}`, 10, 28);

  pdf.text(`Jumlah Murid (unik): ${summary.murid}`, 10, 40);
  pdf.text(`Jumlah Rekod: ${summary.rekod}`, 10, 48);
  pdf.text(`Lelaki: ${summary.L} | Perempuan: ${summary.P}`, 10, 56);
  pdf.text(`% Kehadiran: ${summary.pct}`, 10, 64);

  pdf.text(`Ranking Top 10 (% Kehadiran):`, 10, 76);
  let y = 84;
  const rows = Array.from(document.querySelectorAll("#rankBody tr"));
  rows.forEach(tr => {
    const t = tr.innerText.replace(/\s+/g, " | ");
    if (y > 280) return;
    pdf.text(t, 10, y);
    y += 7;
  });

  pdf.save(`Laporan_${ym}_${cls.replace(/\s+/g,"_")}.pdf`);
}

function renderAll() {
  const { filtered, range } = filterByMonthClass(state.raw);

  setWarn(filtered.length === 0);

  renderKPI(filtered);
  renderGenderChart(filtered);
  renderGenderByClass(filtered);
  renderTrend(filtered, range);
  renderTopAbsent(filtered);
  renderRanking(filtered);

  // return summary for PDF
  const murid = uniqueMurid(filtered);
  const rekod = filtered.length;
  const L = filtered.filter(r => r.jantina === "Lelaki").length;
  const P = filtered.filter(r => r.jantina === "Perempuan").length;
  const hadir = filtered.filter(r => r.isHadir).length;
  const pct = rekod ? `${(hadir/rekod*100).toFixed(1)}%` : "—";

  return { murid, rekod, L, P, pct };
}

async function init() {
  $("#btnTheme").addEventListener("click", toggleTheme);
  updateThemeIcon();

  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-view");
      $("#view-dashboard").classList.toggle("hidden", v !== "dashboard");
      $("#view-data").classList.toggle("hidden", v !== "data");
      $("#pageTitle").textContent = v === "dashboard" ? "Dashboard Kehadiran" : "Data (CSV)";
      $("#pageSub").textContent = v === "dashboard" ? "Ringkasan Bulanan, Ranking, Jantina" : "Paparan ringkas";
    });
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest(".trendBtn");
    if (!t) return;
    state.trendMode = t.dataset.mode;
    document.querySelectorAll(".trendBtn").forEach(b => b.classList.remove("bg-emerald-600","text-white"));
    t.classList.add("bg-emerald-600","text-white");
    renderAll();
  });

  const rows = await loadCSV();

  $("#schoolNameSide").textContent = window.PORTAL_CONFIG?.SCHOOL_NAME || "PPKI";

  populateClassDropdown(rows);
  autoSetMonthToLatest(rows); // ✅ ini yang elak “kosong” bila data bukan bulan semasa

  $("#monthPick").addEventListener("change", renderAll);
  $("#classPick").addEventListener("change", renderAll);

  // set default active toggle %
  document.querySelectorAll(".trendBtn")[0]?.classList.add("bg-emerald-600","text-white");

  $("#btnPDF").addEventListener("click", () => {
    const summary = renderAll();
    exportPDF(summary);
  });

  renderAll();
}

init().catch(err => {
  console.error(err);
  setWarn(true);
});
