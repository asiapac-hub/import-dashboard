const DATA_URL = 'data/importaciones_data.csv';

const state = {
  raw: [],
  filtered: [],
  charts: {},
  groupFields: ['EMPRESA ECUADOR','PAIS ORIGEN','PUERTO ORIGEN','COMMODITY'],
  maxRows: 100
};

const numericFields = ['20','40','CONT','TEUS_FCL','TEUS_LCL','40_FT_TEMP_CONT'];
const filters = [
  ['filterMes','MES'],
  ['filterPuertoEcuador','PUERTO ECUADOR'],
  ['filterPuertoOrigen','PUERTO ORIGEN'],
  ['filterPaisOrigen','PAIS ORIGEN'],
  ['filterCommodity','COMMODITY'],
  ['filterTransporte','EMPRESA DE TRANSPORTE'],
  ['filterFfwOrigen','FREIGHT FORWARDER ORIGEN'],
  ['filterFfwDestino','FREIGHT FORWARDER DESTINO'],
  ['filterTipoDespacho','TIPO DESPACHO'],
  ['filterIncoterm','INCOTERM']
];

const availableGroupFields = [
  'EMPRESA ECUADOR','EMPRESA EXTERIOR','PUERTO ECUADOR','PUERTO ORIGEN','PAIS ORIGEN','COMMODITY',
  'EMPRESA DE TRANSPORTE','FREIGHT FORWARDER ORIGEN','FREIGHT FORWARDER DESTINO','TIPO DESPACHO','INCOTERM','CARGA REFRIGERADA'
];

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const palette = ['#FC4A1D','#393E4D','#585D6C','#8a909b','#ff7955','#2f3440'];

const clean = v => (v ?? '').toString().trim() || '(en blanco)';
const num = v => Number(String(v ?? 0).replace(/,/g,'')) || 0;
const nfmt = v => fmt.format(Number.isFinite(v) ? v : 0);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

Papa.parse(DATA_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  complete: ({ data }) => {
    state.raw = data.map(row => {
      numericFields.forEach(f => row[f] = num(row[f]));
      row['CARGA REFRIGERADA'] = num(row['40_FT_TEMP_CONT']) > 0 ? 'Sí' : 'No';
      row['20GP_DASH'] = num(row['20']);
      row['40RF_DASH'] = num(row['40_FT_TEMP_CONT']);
      row['40HC_DASH'] = Math.max(0, num(row['40']) - num(row['40_FT_TEMP_CONT']));
      row['TEUS_DASH'] = num(row['TEUS_FCL']);
      return row;
    });
    state.filtered = [...state.raw];
    populateFilters();
    bindEvents();
    renderAll();
    document.getElementById('loading').style.display = 'none';
  },
  error: err => {
    document.querySelector('#loading p').textContent = 'Error cargando datos: ' + err.message;
  }
});

function populateFilters(){
  filters.forEach(([id, field]) => {
    const el = document.getElementById(id);
    const values = [...new Set(state.raw.map(r => clean(r[field])))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
    el.innerHTML = values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  });
  renderFieldChips();
}

function bindEvents(){
  filters.forEach(([id]) => document.getElementById(id).addEventListener('change', applyFilters));
  ['filterEmpresaEcuador','filterEmpresaExterior'].forEach(id => document.getElementById(id).addEventListener('input', debounce(applyFilters, 180)));
  document.querySelectorAll('input[name="reefer"]').forEach(r => r.addEventListener('change', applyFilters));
  document.getElementById('clearFilters').addEventListener('click', resetFilters);
  document.getElementById('hideFilters').addEventListener('click', () => document.querySelector('.app-shell').classList.add('filters-hidden'));
  document.getElementById('showFilters').addEventListener('click', () => document.querySelector('.app-shell').classList.remove('filters-hidden'));
  document.getElementById('metricMode').addEventListener('change', renderTable);
  document.getElementById('downloadCsv').addEventListener('click', downloadCurrentCsv);
}

function selectedValues(id){ return [...document.getElementById(id).selectedOptions].map(o => o.value); }

function applyFilters(){
  const selected = filters.map(([id, field]) => [field, selectedValues(id)]).filter(([, values]) => values.length);
  const empresaEc = document.getElementById('filterEmpresaEcuador').value.trim().toLowerCase();
  const empresaExt = document.getElementById('filterEmpresaExterior').value.trim().toLowerCase();
  const reefer = document.querySelector('input[name="reefer"]:checked').value;

  state.filtered = state.raw.filter(row => {
    for (const [field, values] of selected){ if(!values.includes(clean(row[field]))) return false; }
    if(empresaEc && !clean(row['EMPRESA ECUADOR']).toLowerCase().includes(empresaEc)) return false;
    if(empresaExt && !clean(row['EMPRESA EXTERIOR']).toLowerCase().includes(empresaExt)) return false;
    if(reefer === 'si' && row['CARGA REFRIGERADA'] !== 'Sí') return false;
    if(reefer === 'no' && row['CARGA REFRIGERADA'] !== 'No') return false;
    return true;
  });
  renderAll();
}

function resetFilters(){
  filters.forEach(([id]) => [...document.getElementById(id).options].forEach(o => o.selected = false));
  document.getElementById('filterEmpresaEcuador').value = '';
  document.getElementById('filterEmpresaExterior').value = '';
  document.querySelector('input[name="reefer"][value="all"]').checked = true;
  applyFilters();
}

function renderAll(){ renderSummary(); renderKpis(); renderCharts(); renderTable(); }

function renderSummary(){
  const active = [];
  filters.forEach(([id, field]) => { const n = selectedValues(id).length; if(n) active.push(`${field}: ${n}`); });
  if(document.getElementById('filterEmpresaEcuador').value) active.push('EMPRESA ECUADOR: búsqueda');
  if(document.getElementById('filterEmpresaExterior').value) active.push('EMPRESA EXTERIOR: búsqueda');
  const reefer = document.querySelector('input[name="reefer"]:checked')?.value;
  if(reefer && reefer !== 'all') active.push(`CARGA REFRIGERADA: ${reefer === 'si' ? 'Sí' : 'No'}`);
  document.getElementById('filterSummary').textContent = active.length ? active.join(' · ') : 'Sin filtros';
  document.getElementById('statusText').textContent = `${nfmt(state.filtered.length)} registros visibles de ${nfmt(state.raw.length)} registros cargados.`;
}

function renderKpis(){
  setText('kpiTeus', sum('TEUS_DASH'));
  setText('kpiCont', sum('CONT'));
  setText('kpi20gp', sum('20GP_DASH'));
  setText('kpi40hc', sum('40HC_DASH'));
  setText('kpi40rf', sum('40RF_DASH'));
  setText('kpiEmpresas', nfmt(new Set(state.filtered.map(r => clean(r['EMPRESA ECUADOR']))).size));
}
function sum(field){ return nfmt(state.filtered.reduce((acc,r) => acc + num(r[field]), 0)); }
function setText(id, val){ document.getElementById(id).textContent = val; }

function groupBy(field, metric='TEUS_DASH', limit=10){
  const map = new Map();
  state.filtered.forEach(r => map.set(clean(r[field]), (map.get(clean(r[field])) || 0) + num(r[metric])));
  return [...map.entries()].sort((a,b) => b[1] - a[1]).slice(0, limit);
}

function renderCharts(){
  renderBar('chartMes', groupBy('MES','TEUS_DASH',12), 'TEUs FCL');
  renderBar('chartPais', groupBy('PAIS ORIGEN','TEUS_DASH',10), 'TEUs FCL');
  renderBar('chartCommodity', groupBy('COMMODITY','TEUS_DASH',10), 'TEUs FCL');
  renderBar('chartPuerto', groupBy('PUERTO ORIGEN','TEUS_DASH',10), 'TEUs FCL');
}

function renderBar(canvasId, pairs, label){
  const ctx = document.getElementById(canvasId);
  if(state.charts[canvasId]) state.charts[canvasId].destroy();
  state.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: pairs.map(p => p[0]), datasets: [{ label, data: pairs.map(p => p[1]), backgroundColor: '#FC4A1D', borderRadius: 8, maxBarThickness: 42 }] },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c => `${label}: ${nfmt(c.raw)}`}} },
      scales:{ x:{ ticks:{ color:'#585D6C', maxRotation:35, minRotation:0 }, grid:{display:false} }, y:{ beginAtZero:true, ticks:{ color:'#585D6C', callback:v => nfmt(v) }, grid:{color:'#edf0f4'} } }
    }
  });
}

function renderFieldChips(){
  const wrap = document.getElementById('fieldChips');
  wrap.innerHTML = state.groupFields.map(f => `<button class="chip" draggable="true" data-field="${esc(f)}">${esc(labelField(f))}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('dragstart', e => { chip.classList.add('dragging'); e.dataTransfer.setData('text/plain', chip.dataset.field); });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    chip.addEventListener('dragover', e => e.preventDefault());
    chip.addEventListener('drop', e => {
      e.preventDefault();
      const from = e.dataTransfer.getData('text/plain');
      const to = chip.dataset.field;
      const arr = [...state.groupFields];
      const fromIdx = arr.indexOf(from), toIdx = arr.indexOf(to);
      if(fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, from);
      state.groupFields = arr;
      renderFieldChips(); renderTable();
    });
  });
}

function renderTable(){
  const tbody = document.querySelector('#groupTable tbody');
  const rows = buildGroupedRows(state.filtered, state.groupFields).slice(0, state.maxRows);
  tbody.innerHTML = rows.map((r, idx) => {
    const color = palette[r.level % palette.length];
    const indent = Math.min(r.level, 4);
    return `<tr class="group-row level-${indent}">
      <td class="data-cell"><span class="swatch" style="background:${color}"></span>${esc(r.label)}</td>
      <td class="metric">${nfmt(r.v20)}</td>
      <td class="metric">${nfmt(r.v40hc)}</td>
      <td class="metric">${nfmt(r.v40rf)}</td>
      <td class="metric">${nfmt(r.teus)}</td>
    </tr>`;
  }).join('');
  document.getElementById('tableMeta').textContent = `${nfmt(rows.length)} grupos visibles, máximo ${state.maxRows} resultados`;
}

function buildGroupedRows(data, fields){
  const output = [];
  function recurse(records, level){
    if(level >= fields.length) return;
    const field = fields[level];
    const groups = new Map();
    records.forEach(r => {
      const key = clean(r[field]);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    [...groups.entries()]
      .map(([key, recs]) => ({ key, recs, totals: totals(recs) }))
      .sort((a,b) => b.totals.teus - a.totals.teus)
      .forEach(g => {
        output.push({ level, label: `${labelField(field)}: ${g.key}`, ...g.totals });
        recurse(g.recs, level + 1);
      });
  }
  recurse(data, 0);
  return output;
}

function totals(records){
  return records.reduce((acc,r) => {
    acc.v20 += num(r['20GP_DASH']);
    acc.v40hc += num(r['40HC_DASH']);
    acc.v40rf += num(r['40RF_DASH']);
    acc.teus += num(r['TEUS_DASH']);
    return acc;
  }, { v20:0, v40hc:0, v40rf:0, teus:0 });
}

function labelField(field){
  return ({
    'EMPRESA ECUADOR':'Empresa Ecuador','EMPRESA EXTERIOR':'Empresa Exterior','PUERTO ECUADOR':'Puerto Ecuador','PUERTO ORIGEN':'Puerto Origen','PAIS ORIGEN':'País Origen','COMMODITY':'Commodity','EMPRESA DE TRANSPORTE':'Empresa de Transporte','FREIGHT FORWARDER ORIGEN':'Forwarder Origen','FREIGHT FORWARDER DESTINO':'Forwarder Destino','TIPO DESPACHO':'Tipo de Despacho','INCOTERM':'Incoterm','CARGA REFRIGERADA':'Carga Refrigerada'
  })[field] || field;
}

function downloadCurrentCsv(){
  const rows = state.filtered.map(r => ({
    MES:r['MES'], 'EMPRESA ECUADOR':r['EMPRESA ECUADOR'], 'EMPRESA EXTERIOR':r['EMPRESA EXTERIOR'], 'PUERTO ECUADOR':r['PUERTO ECUADOR'], 'PUERTO ORIGEN':r['PUERTO ORIGEN'], 'PAIS ORIGEN':r['PAIS ORIGEN'], COMMODITY:r['COMMODITY'], 'EMPRESA DE TRANSPORTE':r['EMPRESA DE TRANSPORTE'], 'FREIGHT FORWARDER ORIGEN':r['FREIGHT FORWARDER ORIGEN'], 'FREIGHT FORWARDER DESTINO':r['FREIGHT FORWARDER DESTINO'], 'TIPO DESPACHO':r['TIPO DESPACHO'], INCOTERM:r['INCOTERM'], 'CARGA REFRIGERADA':r['CARGA REFRIGERADA'], '20GP':r['20GP_DASH'], '40HC':r['40HC_DASH'], '40RF':r['40RF_DASH'], TEUS:r['TEUS_DASH']
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vista_importaciones_ecuador.csv'; a.click();
  URL.revokeObjectURL(url);
}

function debounce(fn, wait){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }
