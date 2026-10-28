/* Smart Dash Studio — qualidade dos dados, recomendações e correções */
const SDInsights = (() => {
  const N = SDParser.norm;
  const rowKey = (r, cols) => cols.map(c => { const v = r[c.name]; return v instanceof Date ? v.getTime() : v; }).join('\u0001');
  const squash = s => N(s).replace(/\s+/g, ' ');
  const nrm = x => x < 0.0005 ? 0 : x;

  function variants(ds) {
    const out = [];
    ds.columns.filter(c => c.type === 'category').forEach(c => {
      const m = new Map();
      ds.rows.forEach(r => { const v = r[c.name]; if (v == null) return; const k = squash(v); if (!m.has(k)) m.set(k, new Map()); m.get(k).set(v, (m.get(k).get(v) || 0) + 1); });
      const groups = [...m.values()].filter(g => g.size > 1);
      if (groups.length) out.push({ col: c.name, groups: groups.map(g => [...g.keys()]) });
    });
    return out;
  }
  const spaced = ds => { let n = 0; ds.rows.forEach(r => ds.columns.forEach(c => { const v = r[c.name]; if (typeof v === 'string' && v !== v.replace(/\s+/g, ' ').trim()) n++; })); return n; };
  function outliers(rows, col) {
    const v = rows.map(r => r[col]).filter(x => typeof x === 'number').sort((a, b) => a - b);
    if (v.length < 8) return 0;
    const q = p => v[Math.floor((v.length - 1) * p)], i = q(.75) - q(.25);
    return i ? v.filter(x => x < q(.25) - 3 * i || x > q(.75) + 3 * i).length : 0;
  }

  function assess(ds, p) {
    const n = ds.rows.length, nc = ds.columns.length, items = [];
    const nulls = ds.columns.reduce((a, c) => a + c.nulls, 0);
    const completeness = 1 - nulls / Math.max(1, n * nc);
    const invalid = ds.columns.reduce((a, c) => a + (c.invalid || 0), 0);
    const vr = variants(ds), vCells = vr.reduce((a, v) => a + v.groups.length, 0);
    const consistency = Math.max(0, 1 - (invalid + vCells + spaced(ds) * 0.3) / Math.max(1, n * nc) * 4);
    const seen = new Set(); let dup = 0;
    ds.rows.forEach(r => { const k = rowKey(r, ds.columns); if (seen.has(k)) dup++; else seen.add(k); });
    const duplicates = 1 - dup / Math.max(1, n);
    const score = Math.round(100 * (0.45 * completeness + 0.35 * consistency + 0.2 * duplicates));
    const parts = { completeness: Math.round(100 * completeness), consistency: Math.round(100 * Math.min(1, consistency)), duplicates: Math.round(100 * duplicates) };

    if (n < 5) items.push({ level: 'warn', text: `Apenas ${n} registro(s): poucos dados limitam tendências e comparações.` });
    if (p.date) {
      const months = new Set(ds.rows.map(r => r[p.date.name]).filter(Boolean).map(d => d.getFullYear() * 12 + d.getMonth())).size;
      items.push({ level: 'info', text: `Identificamos a coluna de datas "${p.date.name}" (${SDParser.fmtDate(p.date.min)} a ${SDParser.fmtDate(p.date.max)}). ${months > 1 ? `Você pode analisar a evolução mensal (${months} meses).` : 'Os dados cobrem um único mês; a evolução temporal é limitada.'}` });
    } else items.push({ level: 'info', text: 'Não há coluna de datas. Adicionar uma data permitiria gerar análises de evolução e tendência.' });
    if (!p.person) items.push({ level: 'info', text: 'Os dados não possuem identificação de responsáveis ou equipes. Adicionar essa informação permitiria avaliar a distribuição de demandas e a produtividade.' });
    if (!p.status) items.push({ level: 'info', text: 'Não há coluna de status. Incluí-la permitiria acompanhar andamento, taxa de conclusão e gargalos.' });
    if (p.measures.length && !p.target) items.push({ level: 'info', text: 'Adicionar metas (ex.: uma coluna "Meta") permitiria comparar o resultado realizado com o planejado.' });
    if (!p.measures.length) items.push({ level: 'warn', text: 'Não há colunas numéricas: os gráficos ficam limitados a contagem de registros.' });

    ds.columns.filter(c => c.nulls > 0).sort((a, b) => b.nulls - a.nulls).slice(0, 4).forEach(c => {
      const pc = Math.round(c.nulls / n * 100) || 1;
      const isStatus = c === p.status;
      items.push({
        level: pc >= 20 ? 'warn' : 'info',
        text: isStatus ? `Existem ${c.nulls} registros sem status definido (${pc}%).` : `A coluna "${c.name}" tem ${c.nulls} célula(s) vazia(s) (${pc}%).`,
        action: c.type === 'category' ? { id: 'fillblank', col: c.name, label: 'Marcar como "Não informado"' } : null
      });
    });
    ds.columns.filter(c => c.invalid > 0).slice(0, 3).forEach(c => items.push({ level: 'warn', text: `${c.invalid} valor(es) da coluna "${c.name}" não seguem o padrão ${c.type === 'date' ? 'de data' : 'numérico'} e foram ignorados nos cálculos.` }));
    if (dup) items.push({ level: 'warn', text: `Há possíveis duplicidades: ${dup} registro(s) idênticos a outros.`, action: { id: 'dedupe', label: 'Remover duplicados' } });
    vr.forEach(v => items.push({ level: 'warn', text: `Na coluna "${v.col}", ${v.groups.length} categoria(s) aparecem com grafias diferentes (ex.: ${v.groups[0].slice(0, 3).map(x => `"${x}"`).join(', ')}).`, action: { id: 'normalize', col: v.col, label: 'Unificar grafias' } }));
    const sp = spaced(ds);
    if (sp) items.push({ level: 'info', text: `${sp} célula(s) de texto com espaços sobrando.`, action: { id: 'trim', label: 'Limpar espaços' } });
    ds.columns.filter(c => c.type === 'category' && c.unique > 15).forEach(c => items.push({ level: 'info', text: `A coluna "${c.name}" tem ${c.unique} categorias distintas. Agrupar as menos frequentes em "Outros" facilitaria a leitura.`, action: { id: 'group', col: c.name, label: 'Agrupar em "Outros"' } }));
    ds.columns.filter(c => c.type === 'text' && c.unique > 1 && n >= 10).slice(0, 2).forEach(c => items.push({ level: 'info', text: `A coluna "${c.name}" tem texto livre (${c.unique} valores distintos) e não entra em gráficos. Padronizá-la em categorias permitiria analisá-la.` }));
    p.measures.forEach(c => { const o = outliers(ds.rows, c.name); if (o) items.push({ level: 'info', text: `${o} valor(es) atípico(s) em "${c.name}" podem distorcer médias e totais.` }); });
    if (items.every(i => i.level === 'info') && score >= 90) items.unshift({ level: 'ok', text: 'Os dados estão bem estruturados: completos, consistentes e sem duplicidades.' });
    const rec = [];
    if (p.date && p.measures.length) rec.push('linha de evolução temporal');
    if (p.dims.length && p.measures.length) rec.push('barras por categoria');
    if (p.status) rec.push('distribuição de status');
    if (p.dims.length >= 2) rec.push('cruzamento entre categorias');
    if (p.measures.length >= 2) rec.push('dispersão entre medidas');
    if (rec.length) items.push({ level: 'info', text: `Visualizações recomendadas para estes dados: ${rec.join(', ')}.` });
    return { score, parts, items, dup, nulls };
  }

  function apply(act, ds) {
    const rows = ds.rows.map(r => ({ ...r })); let changed = 0;
    if (act.id === 'trim') rows.forEach(r => ds.columns.forEach(c => { const v = r[c.name]; if (typeof v === 'string') { const t = v.replace(/\s+/g, ' ').trim(); if (t !== v) { r[c.name] = t; changed++; } } }));
    if (act.id === 'fillblank') rows.forEach(r => { if (r[act.col] == null) { r[act.col] = 'Não informado'; changed++; } });
    if (act.id === 'normalize') {
      const m = new Map();
      rows.forEach(r => { const v = r[act.col]; if (v == null) return; const k = squash(v); if (!m.has(k)) m.set(k, new Map()); m.get(k).set(v, (m.get(k).get(v) || 0) + 1); });
      const canon = new Map([...m].map(([k, g]) => [k, [...g].sort((a, b) => b[1] - a[1])[0][0]]));
      rows.forEach(r => { const v = r[act.col]; if (v == null) return; const c = canon.get(squash(v)); if (c !== v) { r[act.col] = c; changed++; } });
    }
    if (act.id === 'group') {
      const cnt = new Map(); rows.forEach(r => { const v = r[act.col]; if (v != null) cnt.set(v, (cnt.get(v) || 0) + 1); });
      const top = new Set([...cnt].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]));
      rows.forEach(r => { const v = r[act.col]; if (v != null && !top.has(v)) { r[act.col] = 'Outros'; changed++; } });
    }
    let out = rows;
    if (act.id === 'dedupe') { const s = new Set(); out = rows.filter(r => { const k = rowKey(r, ds.columns); if (s.has(k)) { changed++; return false; } s.add(k); return true; }); }
    const nds = { ...ds, rows: out, columns: ds.columns.map(c => ({ ...c })) };
    SDParser.refreshStats(nds);
    return { ds: nds, changed };
  }
  return { assess, apply };
})();
