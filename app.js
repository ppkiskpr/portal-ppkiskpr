const $ = q => document.querySelector(q);
let rows = [], chartGender;

// =======================
// PARSE TARIKH (SMART)
// =======================
function parseDateSmart(s) {
  if (!s) return null;

  // Jika format DD/MM/YYYY
  if (s.includes("/")) {
    const [dd, mm, yyyy] = s.split("/").map(Number);
    if (yyyy && mm && dd) return new Date(yyyy, mm - 1, dd);
  }

  // Jika format YYYY-MM-DD
  if (s.includes("-")) {
    const d = new Date(s + "T00:00:00");
    if (!isNaN(d)) return d;
  }

  return null;
}

// =======================
// LOAD CSV
// =======================
function loadCSV() {
  Papa.parse(window.PORTAL_CONFIG.CSV_URL, {
    download: true,
    header: true,
    complete: r => {
      rows = r.data.map(x => {
        const d = parseDateSmart(x.Tarikh);
        return {
          tarikhRaw: x.Tarikh,
          nama: x["Nama Murid"],
          kelas: x.Kelas,
          status: x.Status,
          jantina: x.Jantina,
          hadir: String(x.Status).toLowerCase() === "hadir",
          date: d
        };
      }).filter(x => x.nama && x.date);

      initUI();
    }
  });
}

// =======================
// INIT UI
// =======================
function initUI() {
  const cls = [...new Set(rows.map(r => r.kelas))];
  $("#classPick").innerHTML =
    '<option value="">Semua Kelas</option>' +
    cls.map(c => `<option>${c}</option>`).join("");

  const now = new Date();
  $("#monthPick").value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  $("#monthPick").onchange = renderAll;
  $("#classPick").onchange = renderAll;
  $("#btnPDF").onclick = exportPDF;

  renderAll();
}

// =======================
// MAIN RENDER
// =======================
function renderAll() {
  const [y, m] = $("#monthPick").value.split("-").map(Number);
  const cls = $("#classPick").value;

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const data = rows.filter(r =>
    r.date >= start &&
    r.date <= end &&
    (cls === "" || r.kelas === cls)
  );

  renderKPI(data);
  renderGender(data);
  renderRanking(data);
}

// =======================
// KPI
// =======================
function renderKPI(d) {
  const murid = [...new Set(d.map(x => x.nama))];
  const L = d.filter(x => x.jantina === "Lelaki").length;
  const P = d.filter(x => x.jantina === "Perempuan").length;
  const pct = d.length
    ? Math.round(d.filter(x => x.hadir).length / d.length * 100)
    : 0;

  $("#kpiTotal").textContent = murid.length;
  $("#kpiL").textContent = L;
  $("#kpiP").textContent = P;
  $("#kpiPct").textContent = pct + "%";
}

// =======================
// GRAF JANTINA
// =======================
function renderGender(d) {
  const L = d.filter(x => x.jantina === "Lelaki").length;
  const P = d.filter(x => x.jantina === "Perempuan").length;

  if (chartGender) chartGender.destroy();
  chartGender = new Chart($("#chartGender"), {
    type: "bar",
    data: {
      labels: ["Lelaki", "Perempuan"],
      datasets: [{ data: [L, P] }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

// =======================
// RANKING MURID
// =======================
function renderRanking(d) {
  const map = {};
  d.forEach(x => {
    if (!map[x.nama]) map[x.nama] = { n: x.nama, k: x.kelas, t: 0, h: 0 };
    map[x.nama].t++;
    if (x.hadir) map[x.nama].h++;
  });

  const list = Object.values(map)
    .map(x => ({ ...x, p: Math.round(x.h / x.t * 100) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 10);

  $("#rankBody").innerHTML = list.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${x.n}</td>
      <td>${x.k}</td>
      <td>${x.p}%</td>
    </tr>
  `).join("");
}

// =======================
// EXPORT PDF
// =======================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.text("Laporan Kehadiran PPKI", 10, 10);
  pdf.text("Bulan: " + $("#monthPick").value, 10, 18);
  pdf.text("Kelas: " + ($("#classPick").value || "Semua"), 10, 26);

  pdf.text("Jumlah Murid: " + $("#kpiTotal").textContent, 10, 38);
  pdf.text("Lelaki: " + $("#kpiL").textContent, 10, 46);
  pdf.text("Perempuan: " + $("#kpiP").textContent, 10, 54);
  pdf.text("% Kehadiran: " + $("#kpiPct").textContent, 10, 62);

  pdf.text("Ranking Murid:", 10, 74);
  let y = 82;
  document.querySelectorAll("#rankBody tr").forEach(r => {
    pdf.text(r.innerText.replace(/\s+/g, " | "), 10, y);
    y += 8;
  });

  pdf.save("Laporan_PPKI.pdf");
}

// =======================
loadCSV();
