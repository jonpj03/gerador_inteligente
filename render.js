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
  const fmtT = SDEngine.fmt;

  /* Rótulos de valores: barras, linhas, pizza/rosca, radar, funil, cascata */
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.show) return;
      const ctx = chart.ctx, type = chart.config.type, horiz = chart.options.indexAxis === 'y';
      ctx.save(); ctx.font = '600 11px Inter, system-ui, sans-serif';
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden || ds.noLabel) return;
        const dt = ds.type || type, f = ds.fmtFn || o.fmt, tot = (dt === 'doughnut' || dt === 'pie') ? ds.data.reduce((a, x) => a + (+x || 0), 0) : 0;
        meta.data.forEach((el, i) => {
          const raw = ds.vals ? ds.vals[i] : ds.data[i];
          if (raw == null || typeof raw === 'object') return;
          const t = f(raw, i);
          if (dt === 'bar') {
            ctx.textBaseline = 'middle';
            if (o.stacked || ds.center) {
              const len = horiz ? Math.abs(el.x - el.base) : Math.abs(el.y - el.base);
              if (len < (horiz ? String(t).length * 6.5 + 8 : 16)) return;
              ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
              ctx.fillText(t, horiz ? (el.x + el.base) / 2 : el.x, horiz ? el.y : (el.y + el.base) / 2);
            } else if (ds.lblPos === 'top') {
              ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, el.x, Math.min(el.y, el.base) - 3);
            } else {
              ctx.fillStyle = o.color;
              if (horiz) { ctx.textAlign = raw < 0 ? 'right' : 'left'; ctx.fillText(t, el.x + (raw < 0 ? -4 : 4), el.y); }
              else { ctx.textAlign = 'center'; ctx.textBaseline = raw < 0 ? 'top' : 'bottom'; ctx.fillText(t, el.x, el.y + (raw < 0 ? 3 : -3)); }
            }
          } else if (dt === 'line' || dt === 'radar') {
            ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, el.x, el.y - 6);
          } else if (dt === 'doughnut' || dt === 'pie' || dt === 'polarArea') {
            const frac = tot ? (+raw || 0) / tot : 0, a = (el.startAngle + el.endAngle) / 2;
            const txt2 = o.pieFmt === 'value' ? t : o.pieFmt === 'pct' ? (tot ? (frac * 100).toFixed(1).replace('.', ',') + '%' : t) : (tot ? `${t} (${(frac * 100).toFixed(1).replace('.', ',')}%)` : t);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (dt === 'polarArea' || frac >= .07) { const r = dt === 'polarArea' ? el.outerRadius * .65 : (el.innerRadius + el.outerRadius) / 2; ctx.fillStyle = '#fff'; ctx.fillText(txt2, el.x + Math.cos(a) * r, el.y + Math.sin(a) * r); }
            else if (frac > .012) { const r = el.outerRadius + 16; ctx.fillStyle = o.color; ctx.fillText(txt2, el.x + Math.cos(a) * r, el.y + Math.sin(a) * r); }
          }
        });
      });
      ctx.restore();
    }
  };

  let charts = [];
  const dropChart = c => { if (!c) return; try { c.destroy(); } catch (e) { /* ok */ } charts = charts.filter(x => x !== c); };
  const destroy = () => { charts.forEach(c => { try { c.destroy(); } catch (e) { /* ok */ } }); charts = []; };
  const dispose = el => { dropChart(el && el._ch); };
  const isSeries = w => w.kind === 'chart' && (w.data === 'group' || w.data === 'time');
  const isMatrix = w => w.kind === 'chart' && (w.data === 'stacked' || w.data === 'compare');
  const MATRIX = ['stacked', 'sbar', 'stacked100', 'sbar100', 'bar', 'hbar', 'line'];
  const HORIZ = ['hbar', 'sbar', 'sbar100', 'funnel'];

  function chartType(w, P) {
    if (!isSeries(w)) return w.chart;
    if (w.userChart) return w.chart;
    return P.chartFormat && P.chartFormat !== 'auto' ? P.chartFormat : w.chart;
  }
  function effVis(w, d, P) {
    let v = chartType(w, P); const n = (d.labels || []).length;
    if (isMatrix(w)) {
      if (!MATRIX.includes(v)) v = 'stacked';
      if (!w.userChart && n > 12) v = v === 'stacked' ? 'sbar' : v === 'stacked100' ? 'sbar100' : v === 'bar' ? 'hbar' : v;
    } else if (w.data === 'group' && !w.userChart && v === 'bar' && n > 12) v = 'hbar';
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
  /* decide se os rótulos cabem sem poluir o gráfico */
  function labelPlan(w, P, d, vis) {
    const on = w.labels === true || w.labels === false ? w.labels : P.lbl;
    if (!on || w.data === 'scatter' || w.data === 'bubble' || vis === 'treemap') return { on: false, skipped: false };
    const n = (d.labels || []).length;
    const lim = HORIZ.includes(vis) ? 300 : (vis === 'doughnut' || vis === 'pie' || vis === 'polar') ? 24 : vis === 'radar' ? 14 : 40;
    return n > lim ? { on: false, skipped: true } : { on: true, skipped: false };
  }

  function sizing(w, d, vis, st, opt) {
    const dflt = { compact: 200, normal: 260, large: 340 }[st.prefs.cardSize] || 260;
    const horiz = HORIZ.includes(vis); let need = 0;
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

  function buildChart(canvas, w, d, st, vis, dpr, plan) {
    const P = st.prefs, dark = P.theme === 'dark';
    const txt = dark ? '#E8EAED' : '#202124', grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
    const pal = w.color ? SDEngine.makePalette(w.color) : P.palette;
    const pie = vis === 'doughnut' || vis === 'pie' || vis === 'polar', horiz = HORIZ.includes(vis);
    const stacked = vis === 'stacked' || vis === 'sbar' || vis === 'stacked100' || vis === 'sbar100', p100 = /100$/.test(vis);
    const [r, g, b] = SDEngine.hexRgb(pal[0]);
    const nf = v => fmtT(v, d.fmt, true);
    let type = vis, data, fmtLbl = nf, extra = null;
    const ax0 = { ticks: { color: txt, font: { size: 11 }, maxRotation: 45 }, grid: { color: grid }, border: { display: false } };
    if (w.data === 'scatter') {
      type = 'scatter';
      data = { datasets: [{ label: `${d.yl} × ${d.xl}`, data: d.points, backgroundColor: `rgba(${r},${g},${b},.55)`, pointRadius: 4 }] };
    } else if (w.data === 'bubble') {
      type = 'bubble'; let mx = 0; d.points.forEach(q => { if (q.s > mx) mx = q.s; });
      data = { datasets: [{ label: d.sl, data: d.points.map(q => ({ ...q, r: 5 + 24 * Math.sqrt(q.s / (mx || 1)) })), backgroundColor: `rgba(${r},${g},${b},.5)`, borderColor: pal[0] }] };
    } else if (w.data === 'combo') {
      type = 'bar';
      data = { labels: d.labels, datasets: [
        { ...d.datasets[0], type: 'bar', backgroundColor: pal[0], borderRadius: 4, yAxisID: 'y', order: 2 },
        { ...d.datasets[1], type: 'line', yAxisID: 'y1', borderColor: pal[1], backgroundColor: pal[1], borderWidth: 2.5, tension: .25, pointRadius: 3, order: 1, fmtFn: v => fmtT(v, d.fmt2, true) }] };
    } else if (isMatrix(w)) {
      type = vis === 'line' ? 'line' : 'bar';
      const cols = colorsFor(d.datasets.length, pal);
      let dss = d.datasets.map(s => ({ ...s }));
      if (p100) {
        const tot = d.labels.map((_, i) => dss.reduce((a, s) => a + (+s.data[i] || 0), 0));
        dss = dss.map(s => ({ ...s, raw: s.data, data: s.data.map((v, i) => tot[i] ? (+v || 0) / tot[i] * 100 : 0), fmtFn: v => Math.round(v) + '%' }));
      }
      data = { labels: d.labels, datasets: dss.map((s, i) => ({ ...s, backgroundColor: cols[i], borderColor: cols[i], borderWidth: type === 'line' ? 2.5 : 0, borderRadius: type === 'bar' && !stacked ? 3 : 0, tension: .3, pointRadius: type === 'line' ? 3 : 0, fill: false })) };
    } else if (w.data === 'pareto') {
      type = 'bar';
      data = { labels: d.labels, datasets: [{ ...d.datasets[0], type: 'bar', backgroundColor: pal[0], borderRadius: 4, yAxisID: 'y', order: 2 }, { type: 'line', label: '% acumulado', data: d.cum, yAxisID: 'y1', borderColor: pal[1], backgroundColor: pal[1], borderWidth: 2.5, tension: .2, pointRadius: 3, order: 1, fmtFn: v => Math.round(v) + '%' }] };
    } else {
      const ds0 = d.datasets[0]; let labels = d.labels;
      if (vis === 'hbar') type = 'bar';
      if (vis === 'area') type = 'line';
      if (vis === 'radar') type = 'radar';
      if (vis === 'funnel') {
        type = 'bar'; const cols = colorsFor(labels.length, pal);
        data = { labels, datasets: [{ label: ds0.label, data: ds0.data.map(v => [-v / 2, v / 2]), vals: ds0.data, center: true, backgroundColor: cols, borderRadius: 3 }] };
      } else if (vis === 'waterfall') {
        type = 'bar'; let c = 0; const bars = [], vals = [], cols = [];
        ds0.data.forEach(v => { bars.push([c, c + v]); vals.push(v); cols.push(v >= 0 ? pal[0] : '#C62828'); c += v; });
        labels = [...labels, 'Total']; bars.push([0, c]); vals.push(c); cols.push(pal[1] || pal[0]);
        data = { labels, datasets: [{ label: ds0.label, data: bars, vals, lblPos: 'top', backgroundColor: cols, borderRadius: 3 }] };
        extra = { labels };
      } else {
        const bg = pie ? colorsFor(labels.length, pal) : (type === 'line' || type === 'radar' ? `rgba(${r},${g},${b},.18)` : pal[0]);
        data = { labels, datasets: [{ ...ds0, backgroundColor: bg, borderColor: pie ? (dark ? '#1c1e23' : '#fff') : pal[0], borderWidth: pie ? 2 : type === 'line' || type === 'radar' ? 2.5 : 0, borderRadius: type === 'bar' ? 4 : 0, fill: type === 'line' || type === 'radar', tension: .3, pointRadius: type === 'line' || type === 'radar' ? 3 : 0, pointBackgroundColor: pal[0] }] };
        if (w.data === 'time' && d.datasets.length > 1) d.datasets.slice(1).forEach((x, i) => data.datasets.push({ ...x, noLabel: true, type: 'line', borderColor: pal[(i + 1) % pal.length], backgroundColor: pal[(i + 1) % pal.length], borderDash: /Média móvel/.test(x.label) ? [] : [6, 4], borderWidth: 2, pointRadius: 0, fill: false, tension: .3 }));
      }
    }
    const multi = isMatrix(w), nLab = (data.labels || []).length;
    const opts = {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: dpr,
      animation: st.animate ? { duration: 500 } : false,
      plugins: {
        legend: { display: P.legend && (pie || multi || w.data === 'pareto' || w.data === 'combo' || data.datasets.length > 1) && vis !== 'waterfall' && vis !== 'funnel', position: pie ? 'right' : 'bottom', labels: { color: txt, boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
        tooltip: { callbacks: {
          title: items => items.length && items[0].label !== undefined ? String(items[0].label) : '',
          label: c => {
            const ds = c.dataset;
            if (w.data === 'bubble') { const q = c.raw; return `${q.label}: ${d.xl} ${fmtT(q.x, d.fmt)} · ${d.yl} ${fmtT(q.y, d.fmt2)} · ${d.sl} ${fmtT(q.s, 'number')}`; }
            if (w.data === 'scatter') return `${fmtT(c.parsed.x, d.fmt)} / ${fmtT(c.parsed.y, d.fmt)}`;
            if (ds.raw) return `${ds.label}: ${fmtT(ds.raw[c.dataIndex], d.fmt)} (${Math.round(c.parsed[horiz ? 'x' : 'y'])}%)`;
            if (ds.fmtFn) return `${ds.label}: ${ds.yAxisID === 'y1' && w.data === 'combo' ? fmtT(c.parsed.y, d.fmt2) : ds.fmtFn(c.parsed.y)}`;
            if (ds.vals) return fmtT(ds.vals[c.dataIndex], d.fmt);
            const v = c.parsed && typeof c.parsed === 'object' ? (horiz ? c.parsed.x : c.parsed.y) : c.parsed;
            if (pie) { const tot = ds.data.reduce((a, x) => a + (+x || 0), 0); return `${c.label}: ${fmtT(v, d.fmt)}${tot ? ` (${(v / tot * 100).toFixed(1).replace('.', ',')}%)` : ''}`; }
            return (ds.label ? ds.label + ': ' : '') + fmtT(v, d.fmt);
          }
        } }
      }
    };
    opts.plugins.valueLabels = { show: !!(plan && plan.on) && w.data !== 'scatter', color: txt, fmt: nf, stacked, pieFmt: w.lblFmt || 'both' };
    if (opts.plugins.valueLabels.show) opts.layout = { padding: horiz ? { right: 60 } : pie ? 28 : { top: 20 } };
    if (vis === 'radar') opts.scales = { r: { ticks: { color: txt, backdropColor: 'transparent', font: { size: 10 } }, grid: { color: grid }, angleLines: { color: grid }, pointLabels: { color: txt, font: { size: 11 } } } };
    else if (!pie) {
      const val = { ...ax0, beginAtZero: type !== 'scatter' && type !== 'bubble' && vis !== 'waterfall', ticks: { ...ax0.ticks, callback: v => fmtT(v, d.fmt, true) } };
      const catAx = { ...ax0, stacked, grid: { display: false }, ticks: { color: txt, font: { size: 11 }, autoSkip: false, callback(v) { return wrap(this.getLabelForValue(v), 28); } } };
      if (vis === 'funnel') {
        let mx = 0; data.datasets[0].vals.forEach(v => { if (v > mx) mx = v; });
        opts.indexAxis = 'y'; opts.scales = { x: { display: false, min: -mx * .55, max: mx * .55 }, y: { ...catAx, border: { display: false } } };
      } else if (horiz) {
        opts.indexAxis = 'y';
        opts.scales = { x: { ...val, stacked, ...(p100 ? { max: 100, ticks: { ...val.ticks, callback: v => v + '%' } } : {}) }, y: catAx };
      } else if (w.data === 'scatter' || w.data === 'bubble') opts.scales = { x: { ...val, title: { display: true, text: d.xl, color: txt } }, y: { ...val, ticks: { ...val.ticks, callback: v => fmtT(v, d.fmt2 || d.fmt, true) }, title: { display: true, text: d.yl, color: txt } } };
      else {
        opts.scales = { x: { ...ax0, grid: { display: false }, stacked, ticks: { ...ax0.ticks, autoSkip: nLab > 40 } }, y: { ...val, stacked, ...(p100 ? { max: 100, ticks: { ...val.ticks, callback: v => v + '%' } } : {}) } };
        if (w.data === 'pareto' || w.data === 'combo') opts.scales.y1 = { position: 'right', ...(w.data === 'pareto' ? { min: 0, max: 100 } : { beginAtZero: true }), grid: { display: false }, border: { display: false }, ticks: { color: txt, font: { size: 11 }, callback: v => w.data === 'pareto' ? v + '%' : fmtT(v, d.fmt2, true) } };
      }
    } else if (vis === 'doughnut') opts.cutout = '62%';
    const ch = new Chart(canvas, { type: vis === 'polar' ? 'polarArea' : (pie ? vis : type), data, options: opts, plugins: [valueLabels] });
    charts.push(ch); return ch;
  }

  /* treemap em HTML (divisão binária pelo tamanho) */
  function treemap(d, w, st, h, plan) {
    const pal = w.color ? SDEngine.makePalette(w.color) : st.prefs.palette, cols = colorsFor(d.labels.length, pal);
    const items = d.labels.map((l, i) => ({ l, v: d.datasets[0].data[i], c: cols[i] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const tot = items.reduce((a, x) => a + x.v, 0), out = [];
    (function lay(it, x, y, ww, hh) {
      if (!it.length) return;
      if (it.length === 1) { out.push({ ...it[0], x, y, w: ww, h: hh }); return; }
      const sum = it.reduce((a, q) => a + q.v, 0); let acc = 0, k = 0;
      while (k < it.length - 1 && acc + it[k].v / 2 < sum / 2) { acc += it[k].v; k++; } k = Math.max(1, k);
      const a = it.slice(0, k), b = it.slice(k), fa = a.reduce((s, q) => s + q.v, 0) / sum;
      if (ww >= hh) { lay(a, x, y, ww * fa, hh); lay(b, x + ww * fa, y, ww * (1 - fa), hh); } else { lay(a, x, y, ww, hh * fa); lay(b, x, y + hh * fa, ww, hh * (1 - fa)); }
    })(items, 0, 0, 100, 100);
    const lum = c => { const [r, g, b] = SDEngine.hexRgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };
    const showV = plan.on;
    return `<div class="tm" style="height:${h}px">${out.map(t => `<div class="tm-t" style="left:${t.x}%;top:${t.y}%;width:${t.w}%;height:${t.h}%;background:${t.c};color:${lum(t.c) > .62 ? '#202124' : '#fff'}" title="${esc(t.l)}: ${esc(fmtT(t.v, d.fmt))} (${(t.v / tot * 100).toFixed(1).replace('.', ',')}%)"><b>${esc(t.l)}</b>${showV ? `<span>${esc(fmtT(t.v, d.fmt, true))} · ${(t.v / tot * 100).toFixed(1).replace('.', ',')}%</span>` : ''}</div>`).join('')}</div>`;
  }

  function heat(d, st) {
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
  function customTable(d) {
    const cell = (v, i) => v == null ? '' : typeof v === 'string' ? v : fmtT(v, d.types[i]);
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.head.map((h, i) => `<th class="${i && d.types[i - 1] !== 'text' && typeof (d.rows[0] || { vals: [] }).vals[i - 1] !== 'string' ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr><th class="sticky">${esc(r.label)}</th>${r.vals.map((v, i) => `<td class="${typeof v === 'string' ? 'lst' : 'num'}">${esc(cell(v, i))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function listView(d, w) {
    const f = v => fmtT(v, d.fmt, true);
    if (w.style === 'table') return `<div class="tbl-wrap"><table class="tbl"><tbody>${d.items.map((x, i) => `<tr><td class="num muted">${i + 1}</td><th>${esc(x.label)}</th>${d.hasV ? `<td class="num">${esc(f(x.v))}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    return `<div class="lchips">${d.items.map(x => `<span class="lchip">${esc(x.label)}${d.hasV ? `<b>${esc(f(x.v))}</b>` : ''}</span>`).join('')}</div>`;
  }
  const whereNote = w => (w.where || []).map(f => f.values ? `${f.col} = ${f.values.join(', ')}` : `${f.col}: ${f.from || '…'} a ${f.to || '…'}`).join(' · ');
  function noteOf(d, w) {
    const out = [];
    if (d.n80) out.push(`${d.n80} de ${d.n} categorias somam 80% do total (% acumulado calculado sobre todas)`);
    if (d.total != null) {
      const unit = w.kind === 'chart' ? 'categorias' : 'itens';
      if (d.q) out.push(`Busca: ${d.matched} de ${d.total} ${unit}`);
      if (d.others) out.push(`Top ${d.shown} + ${d.others} ${unit} agrupadas em "Outros"`);
      else if (d.shown < d.matched) out.push(`Exibindo ${d.shown} de ${d.matched} ${unit} (Top ${w.limit})`);
      else if (!d.q) out.push(w.kind === 'chart' ? `Todas as ${d.shown} categorias exibidas` : `Todos os ${d.shown} itens exibidos`);
      if (d.serOthers) out.push('séries menos frequentes agrupadas em "Outros"');
    }
    const wn = whereNote(w); if (wn) out.push('Filtros: ' + wn);
    return out.join(' · ');
  }
  const TB = w => `<div class="tb" data-html2canvas-ignore><input type="search" data-tb="q" placeholder="Buscar nome…" value="${esc(w.q || '')}" aria-label="Buscar"><select data-tb="sort" aria-label="Ordenar">${[['desc', 'Maior valor'], ['asc', 'Menor valor'], ['az', 'Nome A–Z'], ['za', 'Nome Z–A']].map(([v, l]) => `<option value="${v}"${(w.sort || (w.kind === 'list' ? 'az' : 'desc')) === v ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-tb="limit" aria-label="Quantidade">${[[0, 'Todos'], [10, 'Top 10'], [20, 'Top 20'], [50, 'Top 50']].map(([v, l]) => `<option value="${v}"${(+w.limit || 0) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;

  function wireTb(b, w, st, draw) {
    const h = e => {
      const t = e.target.closest('[data-tb]'); if (!t) return; const k = t.dataset.tb;
      w[k] = k === 'limit' ? +t.value : t.value; draw();
      if (k !== 'q' && st.onChange) st.onChange();
    };
    b.addEventListener('input', h); b.addEventListener('change', e => { if (e.target.tagName === 'SELECT') h(e); });
  }

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
    const big = ['chart', 'heatmap', 'grouptable', 'datatable', 'table', 'list'].includes(w.kind);
    let acts = (['chart', 'heatmap', 'kpi'].includes(w.kind) ? `<button class="ib" data-act="copy" title="Copiar como imagem">${ICON.copy}</button>` : '') + `<button class="ib" data-act="png" title="Baixar PNG">${ICON.dl}</button>`;
    if (big && !opt.expanded) acts += `<button class="ib" data-act="exp" title="Expandir">${ICON.exp}</button>`;
    if (!opt.expanded) acts += `<button class="ib" data-act="cfg" title="Editar visualização">${ICON.cfg}</button><button class="ib" data-act="del" title="Remover">${ICON.x}</button>`;
    el.innerHTML = `<header class="card-h">${opt.expanded ? '' : `<span class="grip" data-html2canvas-ignore title="Arraste para reorganizar">${ICON.grip}</span>`}<h3 class="card-t" title="${esc(w.title)}">${esc(w.title)}</h3><div class="card-a" data-html2canvas-ignore>${acts}</div></header><div class="card-b"></div>${!opt.expanded && w.kind !== 'kpi' ? '<span class="rz rz-r" data-html2canvas-ignore title="Arraste para ajustar a largura"></span><span class="rz rz-b" data-html2canvas-ignore title="Arraste para ajustar a altura"></span><span class="rz rz-c" data-html2canvas-ignore title="Arraste para redimensionar"></span>' : ''}`;
    const b = el.querySelector('.card-b');
    if (w.kind === 'text') { b.innerHTML = `<div class="txt">${esc(w.text || 'Clique em ⚙ para escrever um comentário ou conclusão.')}</div>`; return el; }
    if (!rows.length) { b.innerHTML = '<p class="empty">Sem dados para os filtros atuais.</p>'; return el; }

    if (w.kind === 'chart') {
      const tb = isMatrix(w) || w.data === 'group' || w.data === 'pareto' || w.data === 'combo';
      b.innerHTML = (tb ? TB(w) : '') + '<div class="cv"></div><p class="cnote muted small"></p>';
      const cv = b.querySelector('.cv'), note = b.querySelector('.cnote');
      const draw = () => {
        dropChart(el._ch); el._ch = null;
        const v0 = chartType(w, st.prefs), d = SDEngine.compute(w, rows0, p, { pie: v0 === 'doughnut' || v0 === 'pie' || v0 === 'polar' });
        const empty = d.points ? !d.points.length : !d.labels.length;
        if (empty) { cv.innerHTML = `<p class="empty">${d.q ? 'Nenhuma categoria corresponde à busca.' : 'Dados insuficientes para este gráfico.'}</p>`; note.textContent = noteOf(d, w); return; }
        const vis = effVis(w, d, st.prefs), z = sizing(w, d, vis, st, opt), plan = labelPlan(w, st.prefs, d, vis);
        const extraNote = () => { const n = noteOf(d, w); note.textContent = n + (plan.skipped ? (n ? ' · ' : '') + 'Rótulos ocultos: muitas categorias (use Top N, amplie o gráfico ou filtre).' : ''); };
        if (vis === 'treemap') { cv.innerHTML = treemap(d, w, st, Math.max(z.vp, 260), plan); extraNote(); return; }
        if (z.box > 28000) { cv.innerHTML = `<p class="empty">Este gráfico teria ${d.labels.length} categorias e excede o limite técnico de desenho do navegador. Use Top N, a busca ou o módulo Explorar Dados (tabela completa).</p>`; note.textContent = noteOf(d, w); return; }
        cv.innerHTML = `<div class="cs" style="max-height:${z.vp}px"><div class="chart-box" data-need="${z.need}" style="height:${z.box}px"><canvas></canvas></div></div>`;
        el._ch = buildChart(cv.querySelector('canvas'), w, d, st, vis, Math.max(1, Math.min(2, Math.floor(16000 / z.box))), plan);
        extraNote();
      };
      if (tb) wireTb(b, w, st, draw);
      draw();
      return el;
    }

    if (w.kind === 'table' || w.kind === 'list') {
      b.innerHTML = TB(w) + '<div class="cv lv"></div><p class="cnote muted small"></p>';
      const cv = b.querySelector('.cv'), note = b.querySelector('.cnote');
      const draw = () => {
        const d = SDEngine.compute(w, rows0, p), mh = (w.h && !opt.expanded) ? w.h : (opt.expanded ? Math.round(innerHeight * .7) : 420);
        cv.style.maxHeight = mh + 'px';
        cv.innerHTML = (w.kind === 'table' ? (d.rows.length ? customTable(d) : '') : (d.items.length ? listView(d, w) : '')) || `<p class="empty">${d.q ? 'Nenhum item corresponde à busca.' : 'Sem itens.'}</p>`;
        note.textContent = noteOf(d, w);
      };
      wireTb(b, w, st, draw); draw();
      return el;
    }

    const d = SDEngine.compute(w, rows0, p);
    switch (w.kind) {
      case 'kpi': {
        const t = d.trend ? `<span class="trend">${d.trend.pct >= 0 ? '▲' : '▼'} ${esc(fmtT(Math.abs(d.trend.pct), 'percent'))} <em>${esc(d.trend.label)}</em></span>` : '';
        const goal = d.goal != null ? `<div class="goal"><i style="width:${Math.min(100, Math.max(0, d.goal))}%"></i></div><span class="trend">${esc(fmtT(d.goal, 'percent'))} da meta (${esc(fmtT(+w.goal, 'number'))})</span>` : '';
        const wn = whereNote(w);
        b.innerHTML = `<div class="${d.isList ? 'kpi-l' : 'kpi-v'}">${esc(d.text)}</div>${t}${goal}${wn ? `<p class="cnote muted small">${esc(wn)}</p>` : ''}`; break;
      }
      case 'heatmap': b.innerHTML = heat(d, st); break;
      case 'grouptable': b.innerHTML = table(d, d.numFrom); break;
      case 'datatable': b.innerHTML = dataTable(d); break;
      case 'highlights': case 'bottlenecks':
        b.innerHTML = d.items.length ? `<ul class="hl">${d.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="empty">Ainda não há destaques calculáveis com estes dados.</p>'; break;
      case 'strategy':
        b.innerHTML = d.sections.length ? `<div class="strat">${d.sections.map(s => `<div class="sg sg-${s.key}"><h4><i></i>${esc(s.title)}</h4><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div><p class="muted small strat-n">Leituras geradas por regras sobre os dados e filtros atuais. São hipóteses para apoiar a decisão, não conclusões: valide com o contexto do negócio.</p>` : '<p class="empty">Dados insuficientes para gerar leituras estratégicas.</p>'; break;
      case 'notice': b.innerHTML = `<p class="notice">${esc(w.text)}</p>`; break;
    }
    if (w.h && !opt.expanded && w.kind !== 'kpi') { const tw = b.querySelector('.tbl-wrap'); if (tw) tw.style.maxHeight = Math.max(80, w.h - 40) + 'px'; else { b.style.maxHeight = w.h + 'px'; b.style.overflow = 'auto'; } }
    return el;
  }

  function render(board, widgets, st, p, rows) {
    destroy(); board.innerHTML = '';
    st.colW = Math.max(40, (board.clientWidth - 11 * 16) / 12);
    if (!widgets.length) { board.innerHTML = '<p class="empty big">Nenhuma visualização neste dashboard. Use "+ Visualização", o chat ou o módulo Explorar Dados para adicionar.</p>'; return; }
    widgets.forEach(w => board.appendChild(cardEl(w, st, p, rows)));
  }
  return { esc, ICON, render, destroy, dispose, chartType, isSeries, isMatrix, cardEl, MATRIX };
})();
