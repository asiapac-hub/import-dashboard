const DATA_URL = 'data/importaciones_data.csv';
const SUMMARY_URL = 'data/importaciones_summary.json';

const state = { raw: [], filtered: [], page: 1, pageSize: 50, charts: {} };

const numericFields = ['20','40','CONT','TEUS_FCL','TEUS_LCL','20_FT_IC','20_FT_OT','20_FT_TEMP_CONT','20_FT_OTROS','40_FT_IC','40_FT_OT','40_FT_NOR','40_FT_TEMP_CONT','40_FT_OTROS'];
const filters = [
  ['filterMes','MES'], ['filterTipoDespacho','TIPO DESPACHO'], ['filterPuertoEcuador','PUERTO ECUADOR'],
  ['filterPuertoOrigen','PUERTO ORIGEN'], ['filterPaisOrigen','PAIS ORIGEN'], ['filterRegionOrigen','REGION ORIGEN'],
  ['filterProvincia','PROVINCIA EMPRESA ECUADOR'], ['filterCommodity','COMMODITY'], ['filterTransporte','EMPRESA DE TRANSPORTE'],
  ['filterFfwOrigen','FREIGHT FORWARDER ORIGEN'], ['filterFfwDestino','FREIGHT FORWARDER DESTINO'], ['filterIncoterm','INCOTERM']
];

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const moneySafe = (v) => Number.isFinite(v) ? fmt.format(v) : '0';
const clean = (v) => (v ?? '').toString().trim() || '(en blanco)';
const num = (v) => Number(String(v ?? 0).replace(/,/g,'')) || 0;

async function init(){
  await fetch(SUMMARY_URL).catch(() => null);
  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: ({ data }) => {
      state.raw = data.map(row => {
        numericFields.forEach(f => row[f] = num(row[f]));
        return row;
      });
      state.filtered = [...state.raw];
      populateFilters();
      bindEvents();
      renderAll();
      document.getElementById('loading').style.display = 'none';
    },
    error: err => {
      document.querySelector('.loader-card p').textContent = 'Error cargando data: ' + err.message;
    }
  });
}

function populateFilters(){
  filters.forEach(([id, field]) => {
    const el = document.getElementById(id);
    const values = [...new Set(state.raw.map(r => clean(r[field])))].sort((a,b) => String(a).localeCompare(String(b), 'es', { numeric:true }));
    el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  });
}

function bindEvents(){
  filters.forEach(([id]) => document.getElementById(id).addEventListener('change', applyFilters));
  ['searchEmpresaEcuador','searchEmpresaExterior'].forEach(id => document.getElementById(id).addEventListener('input', debounce(applyFilters, 180)));
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  document.getElementById('resetFiltersTop').addEventListener('click', resetFilters);
  document.getElementById('downloadCsv').addEventListener('click', downloadCurrentCsv);
  document.getElementById('pageSize').addEventListener('change', e => { state.pageSize = Number(e.target.value); state.page = 1; renderTable(); });
  document.getElementById('prevPage').addEventListener('click', () => { if(state.page > 1){ state.page--; renderTable(); } });
  document.getElementById('nextPage').addEventListener('click', () => { const max = Math.ceil(state.filtered.length/state.pageSize); if(state.page < max){ state.page++; renderTable(); } });
  document.getElementById('toggleFilters').addEventListener('click', () => toggleFilters(true));
  document.getElementById('showFilters').addEventListener('click', () => toggleFilters(false));
}

function toggleFilters(hide){
  document.getElementById('filterPanel').classList.toggle('hidden', hide);
  document.querySelector('.layout').classList.toggle('filters-collapsed', hide);
}

function resetFilters(){
  filters.forEach(([id]) => [...document.getElementById(id).options].forEach(o => o.selected = false));
  document.getElementById('searchEmpresaEcuador').value = '';
  document.getElementById('searchEmpresaExterior').value = '';
  applyFilters();
}

function selectedValues(id){ return [...document.getElementById(id).selectedOptions].map(o => o.value); }

function applyFilters(){
  const selected = filters.map(([id, field]) => [field, selectedValues(id)]).filter(([,v]) => v.length);
  const empresaEc = document.getElementById('searchEmpresaEcuador').value.trim().toLowerCase();
  const empresaExt = document.getElementById('searchEmpresaExterior').value.trim().toLowerCase();

  state.filtered = state.raw.filter(row => {
    for (const [field, values] of selected){ if(!values.includes(clean(row[field]))) return false; }
    if(empresaEc && !clean(row['EMPRESA ECUADOR']).toLowerCase().includes(empresaEc)) return false;
    if(empresaExt && !clean(row['EMPRESA EXTERIOR']).toLowerCase().includes(empresaExt)) return false;
    return true;
  });
  state.page = 1;
  renderAll();
}

function renderAll(){ renderKpis(); renderCharts(); renderTable(); }

function renderKpis(){
  setText('kpiRegistros', moneySafe(state.filtered.length));
  setText('kpiCont', sum('CONT'));
  setText('kpi20', sum('20'));
  setText('kpi40', sum('40'));
  setText('kpiTeusFcl', sum('TEUS_FCL'));
  setText('kpiTeusLcl', sum('TEUS_LCL'));
}
function sum(field){ return moneySafe(state.filtered.reduce((acc,r) => acc + num(r[field]), 0)); }
function setText(id, value){ document.getElementById(id).textContent = value; }

function groupBy(field, metric='TEUS_FCL', limit=10){
  const map = new Map();
  state.filtered.forEach(r => map.set(clean(r[field]), (map.get(clean(r[field])) || 0) + num(r[metric])));
  return [...map.entries()].sort((a,b) => b[1]-a[1]).slice(0, limit);
}
function renderCharts(){
  renderBar('chartMes', groupBy('MES','TEUS_FCL',12), 'TEUS FCL');
  renderBar('chartPais', groupBy('PAIS ORIGEN','TEUS_FCL',10), 'TEUS FCL');
  renderBar('chartCommodity', groupBy('COMMODITY','TEUS_FCL',10), 'TEUS FCL');
  renderBar('chartFfw', groupBy('FREIGHT FORWARDER DESTINO','TEUS_FCL',10), 'TEUS FCL');
}
function renderBar(canvasId, pairs, label){
  const ctx = document.getElementById(canvasId);
  if(state.charts[canvasId]) state.charts[canvasId].destroy();
  state.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: pairs.map(p => p[0]), datasets: [{ label, data: pairs.map(p => p[1]), backgroundColor: '#FC4A1D', borderRadius: 8 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c => `${label}: ${moneySafe(c.raw)}`}}}, scales:{ x:{ticks:{maxRotation:45,minRotation:0}}, y:{beginAtZero:true,ticks:{callback:v => moneySafe(v)}} } }
  });
}

function renderTable(){
  const tbody = document.querySelector('#dataTable tbody');
  const start = (state.page - 1) * state.pageSize;
  const rows = state.filtered.slice(start, start + state.pageSize);
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(clean(r['MES']))}</td>
      <td>${escapeHtml(clean(r['EMPRESA ECUADOR']))}</td>
      <td>${escapeHtml(clean(r['EMPRESA EXTERIOR']))}</td>
      <td>${escapeHtml(clean(r['PUERTO ECUADOR']))}</td>
      <td>${escapeHtml(clean(r['PUERTO ORIGEN']))}</td>
      <td>${escapeHtml(clean(r['PAIS ORIGEN']))}</td>
      <td>${escapeHtml(clean(r['COMMODITY']))}</td>
      <td>${escapeHtml(clean(r['EMPRESA DE TRANSPORTE']))}</td>
      <td>${escapeHtml(clean(r['FREIGHT FORWARDER DESTINO']))}</td>
      <td>${escapeHtml(clean(r['TIPO DESPACHO']))}</td>
      <td class="numeric">${moneySafe(num(r['20']))}</td>
      <td class="numeric">${moneySafe(num(r['40']))}</td>
      <td class="numeric">${moneySafe(num(r['CONT']))}</td>
      <td class="numeric">${moneySafe(num(r['TEUS_FCL']))}</td>
      <td class="numeric">${moneySafe(num(r['TEUS_LCL']))}</td>
    </tr>`).join('');
  const max = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  setText('tableCount', `${moneySafe(state.filtered.length)} registros visibles`);
  setText('pageInfo', `Página ${state.page} de ${max}`);
  document.getElementById('prevPage').disabled = state.page <= 1;
  document.getElementById('nextPage').disabled = state.page >= max;
}

function downloadCurrentCsv(){
  const fields = ['MES','EMPRESA ECUADOR','EMPRESA EXTERIOR','PUERTO ECUADOR','PUERTO ORIGEN','PAIS ORIGEN','REGION ORIGEN','PROVINCIA EMPRESA ECUADOR','COMMODITY','EMPRESA DE TRANSPORTE','FREIGHT FORWARDER ORIGEN','FREIGHT FORWARDER DESTINO','TIPO DESPACHO','INCOTERM','20','40','CONT','TEUS_FCL','TEUS_LCL'];
  const csv = Papa.unparse(state.filtered.map(r => Object.fromEntries(fields.map(f => [f, r[f] ?? '']))));
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vista_importaciones_ecuador.csv'; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function debounce(fn, wait){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

init();
