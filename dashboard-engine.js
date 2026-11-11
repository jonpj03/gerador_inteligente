/* Smart Dash Studio — perfil dos dados, especificação e cálculo dos widgets */
const SDEngine = (() => {
  const N = SDParser.norm;
  const RX = {
    person: /respons|professor|docente|aluno|colaborad|analista|equipe|\btime\b|vendedor|atendente|funcion|pessoa|\bnome\b|owner|dono|assignee|tecnico|agente|operador|gerente|consultor/,
    status: /status|situacao|etapa|fase|estagio|andamento/,
    target: /\bmeta\b|target|planejad|previst|orcad|objetivo/,
    finance: /valor|custo|receita|preco|faturam|despesa|lucro|venda|r\$|orcamento|pagament|salario|comiss/,
    avg: /media|taxa|nota|score|%|tempo|prazo|dias|idade|percent|ticket|pontua/,
    done: /conclu|finaliz|done|fechad|entreg|resolvid|encerrad|pronto|aprovad/
  };
  const MPT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MFULL = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const isDone = s => { const n = N(s); return RX.done.test(n) && !/nao|incompl|pendent|parcial|atras/.test(n); };
  const isFin = c => c.type === 'currency' || RX.finance.test(N(c.name));
  const aggFor = c => (c.type === 'percent' || RX.avg.test(N(c.name))) ? 'avg' : 'sum';
  const MEAS = ['number', 'percent', 'currency'];
  const AGGL = { sum: 'Soma', avg: 'Média', median: 'Mediana', min: 'Mínimo', max: 'Máximo', count: 'Contagem', distinct: 'Contagem distinta', list: 'Lista de valores', doneRate: 'Taxa de conclusão' };
  const aggLabel = (m, a) => m ? `${AGGL[a] || a} de ${m}` : 'Registros';
  let _id = 0; const nid = () => 'w' + (++_id);

  /* ---------- cores ---------- */
  const hex2hsl = h => {
    let r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0; const L = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn; S = L > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      H = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60;
    }
    return [H, S, L];
  };
  const hsl2hex = (h, s, l) => {
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * v).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  };
  const withL = (hex, dl) => { const [h, s, l] = hex2hsl(hex); return hsl2hex(h, s, Math.max(.1, Math.min(.93, l + dl))); };
  const soft = (hex, dark) => { const [h, s] = hex2hsl(hex); return dark ? hsl2hex(h, s * .5, .17) : hsl2hex(h, Math.min(s, .85), .94); };
  const makePalette = hex => [0, -.14, .14, -.26, .26, -.07, .07, .34].map(d => withL(hex, d));
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PRESETS = [
    { name: 'Magenta', primary: '#C2185B', palette: ['#C2185B', '#880E4F', '#E91E63', '#F06292', '#AD1457', '#F8BBD0', '#6A1B4D', '#9C27B0'] },
    { name: 'Azul', primary: '#1565C0' }, { name: 'Verde', primary: '#2E7D32' }, { name: 'Roxo', primary: '#6A1B9A' }, { name: 'Laranja', primary: '#E65100' },
    { name: 'Corporativo', primary: '#1F3A5F', palette: ['#1F3A5F', '#2E86AB', '#7A8B99', '#C2185B', '#F2A900', '#4C9F70', '#8E6C8A', '#5B5B5B'] },
    { name: 'Grafite', primary: '#455A64' }, { name: 'Turquesa', primary: '#00796B' },
    { name: 'Multicor', primary: '#C2185B', palette: ['#C2185B', '#1565C0', '#2E7D32', '#F9A825', '#6A1B9A', '#00838F', '#E65100', '#546E7A'] }
  ].map(p => ({ ...p, palette: p.palette || makePalette(p.primary) }));

  /* ---------- formatação ---------- */
  const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const nfc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  function fmt(v, type, compact) {
    if (v == null || isNaN(v)) return '—';
    const s = compact && Math.abs(v) >= 1e5 ? nfc.format(v) : nf.format(v);
    return type === 'currency' ? 'R$ ' + s : type === 'percent' ? s + '%' : s;
  }

  /* ---------- perfil ---------- */
  function profile(ds, focus) {
    const f = N(focus || ''), cols = ds.columns;
    const men = c => f && f.includes(N(c.name)) ? 1 : 0;
    const by = (a, b) => men(b) - men(a);
    const p = { ds, focus: f };
    p.measures = cols.filter(c => MEAS.includes(c.type)).sort(by);
    p.dates = cols.filter(c => c.type === 'date').sort(by);
    p.date = p.dates[0] || null;
    const cats = cols.filter(c => c.type === 'category' && c.unique >= 2);
    p.person = cats.find(c => RX.person.test(N(c.name))) || null;
    p.status = cats.find(c => RX.status.test(N(c.name))) ||
      cats.find(c => c.unique <= 10 && ds.rows.some(r => r[c.name] && isDone(r[c.name]))) || null;
    p.target = p.measures.find(c => RX.target.test(N(c.name))) || null;
    p.dims = cats.filter(c => c.unique <= 500).sort(by);
    const rank = c => men(c) * 10 + (c === p.person ? 3 : c === p.status ? 0 : 1);
    p.dimsOrdered = [...p.dims].sort((a, b) => rank(b) - rank(a));
    p.primaryMeasure = p.measures.find(c => !p.target || c !== p.target) || p.measures[0] || null;
    p.primaryDim = p.dimsOrdered.find(c => c !== p.status) || p.dimsOrdered[0] || null;
    p.isDone = isDone;
    return p;
  }

  /* ---------- construção dos dashboards ---------- */
  const W = o => { const w = { id: nid(), span: 6, agg: 'count', m: null, limit: 0, ...o }; if (w.span0 == null) w.span0 = w.span; return w; };
  const mTitle = (m, agg) => !m ? 'registros' : (agg === 'avg' ? 'média de ' : agg === 'sum' ? 'total de ' : '') + m.name;

  function buildExecutive(p) {
    const w = [], pm = p.primaryMeasure;
    w.push(W({ kind: 'kpi', title: 'Total de registros', span: 3 }));
    if (p.status && p.rows_done !== false && p.ds.rows.some(r => r[p.status.name] && isDone(r[p.status.name])))
      w.push(W({ kind: 'kpi', title: 'Taxa de conclusão', m: p.status.name, agg: 'doneRate', span: 3 }));
    p.measures.forEach(c => { if (w.length < 4) w.push(W({ kind: 'kpi', title: (aggFor(c) === 'avg' ? 'Média de ' : 'Total de ') + c.name, m: c.name, agg: aggFor(c), span: 3 })); });
    const agg = pm ? aggFor(pm) : 'count';
    if (p.date) w.push(W({ kind: 'chart', data: 'time', chart: 'line', title: 'Evolução de ' + mTitle(pm, agg), m: pm && pm.name, agg, date: p.date.name, span: 8 }));
    const catPie = p.status || p.dimsOrdered.find(c => c.unique <= 8 && c !== p.primaryDim);
    if (catPie) w.push(W({ kind: 'chart', data: 'group', chart: 'doughnut', title: 'Distribuição por ' + catPie.name, dim: catPie.name, limit: 8, span: p.date ? 4 : 6 }));
    if (p.primaryDim) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: (pm ? cap(mTitle(pm, agg)) : 'Registros') + ' por ' + p.primaryDim.name, m: pm && pm.name, agg, dim: p.primaryDim.name, span: 6 }));
    w.push(W({ kind: 'highlights', title: 'Destaques', span: 6 }));
    if (w.length < 3) w.unshift(W({ kind: 'notice', title: 'Dados limitados', text: 'Os dados têm poucas colunas numéricas, de data ou de categoria. Foram gerados apenas os indicadores possíveis.', span: 12 }));
    return w;
  }

  function buildOperational(p) {
    const w = [], S = p.status, P = p.person, pm = p.primaryMeasure;
    w.push(W({ kind: 'kpi', title: 'Volume de atividades', span: 3 }));
    if (S && p.ds.rows.some(r => r[S.name] && isDone(r[S.name]))) {
      w.push(W({ kind: 'kpi', title: 'Taxa de conclusão', m: S.name, agg: 'doneRate', span: 3 }));
    }
    if (P) w.push(W({ kind: 'kpi', title: 'Pessoas / equipes', m: P.name, agg: 'distinct', span: 3 }));
    if (pm && w.length < 4) w.push(W({ kind: 'kpi', title: (aggFor(pm) === 'avg' ? 'Média de ' : 'Total de ') + pm.name, m: pm.name, agg: aggFor(pm), span: 3 }));
    if (S) w.push(W({ kind: 'chart', data: 'group', chart: 'doughnut', title: 'Status das demandas', dim: S.name, limit: 8, span: P ? 4 : 6 }));
    if (S && P) w.push(W({ kind: 'chart', data: 'stacked', chart: 'stacked', title: `${P.name} × ${S.name}`, dim: P.name, dim2: S.name, span: 8 }));
    if (P) w.push(W({ kind: 'chart', data: 'group', chart: 'hbar', title: 'Distribuição de trabalho por ' + P.name, dim: P.name, span: 6 }));
    if (P && pm) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `Produtividade: ${mTitle(pm, aggFor(pm))} por ${P.name}`, m: pm.name, agg: aggFor(pm), dim: P.name, span: 6 }));
    if (p.date) w.push(W({ kind: 'chart', data: 'time', chart: 'bar', title: 'Volume de atividades no tempo', date: p.date.name, span: 6 }));
    if (!S && !P && p.primaryDim) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: 'Volume por ' + p.primaryDim.name, dim: p.primaryDim.name, span: 6 }));
    if (S) w.push(W({ kind: 'bottlenecks', title: 'Gargalos identificados', span: 12 }));
    else w.push(W({ kind: 'notice', title: 'Gargalos', text: 'Não há coluna de status nos dados, então não é possível apontar gargalos. Inclua uma coluna de situação (ex.: Pendente, Em andamento, Concluído).', span: 12 }));
    if (!P) w.push(W({ kind: 'notice', title: 'Distribuição de trabalho', text: 'Não identificamos uma coluna de responsável/equipe. Incluí-la permite analisar a carga de trabalho e a produtividade por pessoa.', span: 12 }));
    return w;
  }

  function buildAnalytical(p) {
    const w = [], pm = p.primaryMeasure, agg = pm ? aggFor(pm) : 'count', d1 = p.dimsOrdered[0], d2 = p.dimsOrdered[1];
    p.dimsOrdered.slice(0, 2).forEach(d => w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `${cap(mTitle(pm, agg))} por ${d.name}`, m: pm && pm.name, agg, dim: d.name, span: 6 })));
    const m2 = p.measures.find(c => c !== pm);
    if (m2 && d1) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `${cap(mTitle(m2, aggFor(m2)))} por ${d1.name}`, m: m2.name, agg: aggFor(m2), dim: d1.name, span: 6 }));
    if (p.date) w.push(W({ kind: 'chart', data: 'time', chart: 'line', title: 'Evolução temporal de ' + mTitle(pm, agg), m: pm && pm.name, agg, date: p.date.name, span: 6 }));
    if (d1 && d2) {
      if (d2.unique <= 6) w.push(W({ kind: 'chart', data: 'stacked', chart: 'stacked', title: `${d1.name} × ${d2.name}`, dim: d1.name, dim2: d2.name, span: 6 }));
      else w.push(W({ kind: 'heatmap', title: `Mapa de calor: ${d1.name} × ${d2.name}`, dim: d1.name, dim2: d2.name, span: 12 }));
    }
    if (p.measures.length >= 2) w.push(W({ kind: 'chart', data: 'scatter', chart: 'scatter', title: `${p.measures[0].name} × ${p.measures[1].name}`, m: p.measures[0].name, m2: p.measures[1].name, span: 6 }));
    if (pm && p.ds.rows.length >= 8) w.push(W({ kind: 'chart', data: 'hist', chart: 'bar', title: 'Distribuição de ' + pm.name, m: pm.name, span: 6 }));
    if (d1) w.push(W({ kind: 'grouptable', title: 'Resumo por ' + d1.name, dim: d1.name, span: 12 }));
    w.push(W({ kind: 'datatable', title: 'Dados detalhados', span: 12 }));
    return w;
  }

  function buildStrategic(p) {
    const w = [], pm = p.primaryMeasure, agg = pm ? aggFor(pm) : 'count', d = p.primaryDim;
    w.push(W({ kind: 'strategy', title: 'Resumo estratégico', span: 12 }));
    if (d && agg !== 'avg') w.push(W({ kind: 'chart', data: 'pareto', chart: 'pareto', title: `Pareto: ${cap(mTitle(pm, agg))} por ${d.name}`, m: pm && pm.name, agg, dim: d.name, limit: 20, span: 12 }));
    if (p.date) w.push(W({ kind: 'chart', data: 'time', chart: 'line', title: 'Tendência de ' + mTitle(pm, agg), m: pm && pm.name, agg, date: p.date.name, ma: 3, trend: true, span: p.target && d ? 6 : 12 }));
    if (p.target && pm && p.target !== pm && d) w.push(W({ kind: 'chart', data: 'compare', chart: 'bar', title: `Realizado × meta por ${d.name}`, m: pm.name, m2: p.target.name, agg: 'sum', dim: d.name, span: p.date ? 6 : 12 }));
    return w;
  }
  function buildAll(p) {
    const ex = buildExecutive(p);
    const custom = ex.filter(x => x.kind === 'kpi' || x.kind === 'chart').slice(0, 5).map(x => ({ ...x, id: nid() }));
    return { executive: ex, operational: buildOperational(p), analytical: buildAnalytical(p), strategic: buildStrategic(p), custom };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- cálculo ---------- */
  const colOf = (p, name) => p.ds.columns.find(c => c.name === name);
  function aggregate(rows, m, agg) {
    if (!m && agg !== 'doneRate') return rows.length;
    if (agg === 'count') { let n = 0; for (let i = 0; i < rows.length; i++) if (rows[i][m] != null) n++; return n; }
    if (agg === 'distinct') { const s = new Set(); for (const r of rows) { const v = r[m]; if (v != null) s.add(v instanceof Date ? v.getTime() : v); } return s.size; }
    if (agg === 'doneRate') { const ok = rows.filter(r => r[m] != null); return ok.length ? 100 * ok.filter(r => isDone(r[m])).length / ok.length : null; }
    if (agg === 'median') { const a = []; for (const r of rows) { const v = r[m]; if (typeof v === 'number') a.push(v); } if (!a.length) return null; a.sort((x, y) => x - y); const k = a.length >> 1; return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2; }
    if (agg === 'list') {
      const st = new Set(); for (const r of rows) { const v = r[m]; if (v != null) st.add(v instanceof Date ? SDParser.fmtDate(v) : String(v)); }
      const arr = [...st].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
      return arr.length ? arr.slice(0, 300).join(', ') + (arr.length > 300 ? ` (+${arr.length - 300})` : '') : null;
    }
    let n = 0, s = 0, mx = -Infinity, mn = Infinity;
    for (let i = 0; i < rows.length; i++) { const v = rows[i][m]; if (typeof v === 'number') { n++; s += v; if (v > mx) mx = v; if (v < mn) mn = v; } }
    if (!n) return null;
    return agg === 'sum' ? s : agg === 'avg' ? s / n : agg === 'max' ? mx : mn;
  }
  const keyOf = v => v == null || v === '' ? '(Sem valor)' : v;
  function groupRows(rows, dim, m, agg) {
    const g = new Map();
    rows.forEach(r => { const k = keyOf(r[dim]); if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    return [...g].map(([k, rs]) => ({ k, v: aggregate(rs, m, agg), n: rs.length }));
  }
  function autoGrain(rows, dc) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < rows.length; i++) { const d = rows[i][dc]; if (d) { const t = d.getTime(); if (t < mn) mn = t; if (t > mx) mx = t; } }
    if (mn === Infinity) return 'month';
    const span = (mx - mn) / 864e5;
    return span > 1800 ? 'year' : span > 75 ? 'month' : 'day';
  }
  const pk = (d, g) => g === 'year' ? String(d.getFullYear()) : g === 'quarter' ? `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` : g === 'week' ? SDParser.ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))) : g === 'month' ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : SDParser.ymd(d);
  function plabel(k, g) {
    if (g === 'year') return k;
    if (g === 'quarter') { const [y, q] = k.split('-Q'); return `T${q}/${y.slice(2)}`; }
    if (g === 'week') { const [, m, d] = k.split('-'); return `sem ${d}/${m}`; }
    if (g === 'month') { const [y, m] = k.split('-'); return `${MPT[+m - 1]}/${y.slice(2)}`; }
    const [y, m, d] = k.split('-'); return `${d}/${m}`;
  }
  function timeSeries(rows, dc, m, agg, grain) {
    const g = grain && grain !== 'auto' ? grain : autoGrain(rows, dc);
    const map = new Map();
    rows.forEach(r => { const d = r[dc]; if (!d) return; const k = pk(d, g); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    let keys = [...map.keys()].sort();
    if (g === 'month' && keys.length > 1 && (agg === 'sum' || agg === 'count' || !m)) {
      const [y0, m0] = keys[0].split('-').map(Number), [y1, m1] = keys[keys.length - 1].split('-').map(Number);
      const all = []; let y = y0, mo = m0;
      while ((y < y1 || (y === y1 && mo <= m1)) && all.length < 240) { all.push(`${y}-${String(mo).padStart(2, '0')}`); if (++mo > 12) { mo = 1; y++; } }
      keys = all;
    }
    return { g, pts: keys.map(k => ({ k, label: plabel(k, g), v: map.has(k) ? aggregate(map.get(k), m, agg) : 0 })) };
  }

  function trend(w, rows, p) {
    if (!p.date || !['sum', 'count'].includes(w.agg)) return null;
    const { g, pts } = timeSeries(rows, p.date.name, w.m, w.agg, 'auto');
    if (g !== 'month' || pts.length < 2) return null;
    const a = pts[pts.length - 1].v, b = pts[pts.length - 2].v;
    if (!b || a == null) return null;
    return { pct: (a - b) / Math.abs(b) * 100, label: 'vs. ' + pts[pts.length - 2].label };
  }

  const sortFn = s => s === 'asc' ? (a, b) => a.v - b.v : s === 'az' ? (a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }) : s === 'za' ? (a, b) => String(b.label).localeCompare(String(a.label), 'pt-BR', { numeric: true }) : (a, b) => b.v - a.v;
  function pickRows(items, w, pie, chrono) {
    const total = items.length, q = N(w.q || '');
    let g = q ? items.filter(x => N(x.label).includes(q)) : items.slice();
    const matched = g.length, lim = +w.limit || 0; let others = 0;
    if (lim > 0 && g.length > lim) {
      g.sort((a, b) => b.v - a.v);
      const rest = g.slice(lim); g = g.slice(0, lim);
      if (pie && rest.length) { others = rest.length; g.push({ k: '__o', label: `Outros (${rest.length})`, v: rest.reduce((a, x) => a + x.v, 0), rest: true }); }
    }
    const s = w.sort || (chrono ? 'none' : 'desc');
    if (s !== 'none') { const o = g.filter(x => x.rest); g = g.filter(x => !x.rest).sort(sortFn(s)).concat(o); }
    return { g, total, matched, others, q: !!q };
  }
  function crosstab(rows, rf, cf, o) {
    o = o || {};
    const gR = rf && rf.type === 'date' ? (o.grain && o.grain !== 'auto' ? o.grain : autoGrain(rows, rf.name)) : null;
    const gC = cf && cf.type === 'date' ? (o.grain && o.grain !== 'auto' ? o.grain : autoGrain(rows, cf.name)) : null;
    const kf = (r, c, g) => { const v = r[c.name]; return c.type === 'date' ? (v ? pk(v, g) : '(Sem valor)') : keyOf(v); };
    let top = null;
    if (cf && cf.type !== 'date' && o.maxCols) {
      const cnt = new Map(); for (const r of rows) { const k = kf(r, cf); cnt.set(k, (cnt.get(k) || 0) + 1); }
      if (cnt.size > o.maxCols) top = new Set([...cnt].sort((a, b) => b[1] - a[1]).slice(0, o.maxCols).map(x => x[0]));
    }
    const rowMap = new Map(), colMap = new Map(), cells = new Map();
    const add = (m, k, r) => { const a = m.get(k); if (a) a.push(r); else m.set(k, [r]); };
    for (const r of rows) {
      const rk = rf ? kf(r, rf, gR) : 'Total'; let ck = cf ? kf(r, cf, gC) : '__all__';
      if (top && !top.has(ck)) ck = 'Outros';
      add(rowMap, rk, r); add(colMap, ck, r); add(cells, rk + '\u0001' + ck, r);
    }
    const order = (m, c) => {
      const ks = [...m.keys()];
      if (c && c.type === 'date') return ks.sort((a, b) => a === '(Sem valor)' ? 1 : b === '(Sem valor)' ? -1 : a < b ? -1 : a > b ? 1 : 0);
      ks.sort((a, b) => m.get(b).length - m.get(a).length);
      if (m.has('Outros')) { ks.splice(ks.indexOf('Outros'), 1); ks.push('Outros'); }
      return ks;
    };
    return { rowMap, colMap, cells, rowKeys: order(rowMap, rf), colKeys: order(colMap, cf), gR, gC, grouped: !!top,
      rowLabel: k => rf && rf.type === 'date' && k !== '(Sem valor)' ? plabel(k, gR) : k,
      colLabel: k => cf && cf.type === 'date' && k !== '(Sem valor)' ? plabel(k, gC) : (k === '__all__' ? 'Total' : k),
      cell: (r, c) => cells.get(r + '\u0001' + c) || [] };
  }
  const zeroAgg = w => w.agg === 'sum' || w.agg === 'count' || !w.m;

  function chartData(w, rows, p, ft, opts) {
    if (w.data === 'time') {
      const { pts } = timeSeries(rows, w.date, w.m, w.agg, w.grain);
      const ds = [{ label: w.m ? `${w.agg === 'avg' ? 'Média' : 'Total'} de ${w.m}` : 'Registros', data: pts.map(x => x.v) }];
      if (w.ma && pts.length >= w.ma) { const k = +w.ma; ds.push({ label: `Média móvel (${k})`, data: pts.map((_, i) => { if (i < k - 1) return null; let s = 0, n = 0; for (let j = i - k + 1; j <= i; j++) if (pts[j].v != null) { s += pts[j].v; n++; } return n ? s / n : null; }) }); }
      if (w.trend && pts.length >= 3) {
        const xy = pts.map((x, i) => [i, x.v]).filter(x => x[1] != null), n = xy.length;
        if (n >= 3) { const sx = xy.reduce((a, x) => a + x[0], 0), sy = xy.reduce((a, x) => a + x[1], 0), sxy = xy.reduce((a, x) => a + x[0] * x[1], 0), sxx = xy.reduce((a, x) => a + x[0] * x[0], 0), den = n * sxx - sx * sx; if (den) { const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n; ds.push({ label: 'Tendência linear', data: pts.map((_, i) => a + b * i) }); } }
      }
      return { labels: pts.map(x => x.label), datasets: ds, fmt: ft };
    }
    if (w.data === 'combo') {
      const dc = colOf(p, w.dim), agg2 = w.agg2 || w.agg, c2 = w.m2 ? colOf(p, w.m2) : null, f2 = c2 ? c2.type : 'number';
      if (dc && dc.type === 'date') {
        const s1 = timeSeries(rows, w.dim, w.m, w.agg, w.grain), s2 = timeSeries(rows, w.dim, w.m2, agg2, w.grain);
        return { labels: s1.pts.map(x => x.label), datasets: [{ label: aggLabel(w.m, w.agg), data: s1.pts.map(x => x.v) }, { label: aggLabel(w.m2, agg2), data: s2.pts.map(x => x.v) }], fmt: ft, fmt2: f2, total: s1.pts.length, matched: s1.pts.length, shown: s1.pts.length, others: 0, q: false };
      }
      const gb = new Map(groupRows(rows, w.dim, w.m2, agg2).map(x => [x.k, x.v]));
      const items = groupRows(rows, w.dim, w.m, w.agg).filter(x => x.v != null).map(x => ({ k: x.k, label: String(x.k), v: x.v, v2: gb.get(x.k) }));
      const r = pickRows(items, w, false);
      return { labels: r.g.map(x => x.label), datasets: [{ label: aggLabel(w.m, w.agg), data: r.g.map(x => x.v) }, { label: aggLabel(w.m2, agg2), data: r.g.map(x => x.v2 == null ? null : x.v2) }], fmt: ft, fmt2: f2, total: r.total, matched: r.matched, shown: r.g.length, others: 0, q: r.q };
    }
    if (w.data === 'bubble') {
      const gy = new Map(groupRows(rows, w.dim, w.m2, w.agg).map(x => [x.k, x.v])), gs = new Map(groupRows(rows, w.dim, w.m3, w.agg).map(x => [x.k, x.v]));
      let pts = groupRows(rows, w.dim, w.m, w.agg).map(x => ({ label: String(x.k), x: x.v, y: gy.get(x.k), s: w.m3 ? gs.get(x.k) : x.n })).filter(q => q.x != null && q.y != null && q.s != null && q.s > 0);
      const total = pts.length; pts.sort((a, b) => b.s - a.s); const lim = +w.limit || 300; pts = pts.slice(0, lim);
      const c2 = colOf(p, w.m2);
      return { points: pts, xl: w.m || 'Registros', yl: w.m2 || 'Registros', sl: w.m3 || 'Registros', fmt: ft, fmt2: c2 ? c2.type : 'number', total, shown: pts.length };
    }
    if (w.data === 'pareto') {
      const items = groupRows(rows, w.dim, w.m, w.agg).filter(x => x.v != null && x.v > 0).map(x => ({ k: x.k, label: String(x.k), v: x.v })).sort((a, b) => b.v - a.v);
      const tot = items.reduce((a, x) => a + x.v, 0); let c = 0, n80 = 0; const cum = new Map();
      items.forEach(x => { c += x.v; cum.set(x.k, c / tot * 100); if (!n80 && c / tot >= .8) n80 = cum.size; });
      const r = pickRows(items, { ...w, sort: 'desc' }, false);
      return { labels: r.g.map(x => x.label), datasets: [{ label: w.m || 'Registros', data: r.g.map(x => x.v) }], cum: r.g.map(x => cum.get(x.k)), fmt: ft, total: r.total, matched: r.matched, shown: r.g.length, others: 0, q: r.q, n80, n: items.length };
    }
    if (w.data === 'compare') {
      const a = groupRows(rows, w.dim, w.m, w.agg), bm = new Map(groupRows(rows, w.dim, w.m2, w.agg).map(x => [x.k, x.v]));
      const items = a.filter(x => x.v != null).map(x => ({ k: x.k, label: String(x.k), v: x.v, v2: bm.get(x.k) || 0 }));
      const r = pickRows(items, w, false);
      return { labels: r.g.map(x => x.label), datasets: [{ label: w.m, data: r.g.map(x => x.v) }, { label: w.m2, data: r.g.map(x => x.v2) }], fmt: ft, total: r.total, matched: r.matched, shown: r.g.length, others: 0, q: r.q };
    }
    if (w.data === 'group') {
      const items = groupRows(rows, w.dim, w.m, w.agg).filter(x => x.v != null).map(x => ({ k: x.k, label: String(x.k), v: x.v }));
      const r = pickRows(items, w, !!(opts && opts.pie) && zeroAgg(w));
      return { labels: r.g.map(x => x.label), datasets: [{ label: w.m || 'Registros', data: r.g.map(x => x.v) }], fmt: ft, total: r.total, matched: r.matched, shown: r.g.length - (r.others ? 1 : 0), others: r.others, q: r.q };
    }
    if (w.data === 'stacked') {
      const rc = colOf(p, w.dim), cc = w.dim2 ? colOf(p, w.dim2) : null;
      const ct = crosstab(rows, rc, cc, { grain: w.grain, maxCols: 12 });
      const empty = zeroAgg(w) ? 0 : null;
      const items = ct.rowKeys.map(k => { const v = aggregate(ct.rowMap.get(k), w.m, w.agg); return { k, label: ct.rowLabel(k), v: v == null ? 0 : v }; });
      const r = pickRows(items, w, false, rc && rc.type === 'date');
      const datasets = ct.colKeys.map(ck => ({ label: ct.colLabel(ck), data: r.g.map(x => { const cr = ct.cell(x.k, ck); return cr.length ? aggregate(cr, w.m, w.agg) : empty; }) }));
      return { labels: r.g.map(x => x.label), datasets, fmt: w.m ? ft : 'number', total: r.total, matched: r.matched, shown: r.g.length, others: 0, q: r.q, serOthers: ct.grouped };
    }
    if (w.data === 'scatter') {
      let pts = rows.filter(r => typeof r[w.m] === 'number' && typeof r[w.m2] === 'number').map(r => ({ x: r[w.m], y: r[w.m2] }));
      if (pts.length > 500) { const k = Math.ceil(pts.length / 500); pts = pts.filter((_, i) => i % k === 0); }
      return { points: pts, xl: w.m, yl: w.m2, fmt: ft };
    }
    if (w.data === 'hist') {
      let mn = Infinity, mx = -Infinity, n = 0;
      for (const r of rows) { const v = r[w.m]; if (typeof v === 'number') { n++; if (v < mn) mn = v; if (v > mx) mx = v; } }
      if (n < 2) return { labels: [], datasets: [{ data: [] }] };
      const b = Math.max(5, Math.min(12, Math.ceil(Math.log2(n) + 1))), step = (mx - mn) / b || 1, bins = new Array(b).fill(0);
      for (const r of rows) { const v = r[w.m]; if (typeof v === 'number') bins[Math.min(b - 1, Math.floor((v - mn) / step))]++; }
      return { labels: bins.map((_, i) => `${fmt(mn + i * step, ft, true)}–${fmt(mn + (i + 1) * step, ft, true)}`), datasets: [{ label: 'Registros', data: bins }], fmt: 'number' };
    }
    return { labels: [], datasets: [] };
  }

  function applyWhere(rows, where, p) {
    if (!where || !where.length) return rows;
    const cs = where.map(f => ({ f, c: colOf(p, f.col) })).filter(x => x.c);
    return rows.filter(r => cs.every(({ f, c }) => {
      const v = r[f.col];
      if (f.values) return f.values.includes(keyOf(v));
      if (c.type === 'date') { if (!v) return false; if (f.from && v < new Date(f.from + 'T00:00:00')) return false; if (f.to && v > new Date(f.to + 'T23:59:59')) return false; return true; }
      if (typeof v !== 'number') return false;
      if (f.from !== '' && f.from != null && v < +f.from) return false;
      if (f.to !== '' && f.to != null && v > +f.to) return false;
      return true;
    }));
  }
  const rowsFor = (w, rows, p) => applyWhere(rows, w.where, p);

  function highlights(rows, p, w) {
    const out = [], pm = p.primaryMeasure, agg = pm ? aggFor(pm) : 'count', ft = pm ? pm.type : 'number';
    if (!rows.length) return out;
    const d = p.primaryDim;
    if (d) {
      const g = groupRows(rows, d.name, pm && pm.name, agg).filter(x => x.v != null).sort((a, b) => b.v - a.v);
      if (g.length > 1) {
        const tot = g.reduce((a, x) => a + x.v, 0);
        if (agg !== 'avg' && tot > 0) {
          out.push(`${g[0].k} lidera em ${d.name} (${pm ? pm.name : 'registros'}): ${fmt(g[0].v, ft)}, ${fmt(g[0].v / tot * 100, 'percent')} do total.`);
          if (g.length >= 4) out.push(`As 3 maiores categorias de ${d.name} concentram ${fmt(g.slice(0, 3).reduce((a, x) => a + x.v, 0) / tot * 100, 'percent')} do total.`);
        } else out.push(`${g[0].k} tem o maior valor em ${d.name} (${fmt(g[0].v, ft)}) e ${g[g.length - 1].k} o menor (${fmt(g[g.length - 1].v, ft)}).`);
      }
    }
    if (p.date) {
      const { g, pts } = timeSeries(rows, p.date.name, pm && pm.name, agg, 'auto');
      const ok = pts.filter(x => x.v != null);
      if (ok.length >= 2) {
        const top = [...ok].sort((a, b) => b.v - a.v)[0];
        out.push(`O período de maior valor foi ${top.label} (${fmt(top.v, ft)}).`);
        const a = ok[ok.length - 1], b = ok[ok.length - 2];
        if (b.v) out.push(`Último período (${a.label}) ${a.v >= b.v ? 'subiu' : 'caiu'} ${fmt(Math.abs(a.v - b.v) / Math.abs(b.v) * 100, 'percent')} em relação a ${b.label}.`);
      }
    }
    if (p.status) {
      const ok = rows.filter(r => r[p.status.name] != null);
      const dn = ok.filter(r => isDone(r[p.status.name])).length;
      if (ok.length && dn) out.push(`${fmt(dn / ok.length * 100, 'percent')} dos registros estão em status concluído.`);
    }
    if (p.target && p.primaryMeasure && p.target !== p.primaryMeasure) {
      const a = aggregate(rows, pm.name, 'sum'), t = aggregate(rows, p.target.name, 'sum');
      if (t) out.push(`Realizado (${pm.name}) equivale a ${fmt(a / t * 100, 'percent')} de "${p.target.name}".`);
    }
    return out;
  }

  function bottlenecks(rows, p) {
    const out = [], S = p.status.name;
    const known = rows.filter(r => r[S] != null);
    if (!known.length) return ['Sem registros com status definido para os filtros atuais.'];
    if (!known.some(r => isDone(r[S]))) { out.push('Nenhum status foi reconhecido como "concluído"; os cálculos de itens em aberto não puderam ser feitos.'); return out; }
    const open = known.filter(r => !isDone(r[S]));
    out.push(`${open.length} de ${known.length} registros (${fmt(open.length / known.length * 100, 'percent')}) ainda não foram concluídos.`);
    if (open.length) {
      const bs = groupRows(open, S, null, 'count').sort((a, b) => b.n - a.n)[0];
      out.push(`Etapa com mais itens em aberto: ${bs.k} (${bs.n}).`);
      if (p.person) {
        const bp = groupRows(open, p.person.name, null, 'count').sort((a, b) => b.n - a.n)[0];
        out.push(`Maior volume em aberto por ${p.person.name}: ${bp.k} (${bp.n} itens).`);
      }
      if (p.date) {
        const ds = open.map(r => r[p.date.name]).filter(Boolean);
        if (ds.length) { let mn = Infinity; ds.forEach(d => { if (d.getTime() < mn) mn = d.getTime(); }); out.push(`Item em aberto mais antigo: ${SDParser.fmtDate(new Date(mn))}.`); }
      }
    }
    return out;
  }

  function strategy(rows, p) {
    const good = [], risk = [], opp = [], act = [];
    if (!rows.length) return [];
    const pm = p.primaryMeasure, agg = pm ? aggFor(pm) : 'count', ft = pm ? pm.type : 'number', mn = pm ? pm.name : 'registros', d = p.primaryDim;
    const pc = x => fmt(x * 100, 'percent');
    if (d) {
      const g = groupRows(rows, d.name, pm && pm.name, agg).filter(x => x.v != null && x.v > 0).sort((a, b) => b.v - a.v);
      const tot = g.reduce((a, x) => a + x.v, 0);
      if (g.length >= 3 && agg !== 'avg' && tot > 0) {
        const share = g[0].v / tot; let cum = 0, n80 = 0;
        for (const x of g) { cum += x.v; n80++; if (cum / tot >= .8) break; }
        if (share >= .4) { risk.push(`Concentração: ${g[0].k} responde por ${pc(share)} de ${mn} em ${d.name}.`); act.push(`Avaliar a dependência de ${g[0].k} e definir um plano para reduzir o risco de concentração.`); }
        else good.push(`Distribuição equilibrada: a maior categoria de ${d.name} (${g[0].k}) tem ${pc(share)} do total de ${mn}.`);
        const f = n80 / g.length;
        if (g.length >= 6) (f <= .3 ? opp : good).push(`${n80} de ${g.length} categorias de ${d.name} (${pc(f)}) respondem por 80% de ${mn}${f <= .3 ? ' — poucos itens concentram o resultado (princípio de Pareto).' : '.'}`);
        const avg = tot / g.length, low = g.filter(x => x.v < .5 * avg);
        if (g.length >= 6 && low.length >= 2) { opp.push(`${low.length} categorias de ${d.name} estão abaixo de 50% da média — espaço para evolução.`); act.push(`Investigar o que diferencia as ${low.length} categorias abaixo de 50% da média (menores: ${low.slice(-3).map(x => x.k).join(', ')}).`); }
      }
    }
    if (p.date) {
      const { g, pts } = timeSeries(rows, p.date.name, pm && pm.name, agg, 'auto');
      const v = pts.map(x => x.v).filter(x => x != null);
      if (g === 'month' && v.length >= 4) {
        const k = Math.min(3, Math.floor(v.length / 2)), mean = a => a.reduce((s, x) => s + x, 0) / a.length;
        const last = mean(v.slice(-k)), prev = mean(v.slice(-2 * k, -k));
        if (prev) {
          const ch = (last - prev) / Math.abs(prev);
          if (ch >= .1) good.push(`Crescimento: a média dos últimos ${k} meses de ${mn} está ${pc(ch)} acima dos ${k} meses anteriores.`);
          else if (ch <= -.1) { risk.push(`Queda: a média dos últimos ${k} meses de ${mn} está ${pc(-ch)} abaixo dos ${k} meses anteriores.`); act.push('Analisar as causas da queda recente (sazonalidade, capacidade ou demanda) antes de definir metas.'); }
          else good.push(`Estabilidade: a média dos últimos ${k} meses de ${mn} variou ${pc(Math.abs(ch))} frente ao período anterior.`);
        }
        const m = mean(v), sd = Math.sqrt(mean(v.map(x => (x - m) * (x - m))));
        if (m > 0 && sd / m > .5) { risk.push(`Alta volatilidade: o desvio padrão mensal de ${mn} equivale a ${pc(sd / m)} da média.`); act.push('Investigar picos e vales mensais para entender o que causa a oscilação.'); }
      }
    }
    if (pm) {
      const vs = rows.map(r => r[pm.name]).filter(x => typeof x === 'number').sort((a, b) => a - b);
      if (vs.length >= 8) {
        const q = x => vs[Math.floor((vs.length - 1) * x)], iq = q(.75) - q(.25);
        const out = iq ? vs.filter(x => x < q(.25) - 3 * iq || x > q(.75) + 3 * iq) : [];
        if (out.length) { risk.push(`${out.length} valor(es) atípico(s) em ${pm.name} (extremos: ${fmt(out[0], ft)} a ${fmt(out[out.length - 1], ft)}).`); act.push(`Validar os ${out.length} registros atípicos de ${pm.name}: erro de digitação ou caso excepcional?`); }
      }
    }
    if (p.status) {
      const ok = rows.filter(r => r[p.status.name] != null);
      if (ok.some(r => isDone(r[p.status.name]))) {
        const open = ok.filter(r => !isDone(r[p.status.name])), rate = open.length / ok.length;
        if (rate >= .5) { risk.push(`${pc(rate)} dos registros ainda estão em aberto.`); }
        else good.push(`${pc(1 - rate)} dos registros já estão concluídos.`);
        if (open.length && p.person) { const bp = groupRows(open, p.person.name, null, 'count').sort((a, b) => b.n - a.n)[0]; if (bp && bp.n / open.length >= .25 && groupRows(open, p.person.name, null, 'count').length >= 3) act.push(`Priorizar ou redistribuir os itens em aberto de ${bp.k} (${bp.n} de ${open.length}, ${pc(bp.n / open.length)} do pendente).`); }
      }
    }
    if (p.target && pm && p.target !== pm) {
      const a = aggregate(rows, pm.name, 'sum'), t = aggregate(rows, p.target.name, 'sum');
      if (t) {
        (a / t >= 1 ? good : risk).push(`Realizado de ${pm.name} equivale a ${pc(a / t)} de "${p.target.name}".`);
        if (d) { const g = groupRows(rows, d.name, pm.name, 'sum'), tg = new Map(groupRows(rows, d.name, p.target.name, 'sum').map(x => [x.k, x.v])); const below = g.filter(x => tg.get(x.k) && x.v < tg.get(x.k)); if (below.length) act.push(`Acompanhar de perto as ${below.length} categorias de ${d.name} abaixo da meta.`); }
      }
    }
    return [['good', 'Destaques', good], ['risk', 'Riscos e atenção', risk], ['opp', 'Oportunidades', opp], ['act', 'Ações sugeridas', act]].filter(x => x[2].length).map(([key, title, items]) => ({ key, title, items }));
  }

  function compute(w, rows, p, opts) {
    rows = applyWhere(rows, w.where, p);
    const mc = w.m ? colOf(p, w.m) : null, ft = mc ? mc.type : 'number';
    switch (w.kind) {
      case 'kpi': {
        const v = aggregate(rows, w.m, w.agg), isList = typeof v === 'string';
        const text = v == null ? '—' : isList ? v : w.agg === 'doneRate' ? fmt(v, 'percent') : (w.agg === 'count' || w.agg === 'distinct') ? fmt(v, 'number') : fmt(v, ft, true);
        return { value: v, text, isList, trend: isList ? null : trend(w, rows, p), goal: !isList && +w.goal > 0 && typeof v === 'number' ? v / +w.goal * 100 : null };
      }
      case 'chart': return chartData(w, rows, p, ft, opts);
      case 'heatmap': {
        const ct = crosstab(rows, colOf(p, w.dim), colOf(p, w.dim2), { grain: w.grain, maxCols: 30 });
        let mx = 0;
        const mat = ct.rowKeys.map(r => ct.colKeys.map(c => { const cr = ct.cell(r, c); const v = cr.length ? aggregate(cr, w.m, w.agg || 'count') : null; if (v != null && v > mx) mx = v; return v; }));
        return { rs: ct.rowKeys.map(ct.rowLabel), cs: ct.colKeys.map(ct.colLabel), mat, max: mx || 1, fmt: w.m ? ft : 'number', grouped: ct.grouped };
      }
      case 'grouptable': {
        const ms = p.measures.slice(0, 3);
        const g = groupRows(rows, w.dim, null, 'count').sort((a, b) => b.n - a.n).slice(0, 15);
        const head = [w.dim, 'Registros', ...ms.map(c => (aggFor(c) === 'avg' ? 'Média ' : 'Soma ') + c.name)];
        const body = g.map(x => { const rs = rows.filter(r => keyOf(r[w.dim]) === x.k); return [x.k, fmt(x.n, 'number'), ...ms.map(c => fmt(aggregate(rs, c.name, aggFor(c)), c.type))]; });
        return { head, body, numFrom: 1 };
      }
      case 'datatable': return { head: p.ds.columns.map(c => c.name), cols: p.ds.columns, rows: rows.slice(0, 100), total: rows.length };
      case 'table': {
        const dc = w.dim ? colOf(p, w.dim) : null, ct = crosstab(rows, dc, null, { grain: w.grain });
        const cs = w.cols && w.cols.length ? w.cols : [{ f: '', agg: 'count' }];
        const numeric = a => a !== 'list';
        const items = ct.rowKeys.map(k => { const rs = ct.rowMap.get(k), vals = cs.map(c => aggregate(rs, c.f || null, c.agg)), fv = vals.find(v => typeof v === 'number'); return { k, label: ct.rowLabel(k), v: fv == null ? 0 : fv, vals }; });
        const r = pickRows(items, { ...w, sort: w.sort || (numeric(cs[0].agg) ? 'desc' : 'az') }, false, dc && dc.type === 'date');
        return { head: [w.dim || '', ...cs.map(c => aggLabel(c.f, c.agg))], types: cs.map(c => (c.agg === 'count' || c.agg === 'distinct') ? 'number' : ((colOf(p, c.f) || {}).type || 'number')), rows: r.g, total: r.total, matched: r.matched, shown: r.g.length, q: r.q };
      }
      case 'list': {
        const dc = colOf(p, w.dim), ct = crosstab(rows, dc, null, { grain: w.grain }), hasV = w.showVal !== false, agg = w.m ? w.agg : 'count';
        const items = ct.rowKeys.map(k => ({ k, label: ct.rowLabel(k), v: hasV ? (aggregate(ct.rowMap.get(k), w.m || null, agg) ?? 0) : 0 }));
        const r = pickRows(items, { ...w, sort: w.sort || 'az' }, false, dc && dc.type === 'date');
        const mc = w.m ? colOf(p, w.m) : null;
        return { items: r.g, hasV, fmt: (agg === 'count' || agg === 'distinct') ? 'number' : (mc ? mc.type : 'number'), total: r.total, matched: r.matched, shown: r.g.length, q: r.q };
      }
      case 'strategy': return { sections: strategy(rows, p) };
      case 'highlights': return { items: highlights(rows, p, w) };
      case 'bottlenecks': return { items: p.status ? bottlenecks(rows, p) : [] };
      default: return {};
    }
  }

  function applyFilters(rows, f, p) {
    const dc = p.date ? p.date.name : null;
    const dk = Object.keys(f.dims || {}).filter(k => f.dims[k] && f.dims[k].length);
    const from = f.from ? new Date(f.from + 'T00:00:00') : null, to = f.to ? new Date(f.to + 'T23:59:59') : null;
    const useD = dc && (from || to || (f.months || []).length || (f.years || []).length);
    return rows.filter(r => {
      for (const k of dk) if (!f.dims[k].includes(keyOf(r[k]))) return false;
      if (useD) {
        const d = r[dc]; if (!d) return false;
        if (from && d < from) return false; if (to && d > to) return false;
        if (f.months.length && !f.months.includes(d.getMonth() + 1)) return false;
        if (f.years.length && !f.years.includes(d.getFullYear())) return false;
      }
      return true;
    });
  }

  function describe(p) {
    const c = p.ds.columns, t = x => c.filter(y => y.type === x).length;
    const parts = [];
    if (p.date) parts.push(`datas em "${p.date.name}"`);
    if (p.measures.length) parts.push(`${p.measures.length} medida(s) numérica(s) (${p.measures.slice(0, 3).map(m => m.name).join(', ')})`);
    if (p.person) parts.push(`responsáveis em "${p.person.name}"`);
    if (p.status) parts.push(`status em "${p.status.name}"`);
    const other = p.dims.filter(d => d !== p.person && d !== p.status).length;
    if (other) parts.push(`${other} outra(s) categoria(s)`);
    return `Li ${p.ds.rows.length} linhas e ${c.length} colunas. Identifiquei: ${parts.join('; ') || 'poucas dimensões analisáveis'}.`;
  }

  return { AGGL, aggLabel, buildStrategic, crosstab, aggregate, applyWhere, rowsFor, RX, MFULL, MPT, MEAS, isDone, isFin, aggFor, nid, cap, makePalette, withL, soft, hexRgb, PRESETS, fmt, profile, buildAll, buildExecutive, compute, applyFilters, describe, colOf, W, shade: withL };
})();
