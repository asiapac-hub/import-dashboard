const DATA_URL = 'data/importaciones_data.csv';

const monthNames = {
  '1':'Enero','01':'Enero','2':'Febrero','02':'Febrero','3':'Marzo','03':'Marzo','4':'Abril','04':'Abril','5':'Mayo','05':'Mayo','6':'Junio','06':'Junio',
  '7':'Julio','07':'Julio','8':'Agosto','08':'Agosto','9':'Septiembre','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre'
};

const state = {
  raw: [],
  filtered: [],
  charts: {},
  groupFields: ['EMPRESA DE TRANSPORTE','FREIGHT FORWARDER DESTINO','PUERTO ORIGEN'],
  maxRows: 100
};

const numericFields = ['20','40','CONT','TEUS_FCL','TEUS_LCL','40_FT_TEMP_CONT'];
const filters = [
  ['filterMes','MES'],
  ['filterEmpresaEcuador','EMPRESA ECUADOR'],
  ['filterEmpresaExterior','EMPRESA EXTERIOR'],
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
  'EMPRESA ECUADOR','EMPRESA EXTERIOR','PUERTO ECUADOR','PUERTO ORIGEN','PAIS ORIGEN','REGION ORIGEN',
  'COMMODITY','EMPRESA DE TRANSPORTE','FREIGHT FORWARDER ORIGEN','FREIGHT FORWARDER DESTINO','INCOTERM','MES'
];

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const palette = ['#dcefe4','#eadcf2','#dce8f4','#fff0eb','#e7eaf0','#f3e7dc'];

const clean = v => (v ?? '').toString().trim() || '(en blanco)';
const num = v => Number(String(v ?? 0).replace(/,/g,'')) || 0;
const nfmt = v => fmt.format(Number.isFinite(v) ? v : 0);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const displayValue = (field, value) => field === 'MES' ? `${clean(value)}: ${monthNames[clean(value)] || clean(value)}` : clean(value);

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
  error: err => { document.querySelector('#loading p').textContent = 'Error cargando datos: ' + err.message; }
});

function populateFilters(){
  filters.forEach(([id, field]) => {
    const el = document.getElementById(id);
    const values = [...new Set(state.raw.map(r => clean(r[field])))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
    el.innerHTML = `<option value="">Todos</option>` + values.map(v => `<option value="${esc(v)}">${esc(displayValue(field, v))}</option>`).join('');
  });
  renderFieldSelector();
  renderFieldChips();
}

function bindEvents(){
  filters.forEach(([id]) => document.getElementById(id).addEventListener('change', applyFilters));
  document.querySelectorAll('input[name="reefer"]').forEach(r => r.addEventListener('change', applyFilters));
  document.getElementById('clearFilters').addEventListener('click', resetFilters);
  document.getElementById('hideFilters').addEventListener('click', () => document.querySelector('.app-shell').classList.add('filters-hidden'));
  document.getElementById('showFilters').addEventListener('click', () => document.querySelector('.app-shell').classList.remove('filters-hidden'));
  document.getElementById('metricMode').addEventListener('change', renderTable);
  document.getElementById('downloadCsv').addEventListener('click', downloadCurrentCsv);
}

function selectedValue(id){ return document.getElementById(id).value; }

function applyFilters(){
  const selected = filters.map(([id, field]) => [field, selectedValue(id)]).filter(([, value]) => value);
  const reefer = document.querySelector('input[name="reefer"]:checked').value;

  state.filtered = state.raw.filter(row => {
    for (const [field, value] of selected){ if(clean(row[field]) !== value) return false; }
    if(reefer === 'si' && row['CARGA REFRIGERADA'] !== 'Sí') return false;
    if(reefer === 'no' && row['CARGA REFRIGERADA'] !== 'No') return false;
    return true;
  });
  renderAll();
}

function resetFilters(){
  filters.forEach(([id]) => document.getElementById(id).value = '');
  document.querySelector('input[name="reefer"][value="all"]').checked = true;
  applyFilters();
}

function renderAll(){ renderSummary(); renderKpis(); renderCharts(); renderTable(); }

function renderSummary(){
  const active = [];
  filters.forEach(([id, field]) => { const v = selectedValue(id); if(v) active.push(`${field}: ${displayValue(field, v)}`); });
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
  state.filtered.forEach(r => map.set(displayValue(field, r[field]), (map.get(displayValue(field, r[field])) || 0) + num(r[metric])));
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

function renderFieldSelector(){
  const wrap = document.getElementById('fieldSelector');
  wrap.innerHTML = availableGroupFields.map(f => `
    <label class="field-check"><input type="checkbox" value="${esc(f)}" ${state.groupFields.includes(f) ? 'checked' : ''}> ${esc(labelField(f))}</label>
  `).join('');
  wrap.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      const field = input.value;
      if(input.checked && !state.groupFields.includes(field)) state.groupFields.push(field);
      if(!input.checked) state.groupFields = state.groupFields.filter(f => f !== field);
      renderFieldChips();
      renderTable();
    });
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
  const rows = state.groupFields.length ? buildGroupedRows(state.filtered, state.groupFields).slice(0, state.maxRows) : [];
  tbody.innerHTML = rows.map((r) => {
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
      const key = displayValue(field, r[field]);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    [...groups.entries()]
      .map(([key, recs]) => ({ key, recs, totals: totals(recs) }))
      .sort((a,b) => b.totals.teus - a.totals.teus)
      .forEach(g => {
        output.push({ level, label: g.key, ...g.totals });
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
    'EMPRESA ECUADOR':'EMPRESA ECUADOR','EMPRESA EXTERIOR':'EMPRESA EXTERIOR','PUERTO ECUADOR':'PUERTO ECUADOR','PUERTO ORIGEN':'PUERTO ORIGEN','PAIS ORIGEN':'PAÍS ORIGEN','REGION ORIGEN':'REGIÓN ORIGEN','COMMODITY':'COMMODITY','EMPRESA DE TRANSPORTE':'EMPRESA DE TRANSPORTE','FREIGHT FORWARDER ORIGEN':'FREIGHT FORWARDER ORIGEN','FREIGHT FORWARDER DESTINO':'FREIGHT FORWARDER DESTINO','TIPO DESPACHO':'TIPO DESPACHO','INCOTERM':'INCOTERM','MES':'MES','CARGA REFRIGERADA':'CARGA REFRIGERADA'
  })[field] || field;
}

function downloadCurrentCsv(){
  const rows = state.filtered.map(r => ({
    MES:r['MES'], 'EMPRESA ECUADOR':r['EMPRESA ECUADOR'], 'EMPRESA EXTERIOR':r['EMPRESA EXTERIOR'], 'PUERTO ECUADOR':r['PUERTO ECUADOR'], 'PUERTO ORIGEN':r['PUERTO ORIGEN'], 'PAIS ORIGEN':r['PAIS ORIGEN'], 'REGION ORIGEN':r['REGION ORIGEN'], COMMODITY:r['COMMODITY'], 'EMPRESA DE TRANSPORTE':r['EMPRESA DE TRANSPORTE'], 'FREIGHT FORWARDER ORIGEN':r['FREIGHT FORWARDER ORIGEN'], 'FREIGHT FORWARDER DESTINO':r['FREIGHT FORWARDER DESTINO'], 'TIPO DESPACHO':r['TIPO DESPACHO'], INCOTERM:r['INCOTERM'], 'CARGA REFRIGERADA':r['CARGA REFRIGERADA'], '20GP':r['20GP_DASH'], '40HC':r['40HC_DASH'], '40RF':r['40RF_DASH'], TEUS:r['TEUS_DASH']
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vista_importaciones_ecuador.csv'; a.click();
  URL.revokeObjectURL(url);
}
