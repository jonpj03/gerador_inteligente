/* Smart Dash Studio — Explorar Dados (tabela dinâmica inteligente) */
const SDExplore = (() => {
  const N = SDParser.norm, E = SDEngine, esc = SDRender.esc, CNT = '__count__';
  let api, root, cfg, sigC = '', last = null;
  const emptyCfg = () => ({ rows: [], cols: [], values: [], filters: [], grain: 'auto', sort: 'auto' });
  const isNum = c => ['number', 'percent', 'currency'].includes(c.type);
  const TL = { text: 'Texto', category: 'Categoria', number: 'Número', percent: 'Percentual', currency: 'Moeda', date: 'Data', id: 'Identificador' };
  const AL = { sum: 'Soma', avg: 'Média', min: 'Mínimo', max: 'Máximo', count: 'Contagem', distinct: 'Contagem distinta' };
  const cols = () => api.ds().columns, col = n => cols().find(c => c.name === n);
  const aggsFor = c => !c ? ['count'] : c.type === 'percent' ? ['avg', 'min', 'max', 'count', 'distinct'] : isNum(c) ? ['sum', 'avg', 'min', 'max', 'count', 'distinct'] : ['count', 'distinct'];
  const defAgg = c => !c ? 'count' : c.type === 'percent' ? 'avg' : isNum(c) ? E.aggFor(c) : 'count';
  const vLabel = v => v.f === CNT ? 'Contagem de registros' : `${AL[v.agg]} de ${v.f}`;
  const vType = v => v.f === CNT || v.agg === 'count' || v.agg === 'distinct' ? 'number' : col(v.f).type;
  const vField = v => v.f === CNT ? null : v.f;
  const opt = (v, l, s) => `<option value="${esc(v)}"${s ? ' selected' : ''}>${esc(l)}</option>`;
  const canFilter = c => c.type === 'date' || isNum(c) || c.unique <= 300;

  function activeWhere() {
    return cfg.filters.filter(f => f.values ? f.values.length : (f.from !== '' || f.to !== '')).map(f => f.values ? { col: f.f, values: [...f.values] } : { col: f.f, from: f.from, to: f.to });
  }
  function uniq(name) { return [...new Set(api.ds().rows.map(r => r[name] == null ? '(Sem valor)' : r[name]))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })).slice(0, 300); }

  /* ---------- cálculo ---------- */
  function compute() {
    const p = api.profile();
    const rows = E.applyWhere(api.rows(), activeWhere(), p);
    const rf = cfg.rows[0] ? col(cfg.rows[0]) : null, cf = cfg.cols[0] ? col(cfg.cols[0]) : null;
    const vals = cfg.values.length ? cfg.values : [{ f: CNT, agg: 'count' }];
    const ct = E.crosstab(rows, rf, cf, { grain: cfg.grain });
    if (ct.colMap.size > 40) return { error: `"${cf.name}" tem ${ct.colMap.size} valores distintos. Use um campo com até 40 valores em Colunas ou aplique filtros.` };
    const agg = (rs, v) => E.aggregate(rs, vField(v), v.agg);
    let rks = ct.rowKeys.map(k => ({ k, label: ct.rowLabel(k), t: agg(ct.rowMap.get(k), vals[0]) }));
    const isDate = rf && rf.type === 'date', nv = x => x == null ? -Infinity : x;
    if (cfg.sort === 'label' || cfg.sort === 'labeld') rks.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }) * (cfg.sort === 'labeld' ? -1 : 1));
    else if (cfg.sort === 'vald') rks.sort((a, b) => nv(b.t) - nv(a.t));
    else if (cfg.sort === 'vala') rks.sort((a, b) => nv(a.t) - nv(b.t));
    else if (!isDate) rks.sort((a, b) => nv(b.t) - nv(a.t));
    return { rows, rf, cf, vals, ct, rks, agg };
  }

  function build() {
    const r = last = compute();
    if (r.error) return { html: `<p class="notice">${esc(r.error)}</p>` };
    const { ct, rks, vals, agg, rf, cf } = r, CAP = 2000;
    const f = (v, val) => v == null ? '' : esc(E.fmt(v, vType(val)));
    const ck = cf ? ct.colKeys : ['__all__'], multi = vals.length > 1;
    const csvHead = [rf ? rf.name : 'Total'], csvRows = [];
    let h1 = `<tr><th class="sticky" rowspan="${cf && multi ? 2 : 1}">${esc(rf ? rf.name : '')}</th>`, h2 = '';
    if (cf) { ck.forEach(k => { h1 += `<th colspan="${vals.length}">${esc(ct.colLabel(k))}</th>`; vals.forEach(v => { csvHead.push(`${ct.colLabel(k)} — ${vLabel(v)}`); if (multi) h2 += `<th>${esc(vLabel(v))}</th>`; }); }); h1 += `<th colspan="${vals.length}">Total geral</th>`; vals.forEach(v => { csvHead.push(`Total geral — ${vLabel(v)}`); if (multi) h2 += `<th>${esc(vLabel(v))}</th>`; }); }
    else vals.forEach(v => { h1 += `<th>${esc(vLabel(v))}</th>`; csvHead.push(vLabel(v)); });
    h1 += '</tr>';
    let body = '';
    rks.forEach((rk, i) => {
      const rs = ct.rowMap.get(rk.k), obj = { [csvHead[0]]: rk.label }; let t = `<tr><th class="sticky">${esc(rk.label)}</th>`, ci = 1;
      if (cf) ck.forEach(k => vals.forEach(v => { const cr = ct.cell(rk.k, k), x = cr.length ? agg(cr, v) : null; t += `<td class="num">${f(x, v)}</td>`; obj[csvHead[ci++]] = x; }));
      const tot = vals.map(v => agg(rs, v));
      tot.forEach((x, j) => { t += `<td class="num${cf ? ' tot' : ''}">${f(x, vals[j])}</td>`; obj[csvHead[ci++]] = x; });
      if (i < CAP) body += t + '</tr>'; csvRows.push(obj);
    });
    const all = r.rows; let foot = '<tr class="grand"><th class="sticky">Total geral</th>', go = { [csvHead[0]]: 'Total geral' }, ci = 1;
    if (cf) ck.forEach(k => vals.forEach(v => { const x = agg(ct.colMap.get(k) || [], v); foot += `<td class="num">${f(x, v)}</td>`; go[csvHead[ci++]] = x; }));
    vals.forEach(v => { const x = agg(all, v); foot += `<td class="num">${f(x, v)}</td>`; go[csvHead[ci++]] = x; });
    csvRows.push(go);
    last.csv = { head: csvHead, rows: csvRows };
    const warnCap = rks.length > CAP ? ` Exibindo as primeiras ${CAP} linhas; o CSV contém todas.` : '';
    return { html: `<div class="tbl-wrap pv"><table class="tbl"><thead>${h1}${h2 ? `<tr>${h2}</tr>` : ''}</thead><tbody>${body}${foot}</tbody></table></div><p class="muted small">${rks.length} linha(s) × ${ck.length} coluna(s) · ${all.length} de ${api.ds().rows.length} registros considerados · totais calculados sobre os registros (médias não são somadas).${warnCap}</p>` };
  }

  /* ---------- sugestões e alertas ---------- */
  function suggestions() {
    const p = api.profile(), out = [], dim = p.person || p.primaryDim, pm = p.primaryMeasure, ds = api.ds();
    const dim2 = p.dims.find(d => d !== dim && d !== p.status);
    if (dim) out.push({ t: `Quantidade de registros por ${dim.name}`, c: { rows: [dim.name], values: [{ f: CNT, agg: 'count' }] } });
    if (dim && pm) out.push({ t: `${AL[defAgg(pm)]} de ${pm.name} por ${dim.name}`, c: { rows: [dim.name], values: [{ f: pm.name, agg: defAgg(pm) }] } });
    if (p.date) out.push({ t: `Evolução mensal${pm ? ' de ' + pm.name : ' de registros'}`, c: { rows: [p.date.name], values: [pm ? { f: pm.name, agg: defAgg(pm) } : { f: CNT, agg: 'count' }], grain: 'month' } });
    if (dim && p.status) out.push({ t: `${dim.name} × ${p.status.name}`, c: { rows: [dim.name], cols: [p.status.name], values: [{ f: CNT, agg: 'count' }] } });
    if (dim && dim2) out.push({ t: `${dim.name} × ${dim2.name}`, c: { rows: [dim.name], cols: [dim2.name], values: [{ f: CNT, agg: 'count' }] } });
    if (dim && dim2 && p.status) {
      const open = [...new Set(ds.rows.map(r => r[p.status.name]).filter(v => v != null))].filter(v => !E.isDone(v));
      if (open.length && open.length < uniq(p.status.name).length) out.push({ t: `Itens em aberto por ${dim.name} × ${dim2.name}`, c: { rows: [dim.name], cols: [dim2.name], values: [{ f: CNT, agg: 'count' }], filters: [{ f: p.status.name, values: open }] } });
    }
    return out.slice(0, 6);
  }
  function warnings() {
    const w = [], ds = api.ds();
    const rf = cfg.rows[0] && col(cfg.rows[0]), cf = cfg.cols[0] && col(cfg.cols[0]);
    if (rf && rf.type === 'id') w.push(`"${rf.name}" é um identificador: cada valor gera uma linha. Prefira uma categoria.`);
    if (rf && rf.type === 'text' && rf.unique > 200) w.push(`"${rf.name}" é texto livre com ${rf.unique} valores distintos; a tabela ficará muito longa.`);
    if (cf && cf.unique > 40) w.push(`"${cf.name}" tem ${cf.unique} valores distintos — muitas colunas. Escolha outro campo ou filtre.`);
    if (rf && cf && rf === cf) w.push('Linhas e Colunas usam o mesmo campo.');
    cfg.values.forEach(v => { if (v.f !== CNT && (cfg.rows[0] === v.f || cfg.cols[0] === v.f)) w.push(`"${v.f}" está em Valores e também em ${cfg.rows[0] === v.f ? 'Linhas' : 'Colunas'}; o resultado é redundante.`); });
    if (!cfg.rows.length && !cfg.cols.length) w.push('Adicione um campo em Linhas ou Colunas para detalhar o resultado (hoje há apenas o total geral).');
    const fn = api.filterNote && api.filterNote(); if (fn) w.push('Filtros ativos dos dashboards estão aplicados: ' + fn + '.');
    if (!cfg.values.length) w.push('Nenhum valor escolhido: usando "Contagem de registros".');
    if (last && !last.error && !last.rows.length) w.push('Os filtros eliminaram todos os registros.');
    return w;
  }

  /* ---------- interface ---------- */
  function fieldList() {
    const groups = [['Categorias', c => c.type === 'category'], ['Datas', c => c.type === 'date'], ['Números e moedas', c => c.type === 'number' || c.type === 'currency'], ['Percentuais', c => c.type === 'percent'], ['Textos', c => c.type === 'text'], ['Identificadores', c => c.type === 'id']];
    return groups.map(([t, fn]) => { const cs = cols().filter(fn); if (!cs.length) return ''; return `<h4>${t}</h4>${cs.map(c => `<div class="fx" draggable="true" data-f="${esc(c.name)}" title="Arraste para uma área ou dê duplo clique"><span class="tag t-${c.type}">${TL[c.type]}</span><span class="fx-n">${esc(c.name)}</span><small>${[isNum(c) ? 'agregável' : '', canFilter(c) ? 'filtro' : ''].filter(Boolean).join(' · ')}</small></div>`).join('')}`; }).join('');
  }
  function zoneChips(z) {
    if (z === 'rows' || z === 'cols') return cfg[z].map(f => `<span class="zc" draggable="true" data-z="${z}" data-f="${esc(f)}"><b>${esc(f)}</b><button data-rm="${z}" data-i="0" aria-label="Remover">×</button></span>`).join('');
    if (z === 'values') return cfg.values.map((v, i) => `<span class="zc" data-z="values"><b>${esc(v.f === CNT ? 'Registros' : v.f)}</b><select data-vagg="${i}" aria-label="Agregação">${aggsFor(v.f === CNT ? null : col(v.f)).map(a => opt(a, AL[a], v.agg === a)).join('')}</select><button data-rm="values" data-i="${i}" aria-label="Remover">×</button></span>`).join('');
    return cfg.filters.map((fl, i) => {
      const c = col(fl.f), on = fl.values ? fl.values.length : (fl.from !== '' || fl.to !== '');
      const body = fl.values ? uniq(fl.f).map(v => `<label><input type="checkbox" data-fv="${i}" value="${esc(v)}"${fl.values.includes(v) ? ' checked' : ''}> ${esc(v)}</label>`).join('') : `<label class="fld">De<input type="${c.type === 'date' ? 'date' : 'number'}" step="any" data-fr="${i}:from" value="${esc(fl.from)}"></label><label class="fld">Até<input type="${c.type === 'date' ? 'date' : 'number'}" step="any" data-fr="${i}:to" value="${esc(fl.to)}"></label>`;
      return `<details class="zc fz" data-on="${on}"><summary><b>${esc(fl.f)}</b> <span class="cnt">${fl.values ? (fl.values.length ? `(${fl.values.length})` : '(todos)') : (on ? '(intervalo)' : '(todos)')}</span></summary><div class="fmenu">${body}<button class="link" data-rm="filters" data-i="${i}">Remover filtro</button></div></details>`;
    }).join('');
  }
  function zoneHtml(z, title, hint) {
    const used = new Set([...cfg.rows, ...cfg.cols, ...cfg.values.map(v => v.f), ...cfg.filters.map(f => f.f)]);
    const avail = cols().filter(c => z === 'values' ? true : z === 'filters' ? canFilter(c) && !cfg.filters.some(f => f.f === c.name) : true);
    return `<div class="zone" data-zone="${z}"><h4>${title}</h4><p class="muted small">${hint}</p><div class="zitems">${zoneChips(z)}</div><select class="zadd" data-add="${z}" aria-label="Adicionar em ${title}"><option value="">+ Adicionar campo…</option>${z === 'values' ? opt(CNT, 'Contagem de registros') : ''}${avail.map(c => opt(c.name, c.name)).join('')}</select></div>`;
  }
  function drawAll() {
    const dateUsed = [cfg.rows[0], cfg.cols[0]].some(n => n && col(n) && col(n).type === 'date');
    const sg = suggestions();
    root.innerHTML = `<div class="ex-wrap"><aside class="ex-fields panelbox"><h3>Campos encontrados</h3><p class="muted small">${cols().length} campos · arraste para as áreas ao lado.</p>${fieldList()}</aside>
      <section class="ex-main"><div class="panelbox"><h3 style="margin:0 0 8px">Sugestões para estes dados</h3><div class="chips left" id="exSugg">${sg.map((s, i) => `<button class="chip" data-sg="${i}">${esc(s.t)}</button>`).join('') || '<span class="muted small">Poucos campos para sugerir cruzamentos.</span>'}</div></div>
      <div class="ex-areas">${zoneHtml('rows', 'Linhas', 'Categoria principal')}${zoneHtml('cols', 'Colunas', 'Dimensão de comparação')}${zoneHtml('values', 'Valores', 'O que calcular')}${zoneHtml('filters', 'Filtros', 'Quais registros considerar')}</div>
      <div class="ex-actions"><button class="btn primary big" id="exGen">Gerar dashboard desta análise</button><button class="btn ghost" id="exCsv">Exportar tabela (CSV)</button><button class="link" id="exClear">Limpar configuração</button>
        <span class="spacer"></span>
        <label class="fld inl">Ordenar<select id="exSort">${[['auto', 'Automático'], ['vald', 'Valor ↓'], ['vala', 'Valor ↑'], ['label', 'Nome A–Z'], ['labeld', 'Nome Z–A']].map(([v, l]) => opt(v, l, cfg.sort === v)).join('')}</select></label>
        ${dateUsed ? `<label class="fld inl">Período<select id="exGrain">${[['auto', 'Automático'], ['day', 'Dia'], ['month', 'Mês'], ['year', 'Ano']].map(([v, l]) => opt(v, l, cfg.grain === v)).join('')}</select></label>` : ''}</div>
      <div id="exWarn"></div><div class="panelbox" id="exResult"></div></section></div>`;
    drawResult();
  }
  function drawResult() {
    const b = build(); $('#exResult', root).innerHTML = b.html;
    $('#exWarn', root).innerHTML = warnings().map(w => `<div class="banner warnb">${esc(w)}</div>`).join('');
  }
  const $ = (s, r) => (r || document).querySelector(s);

  function add(z, f) {
    if (!f) return; if (f !== CNT && !col(f)) return; if (f === CNT && z !== 'values') return;
    const c = f === CNT ? null : col(f);
    if (z === 'rows' || z === 'cols') { cfg.rows = cfg.rows.filter(x => x !== f); cfg.cols = cfg.cols.filter(x => x !== f); cfg[z] = [f]; }
    else if (z === 'values') { const used = cfg.values.filter(v => v.f === f).map(v => v.agg); const a = [defAgg(c), ...aggsFor(c)].find(x => !used.includes(x)); if (!a) return; cfg.values.push({ f, agg: a }); }
    else if (z === 'filters') { if (!canFilter(c) || cfg.filters.some(x => x.f === f)) return; cfg.filters.push(c.type === 'date' || isNum(c) ? { f, from: '', to: '' } : { f, values: [] }); }
    drawAll();
  }
  function autoPlace(f) {
    const c = col(f); if (!c) return;
    if (isNum(c)) add('values', f); else if (c.type === 'date' || !cfg.rows.length) add('rows', f); else add('cols', f);
  }

  function widgets() {
    const vals = cfg.values.length ? cfg.values : [{ f: CNT, agg: 'count' }], where = activeWhere();
    let rF = cfg.rows[0] ? col(cfg.rows[0]) : null, cF = cfg.cols[0] ? col(cfg.cols[0]) : null;
    if (!rF && cF) { rF = cF; cF = null; }
    const W = o => E.W({ where, grain: cfg.grain, ...o }), out = [], m = v => vField(v);
    vals.slice(0, 4).forEach(v => out.push(W({ kind: 'kpi', title: vLabel(v), m: m(v), agg: v.agg, span: 3 })));
    if (!rF) return out;
    const stackable = v => v.agg === 'sum' || v.agg === 'count';
    const span = rF.unique > 12 ? 12 : 6;
    vals.slice(0, 3).forEach(v => {
      if (!cF) {
        if (rF.type === 'date') out.push(W({ kind: 'chart', data: 'time', chart: 'line', title: `${vLabel(v)} por ${rF.name}`, m: m(v), agg: v.agg, date: rF.name, span: 12 }));
        else out.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `${vLabel(v)} por ${rF.name}`, m: m(v), agg: v.agg, dim: rF.name, span }));
      } else {
        let dim = rF.name, dim2 = cF.name, chart = stackable(v) ? 'stacked' : 'bar';
        if (cF.type === 'date' && rF.type !== 'date' && rF.unique <= 10) { dim = cF.name; dim2 = rF.name; chart = 'line'; }
        else if (rF.type === 'date') chart = cF.unique <= 10 ? 'line' : chart;
        out.push(W({ kind: 'chart', data: 'stacked', chart, title: `${vLabel(v)}: ${rF.name} × ${cF.name}`, m: m(v), agg: v.agg, dim, dim2, span: 12 }));
      }
    });
    if (cF && rF.type !== 'date' && cF.type !== 'date') out.push(W({ kind: 'heatmap', title: `Mapa de calor: ${rF.name} × ${cF.name}`, m: m(vals[0]), agg: vals[0].agg, dim: rF.name, dim2: cF.name, span: 12 }));
    return out;
  }
  function title() {
    const p = [cfg.rows[0] && `Linhas: ${cfg.rows[0]}`, cfg.cols[0] && `Colunas: ${cfg.cols[0]}`, cfg.values.length && cfg.values.map(vLabel).join(', ')].filter(Boolean);
    return 'Análise — ' + (p.join(' · ') || 'Contagem de registros');
  }

  function init(a) {
    api = a; root = document.getElementById('viewExplore');
    root.addEventListener('click', e => {
      const t = e.target;
      const sg = t.closest('[data-sg]'); if (sg) { const s = suggestions()[+sg.dataset.sg]; cfg = { ...emptyCfg(), ...JSON.parse(JSON.stringify(s.c)) }; drawAll(); return; }
      const rm = t.closest('[data-rm]'); if (rm) { const z = rm.dataset.rm, i = +rm.dataset.i; if (z === 'rows' || z === 'cols') cfg[z] = []; else cfg[z].splice(i, 1); drawAll(); return; }
      if (t.closest('#exGen')) {
        const w = widgets(); if (w.length <= 4 && !cfg.rows.length && !cfg.cols.length && !cfg.values.length) return api.toast('Escolha ao menos um campo em Linhas, Colunas ou Valores.', true);
        if (last && last.error) return api.toast(last.error, true);
        api.onDashboard(w, title()); return;
      }
      if (t.closest('#exCsv')) { if (!last || last.error || !last.csv) return api.toast('Não há tabela para exportar.', true); SDExport.csv({ columns: last.csv.head.map(n => ({ name: n })) }, last.csv.rows, 'tabela-dinamica'); api.toast('Tabela exportada em CSV.'); return; }
      if (t.closest('#exClear')) { cfg = emptyCfg(); drawAll(); }
    });
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.add !== undefined) { add(t.dataset.add, t.value); return; }
      if (t.dataset.vagg !== undefined) { cfg.values[+t.dataset.vagg].agg = t.value; drawResult(); return; }
      if (t.id === 'exSort') { cfg.sort = t.value; drawResult(); return; }
      if (t.id === 'exGrain') { cfg.grain = t.value; drawResult(); return; }
      if (t.dataset.fv !== undefined) { const f = cfg.filters[+t.dataset.fv], a = f.values; if (t.checked) a.push(t.value); else a.splice(a.indexOf(t.value), 1); const d = t.closest('details'); d.dataset.on = a.length > 0; d.querySelector('.cnt').textContent = a.length ? `(${a.length})` : '(todos)'; drawResult(); return; }
      if (t.dataset.fr !== undefined) { const [i, k] = t.dataset.fr.split(':'); cfg.filters[+i][k] = t.value; const d = t.closest('details'); const f = cfg.filters[+i]; d.dataset.on = f.from !== '' || f.to !== ''; d.querySelector('.cnt').textContent = d.dataset.on === 'true' ? '(intervalo)' : '(todos)'; drawResult(); }
    });
    root.addEventListener('dblclick', e => { const f = e.target.closest('.fx'); if (f) autoPlace(f.dataset.f); });
    root.addEventListener('dragstart', e => { const f = e.target.closest('.fx, .zc[data-z]'); if (!f) return; e.dataTransfer.setData('text/plain', JSON.stringify({ f: f.dataset.f, from: f.dataset.z || '' })); e.dataTransfer.effectAllowed = 'move'; });
    root.addEventListener('dragover', e => { const z = e.target.closest('.zone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
    root.addEventListener('dragleave', e => { const z = e.target.closest('.zone'); if (z) z.classList.remove('over'); });
    root.addEventListener('drop', e => {
      const z = e.target.closest('.zone'); if (!z) return; e.preventDefault(); z.classList.remove('over');
      try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d.from && d.from !== z.dataset.zone && (d.from === 'rows' || d.from === 'cols')) cfg[d.from] = []; add(z.dataset.zone, d.f); } catch (err) { /* ignora */ }
    });
  }
  function refresh() {
    const sig = cols().map(c => c.name + ':' + c.type).join('|');
    if (sig !== sigC) { cfg = emptyCfg(); sigC = sig; const s = suggestions()[0]; if (s) cfg = { ...emptyCfg(), ...JSON.parse(JSON.stringify(s.c)) }; }
    drawAll();
  }
  return { init, refresh };
})();
