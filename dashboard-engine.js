/* Smart Dash Studio — perfil dos dados, especificação e cálculo dos widgets */
const SDEngine = (() => {
  const N = SDParser.norm;
  const RX = {
    person: /respons|colaborad|analista|equipe|\btime\b|vendedor|atendente|funcion|pessoa|\bnome\b|owner|dono|assignee|tecnico|agente|operador|gerente|consultor/,
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
    { name: 'Azul', primary: '#1565C0' }, { name: 'Verde', primary: '#2E7D32' }, { name: 'Laranja', primary: '#E65100' },
    { name: 'Roxo', primary: '#6A1B9A' }, { name: 'Grafite', primary: '#455A64' }, { name: 'Turquesa', primary: '#00796B' },
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
    p.dims = cats.filter(c => c.unique <= 30).sort(by);
    const rank = c => men(c) * 10 + (c === p.person ? 3 : c === p.status ? 0 : 1);
    p.dimsOrdered = [...p.dims].sort((a, b) => rank(b) - rank(a));
    p.primaryMeasure = p.measures.find(c => !p.target || c !== p.target) || p.measures[0] || null;
    p.primaryDim = p.dimsOrdered.find(c => c !== p.status) || p.dimsOrdered[0] || null;
    p.isDone = isDone;
    return p;
  }

  /* ---------- construção dos dashboards ---------- */
  const W = o => ({ id: nid(), span: 6, agg: 'count', m: null, limit: 8, ...o });
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
    if (catPie) w.push(W({ kind: 'chart', data: 'group', chart: 'doughnut', title: 'Distribuição por ' + catPie.name, dim: catPie.name, span: p.date ? 4 : 6 }));
    if (p.primaryDim) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: (pm ? cap(mTitle(pm, agg)) : 'Registros') + ' por ' + p.primaryDim.name, m: pm && pm.name, agg, dim: p.primaryDim.name, limit: 8, span: 6 }));
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
    if (S) w.push(W({ kind: 'chart', data: 'group', chart: 'doughnut', title: 'Status das demandas', dim: S.name, span: P ? 4 : 6 }));
    if (S && P) w.push(W({ kind: 'chart', data: 'stacked', chart: 'stacked', title: `${P.name} × ${S.name}`, dim: P.name, dim2: S.name, span: 8 }));
    if (P) w.push(W({ kind: 'chart', data: 'group', chart: 'hbar', title: 'Distribuição de trabalho por ' + P.name, dim: P.name, limit: 10, span: 6 }));
    if (P && pm) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `Produtividade: ${mTitle(pm, aggFor(pm))} por ${P.name}`, m: pm.name, agg: aggFor(pm), dim: P.name, limit: 10, span: 6 }));
    if (p.date) w.push(W({ kind: 'chart', data: 'time', chart: 'bar', title: 'Volume de atividades no tempo', date: p.date.name, span: 6 }));
    if (!S && !P && p.primaryDim) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: 'Volume por ' + p.primaryDim.name, dim: p.primaryDim.name, span: 6 }));
    if (S) w.push(W({ kind: 'bottlenecks', title: 'Gargalos identificados', span: 12 }));
    else w.push(W({ kind: 'notice', title: 'Gargalos', text: 'Não há coluna de status nos dados, então não é possível apontar gargalos. Inclua uma coluna de situação (ex.: Pendente, Em andamento, Concluído).', span: 12 }));
    if (!P) w.push(W({ kind: 'notice', title: 'Distribuição de trabalho', text: 'Não identificamos uma coluna de responsável/equipe. Incluí-la permite analisar a carga de trabalho e a produtividade por pessoa.', span: 12 }));
    return w;
  }

  function buildAnalytical(p) {
    const w = [], pm = p.primaryMeasure, agg = pm ? aggFor(pm) : 'count', d1 = p.dimsOrdered[0], d2 = p.dimsOrdered[1];
    p.dimsOrdered.slice(0, 2).forEach(d => w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `${cap(mTitle(pm, agg))} por ${d.name}`, m: pm && pm.name, agg, dim: d.name, limit: 10, span: 6 })));
    const m2 = p.measures.find(c => c !== pm);
    if (m2 && d1) w.push(W({ kind: 'chart', data: 'group', chart: 'bar', title: `${cap(mTitle(m2, aggFor(m2)))} por ${d1.name}`, m: m2.name, agg: aggFor(m2), dim: d1.name, limit: 10, span: 6 }));
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

  function buildAll(p) {
    const ex = buildExecutive(p);
    const custom = ex.filter(x => x.kind === 'kpi' || x.kind === 'chart').slice(0, 5).map(x => ({ ...x, id: nid() }));
    return { executive: ex, operational: buildOperational(p), analytical: buildAnalytical(p), custom };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- cálculo ---------- */
  const colOf = (p, name) => p.ds.columns.find(c => c.name === name);
  function aggregate(rows, m, agg) {
    if (agg === 'count' || !m) return rows.length;
    if (agg === 'distinct') return new Set(rows.map(r => r[m]).filter(v => v != null)).size;
    if (agg === 'doneRate') { const ok = rows.filter(r => r[m] != null); return ok.length ? 100 * ok.filter(r => isDone(r[m])).length / ok.length : null; }
    const vs = rows.map(r => r[m]).filter(v => typeof v === 'number');
    if (!vs.length) return null;
    const s = vs.reduce((a, b) => a + b, 0);
    return agg === 'sum' ? s : agg === 'avg' ? s / vs.length : agg === 'max' ? Math.max(...vs) : Math.min(...vs);
  }
  const keyOf = v => v == null || v === '' ? '(Sem valor)' : v;
  function groupRows(rows, dim, m, agg) {
    const g = new Map();
    rows.forEach(r => { const k = keyOf(r[dim]); if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    return [...g].map(([k, rs]) => ({ k, v: aggregate(rs, m, agg), n: rs.length }));
  }
  function autoGrain(rows, dc) {
    const ds = rows.map(r => r[dc]).filter(Boolean).map(d => d.getTime());
    if (!ds.length) return 'month';
    const span = (Math.max(...ds) - Math.min(...ds)) / 864e5;
    return span > 1800 ? 'year' : span > 75 ? 'month' : 'day';
  }
  const pk = (d, g) => g === 'year' ? String(d.getFullYear()) : g === 'month' ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : SDParser.ymd(d);
  function plabel(k, g) {
    if (g === 'year') return k;
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

  function chartData(w, rows, p, ft) {
    if (w.data === 'time') {
      const { pts } = timeSeries(rows, w.date, w.m, w.agg, w.grain);
      return { labels: pts.map(x => x.label), datasets: [{ label: w.m ? `${w.agg === 'avg' ? 'Média' : 'Total'} de ${w.m}` : 'Registros', data: pts.map(x => x.v) }], fmt: ft };
    }
    if (w.data === 'group') {
      let g = groupRows(rows, w.dim, w.m, w.agg).filter(x => x.v != null).sort((a, b) => b.v - a.v);
      const lim = w.limit || 8;
      if (g.length > lim) {
        const top = g.slice(0, lim), rest = g.slice(lim);
        if (w.agg === 'sum' || w.agg === 'count' || !w.m) top.push({ k: 'Outros', v: rest.reduce((a, x) => a + x.v, 0) });
        g = top;
      }
      return { labels: g.map(x => x.k), datasets: [{ label: w.m || 'Registros', data: g.map(x => x.v) }], fmt: ft };
    }
    if (w.data === 'stacked') {
      const tot = groupRows(rows, w.dim, null, 'count').sort((a, b) => b.n - a.n).slice(0, 10).map(x => x.k);
      let s2 = groupRows(rows, w.dim2, null, 'count').sort((a, b) => b.n - a.n).map(x => x.k);
      const extra = s2.length > 6; s2 = s2.slice(0, 6);
      const ds = s2.map(s => ({ label: s, data: tot.map(t => rows.filter(r => keyOf(r[w.dim]) === t && keyOf(r[w.dim2]) === s).length) }));
      if (extra) ds.push({ label: 'Outros', data: tot.map(t => rows.filter(r => keyOf(r[w.dim]) === t && !s2.includes(keyOf(r[w.dim2]))).length) });
      return { labels: tot, datasets: ds, fmt: 'number' };
    }
    if (w.data === 'scatter') {
      let pts = rows.filter(r => typeof r[w.m] === 'number' && typeof r[w.m2] === 'number').map(r => ({ x: r[w.m], y: r[w.m2] }));
      if (pts.length > 500) { const k = Math.ceil(pts.length / 500); pts = pts.filter((_, i) => i % k === 0); }
      return { points: pts, xl: w.m, yl: w.m2, fmt: ft };
    }
    if (w.data === 'hist') {
      const vs = rows.map(r => r[w.m]).filter(v => typeof v === 'number');
      if (vs.length < 2) return { labels: [], datasets: [{ data: [] }] };
      const mn = Math.min(...vs), mx = Math.max(...vs), b = Math.max(5, Math.min(12, Math.ceil(Math.log2(vs.length) + 1)));
      const step = (mx - mn) / b || 1, bins = new Array(b).fill(0);
      vs.forEach(v => { bins[Math.min(b - 1, Math.floor((v - mn) / step))]++; });
      return { labels: bins.map((_, i) => `${fmt(mn + i * step, ft, true)}–${fmt(mn + (i + 1) * step, ft, true)}`), datasets: [{ label: 'Registros', data: bins }], fmt: 'number' };
    }
    return { labels: [], datasets: [] };
  }

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
        if (ds.length) out.push(`Item em aberto mais antigo: ${SDParser.fmtDate(new Date(Math.min(...ds)))}.`);
      }
    }
    return out;
  }

  function compute(w, rows, p) {
    const mc = w.m ? colOf(p, w.m) : null, ft = mc ? mc.type : 'number';
    switch (w.kind) {
      case 'kpi': {
        const v = aggregate(rows, w.m, w.agg);
        const text = v == null ? '—' : w.agg === 'doneRate' ? fmt(v, 'percent') : (w.agg === 'count' || w.agg === 'distinct') ? fmt(v, 'number') : fmt(v, ft, true);
        return { value: v, text, trend: trend(w, rows, p) };
      }
      case 'chart': return chartData(w, rows, p, ft);
      case 'heatmap': {
        const rs = groupRows(rows, w.dim, null, 'count').sort((a, b) => b.n - a.n).slice(0, 12).map(x => x.k);
        const cs = groupRows(rows, w.dim2, null, 'count').sort((a, b) => b.n - a.n).slice(0, 12).map(x => x.k);
        const mat = rs.map(r => cs.map(c => rows.filter(x => keyOf(x[w.dim]) === r && keyOf(x[w.dim2]) === c).length));
        return { rs, cs, mat, max: Math.max(1, ...mat.flat()) };
      }
      case 'grouptable': {
        const ms = p.measures.slice(0, 3);
        const g = groupRows(rows, w.dim, null, 'count').sort((a, b) => b.n - a.n).slice(0, 15);
        const head = [w.dim, 'Registros', ...ms.map(c => (aggFor(c) === 'avg' ? 'Média ' : 'Soma ') + c.name)];
        const body = g.map(x => { const rs = rows.filter(r => keyOf(r[w.dim]) === x.k); return [x.k, fmt(x.n, 'number'), ...ms.map(c => fmt(aggregate(rs, c.name, aggFor(c)), c.type))]; });
        return { head, body, numFrom: 1 };
      }
      case 'datatable': return { head: p.ds.columns.map(c => c.name), cols: p.ds.columns, rows: rows.slice(0, 100), total: rows.length };
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

  return { RX, MFULL, MPT, MEAS, isDone, isFin, aggFor, nid, cap, makePalette, withL, soft, hexRgb, PRESETS, fmt, profile, buildAll, buildExecutive, compute, applyFilters, describe, colOf, W, shade: withL };
})();
