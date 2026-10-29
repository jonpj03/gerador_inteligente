/* Smart Dash Studio — exportação (PNG, cópia, PDF, CSV), com suporte a conteúdo maior que a área visível */
const SDExport = (() => {
  const slug = s => (s || 'grafico').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'grafico';
  const PART = 8000; // altura máxima (px CSS) por imagem; com escala 2 fica abaixo do limite de 16384 px dos navegadores
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  /* Renderiza TODO o conteúdo (inclusive áreas roláveis). Retorna lista de canvases (mais de um se for necessário dividir). */
  async function canvases(el) {
    if (typeof html2canvas === 'undefined') throw new Error('Biblioteca de exportação indisponível (verifique a conexão).');
    el.classList.add('exporting');
    try {
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 80)));
      const cs = getComputedStyle(el).backgroundColor;
      const bg = cs && cs !== 'rgba(0, 0, 0, 0)' ? cs : getComputedStyle(document.body).backgroundColor;
      const W = Math.ceil(el.scrollWidth), H = Math.ceil(el.scrollHeight), out = [];
      const base = { scale: 2, backgroundColor: bg, useCORS: true, logging: false, scrollX: 0, scrollY: 0 };
      if (H <= PART) out.push(await html2canvas(el, base));
      else for (let y = 0; y < H; y += PART) out.push(await html2canvas(el, { ...base, x: 0, y, width: W, height: Math.min(PART, H - y) }));
      return out;
    } finally { el.classList.remove('exporting'); }
  }
  const toBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Falha ao gerar a imagem (conteúdo grande demais para o navegador).')), 'image/png'));
  async function png(el, name) {
    const cs = await canvases(el);
    for (let i = 0; i < cs.length; i++) download(await toBlob(cs[i]), slug(name) + (cs.length > 1 ? `-parte-${i + 1}` : '') + '.png');
    return cs.length;
  }
  async function copy(el, name) {
    const cs = await canvases(el);
    if (cs.length === 1 && navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(cs[0]) })]); return 'copied'; } catch (e) { /* fallback */ }
    }
    for (let i = 0; i < cs.length; i++) download(await toBlob(cs[i]), slug(name) + (cs.length > 1 ? `-parte-${i + 1}` : '') + '.png');
    return cs.length > 1 ? 'parts' : 'downloaded';
  }
  async function pdf(el, name) {
    if (!window.jspdf) throw new Error('Biblioteca de PDF indisponível (verifique a conexão).');
    const cs = await canvases(el); let doc;
    cs.forEach((c, i) => {
      const w = c.width / 2, h = c.height / 2;
      if (!doc) doc = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
      else doc.addPage([w, h], w > h ? 'l' : 'p');
      doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    });
    doc.save(slug(name) + '.pdf');
    return cs.length;
  }
  function csv(ds, rows, name) {
    const f = v => {
      if (v == null) return '';
      if (v instanceof Date) return SDParser.fmtDate(v);
      let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      if (/^[=+\-@]/.test(s) && typeof v === 'string') s = "'" + s;
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [ds.columns.map(c => f(c.name)).join(';')];
    for (const r of rows) lines.push(ds.columns.map(c => f(r[c.name])).join(';'));
    download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), slug(name || 'dados') + '.csv');
  }
  return { png, copy, pdf, csv, slug };
})();
