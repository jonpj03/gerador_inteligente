/* Smart Dash Studio — renderização de cards e gráficos (Chart.js) */
const SDRender = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = p => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICON = {
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    cfg: ic('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
    x: ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    grip: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    clip: ic('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
    send: ic('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
    up: ic('<polyline points="18 15 12 9 6 15"/>'), down: ic('<polyline points="6 9 12 15 18 9"/>')
  };
  let charts = [];
  const destroy = () => { charts.forEach(c => { try { c.destroy(); } catch (e) { /* ok */ } }); charts = []; };
  const isSeries = w => w.kind === 'chart' && (w.data === 'group' || w.data === 'time');
  const fmtT = SDEngine.fmt;

  function chartType(w, P) {
    if (!isSeries(w)) return w.chart;
    if (w.userChart) return w.chart;
    return P.chartFormat && P.chartFormat !== 'auto' ? P.chartFormat : w.chart;
  }

  function buildChart(canvas, w, d, st) {
    const P = st.prefs, dark = P.theme === 'dark';
    const txt = dark ? '#E8EAED' : '#202124', grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
    const pal = w.color ? SDEngine.makePalette(w.color) : P.palette;
    const vis = chartType(w, P), pie = vis === 'doughnut' || vis === 'pie';
    const [r, g, b] = SDEngine.hexRgb(pal[0]);
    let type = vis, data, opts;
    if (w.data === 'scatter') {
      type = 'scatter';
      data = { datasets: [{ label: `${d.yl} × ${d.xl}`, data: d.points, backgroundColor: `rgba(${r},${g},${b},.55)`, pointRadius: 4 }] };
    } else if (w.data === 'stacked') {
      type = 'bar';
      data = { labels: d.labels, datasets: d.datasets.map((s, i) => ({ ...s, backgroundColor: pal[i % pal.length], borderRadius: 3 })) };
    } else {
      const ds0 = d.datasets[0];
      if (vis === 'hbar') type = 'bar';
      if (vis === 'area') type = 'line';
      const bg = pie ? d.labels.map((_, i) => pal[i % pal.length]) : (type === 'line' ? `rgba(${r},${g},${b},.15)` : pal[0]);
      data = { labels: d.labels, datasets: [{ ...ds0, backgroundColor: bg, borderColor: pie ? (dark ? '#1c1e23' : '#fff') : pal[0], borderWidth: pie ? 2 : type === 'line' ? 2.5 : 0, borderRadius: type === 'bar' ? 4 : 0, fill: vis === 'area' || (type === 'line'), tension: .3, pointRadius: type === 'line' ? 3 : 0, pointBackgroundColor: pal[0] }] };
    }
    const multi = w.data === 'stacked';
    opts = {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: 2,
      animation: st.animate ? { duration: 500 } : false,
      plugins: {
        legend: { display: P.legend && (pie || multi), position: pie ? 'right' : 'bottom', labels: { color: txt, boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => { if (w.data === 'scatter') return `${fmtT(c.parsed.x, d.fmt)} / ${fmtT(c.parsed.y, d.fmt)}`; const v = c.parsed && typeof c.parsed === 'object' ? (vis === 'hbar' ? c.parsed.x : c.parsed.y) : c.parsed; const pre = pie ? c.label + ': ' : (c.dataset.label ? c.dataset.label + ': ' : ''); return pre + fmtT(v, d.fmt); } } }
      }
    };
    if (!pie) {
      const ax = { ticks: { color: txt, font: { size: 11 }, maxRotation: 45 }, grid: { color: grid }, border: { display: false } };
      const val = { ...ax, beginAtZero: type !== 'scatter', ticks: { ...ax.ticks, callback: v => fmtT(v, d.fmt, true) } };
      if (vis === 'hbar') { opts.indexAxis = 'y'; opts.scales = { x: val, y: { ...ax, grid: { display: false } } }; }
      else if (w.data === 'scatter') opts.scales = { x: { ...val, title: { display: true, text: d.xl, color: txt } }, y: { ...val, title: { display: true, text: d.yl, color: txt } } };
      else opts.scales = { x: { ...ax, grid: { display: false }, stacked: multi }, y: { ...val, stacked: multi } };
    } else if (vis === 'doughnut') opts.cutout = '62%';
    if (type === 'pie' || type === 'doughnut') type = vis;
    charts.push(new Chart(canvas, { type, data, options: opts }));
  }

  function heat(d, st, w) {
    const [r, g, b] = SDEngine.hexRgb(st.prefs.primary);
    const head = `<tr><th></th>${d.cs.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
    const body = d.rs.map((rw, i) => `<tr><th>${esc(rw)}</th>${d.mat[i].map(v => { const a = v / d.max; return `<td style="background:rgba(${r},${g},${b},${(a * .9).toFixed(2)});color:${a > .55 ? '#fff' : 'inherit'}">${v || ''}</td>`; }).join('')}</tr>`).join('');
    return `<div class="tbl-wrap"><table class="tbl heat">${head}${body}</table></div><p class="muted small">Contagem de registros por ${esc(w.dim)} × ${esc(w.dim2)}.</p>`;
  }
  function table(d, num) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.head.map((h, i) => `<th class="${i >= num ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.body.map(r => `<tr>${r.map((c, i) => `<td class="${i >= num ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function dataTable(d) {
    const cell = (v, c) => v == null ? '' : v instanceof Date ? SDParser.fmtDate(v) : typeof v === 'number' ? fmtT(v, c.type) : v;
    const body = d.rows.map(r => `<tr>${d.cols.map(c => `<td class="${['number', 'percent', 'currency'].includes(c.type) ? 'num' : ''}">${esc(cell(r[c.name], c))}</td>`).join('')}</tr>`).join('');
    return `<div class="tbl-wrap tall"><table class="tbl"><thead><tr>${d.cols.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><p class="muted small">Mostrando ${d.rows.length} de ${d.total} registros.</p>`;
  }

  function cardEl(w, st, p, rows) {
    const el = document.createElement('article');
    el.className = `card k-${w.kind}`; el.dataset.id = w.id; el.style.setProperty('--span', w.span || 6);
    const hasData = rows.length > 0;
    const actions = ['chart', 'heatmap'].includes(w.kind) || w.kind === 'kpi' ? '<button class="ib" data-act="copy" title="Copiar como imagem">' + ICON.copy + '</button><button class="ib" data-act="png" title="Baixar PNG">' + ICON.dl + '</button>' : '<button class="ib" data-act="png" title="Baixar PNG">' + ICON.dl + '</button>';
    el.innerHTML = `<header class="card-h"><span class="grip" data-html2canvas-ignore title="Arraste para reorganizar">${ICON.grip}</span><h3 class="card-t">${esc(w.title)}</h3><div class="card-a" data-html2canvas-ignore>${actions}<button class="ib" data-act="cfg" title="Configurar">${ICON.cfg}</button><button class="ib" data-act="del" title="Remover">${ICON.x}</button></div></header><div class="card-b"></div>`;
    const b = el.querySelector('.card-b');
    if (!hasData) { b.innerHTML = '<p class="empty">Sem dados para os filtros atuais.</p>'; return el; }
    const d = SDEngine.compute(w, rows, p);
    switch (w.kind) {
      case 'kpi': {
        const t = d.trend ? `<span class="trend">${d.trend.pct >= 0 ? '▲' : '▼'} ${esc(fmtT(Math.abs(d.trend.pct), 'percent'))} <em>${esc(d.trend.label)}</em></span>` : '';
        b.innerHTML = `<div class="kpi-v">${esc(d.text)}</div>${t}`; break;
      }
      case 'chart': {
        const empty = d.points ? !d.points.length : !d.labels.length;
        if (empty) { b.innerHTML = '<p class="empty">Dados insuficientes para este gráfico.</p>'; break; }
        b.innerHTML = '<div class="chart-box"><canvas></canvas></div>';
        buildChart(b.querySelector('canvas'), w, d, st); break;
      }
      case 'heatmap': b.innerHTML = heat(d, st, w); break;
      case 'grouptable': b.innerHTML = table(d, d.numFrom); break;
      case 'datatable': b.innerHTML = dataTable(d); break;
      case 'highlights': case 'bottlenecks':
        b.innerHTML = d.items.length ? `<ul class="hl">${d.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="empty">Ainda não há destaques calculáveis com estes dados.</p>'; break;
      case 'notice': b.innerHTML = `<p class="notice">${esc(w.text)}</p>`; break;
    }
    return el;
  }

  function render(board, widgets, st, p, rows) {
    destroy(); board.innerHTML = '';
    if (!widgets.length) { board.innerHTML = '<p class="empty big">Nenhuma visualização neste dashboard. Use o construtor acima ou o chat para adicionar.</p>'; return; }
    widgets.forEach(w => board.appendChild(cardEl(w, st, p, rows)));
  }
  return { esc, ICON, render, destroy, chartType, isSeries };
})();
