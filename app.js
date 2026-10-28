/* Smart Dash Studio — aplicação (UI, estado e fluxos) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = SDRender.esc, ICON = SDRender.ICON, E = SDEngine;
  const TABS = [['executive', 'Executivo'], ['operational', 'Operacional'], ['analytical', 'Analítico'], ['custom', 'Personalizado'], ['insights', 'Insights & Melhorias']];
  const DEF_TITLES = { executive: 'Dashboard Executivo', operational: 'Dashboard Operacional', analytical: 'Dashboard Analítico', custom: 'Dashboard Personalizado' };
  const KEY = 'sds.prefs.v1';
  const SUGGEST = ['Analise a produtividade da equipe e apresente os principais indicadores.', 'Crie um dashboard executivo com os resultados mensais.', 'Compare o desempenho dos colaboradores.', 'Identifique gargalos operacionais.', 'Mostre a evolução dos projetos e os principais riscos.'];
  const emptyF = () => ({ dims: {}, from: '', to: '', months: [], years: [] });
  const defPrefs = () => { const m = E.PRESETS[0]; return { primary: m.primary, palette: [...m.palette], preset: 'Magenta', bg: null, theme: 'light', legend: true, cardSize: 'normal', chartFormat: 'auto', titles: {} }; };
  function loadPrefs() {
    const d = defPrefs();
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!j) return d;
      const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
      if (hex(j.primary)) { d.primary = j.primary; d.palette = Array.isArray(j.palette) && j.palette.length >= 4 && j.palette.every(hex) ? j.palette : E.makePalette(j.primary); d.preset = j.preset || null; }
      if (hex(j.bg)) d.bg = j.bg;
      if (['light', 'dark'].includes(j.theme)) d.theme = j.theme;
      if (typeof j.legend === 'boolean') d.legend = j.legend;
      if (['compact', 'normal', 'large'].includes(j.cardSize)) d.cardSize = j.cardSize;
      if (['auto', 'bar', 'hbar', 'line', 'area', 'doughnut', 'pie'].includes(j.chartFormat)) d.chartFormat = j.chartFormat;
      if (j.titles && typeof j.titles === 'object') Object.keys(DEF_TITLES).forEach(k => { if (typeof j.titles[k] === 'string') d.titles[k] = j.titles[k].slice(0, 80); });
    } catch (e) { /* localStorage indisponível */ }
    return d;
  }
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(S.prefs)); } catch (e) { /* ignora */ } };
  const S = { ds: null, orig: null, modified: false, instruction: '', profile: null, dash: null, tab: 'executive', filters: emptyF(), insights: null, files: [], history: [], chat: [], prefs: loadPrefs(), dismissed: false };

  /* ---------- utilidades de UI ---------- */
  let tt;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3600); }
  function setLoading(on, msg) { $('#loading').hidden = !on; if (msg) $('#loadingMsg').textContent = msg; }
  const tick = () => new Promise(r => setTimeout(r, 30));
  function openDlg(html) {
    const d = $('#dlg'); d.innerHTML = html; d.returnValue = '';
    return new Promise(res => { d.addEventListener('close', () => { const f = d.querySelector('form'); res({ val: d.returnValue, fd: f ? new FormData(f) : null }); }, { once: true }); d.showModal(); });
  }
  const confirmDlg = async (title, body, ok) => (await openDlg(`<form method="dialog" class="dlg"><h2>${esc(title)}</h2><p>${esc(body)}</p><div class="dlg-f"><button class="btn ghost" value="cancel">Cancelar</button><button class="btn primary" value="ok" autofocus>${esc(ok || 'Confirmar')}</button></div></form>`)).val === 'ok';
  const curRows = () => E.applyFilters(S.ds.rows, S.filters, S.profile);
  const findW = id => { for (const k of Object.keys(S.dash)) { const w = S.dash[k].find(x => x.id === id); if (w) return w; } return null; };
  const uniqVals = col => [...new Set(S.ds.rows.map(r => r[col] == null ? '(Sem valor)' : r[col]))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')).slice(0, 100);

  /* ---------- tema ---------- */
  function applyTheme() {
    const P = S.prefs, r = document.documentElement, dark = P.theme === 'dark';
    r.dataset.theme = P.theme;
    r.style.setProperty('--brand', P.primary); r.style.setProperty('--brand-deep', E.withL(P.primary, -.12)); r.style.setProperty('--brand-soft', E.soft(P.primary, dark));
    if (P.bg) r.style.setProperty('--bg', P.bg); else r.style.removeProperty('--bg');
    $('#board').dataset.size = P.cardSize;
  }
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (S.ds) renderBoard(false); }); };
  function commit(full) { savePrefs(); applyTheme(); syncPanel(); if (S.ds) full ? renderBoard(false) : schedule(); }
  function setColor(hex, name) {
    const P = S.prefs;
    if (name) { const pr = E.PRESETS.find(x => x.name === name); P.primary = pr.primary; P.palette = [...pr.palette]; P.preset = name; }
    else { P.primary = hex; P.palette = E.makePalette(hex); P.preset = null; }
    Object.values(S.dash || {}).flat().forEach(w => { delete w.color; });
    commit(true);
  }

  /* ---------- home ---------- */
  function renderFiles() {
    $('#fileList').innerHTML = S.files.map((f, i) => `<span class="fchip">${esc(f.name)}<button data-rm="${i}" aria-label="Remover ${esc(f.name)}">×</button></span>`).join('');
  }
  function renderHome() {
    $('#suggestions').innerHTML = SUGGEST.map(t => `<button class="chip" type="button">${esc(t)}</button>`).join('');
    $('#historyBox').hidden = !S.history.length;
    $('#history').innerHTML = S.history.slice(-6).reverse().map(t => `<button class="chip" type="button" title="${esc(t)}">${esc(t.length > 60 ? t.slice(0, 57) + '…' : t)}</button>`).join('');
  }
  const showHint = m => { const h = $('#hint'); h.textContent = m || ''; h.hidden = !m; };
  function addFiles(list) {
    const errs = [];
    [...list].forEach(f => { const e = SDParser.validateFile(f); if (e) errs.push(e); else if (!S.files.some(x => x.name === f.name && x.size === f.size)) S.files.push(f); });
    renderFiles(); showHint(errs.join(' '));
  }
  function sample() {
    const A = ['Ana', 'Bruno', 'Carla', 'Diego'], Ar = ['Financeiro', 'Comercial', 'Operações'], St = ['Concluído', 'Em andamento', 'Pendente', 'Concluído'];
    const rows = ['Data\tResponsável\tÁrea\tStatus\tHoras\tValor (R$)'];
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 7, 3 + i * 3), p = n => String(n).padStart(2, '0');
      rows.push([`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, A[i % 4], Ar[i % 3], St[(i * 7) % 4], 4 + (i * 5) % 9, 1200 + (i * 377) % 2800].join('\t'));
    }
    $('#prompt').value = rows.join('\n'); showHint('');
  }

  async function generate() {
    const text = $('#prompt').value.trim();
    if (!text && !S.files.length) return showHint('Descreva a análise, cole uma tabela ou anexe um arquivo para começar.');
    showHint(''); setLoading(true, 'Interpretando seus dados…'); await tick();
    try {
      const notes = [], list = []; let instr = '';
      if (text) { const r = SDParser.parseText(text); if (r.ds) list.push(r.ds); instr = r.instruction; notes.push(...r.notes); }
      for (const f of S.files) { const r = await SDParser.parseFile(f); if (r.ds) list.push(r.ds); if (r.instruction) instr += ' ' + r.instruction; notes.push(...r.notes); }
      const ds = SDParser.combine(list, notes);
      if (!ds) { setLoading(false); return showHint('Não encontrei dados tabulares. Cole uma tabela (com cabeçalho), CSV, JSON ou anexe uma planilha — a instrução sozinha não gera dashboards.'); }
      S.ds = ds; S.orig = { ...ds, rows: ds.rows.map(r => ({ ...r })), columns: ds.columns.map(c => ({ ...c })) }; S.modified = false;
      S.instruction = instr.trim(); S.filters = emptyF(); S.dismissed = false; S.chat = [];
      S.history.push(S.instruction || text.slice(0, 80) || S.files.map(f => f.name).join(', '));
      rebuild();
      S.tab = pickTab(S.instruction);
      showResults();
      chat('a', E.describe(S.profile) + ' Gerei os quatro dashboards a partir dos dados reais.' + (notes.length ? ' ' + notes.join(' ') : ''));
      if (S.instruction) { const r = SDCommands.run(S.instruction, ctx, true); if (r) chat('a', r.msg); }
    } catch (e) { showHint(e.message || 'Não foi possível ler os dados.'); }
    finally { setLoading(false); }
  }
  function pickTab(t) {
    const n = SDParser.norm(t);
    if (/dashboard executivo|executiv/.test(n)) return 'executive';
    if (/dashboard operacional|operac|produtiv|gargalo|demanda|equipe/.test(n)) return 'operational';
    if (/analitic|compar|cruz|detalh|distribui/.test(n)) return 'analytical';
    return 'executive';
  }
  function rebuild() {
    S.profile = E.profile(S.ds, S.instruction);
    S.dash = E.buildAll(S.profile);
    S.insights = SDInsights.assess(S.ds, S.profile);
  }

  /* ---------- resultados ---------- */
  function showResults() {
    $('#viewHome').hidden = true; $('#viewResults').hidden = false; $('#btnNew').hidden = false; $('#btnPanel').hidden = false;
    renderAll(true); window.scrollTo(0, 0);
  }
  function goHome() { $('#viewHome').hidden = false; $('#viewResults').hidden = true; $('#btnNew').hidden = true; $('#btnPanel').hidden = true; $('#panel').hidden = true; renderHome(); }
  function renderAll(anim) { renderTabs(); renderBanner(); renderFilters(); renderBuilder(); renderBoard(anim); syncPanel(); renderChat(); }
  function goTab(t) { S.tab = t; renderTabs(); renderFilters(); renderBuilder(); renderBoard(true); syncPanel(); }
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}${k === 'insights' ? `<span class="q-badge" title="Qualidade dos dados">${S.insights.score}</span>` : ''}</button>`).join('');
  }
  function renderBanner() {
    const b = $('#banner'), warn = S.insights.items.filter(i => i.level === 'warn').length;
    if (S.dismissed || !warn || S.tab === 'insights') { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = `<span>Qualidade dos dados: <strong>${S.insights.score}/100</strong>. Encontramos ${warn} ponto(s) de atenção que podem afetar os resultados.</span><span><button class="btn ghost" data-go="insights">Ver Insights &amp; Melhorias</button> <button class="link" data-dismiss>Dispensar</button></span>`;
  }
  function filterDesc() {
    const f = S.filters, out = [];
    if (f.months.length) out.push('Mês: ' + f.months.map(m => E.MFULL[m - 1]).join(', '));
    if (f.years.length) out.push('Ano: ' + f.years.join(', '));
    if (f.from || f.to) out.push(`Período: ${f.from || '…'} a ${f.to || '…'}`);
    Object.entries(f.dims).forEach(([k, v]) => { if (v.length) out.push(`${k}: ${v.join(', ')}`); });
    return out;
  }
  function renderFilters() {
    const box = $('#filters');
    if (S.tab === 'insights') { box.hidden = true; return; }
    box.hidden = false;
    const openIdx = $$('.fdrop', box).findIndex(d => d.open), f = S.filters, p = S.profile;
    let h = '';
    p.dims.slice(0, 5).forEach(c => {
      const sel = f.dims[c.name] || [];
      h += `<details class="fdrop" data-on="${sel.length > 0}"><summary>${esc(c.name)}${sel.length ? ` (${sel.length})` : ''} ▾</summary><div class="fmenu">${uniqVals(c.name).map(v => `<label><input type="checkbox" data-fc="${esc(c.name)}" value="${esc(v)}"${sel.includes(v) ? ' checked' : ''}> ${esc(v)}</label>`).join('')}</div></details>`;
    });
    if (p.date) h += `<label>De <input type="date" id="fFrom" value="${esc(f.from)}"></label><label>até <input type="date" id="fTo" value="${esc(f.to)}"></label>`;
    f.months.forEach(m => { h += `<span class="fchip2">Mês: ${E.MFULL[m - 1]}</span>`; }); f.years.forEach(y => { h += `<span class="fchip2">Ano: ${y}</span>`; });
    if (filterDesc().length) h += '<button class="link" id="fClear">Limpar filtros</button>';
    box.innerHTML = h || '<span class="muted">Sem filtros disponíveis para estes dados.</span>';
    if (openIdx > -1) { const d = $$('.fdrop', box)[openIdx]; if (d) d.open = true; }
  }
  function renderBuilder() {
    const b = $('#builder');
    if (S.tab !== 'custom') { b.hidden = true; return; }
    b.hidden = false; const p = S.profile;
    const o = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`;
    b.innerHTML = `<label class="fld">Tipo de visualização<select id="bType">${[['kpi', 'Indicador (KPI)'], ['bar', 'Barras'], ['hbar', 'Barras horizontais'], ['line', 'Linha'], ['doughnut', 'Rosca'], ['pie', 'Pizza'], ['stacked', 'Barras empilhadas'], ['heatmap', 'Mapa de calor'], ['scatter', 'Dispersão'], ['grouptable', 'Tabela agrupada']].map(x => o(...x)).join('')}</select></label>
      <label class="fld" data-f="m">Medida<select id="bM">${o('', 'Contagem de registros')}${p.measures.map(c => o(c.name, c.name)).join('')}</select></label>
      <label class="fld" data-f="agg">Agregação<select id="bAgg">${[['sum', 'Soma'], ['avg', 'Média'], ['max', 'Máximo'], ['min', 'Mínimo']].map(x => o(...x)).join('')}</select></label>
      <label class="fld" data-f="dim">Dimensão<select id="bDim">${p.dims.map(c => o('c:' + c.name, c.name)).join('')}${p.dates.map(c => o('d:' + c.name, 'Tempo: ' + c.name)).join('')}</select></label>
      <label class="fld" data-f="dim2">Segunda dimensão<select id="bDim2">${p.dims.map(c => o(c.name, c.name)).join('')}</select></label>
      <label class="fld" data-f="m2">Segunda medida<select id="bM2">${p.measures.map(c => o(c.name, c.name)).join('')}</select></label>
      <button class="btn primary" id="bAdd">Adicionar ao dashboard</button>`;
    bToggle();
  }
  function bToggle() {
    const t = $('#bType').value, show = { kpi: ['m', 'agg'], bar: ['m', 'agg', 'dim'], hbar: ['m', 'agg', 'dim'], line: ['m', 'agg', 'dim'], doughnut: ['m', 'agg', 'dim'], pie: ['m', 'agg', 'dim'], stacked: ['dim', 'dim2'], heatmap: ['dim', 'dim2'], scatter: ['m', 'm2'], grouptable: ['dim'] }[t];
    $$('#builder [data-f]').forEach(l => { l.hidden = !show.includes(l.dataset.f); });
  }
  function builderAdd() {
    const p = S.profile, t = $('#bType').value, m = $('#bM').value || null, agg = m ? $('#bAgg').value : 'count', dv = $('#bDim').value || '', d2 = $('#bDim2').value, m2 = $('#bM2').value;
    const dim = dv.slice(2), isDate = dv.startsWith('d:'), cap = E.cap;
    const mt = m ? `${agg === 'avg' ? 'média de ' : agg === 'sum' ? 'total de ' : agg === 'max' ? 'máximo de ' : 'mínimo de '}${m}` : 'registros';
    let spec;
    if (t === 'kpi') spec = { kind: 'kpi', title: cap(mt), m, agg, span: 3 };
    else if (['bar', 'hbar', 'line', 'doughnut', 'pie'].includes(t)) {
      if (!dim) return toast('Os dados não têm uma dimensão para este gráfico.', true);
      spec = isDate ? { kind: 'chart', data: 'time', chart: t, title: `${cap(mt)} ao longo de ${dim}`, m, agg, date: dim, span: 6 } : { kind: 'chart', data: 'group', chart: t, title: `${cap(mt)} por ${dim}`, m, agg, dim, limit: 8, span: 6 };
    } else if (t === 'stacked' || t === 'heatmap') {
      if (isDate || !dim || !d2 || dim === d2) return toast('Escolha duas dimensões de categoria diferentes.', true);
      spec = t === 'stacked' ? { kind: 'chart', data: 'stacked', chart: 'stacked', title: `${dim} × ${d2}`, dim, dim2: d2, span: 6 } : { kind: 'heatmap', title: `Mapa de calor: ${dim} × ${d2}`, dim, dim2: d2, span: 12 };
    } else if (t === 'scatter') {
      if (p.measures.length < 2 || !m || m === m2) return toast('A dispersão precisa de duas medidas numéricas diferentes.', true);
      spec = { kind: 'chart', data: 'scatter', chart: 'scatter', title: `${m} × ${m2}`, m, m2, span: 6 };
    } else { if (!dim || isDate) return toast('Escolha uma dimensão de categoria.', true); spec = { kind: 'grouptable', title: 'Resumo por ' + dim, dim, span: 12 }; }
    S.dash.custom.push(E.W(spec)); renderBoard(false); renderPanelWidgets(); toast('Visualização adicionada.');
  }

  function renderBoard(animate) {
    if (!S.ds) return;
    const ins = S.tab === 'insights';
    $('#capture').hidden = ins; $('#insightsView').hidden = !ins;
    if (ins) { renderInsights(); return; }
    const rows = curRows(), title = S.prefs.titles[S.tab] || DEF_TITLES[S.tab];
    $('#capTitle').textContent = title;
    const fd = filterDesc();
    $('#capSub').textContent = `${rows.length} de ${S.ds.rows.length} registros${fd.length ? ' · ' + fd.join(' · ') : ''} · ${new Date().toLocaleDateString('pt-BR')}`;
    SDRender.render($('#board'), S.dash[S.tab], { prefs: S.prefs, animate: !!animate }, S.profile, rows);
  }

  function renderInsights() {
    const I = S.insights, box = $('#insightsView');
    const bar = (l, v) => `<div class="bar-row"><div><span>${l}</span><strong>${v}%</strong></div><div class="bar"><i style="width:${v}%"></i></div></div>`;
    const lab = I.score >= 85 ? 'Boa qualidade' : I.score >= 65 ? 'Qualidade moderada' : 'Precisa de atenção';
    box.innerHTML = `<div class="ins-grid"><div class="panelbox"><div class="ring" style="--p:${I.score}"><span>${I.score}</span></div><p style="text-align:center;font-weight:600;margin:0 0 12px">${lab}</p>${bar('Completude', I.parts.completeness)}${bar('Consistência', I.parts.consistency)}${bar('Sem duplicidade', I.parts.duplicates)}<p class="muted small">Calculado sobre ${S.ds.rows.length} registros e ${S.ds.columns.length} colunas.</p>${S.modified ? '<button class="btn ghost wide" id="iRestore">Restaurar dados originais</button>' : ''}</div>
      <div class="panelbox"><h3 style="margin:0 0 4px">Recomendações para seus dados</h3>${I.items.map((i, k) => `<div class="ins"><span class="dot ${i.level}"></span><span>${esc(i.text)}</span>${i.action ? `<button class="btn ghost" data-ins="${k}">${esc(i.action.label)}</button>` : ''}</div>`).join('')}</div></div>`;
  }
  async function applyInsight(k) {
    const a = S.insights.items[k].action;
    const msg = a.id === 'dedupe' ? 'Registros duplicados serão excluídos da análise (mantendo a primeira ocorrência). Os dados originais continuam disponíveis para restauração nesta sessão.' : `Esta correção altera valores na análise: "${a.label}". Os dados originais continuam disponíveis para restauração nesta sessão.`;
    if (!await confirmDlg('Aplicar correção?', msg, 'Aplicar')) return;
    const r = SDInsights.apply(a, S.ds);
    if (!r.changed) return toast('Nada precisou ser alterado.');
    S.ds = r.ds; S.modified = true; S.filters = emptyF(); rebuild(); renderAll(false); toast(`Correção aplicada: ${r.changed} alteração(ões). Dashboards atualizados.`);
  }
  function restoreOriginal() {
    S.ds = { ...S.orig, rows: S.orig.rows.map(r => ({ ...r })), columns: S.orig.columns.map(c => ({ ...c })) }; S.modified = false; S.filters = emptyF();
    rebuild(); renderAll(false); toast('Dados originais restaurados.');
  }

  /* ---------- chat ---------- */
  function chat(role, text, err) { S.chat.push({ role, text, err }); renderChat(); }
  function renderChat() {
    const c = $('#chatlog');
    c.innerHTML = S.chat.slice(-6).map(m => `<div class="msg ${m.role === 'u' ? 'u' : 'a'}${m.err ? ' err' : ''}">${esc(m.text)}</div>`).join('');
    c.scrollTop = c.scrollHeight;
  }
  function runCommand(t) {
    if (!t.trim()) return;
    chat('u', t);
    const r = SDCommands.run(t, ctx);
    chat('a', r.msg, !r.ok);
  }

  /* ---------- contexto para comandos ---------- */
  const allW = () => Object.values(S.dash).flat();
  const ctx = {
    restoreTheme() { S.prefs = defPrefs(); allW().forEach(w => { delete w.color; delete w.userChart; }); commit(true); },
    setColor, setTheme(t) { S.prefs.theme = t; commit(true); }, setLegend(b) { S.prefs.legend = b; commit(true); },
    setChartType(from, to) {
      let n = 0;
      allW().forEach(w => { if (!SDRender.isSeries(w)) return; const cur = SDRender.chartType(w, S.prefs); if ((from && cur !== from) || cur === to) return; w.chart = to; w.userChart = true; n++; });
      if (n) renderBoard(false); return n;
    },
    setLimit(n) { let k = 0; allW().forEach(w => { if (w.kind === 'chart' && w.data === 'group') { w.limit = n; k++; } }); renderBoard(false); return k; },
    clearFilters() { S.filters = emptyF(); renderFilters(); renderBoard(false); },
    mergeFilters(f) { const F = S.filters; if (f.months.length) F.months = f.months; if (f.years.length) F.years = f.years; Object.entries(f.dims).forEach(([k, v]) => { F.dims[k] = v; }); renderFilters(); renderBoard(false); },
    hasDate: () => !!S.profile.date, rowCount: () => curRows().length,
    dimValues: () => S.profile.dims.map(c => ({ col: c.name, values: uniqVals(c.name).filter(v => v !== '(Sem valor)') })),
    removeWidgets(pred) { let n = 0; Object.keys(S.dash).forEach(k => { const b = S.dash[k].length; S.dash[k] = S.dash[k].filter(w => !pred(w)); n += b - S.dash[k].length; }); if (n) { renderBoard(false); renderPanelWidgets(); } return n; },
    col: n => E.colOf(S.profile, n), person: () => S.profile.person, status: () => S.profile.status, dims: () => S.profile.dims, measures: () => S.profile.measures, primaryMeasure: () => S.profile.primaryMeasure,
    addWidget(tab, spec) { S.dash[tab].push(E.W(spec)); },
    goTab,
    presentation() {
      const ord = { kpi: 0, chart: 1, heatmap: 1, highlights: 2, notice: 3 };
      S.dash.executive = S.dash.executive.filter(w => !['datatable', 'grouptable'].includes(w.kind)).sort((a, b) => (ord[a.kind] ?? 4) - (ord[b.kind] ?? 4));
      S.prefs.cardSize = 'large'; S.prefs.legend = true; S.tab = 'executive'; savePrefs(); applyTheme(); renderAll(true);
    }
  };

  /* ---------- painel de personalização ---------- */
  function syncPanel() {
    const P = S.prefs;
    $('#pPrimary').value = P.primary; if (document.activeElement !== $('#pPrimaryHex')) $('#pPrimaryHex').value = P.primary.toUpperCase();
    $('#pPresets').innerHTML = E.PRESETS.map(x => `<button class="sw" data-preset="${x.name}" aria-pressed="${P.preset === x.name}"><i style="background:${x.primary}"></i>${x.name}</button>`).join('');
    $$('#pTheme button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === P.theme)));
    $('#pBg').value = P.bg || (P.theme === 'dark' ? '#121316' : '#F5F6F8');
    $('#pLegend').checked = P.legend; $('#pFormat').value = P.chartFormat; $('#pSize').value = P.cardSize;
    const ti = $('#pTitle'); ti.disabled = S.tab === 'insights' || !S.ds; if (document.activeElement !== ti) ti.value = DEF_TITLES[S.tab] ? (P.titles[S.tab] || DEF_TITLES[S.tab]) : '';
    renderPanelWidgets();
  }
  function renderPanelWidgets() {
    const box = $('#pWidgets'); if (!S.dash || !S.dash[S.tab]) { box.innerHTML = '<p class="muted small">Abra um dashboard.</p>'; return; }
    box.innerHTML = S.dash[S.tab].map((w, i) => `<div class="pw" data-w="${w.id}"><input type="text" data-f="title" value="${esc(w.title)}" aria-label="Título"><input type="color" data-f="color" value="${w.color || S.prefs.palette[0]}" aria-label="Cor"${w.kind === 'chart' ? '' : ' hidden'}><button class="ib" data-mv="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>${ICON.up}</button><button class="ib" data-mv="1" aria-label="Descer"${i === S.dash[S.tab].length - 1 ? ' disabled' : ''}>${ICON.down}</button></div>`).join('') || '<p class="muted small">Sem visualizações.</p>';
  }
  function moveW(id, delta) { const a = S.dash[S.tab], i = a.findIndex(w => w.id === id), j = i + delta; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; renderBoard(false); renderPanelWidgets(); }
  function moveBefore(src, dst) { const a = S.dash[S.tab], i = a.findIndex(w => w.id === src); if (i < 0) return; const [w] = a.splice(i, 1); a.splice(a.findIndex(x => x.id === dst), 0, w); renderBoard(false); renderPanelWidgets(); }

  /* ---------- configuração de widget ---------- */
  async function editWidget(w) {
    const p = S.profile, series = SDRender.isSeries(w), o = (v, l, s) => `<option value="${esc(v)}"${s ? ' selected' : ''}>${esc(l)}</option>`;
    const simpleAgg = ['sum', 'avg', 'max', 'min', 'count'].includes(w.agg);
    let h = `<form method="dialog" class="dlg"><h2>Configurar visualização</h2><label class="fld">Título<input type="text" name="title" value="${esc(w.title)}" maxlength="90"></label>`;
    if (series) h += `<label class="fld">Formato<select name="chart">${[['bar', 'Barras'], ['hbar', 'Barras horizontais'], ['line', 'Linha'], ['area', 'Área'], ['doughnut', 'Rosca'], ['pie', 'Pizza']].map(([v, l]) => o(v, l, SDRender.chartType(w, S.prefs) === v)).join('')}</select></label>`;
    if ((w.kind === 'kpi' && simpleAgg) || series || w.data === 'hist') {
      h += `<label class="fld">Medida<select name="m">${w.data === 'hist' ? '' : o('', 'Contagem de registros', !w.m)}${p.measures.map(c => o(c.name, c.name, w.m === c.name)).join('')}</select></label>`;
      if (w.data !== 'hist') h += `<label class="fld">Agregação<select name="agg">${[['sum', 'Soma'], ['avg', 'Média'], ['max', 'Máximo'], ['min', 'Mínimo']].map(([v, l]) => o(v, l, w.agg === v)).join('')}</select></label>`;
    }
    if (w.data === 'group') h += `<label class="fld">Agrupar por<select name="dim">${p.dims.map(c => o(c.name, c.name, w.dim === c.name)).join('')}</select></label><label class="fld">Máximo de itens<select name="limit">${[5, 8, 10, 15, 20].map(n => o(n, n, (w.limit || 8) === n)).join('')}</select></label>`;
    if (w.data === 'time') h += `<label class="fld">Coluna de data<select name="date">${p.dates.map(c => o(c.name, c.name, w.date === c.name)).join('')}</select></label><label class="fld">Granularidade<select name="grain">${[['auto', 'Automática'], ['day', 'Dia'], ['month', 'Mês'], ['year', 'Ano']].map(([v, l]) => o(v, l, (w.grain || 'auto') === v)).join('')}</select></label>`;
    h += `<label class="fld">Largura<select name="span">${[[3, 'Pequeno'], [4, 'Compacto'], [6, 'Médio'], [8, 'Largo'], [12, 'Total']].map(([v, l]) => o(v, l, +w.span === v)).join('')}</select></label>`;
    if (w.kind === 'chart') h += `<label class="check mt"><input type="checkbox" name="usecolor"${w.color ? ' checked' : ''}> Usar cor própria <input type="color" name="color" value="${w.color || S.prefs.palette[0]}"></label>`;
    h += '<div class="dlg-f"><button class="btn ghost" value="cancel">Cancelar</button><button class="btn primary" value="ok">Aplicar</button></div></form>';
    const { val, fd } = await openDlg(h); if (val !== 'ok' || !fd) return;
    const g = k => fd.get(k);
    if (g('title') && g('title').trim()) w.title = g('title').trim();
    if (g('chart') && g('chart') !== SDRender.chartType(w, S.prefs)) { w.chart = g('chart'); w.userChart = true; }
    if (fd.has('m') || w.data === 'hist') w.m = g('m') || null;
    if (fd.has('agg')) w.agg = w.m ? g('agg') : 'count'; else if (w.kind !== 'kpi' && series && !w.m) w.agg = 'count';
    ['dim', 'date', 'grain'].forEach(k => { if (fd.has(k)) w[k] = g(k); });
    if (fd.has('limit')) w.limit = +g('limit');
    w.span = +g('span');
    if (w.kind === 'chart') { if (g('usecolor')) w.color = g('color'); else delete w.color; }
    renderBoard(false); renderPanelWidgets();
  }

  /* ---------- eventos ---------- */
  function wire() {
    $('#clipIc').innerHTML = ICON.clip; $('#sendIc').innerHTML = ICON.send;
    $('#suggestions').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { $('#prompt').value = b.textContent; $('#prompt').focus(); } });
    $('#history').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { $('#prompt').value = b.title; $('#prompt').focus(); } });
    $('#fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    $('#fileList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { S.files.splice(+b.dataset.rm, 1); renderFiles(); } });
    $('#btnSample').addEventListener('click', sample);
    $('#btnGenerate').addEventListener('click', generate);
    $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });
    const comp = $('#composer');
    ['dragover', 'dragenter'].forEach(ev => comp.addEventListener(ev, e => { e.preventDefault(); comp.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => comp.addEventListener(ev, e => { e.preventDefault(); comp.classList.remove('drag'); if (ev === 'drop' && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }));
    $('#brand').addEventListener('click', e => { e.preventDefault(); if (S.ds) goHome(); });
    $('#btnNew').addEventListener('click', goHome);
    $('#btnPanel').addEventListener('click', () => { const p = $('#panel'); p.hidden = !p.hidden; });
    $('#panelClose').addEventListener('click', () => { $('#panel').hidden = true; });

    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab(b.dataset.tab); });
    $('#banner').addEventListener('click', e => { if (e.target.closest('[data-go]')) goTab('insights'); if (e.target.closest('[data-dismiss]')) { S.dismissed = true; renderBanner(); } });
    $('#insightsView').addEventListener('click', e => { const b = e.target.closest('[data-ins]'); if (b) applyInsight(+b.dataset.ins); if (e.target.closest('#iRestore')) restoreOriginal(); });
    $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#cmd'); const t = i.value; i.value = ''; runCommand(t); });

    const F = $('#filters');
    F.addEventListener('change', e => {
      const t = e.target, f = S.filters;
      if (t.dataset.fc) { const a = f.dims[t.dataset.fc] = f.dims[t.dataset.fc] || []; if (t.checked) a.push(t.value); else a.splice(a.indexOf(t.value), 1); }
      else if (t.id === 'fFrom') f.from = t.value; else if (t.id === 'fTo') f.to = t.value; else return;
      renderFilters(); renderBoard(false);
    });
    F.addEventListener('click', e => { if (e.target.id === 'fClear') ctx.clearFilters(); });
    document.addEventListener('click', e => {
      $$('.fdrop[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
      if (!e.target.closest('.menu')) $('#exportMenu').hidden = true;
    });
    $('#builder').addEventListener('change', e => { if (e.target.id === 'bType') bToggle(); });
    $('#builder').addEventListener('click', e => { if (e.target.id === 'bAdd') builderAdd(); });

    const board = $('#board');
    board.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const card = b.closest('.card'), w = findW(card.dataset.id); if (!w) return;
      try {
        if (b.dataset.act === 'copy') { const r = await SDExport.copy(card, w.title); toast(r === 'copied' ? 'Copiado como imagem. Cole no PowerPoint com Ctrl+V.' : 'Este navegador não permite copiar imagens; o PNG foi baixado.'); }
        else if (b.dataset.act === 'png') { await SDExport.png(card, w.title); toast('PNG baixado.'); }
        else if (b.dataset.act === 'cfg') editWidget(w);
        else if (b.dataset.act === 'del') { S.dash[S.tab] = S.dash[S.tab].filter(x => x.id !== w.id); renderBoard(false); renderPanelWidgets(); }
      } catch (err) { toast(err.message || 'Não foi possível exportar.', true); }
    });
    let dragId = null;
    board.addEventListener('mousedown', e => { const g = e.target.closest('.grip'); if (g) g.closest('.card').draggable = true; });
    board.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.card'); if (!c || !c.draggable) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    board.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); $$('.card.over').forEach(x => x.classList.remove('over')); const c = e.target.closest('.card'); if (c && c.dataset.id !== dragId) c.classList.add('over'); });
    board.addEventListener('drop', e => { if (!dragId) return; e.preventDefault(); const c = e.target.closest('.card'); if (c && c.dataset.id !== dragId) moveBefore(dragId, c.dataset.id); });
    board.addEventListener('dragend', () => { dragId = null; $$('.card', board).forEach(c => { c.classList.remove('dragging', 'over'); c.draggable = false; }); });

    $('#btnCopyDash').addEventListener('click', async () => {
      if (S.tab === 'insights') return toast('Abra um dashboard para copiá-lo.', true);
      try { const r = await SDExport.copy($('#capture'), S.prefs.titles[S.tab] || DEF_TITLES[S.tab]); toast(r === 'copied' ? 'Dashboard copiado como imagem.' : 'Este navegador não permite copiar imagens; o PNG foi baixado.'); } catch (err) { toast(err.message, true); }
    });
    $('#btnExport').addEventListener('click', () => { const m = $('#exportMenu'); m.hidden = !m.hidden; });
    $('#exportMenu').addEventListener('click', async e => {
      const b = e.target.closest('[data-exp]'); if (!b) return; $('#exportMenu').hidden = true;
      const name = S.prefs.titles[S.tab] || DEF_TITLES[S.tab] || 'dashboard';
      try {
        if (b.dataset.exp === 'csv') { SDExport.csv(S.ds, curRows(), 'dados-processados'); return toast('CSV exportado.'); }
        if (S.tab === 'insights') return toast('Abra um dashboard para exportá-lo.', true);
        setLoading(true, 'Gerando arquivo…'); await tick();
        await (b.dataset.exp === 'pdf' ? SDExport.pdf($('#capture'), name) : SDExport.png($('#capture'), name));
        toast('Arquivo exportado.');
      } catch (err) { toast(err.message || 'Falha na exportação.', true); } finally { setLoading(false); }
    });

    /* painel */
    $('#pPrimary').addEventListener('input', e => setColor(e.target.value, null));
    $('#pPrimaryHex').addEventListener('change', e => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v, null); else { toast('Use o formato #RRGGBB.', true); syncPanel(); } });
    $('#pPresets').addEventListener('click', e => { const b = e.target.closest('[data-preset]'); if (b) setColor(null, b.dataset.preset); });
    $('#pTheme').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { S.prefs.theme = b.dataset.v; commit(true); } });
    $('#pBg').addEventListener('input', e => { S.prefs.bg = e.target.value; commit(false); });
    $('#pBgReset').addEventListener('click', () => { S.prefs.bg = null; commit(false); });
    $('#pLegend').addEventListener('change', e => { S.prefs.legend = e.target.checked; commit(true); });
    $('#pFormat').addEventListener('change', e => { S.prefs.chartFormat = e.target.value; allW().forEach(w => { delete w.userChart; }); commit(true); });
    $('#pSize').addEventListener('change', e => { S.prefs.cardSize = e.target.value; commit(true); });
    $('#pTitle').addEventListener('input', e => { if (!DEF_TITLES[S.tab]) return; S.prefs.titles[S.tab] = e.target.value.slice(0, 80); $('#capTitle').textContent = e.target.value || DEF_TITLES[S.tab]; savePrefs(); });
    $('#pReset').addEventListener('click', () => { ctx.restoreTheme(); toast('Tema original restaurado.'); });
    const pw = $('#pWidgets');
    pw.addEventListener('input', e => {
      const row = e.target.closest('.pw'); if (!row) return; const w = findW(row.dataset.w); if (!w) return;
      if (e.target.dataset.f === 'title') { w.title = e.target.value; const t = $(`.card[data-id="${w.id}"] .card-t`); if (t) t.textContent = w.title; }
      if (e.target.dataset.f === 'color') { w.color = e.target.value; schedule(); }
    });
    pw.addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (b) moveW(b.closest('.pw').dataset.w, +b.dataset.mv); });
  }

  applyTheme(); renderHome(); wire();
})();
