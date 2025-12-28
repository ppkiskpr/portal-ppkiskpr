const $ = q => document.querySelector(q);

const state = {
  rawRows: [],
  trendMode: "pct",
  charts: { trend: null }
};

function parseDate(s){
  const d = new Date(s+"T00:00:00");
  return isNaN(d) ? null : d;
}

function normalizeRow(r){
  return {
    Tarikh: r.Tarikh,
    Nama: r["Nama Murid"],
    Kelas: r.Kelas,
    Status: r.Status,
    dateObj: parseDate(r.Tarikh),
    isHadir: String(r.Status).toLowerCase()==="hadir",
    isTidak: String(r.Status).toLowerCase()!=="hadir"
  };
}

async function loadCSV(){
  const url = window.PORTAL_CONFIG.CSV_URL || "./data/kehadiran.csv";
  $("#csvSourceText").textContent = url;

  Papa.parse(url,{
    download:true,
    header:true,
    complete: r=>{
      state.rawRows = r.data.map(normalizeRow).filter(x=>x.dateObj);
      populateClass();
      renderAll();
    }
  });
}

function populateClass(){
  const sel=$("#cmpClass");
  const set=[...new Set(state.rawRows.map(r=>r.Kelas))];
  sel.innerHTML='<option value="">Semua Kelas</option>'+set.map(k=>`<option>${k}</option>`).join("");
}

function getMonthRange(v){
  const [y,m]=v.split("-").map(Number);
  return {
    start:new Date(y,m-1,1),
    end:new Date(y,m,0,23,59,59)
  };
}

function renderAll(){
  renderTrend();
  renderTopAbsent();
}

function renderTrend(){
  const m=$("#cmpMonth").value;
  if(!m) return;

  const cls=$("#cmpClass").value;
  const range=getMonthRange(m);

  const days=[];
  const d=new Date(range.start);
  while(d<=range.end){ days.push(new Date(d)); d.setDate(d.getDate()+1); }

  const map={};
  days.forEach(d=>map[d.toISOString().slice(0,10)]={hadir:0,total:0});

  state.rawRows
    .filter(r=>r.dateObj>=range.start && r.dateObj<=range.end)
    .filter(r=>!cls||r.Kelas===cls)
    .forEach(r=>{
      const k=r.Tarikh;
      if(map[k]){
        map[k].total++;
        if(r.isHadir) map[k].hadir++;
      }
    });

  let data;
  if(state.trendMode==="hadir") data=days.map(d=>map[d.toISOString().slice(0,10)].hadir);
  else if(state.trendMode==="tidak") data=days.map(d=>map[d.toISOString().slice(0,10)].total-map[d.toISOString().slice(0,10)].hadir);
  else data=days.map(d=>{
    const x=map[d.toISOString().slice(0,10)];
    return x.total?Math.round(x.hadir/x.total*100):null;
  });

  if(state.charts.trend) state.charts.trend.destroy();
  state.charts.trend=new Chart($("#chartDailyTrend"),{
    type:"line",
    data:{labels:days.map(d=>d.getDate()),datasets:[{label:"Trend",data}]},
    options:{scales:{y:{beginAtZero:true,max:100}}}
  });
}

function renderTopAbsent(){
  const m=$("#cmpMonth").value;
  if(!m) return;
  const cls=$("#cmpClass").value;
  const range=getMonthRange(m);

  const map={};
  state.rawRows
    .filter(r=>r.dateObj>=range.start && r.dateObj<=range.end)
    .filter(r=>!cls||r.Kelas===cls)
    .filter(r=>r.isTidak)
    .forEach(r=>{
      const k=r.Nama+"|"+r.Kelas;
      if(!map[k]) map[k]={n:r.Nama,k:r.Kelas,c:0};
      map[k].c++;
    });

  const top=Object.values(map).sort((a,b)=>b.c-a.c).slice(0,5);
  $("#topAbsentBody").innerHTML=top.length
    ? top.map(x=>`<tr><td>${x.n}</td><td>${x.k}</td><td>${x.c}</td></tr>`).join("")
    : `<tr><td colspan="3">Tiada data</td></tr>`;
}

/* EVENTS */
document.addEventListener("click",e=>{
  if(e.target.classList.contains("trendBtn")){
    state.trendMode=e.target.dataset.mode;
    renderTrend();
  }
});

$("#cmpMonth").addEventListener("change",renderAll);
$("#cmpClass").addEventListener("change",renderAll);

loadCSV();
