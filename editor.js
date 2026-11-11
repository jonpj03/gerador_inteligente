/* Smart Dash Studio — editor único de visualizações (criar e editar), guiado pelo catálogo SDSchema */
const SDEditor = (() => {
  const esc = SDRender.esc, S = SDSchema, AG = SDEngine.AGGL;
  const TL = { text: 'Texto', category: 'Categoria', number: 'Número', percent: '%', currency: 'Moeda', date: 'Data', id: 'ID' };
  const PRE = { c: [4, 200], m: [6, 260], g: [8, 360], x: [12, 480] };
  const $ = (s, r) => (r || document).querySelector(s);
  const o = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  let f, sz, p, w, onSave, d, cache, err;

  const col = n => p.ds.columns.find(c => c.name === n);
  const numCols = () => p.ds.columns.filter(c => S.isNum(c));
  const uniq = n => cache[n] || (cache[n] = [...new Set(p.ds.rows.map(r => r[n] == null ? '(Sem valor)' : r[n]))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })).slice(0, 300));
  const T = () => S.byId(f.type);
  const colOpts = (cols, sel, empty) => (empty ? o('', empty, !sel) : '') + cols.map(c => o(c.name, `${c.name} · ${TL[c.type]}`, c.name === sel)).join('');
  const GR = [['auto', 'Automática'], ['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['quarter', 'Trimestre'], ['year', 'Ano']];
  const LIM = [[0, 'Todos'], [5, 'Top 5'], [10, 'Top 10'], [15, 'Top 15'], [20, 'Top 20'], [50, 'Top 50'], [100, 'Top 100']];
  const SORTS = [['', 'Padrão'], ['desc', 'Maior valor'], ['asc', 'Menor valor'], ['az', 'Nome A–Z'], ['za', 'Nome Z–A']];

  function fix() {
    const t = T(); if (!t) return;
    const num = numCols();
    if (t.o.numM && (!col(f.m) || !S.isNum(col(f.m)))) f.m = num[0] ? num[0].name : '';
    if (t.o.numM2 && (!col(f.m2) || !S.isNum(col(f.m2)) || f.m2 === f.m)) f.m2 = (num.find(c => c.name !== f.m) || {}).name || '';
    if (f.m3 && !(col(f.m3) && S.isNum(col(f.m3)))) f.m3 = '';
    const mc = col(f.m), ok = t.o.aggs || S.aggsFor(mc, t.o.list);
    if (!f.m) f.agg = 'count'; else if (!ok.includes(f.agg)) f.agg = ok.includes(S.defAgg(mc)) ? S.defAgg(mc) : ok[0];
    if (t.f.includes('agg2')) { const c2 = col(f.m2), ok2 = S.aggsFor(c2, false); if (!f.m2) f.agg2 = 'count'; else if (!ok2.includes(f.agg2)) f.agg2 = f.agg && ok2.includes(f.agg) ? f.agg : S.defAgg(c2); }
    if (t.f.includes('dim') && !t.o.optDim && !col(f.dim)) f.dim = (p.primaryDim || p.dims[0] || p.ds.columns[0] || {}).name || '';
    if (t.o.noDate && col(f.dim) && col(f.dim).type === 'date') f.dim = (p.primaryDim || p.dims[0] || {}).name || '';
    if (t.f.includes('dim2') && (!col(f.dim2) || f.dim2 === f.dim)) f.dim2 = (p.dims.find(c => c.name !== f.dim) || p.ds.columns.find(c => c.name !== f.dim) || {}).name || '';
    if (f.type === 'pareto' && !f.limit) f.limit = 20;
  }

  const FIELD = {
    m: () => { const t = T(), l = { scatter: 'Eixo X (medida)', compare: 'Realizado (medida)', bubble: 'Eixo X (medida)', hist: 'Medida', list: 'Valor ao lado do nome (opcional)' }[f.type] || 'Campo / medida'; const e = t.o.numM ? null : (f.type === 'list' ? 'Nenhum — contar registros' : 'Contagem de registros'); return `<label class="fld">${l}<select data-k="m" data-re>${colOpts(t.o.numM ? numCols() : p.ds.columns, f.m, e)}</select></label>`; },
    agg: () => { const t = T(), mc = col(f.m), ok = t.o.aggs || S.aggsFor(mc, t.o.list); return `<label class="fld">Como calcular<select data-k="agg" ${f.m ? '' : 'disabled'}>${f.m ? ok.map(a => o(a, AG[a], f.agg === a)).join('') : o('count', 'Contagem de registros', true)}</select></label>`; },
    m2: () => { const t = T(), l = { scatter: 'Eixo Y (medida)', compare: 'Meta (medida)', bubble: 'Eixo Y (medida)', combo: 'Medida da linha (2º eixo)' }[f.type] || 'Segunda medida'; return `<label class="fld">${l}<select data-k="m2" data-re>${colOpts(numCols(), f.m2, t.o.m2empty ? 'Contagem de registros' : null)}</select></label>`; },
    agg2: () => { const ok = S.aggsFor(col(f.m2), false); return `<label class="fld">Como calcular a linha<select data-k="agg2" ${f.m2 ? '' : 'disabled'}>${f.m2 ? ok.map(a => o(a, AG[a], f.agg2 === a)).join('') : o('count', 'Contagem de registros', true)}</select></label>`; },
    m3: () => `<label class="fld">Tamanho da bolha<select data-k="m3">${colOpts(numCols(), f.m3, 'Contagem de registros')}</select></label>`,
    dim: () => { const t = T(), l = { list: 'Campo a listar', table: 'Agrupar por (linhas)', stacked: 'Eixo principal', stacked100: 'Eixo principal', grouped: 'Eixo principal', mlines: 'Eixo principal', heatmap: 'Linhas' }[f.type] || 'Agrupar por'; const cs = p.ds.columns.filter(c => !(t.o.noDate && c.type === 'date')); return `<label class="fld">${l}<select data-k="dim" data-re>${colOpts(cs, f.dim, t.o.optDim ? 'Sem agrupar (total)' : null)}</select></label>`; },
    dim2: () => `<label class="fld">Série / colunas (2ª dimensão)<select data-k="dim2" data-re>${colOpts(p.ds.columns.filter(c => c.name !== f.dim), f.dim2)}</select></label>`,
    tr: () => (col(f.dim) && col(f.dim).type === 'date' ? `<div class="fld">Análise de tendência<label class="check"><input type="checkbox" data-k="ma" ${f.ma ? 'checked' : ''}> Média móvel (3 períodos)</label><label class="check"><input type="checkbox" data-k="trend" ${f.trend ? 'checked' : ''}> Linha de tendência linear</label></div>` : ''),
    grain: () => ([f.dim, f.dim2].some(n => col(n) && col(n).type === 'date') ? `<label class="fld">Agrupar datas por<select data-k="grain">${GR.map(([v, l]) => o(v, l, f.grain === v)).join('')}</select></label>` : ''),
    limit: () => `<label class="fld">Quantidade de itens<select data-k="limit">${LIM.map(([v, l]) => o(v, l, (+f.limit || 0) === v)).join('')}</select></label>`,
    sort: () => `<label class="fld">Ordenação<select data-k="sort">${SORTS.map(([v, l]) => o(v, l, f.sort === v)).join('')}</select></label>`,
    goal: () => `<label class="fld">Meta (opcional — mostra o % atingido)<input type="text" inputmode="decimal" data-k="goal" value="${esc(f.goal)}" placeholder="ex.: 1000"></label>`,
    showVal: () => `<label class="check"><input type="checkbox" data-k="showVal" ${f.showVal ? 'checked' : ''}> Mostrar valor ao lado de cada item</label>`,
    style: () => `<label class="fld">Formato da lista<select data-k="style">${[['chips', 'Etiquetas'], ['table', 'Tabela numerada']].map(([v, l]) => o(v, l, f.style === v)).join('')}</select></label>`,
    text: () => `<label class="fld">Texto<textarea data-k="text" rows="5" maxlength="2000" placeholder="Conclusões, recomendações, contexto…">${esc(f.text)}</textarea></label>`,
    cols: () => `<div class="fld">Colunas da tabela<div class="rows">${f.cols.map((c, i) => `<div class="er"><select data-ci="${i}:f" data-re>${colOpts(p.ds.columns, c.f, 'Registros')}</select><select data-ci="${i}:agg">${(c.f ? S.aggsFor(col(c.f), true) : ['count']).map(a => o(a, AG[a], c.agg === a)).join('')}</select><button class="ib" type="button" data-ed="colrm" data-i="${i}" aria-label="Remover coluna">✕</button></div>`).join('')}</div><button class="link" type="button" data-ed="coladd">+ Adicionar coluna</button></div>`
  };

  function whereHtml() {
    return `<div class="fld">Filtros desta visualização<div class="rows">${f.where.map((x, i) => {
      const c = col(x.col), range = c && (c.type === 'date' || S.isNum(c));
      const body = !c ? '' : range ? `<input type="${c.type === 'date' ? 'date' : 'text'}" data-wr="${i}:from" value="${esc(x.from)}" aria-label="De"><input type="${c.type === 'date' ? 'date' : 'text'}" data-wr="${i}:to" value="${esc(x.to)}" aria-label="Até">` : `<details class="wv"><summary>${x.values && x.values.length ? x.values.length + ' valor(es)' : 'Escolher valores'}</summary><div class="fmenu">${uniq(x.col).map(v => `<label><input type="checkbox" data-wv="${i}" value="${esc(v)}"${(x.values || []).includes(v) ? ' checked' : ''}> ${esc(v)}</label>`).join('')}</div></details>`;
      return `<div class="er"><select data-wf="${i}" data-re>${colOpts(p.ds.columns, x.col)}</select>${body}<button class="ib" type="button" data-ed="wrm" data-i="${i}" aria-label="Remover filtro">✕</button></div>`;
    }).join('')}</div><button class="link" type="button" data-ed="wadd">+ Adicionar filtro</button></div>`;
  }

  function fields() {
    const t = T(); if (!t) return '<p class="muted small">Esta visualização é gerada automaticamente: edite o título e o tamanho.</p>';
    let h = t.f.map(k => FIELD[k]()).join('');
    if (!t.o.noData) h += whereHtml();
    if (!t.o.noData) {
      const pie = ['doughnut', 'pie', 'polar'].includes(f.type);
      h += `<div class="row2"><label class="fld">Rótulos de valores<select data-k="labels">${[['', 'Padrão (global)'], ['on', 'Mostrar'], ['off', 'Ocultar']].map(([v, l]) => o(v, l, f.labels === v)).join('')}</select></label>${pie ? `<label class="fld">Conteúdo do rótulo<select data-k="lblFmt">${[['both', 'Valor e %'], ['value', 'Só valor'], ['pct', 'Só %']].map(([v, l]) => o(v, l, f.lblFmt === v)).join('')}</select></label>` : ''}</div>`;
      h += `<label class="check mt"><input type="checkbox" data-k="usecolor" ${f.color ? 'checked' : ''}> Cor própria <input type="color" data-k="color" value="${f.color || '#C2185B'}"></label>`;
    }
    return h;
  }
  function sizeHtml(kind) {
    return `<details class="ed-size"><summary>Tamanho do gráfico</summary><label class="fld">Tamanho predefinido<select data-s="preset">${[['', 'Manter atual'], ['c', 'Compacto'], ['m', 'Médio'], ['g', 'Grande'], ['x', 'Extra grande']].map(([v, l]) => o(v, l, sz.preset === v)).join('')}</select></label>
      <div class="row2"><label class="fld">Largura (px)<input type="text" inputmode="numeric" data-s="wpx" value="${esc(sz.wpx)}" placeholder="automática"></label><label class="fld">Altura (px)<input type="text" inputmode="numeric" data-s="hpx" value="${esc(sz.hpx)}" placeholder="automática"></label></div>
      <label class="fld">Largura em colunas (de 12)<select data-s="span">${o('', 'Padrão do tipo', !sz.span)}${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => o(n, n, +sz.span === n)).join('')}</select></label>
      <label class="check mt"><input type="checkbox" data-s="auto" ${sz.auto ? 'checked' : ''}> Ajustar tamanho ao conteúdo (gráficos)</label>
      <label class="check"><input type="checkbox" data-s="reset"> Restaurar tamanho original</label></details>`;
  }
  function typeSel() {
    const gs = []; S.TYPES.forEach(t => { let g = gs.find(x => x[0] === t.g); if (!g) gs.push(g = [t.g, []]); g[1].push(t); });
    return `<label class="fld">Tipo de visualização<select data-k="type" data-re>${gs.map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(t => o(t.id, t.l, t.id === f.type)).join('')}</optgroup>`).join('')}</select></label><p class="muted small" id="edHint">${esc(T() ? T().h : '')}</p>`;
  }
  function shell() {
    const kind = w ? w.kind : (T() && T().mk(f, p).kind);
    d.innerHTML = `<div class="ed"><div class="ed-h"><h2>${w ? 'Editar visualização' : 'Nova visualização'}</h2><button class="ib" type="button" data-ed="close" aria-label="Fechar">✕</button></div><div class="ed-b">${f.type === null ? '' : typeSel()}<label class="fld">Título<input type="text" data-k="title" maxlength="100" value="${esc(f.title)}" placeholder="${esc(f.type ? S.autoTitle(f) : '')}"></label><div id="edFields">${fields()}</div>${sizeHtml(kind)}<p class="ed-err" id="edErr" role="alert"></p></div><div class="dlg-f"><button class="btn ghost" type="button" data-ed="close">Cancelar</button><button class="btn primary" type="button" data-ed="ok">${w ? 'Aplicar' : 'Adicionar ao dashboard'}</button></div></div>`;
  }
  function redraw() { fix(); const fl = $('#edFields', d); fl.innerHTML = fields(); if (f.type) { $('#edHint', d).textContent = T().h; const t = $('[data-k=title]', d); t.placeholder = S.autoTitle(f); } }

  function finish() {
    const res = f.type === null ? { ...w, title: (f.title || '').trim() || w.title } : S.build(f, p);
    if (res.err) { $('#edErr', d).textContent = res.err; return; }
    let span = w ? w.span : res.span, h = w ? w.h : undefined, wpx = w ? w.wpx : undefined, auto = w ? w.auto : undefined;
    const kind = res.kind;
    if (sz.reset) { span = (w && w.span0) || res.span; h = undefined; wpx = undefined; auto = true; }
    else if (PRE[sz.preset]) { span = PRE[sz.preset][0]; h = kind === 'kpi' ? undefined : PRE[sz.preset][1]; wpx = undefined; }
    else { if (sz.span) span = +sz.span; else if (!w) span = res.span; const wp = parseInt(sz.wpx), hp = parseInt(sz.hpx); wpx = wp >= 120 ? Math.min(wp, 4000) : undefined; h = hp >= 100 ? Math.min(hp, 6000) : undefined; if (kind === 'chart') auto = !!sz.auto; }
    const out = { ...res, span, span0: (w && w.span0) || res.span0 || span };
    if (h) out.h = h; else delete out.h; if (wpx) out.wpx = wpx; else delete out.wpx; if (auto !== undefined) out.auto = auto;
    if (w) { out.id = w.id; delete out.q; } else out.id = SDEngine.nid();
    d.close(); onSave(out);
  }

  function open(o2) {
    p = o2.p; w = o2.w || null; onSave = o2.onSave; d = document.getElementById('dlg'); cache = {};
    if (w) { f = S.toForm(w); } else {
      const dm = (p.primaryDim || p.dims[0] || p.ds.columns[0] || {}).name || '', pm = p.primaryMeasure;
      f = { type: 'hbar', title: '', m: pm ? pm.name : '', agg: pm ? S.defAgg(pm) : 'count', m2: '', agg2: '', m3: '', dim: dm, dim2: '', grain: 'auto', limit: 0, sort: '', goal: '', showVal: true, style: 'chips', text: '', cols: [{ f: '', agg: 'count' }], where: [], labels: '', lblFmt: 'both', color: '' };
    }
    if (f.type === 'table' && !f.cols.length) f.cols = [{ f: '', agg: 'count' }];
    sz = { preset: '', wpx: w && w.wpx || '', hpx: w && w.h || '', span: w ? w.span : '', auto: !w || w.auto !== false, reset: false };
    fix(); shell(); d.classList.add('wide'); d.returnValue = '';
    d.onclick = e => {
      const b = e.target.closest('[data-ed]'); if (!b) return; const a = b.dataset.ed, i = +b.dataset.i;
      if (a === 'close') d.close(); else if (a === 'ok') finish();
      else if (a === 'coladd') { f.cols.push({ f: '', agg: 'count' }); redraw(); }
      else if (a === 'colrm') { f.cols.splice(i, 1); if (!f.cols.length) f.cols.push({ f: '', agg: 'count' }); redraw(); }
      else if (a === 'wadd') { const c = p.dims[0] || p.ds.columns[0]; f.where.push(c.type === 'date' || S.isNum(c) ? { col: c.name, from: '', to: '' } : { col: c.name, values: [] }); redraw(); }
      else if (a === 'wrm') { f.where.splice(i, 1); redraw(); }
    };
    d.onchange = e => {
      const t = e.target; let re = t.hasAttribute('data-re');
      if (t.dataset.k) { const k = t.dataset.k; f[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'usecolor') { f.color = t.checked ? $('[data-k=color]', d).value : ''; return; } if (k === 'color') { f.color = t.value; $('[data-k=usecolor]', d).checked = true; return; } if (k === 'limit') f.limit = +t.value; if (k === 'type') { f.agg = f.agg; } }
      else if (t.dataset.s) { const k = t.dataset.s; sz[k] = t.type === 'checkbox' ? t.checked : t.value; return; }
      else if (t.dataset.ci) { const [i, k] = t.dataset.ci.split(':'); f.cols[+i][k] = t.value; if (k === 'f') f.cols[+i].agg = f.cols[+i].f ? S.defAgg(col(f.cols[+i].f)) : 'count'; }
      else if (t.dataset.wf !== undefined) { const i = +t.dataset.wf, c = col(t.value); f.where[i] = c.type === 'date' || S.isNum(c) ? { col: c.name, from: '', to: '' } : { col: c.name, values: [] }; }
      else if (t.dataset.wv !== undefined) { const x = f.where[+t.dataset.wv]; x.values = x.values || []; if (t.checked) x.values.push(t.value); else x.values.splice(x.values.indexOf(t.value), 1); const s = t.closest('details').querySelector('summary'); s.textContent = x.values.length ? x.values.length + ' valor(es)' : 'Escolher valores'; return; }
      else if (t.dataset.wr) { const [i, k] = t.dataset.wr.split(':'); f.where[+i][k] = t.value; return; }
      else return;
      if (re || t.dataset.ci || t.dataset.wf !== undefined) redraw(); else if (t.dataset.k === 'type') redraw(); else { fix(); }
    };
    d.oninput = e => { const t = e.target; if (t.dataset.k && (t.type === 'text' || t.tagName === 'TEXTAREA') && t.dataset.k !== 'type') f[t.dataset.k] = t.value; else if (t.dataset.s && t.type === 'text') sz[t.dataset.s] = t.value; else if (t.dataset.wr) { const [i, k] = t.dataset.wr.split(':'); f.where[+i][k] = t.value; } };
    d.addEventListener('close', () => { d.onclick = d.onchange = d.oninput = null; d.classList.remove('wide'); }, { once: true });
    d.showModal();
  }
  return { open };
})();
