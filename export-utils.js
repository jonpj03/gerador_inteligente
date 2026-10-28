/* Smart Dash Studio — exportação (PNG, cópia, PDF, CSV) */
const SDExport = (() => {
  const slug = s => (s || 'grafico').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'grafico';
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function toCanvas(el) {
    if (typeof html2canvas === 'undefined') throw new Error('Biblioteca de exportação indisponível (verifique a conexão).');
    const bg = getComputedStyle(el).backgroundColor;
    const c = await html2canvas(el, { scale: 2, backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : getComputedStyle(document.body).backgroundColor, useCORS: true, logging: false });
    return c;
  }
  const canvasBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Falha ao gerar a imagem.')), 'image/png'));
  async function png(el, name) { download(await canvasBlob(await toCanvas(el)), slug(name) + '.png'); }
  async function copy(el, name) {
    const canUse = navigator.clipboard && window.ClipboardItem && window.isSecureContext;
    const blobP = toCanvas(el).then(canvasBlob);
    if (canUse) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]); return 'copied'; } catch (e) { /* fallback */ }
    }
    download(await blobP, slug(name) + '.png');
    return 'downloaded';
  }
  async function pdf(el, name) {
    if (!window.jspdf) throw new Error('Biblioteca de PDF indisponível (verifique a conexão).');
    const c = await toCanvas(el), w = c.width / 2, h = c.height / 2;
    const doc = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    doc.save(slug(name) + '.pdf');
  }
  function csv(ds, rows, name) {
    const f = v => {
      if (v == null) return '';
      if (v instanceof Date) return SDParser.fmtDate(v);
      let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      if (/^[=+\-@]/.test(s) && typeof v === 'string') s = "'" + s;
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [ds.columns.map(c => f(c.name)).join(';'), ...rows.map(r => ds.columns.map(c => f(r[c.name])).join(';'))];
    download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), slug(name || 'dados') + '.csv');
  }
  return { png, copy, pdf, csv, slug };
})();
