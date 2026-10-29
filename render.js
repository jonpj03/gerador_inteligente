/* Smart Dash Studio — renderização de cards e gráficos (Chart.js) */
const SDRender = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = p => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICON = {
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    cfg: ic('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
    x: ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    exp: ic('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
    grip: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    clip: ic('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
    send: ic('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
    up: ic('<polyline points="18 15 12 9 6 15"/>'), down: ic('<polyline points="6 9 12 15 18 9"/>')
  };
  let charts = [];
  const dropChart = c => { if (!c) return; try { c.destroy(); } catch (e) { /* ok */ } charts = charts.filter(x => x !== c); };
  const destroy = () => { charts.forEach(c => { try { c.destroy(); } catch (e) { /* ok */ } }); charts = []; };
  const dispose = el => { dropChart(el && el._ch); };
  const isSeries = w => w.kind === 'chart' && (w.data === 'group' || w.data === 'time');
  const isMatrix = w => w.kind === 'chart' && w.data === 'stacked';
  const fmtT = SDEngine.fmt;
  const MATRIX = ['stacked', 'sbar', 'bar', 'hbar', 'line'];

  function chartType(w, P) {
    if (!isSeries(w)) return w.chart;
    if (w.userChart) return w.chart;
    return P.chartFormat && P.chartFormat !== 'auto' ? P.chartFormat : w.chart;
  }
  function effVis(w, d, P) {
    let v = chartType(w, P); const n = (d.labels || []).length;
    if (isMatrix(w)) { if (!MATRIX.includes(v)) v = 'stacked'; if (!w.userChart && n > 12) v = v === 'stacked' ? 'sbar' : v === 'bar' ? 'hbar' : v; }
    else if (w.data === 'group' && !w.userChart && v === 'bar' && n > 12) v = 'hbar';
    return v;
  }
  function colorsFor(n, pal) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(i < pal.length ? pal[i] : SDEngine.withL(pal[i % pal.length], (Math.floor(i / pal.length) % 2 ? .12 : -.1)));
    return out;
  }
  function wrap(s, max) {
    s = String(s); if (s.length <= max) return s;
    const lines = []; let cur = '';
    s.split(/\s+/).forEach(w => {
      while (w.length > max) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, max)); w = w.slice(max); }
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    return lines.length > 4 ? [...lines.slice(0, 3), lines[3] + '…'] : lines;
  }

  function sizing(w, d, vis, st, opt) {
    const dflt = { compact: 200, normal: 260, large: 340 }[st.prefs.cardSize] || 260;
    const horiz = vis === 'hbar' || vis === 'sbar'; let need = 0;
    if (horiz && d.labels) {
      const n = d.labels.length, k = d.datasets.length;
      let lines = 1; d.labels.forEach(l => { lines = Math.max(lines, Math.min(4, Math.ceil(String(l).length / 28))); });
      const rowH = (vis === 'hbar' && k > 1 ? k * 14 + 10 : 26) + (lines - 1) * 12;
      need = n * rowH + 70;
    }
    const cap = opt.expanded ? Math.round(innerHeight * .78) : 900;
    let vp, box;
    if (w.h && !opt.expanded) { vp = w.h; box = Math.max(w.h, need); }
    else if (opt.expanded) { box = Math.max(Math.round(innerHeight * .6), need); vp = Math.min(box, cap); }
    else if (w.auto !== false) { vp = Math.max(dflt, Math.min(need, cap)); box = Math.max(vp, need); }
    else { vp = dflt; box = Math.max(dflt, need); }
    return { vp, box, need };
  }

  function buildChart(canvas, w, d, st, vis, dpr) {
    const P = st.prefs, dark = P.theme === 'dark';
    const txt = dark ? '#E8EAED' : '#202124', grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
    const pal = w.color ? SDEngine.makePalette(w.color) : P.palette;
    const pie = vis === 'doughnut' || vis === 'pie', horiz = vis === 'hbar' || vis === 'sbar', stacked = vis === 'stacked' || vis === 'sbar';
    const [r, g, b] = SDEngine.hexRgb(pal[0]);
    let type = vis, data;
    if (w.data === 'scatter') {
      type = 'scatter';
      data = { datasets: [{ label: `${d.yl} × ${d.xl}`, data: d.points, backgroundColor: `rgba(${r},${g},${b},.55)`, pointRadius: 4 }] };
    } else if (isMatrix(w)) {
      type = vis === 'line' ? 'line' : 'bar';
      const cols = colorsFor(d.datasets.length, pal);
      data = { labels: d.labels, datasets: d.datasets.map((s, i) => ({ ...s, backgroundColor: cols[i], borderColor: cols[i], borderWidth: type === 'line' ? 2.5 : 0, borderRadius: type === 'bar' && !stacked ? 3 : 0, tension: .3, pointRadius: type === 'line' ? 3 : 0, fill: false })) };
    } else {
      const ds0 = d.datasets[0];
      if (vis === 'hbar') type = 'bar';
      if (vis === 'area') type = 'line';
      const bg = pie ? colorsFor(d.labels.length, pal) : (type === 'line' ? `rgba(${r},${g},${b},.15)` : pal[0]);
      data = { labels: d.labels, datasets: [{ ...ds0, backgroundColor: bg, borderColor: pie ? (dark ? '#1c1e23' : '#fff') : pal[0], borderWidth: pie ? 2 : type === 'line' ? 2.5 : 0, borderRadius: type === 'bar' ? 4 : 0, fill: type === 'line', tension: .3, pointRadius: type === 'line' ? 3 : 0, pointBackgroundColor: pal[0] }] };
    }
    const multi = isMatrix(w);
    const opts = {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: dpr,
      animation: st.animate ? { duration: 500 } : false,
      plugins: {
        legend: { display: P.legend && (pie || multi), position: pie ? 'right' : 'bottom', labels: { color: txt, boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
        tooltip: { callbacks: {
          title: items => items.length && items[0].label !== undefined ? String(items[0].label) : '',
          label: c => { if (w.data === 'scatter') return `${fmtT(c.parsed.x, d.fmt)} / ${fmtT(c.parsed.y, d.fmt)}`; const v = c.parsed && typeof c.parsed === 'object' ? (horiz ? c.parsed.x : c.parsed.y) : c.parsed; const pre = pie ? '' : (c.dataset.label ? c.dataset.label + ': ' : ''); return pre + fmtT(v, d.fmt); }
        } }
      }
    };
    if (!pie) {
      const ax = { ticks: { color: txt, font: { size: 11 }, maxRotation: 45 }, grid: { color: grid }, border: { display: false } };
      const val = { ...ax, beginAtZero: type !== 'scatter', ticks: { ...ax.ticks, callback: v => fmtT(v, d.fmt, true) } };
      if (horiz) {
        opts.indexAxis = 'y';
        opts.scales = { x: { ...val, stacked }, y: { ...ax, stacked, grid: { display: false }, ticks: { color: txt, font: { size: 11 }, autoSkip: false, callback(v) { return wrap(this.getLabelForValue(v), 28); } } } };
      } else if (w.data === 'scatter') opts.scales = { x: { ...val, title: { display: true, text: d.xl, color: txt } }, y: { ...val, title: { display: true, text: d.yl, color: txt } } };
      else opts.scales = { x: { ...ax, grid: { display: false }, stacked, ticks: { ...ax.ticks, autoSkip: (d.labels || []).length > 40 } }, y: { ...val, stacked } };
    } else if (vis === 'doughnut') opts.cutout = '62%';
    const ch = new Chart(canvas, { type: pie ? vis : type, data, options: opts });
    charts.push(ch); return ch;
  }

  const num = (v, t, f) => v == null ? '' : fmtT(v, t || f);
  function heat(d, st, w) {
    const [r, g, b] = SDEngine.hexRgb(st.prefs.palette[0]);
    const head = `<tr><th></th>${d.cs.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
    const body = d.rs.map((rw, i) => `<tr><th>${esc(rw)}</th>${d.mat[i].map(v => { const a = v == null ? 0 : v / d.max; return `<td style="background:rgba(${r},${g},${b},${(a * .9).toFixed(2)});color:${a > .55 ? '#fff' : 'inherit'}">${v == null ? '' : esc(fmtT(v, d.fmt, true))}</td>`; }).join('')}</tr>`).join('');
    return `<div class="tbl-wrap"><table class="tbl heat">${head}${body}</table></div><p class="muted small">${d.rs.length} linhas × ${d.cs.length} colunas${d.grouped ? ' (colunas menos frequentes agrupadas em "Outros")' : ''}.</p>`;
  }
  function table(d, n) { return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.head.map((h, i) => `<th class="${i >= n ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.body.map(r => `<tr>${r.map((c, i) => `<td class="${i >= n ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function dataTable(d) {
    const cell = (v, c) => v == null ? '' : v instanceof Date ? SDParser.fmtDate(v) : typeof v === 'number' ? fmtT(v, c.type) : v;
    const body = d.rows.map(r => `<tr>${d.cols.map(c => `<td class="${['number', 'percent', 'currency'].includes(c.type) ? 'num' : ''}">${esc(cell(r[c.name], c))}</td>`).join('')}</tr>`).join('');
    return `<div class="tbl-wrap tall"><table class="tbl"><thead><tr>${d.cols.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><p class="muted small">Mostrando ${d.rows.length} de ${d.total} registros (a tabela completa está em Exportar → CSV).</p>`;
  }
  function whereNote(w) {
    return (w.where || []).map(f => f.values ? `${f.col} = ${f.values.join(', ')}` : `${f.col}: ${f.from || '…'} a ${f.to || '…'}`).join(' · ');
  }
  function noteOf(d, w) {
    const out = [];
    if (d.total != null) {
      if (d.q) out.push(`Busca: ${d.matched} de ${d.total} categorias`);
      if (d.others) out.push(`Top ${d.shown} + ${d.others} categorias agrupadas em "Outros"`);
      else if (d.shown < d.matched) out.push(`Exibindo ${d.shown} de ${d.matched} categorias (Top ${w.limit})`);
      else if (!d.q) out.push(`Todas as ${d.shown} categorias exibidas`);
      if (d.serOthers) out.push('séries menos frequentes agrupadas em "Outros"');
    }
    const wn = whereNote(w); if (wn) out.push('Filtros da análise: ' + wn);
    return out.join(' · ');
  }
  const TB = w => `<div class="tb" data-html2canvas-ignore><input type="search" data-tb="q" placeholder="Buscar nome…" value="${esc(w.q || '')}" aria-label="Buscar"><select data-tb="sort" aria-label="Ordenar">${[['desc', 'Maior valor'], ['asc', 'Menor valor'], ['az', 'Nome A–Z'], ['za', 'Nome Z–A']].map(([v, l]) => `<option value="${v}"${(w.sort || 'desc') === v ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-tb="limit" aria-label="Quantidade">${[[0, 'Todos'], [10, 'Top 10'], [20, 'Top 20'], [50, 'Top 50']].map(([v, l]) => `<option value="${v}"${(+w.limit || 0) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;

  function cardEl(w, st, p, rows0, opt) {
    opt = opt || {};
    const rows = SDEngine.rowsFor(w, rows0, p);
    const el = document.createElement('article');
    el.className = `card k-${w.kind}`; el.dataset.id = w.id;
    el.style.setProperty('--span', opt.expanded ? 12 : (w.span || 6));
    if (w.wpx && !opt.expanded) {
      const cw = st.colW || 80; el.style.setProperty('--span', Math.min(12, Math.max(1, Math.ceil((w.wpx + 16) / (cw + 16)))));
      el.style.width = w.wpx + 'px'; el.style.maxWidth = '100%'; el.style.justifySelf = 'start'; el.classList.add('wpx');
    }
    const big = ['chart', 'heatmap', 'grouptable', 'datatable'].includes(w.kind);
    let acts = (w.kind === 'chart' || w.kind === 'heatmap' || w.kind === 'kpi' ? `<button class="ib" data-act="copy" title="Copiar como imagem">${ICON.copy}</button>` : '') + `<button class="ib" data-act="png" title="Baixar PNG">${ICON.dl}</button>`;
    if (big && !opt.expanded) acts += `<button class="ib" data-act="exp" title="Expandir">${ICON.exp}</button>`;
    if (!opt.expanded) acts += `<button class="ib" data-act="cfg" title="Configurar">${ICON.cfg}</button><button class="ib" data-act="del" title="Remover">${ICON.x}</button>`;
    el.innerHTML = `<header class="card-h">${opt.expanded ? '' : `<span class="grip" data-html2canvas-ignore title="Arraste para reorganizar">${ICON.grip}</span>`}<h3 class="card-t" title="${esc(w.title)}">${esc(w.title)}</h3><div class="card-a" data-html2canvas-ignore>${acts}</div></header><div class="card-b"></div>${!opt.expanded && w.kind !== 'kpi' ? '<span class="rz rz-r" data-html2canvas-ignore title="Arraste para ajustar a largura"></span><span class="rz rz-b" data-html2canvas-ignore title="Arraste para ajustar a altura"></span><span class="rz rz-c" data-html2canvas-ignore title="Arraste para redimensionar"></span>' : ''}`;
    const b = el.querySelector('.card-b');
    if (!rows.length) { b.innerHTML = '<p class="empty">Sem dados para os filtros atuais.</p>'; return el; }

    if (w.kind === 'chart') {
      const tb = isMatrix(w) || w.data === 'group';
      b.innerHTML = (tb ? TB(w) : '') + '<div class="cv"></div><p class="cnote muted small"></p>';
      const cv = b.querySelector('.cv'), note = b.querySelector('.cnote');
      const draw = () => {
        dropChart(el._ch); el._ch = null;
        const v0 = chartType(w, st.prefs), d = SDEngine.compute(w, rows0, p, { pie: v0 === 'doughnut' || v0 === 'pie' });
        const empty = d.points ? !d.points.length : !d.labels.length;
        if (empty) { cv.innerHTML = `<p class="empty">${d.q ? 'Nenhuma categoria corresponde à busca.' : 'Dados insuficientes para este gráfico.'}</p>`; note.textContent = noteOf(d, w); return; }
        const vis = effVis(w, d, st.prefs), z = sizing(w, d, vis, st, opt);
        if (z.box > 28000) { cv.innerHTML = `<p class="empty">Este gráfico teria ${d.labels.length} categorias e excede o limite técnico de desenho do navegador. Use Top N, a busca ou o módulo Explorar Dados (tabela completa).</p>`; note.textContent = noteOf(d, w); return; }
        cv.innerHTML = `<div class="cs" style="max-height:${z.vp}px"><div class="chart-box" data-need="${z.need}" style="height:${z.box}px"><canvas></canvas></div></div>`;
        el._ch = buildChart(cv.querySelector('canvas'), w, d, st, vis, Math.max(1, Math.min(2, Math.floor(16000 / z.box))));
        note.textContent = noteOf(d, w);
      };
      if (tb) {
        const h = e => {
          const t = e.target.closest('[data-tb]'); if (!t) return; const k = t.dataset.tb;
          w[k] = k === 'limit' ? +t.value : t.value; draw();
          if (k !== 'q' && st.onChange) st.onChange();
        };
        b.addEventListener('input', h); b.addEventListener('change', e => { if (e.target.tagName === 'SELECT') h(e); });
      }
      draw();
      return el;
    }

    const d = SDEngine.compute(w, rows0, p);
    switch (w.kind) {
      case 'kpi': {
        const t = d.trend ? `<span class="trend">${d.trend.pct >= 0 ? '▲' : '▼'} ${esc(fmtT(Math.abs(d.trend.pct), 'percent'))} <em>${esc(d.trend.label)}</em></span>` : '';
        const wn = whereNote(w);
        b.innerHTML = `<div class="kpi-v">${esc(d.text)}</div>${t}${wn ? `<p class="cnote muted small">${esc(wn)}</p>` : ''}`; break;
      }
      case 'heatmap': b.innerHTML = heat(d, st, w); break;
      case 'grouptable': b.innerHTML = table(d, d.numFrom); break;
      case 'datatable': b.innerHTML = dataTable(d); break;
      case 'highlights': case 'bottlenecks':
        b.innerHTML = d.items.length ? `<ul class="hl">${d.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="empty">Ainda não há destaques calculáveis com estes dados.</p>'; break;
      case 'notice': b.innerHTML = `<p class="notice">${esc(w.text)}</p>`; break;
    }
    if (w.h && !opt.expanded && w.kind !== 'kpi') { const tw = b.querySelector('.tbl-wrap'); if (tw) tw.style.maxHeight = Math.max(80, w.h - 40) + 'px'; else { b.style.maxHeight = w.h + 'px'; b.style.overflow = 'auto'; } }
    return el;
  }

  function render(board, widgets, st, p, rows) {
    destroy(); board.innerHTML = '';
    st.colW = Math.max(40, (board.clientWidth - 11 * 16) / 12);
    if (!widgets.length) { board.innerHTML = '<p class="empty big">Nenhuma visualização neste dashboard. Use o construtor, o chat ou o módulo Explorar Dados para adicionar.</p>'; return; }
    widgets.forEach(w => board.appendChild(cardEl(w, st, p, rows)));
  }
  return { esc, ICON, render, destroy, dispose, chartType, isSeries, isMatrix, cardEl, MATRIX };
})();
