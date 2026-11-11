/* Smart Dash Studio — catálogo declarativo de tipos de visualização.
   Cada tipo descreve quais campos aceita e como monta a especificação do widget.
   Para criar um novo tipo basta acrescentar uma entrada em TYPES (e, se necessário, um ramo em dashboard-engine/render). */
const SDSchema = (() => {
  const E = SDEngine, NUMT = ['number', 'percent', 'currency'];
  const AG = E.AGGL, col = (p, n) => p.ds.columns.find(c => c.name === n);
  const isNum = c => !!c && NUMT.includes(c.type);
  const aggsFor = (c, list) => {
    const base = !c ? ['count'] : c.type === 'percent' ? ['avg', 'median', 'min', 'max', 'count', 'distinct'] : isNum(c) ? ['sum', 'avg', 'median', 'min', 'max', 'count', 'distinct'] : ['count', 'distinct'];
    return list ? [...base, 'list'] : base;
  };
  const defAgg = c => !c ? 'count' : c.type === 'percent' ? 'avg' : isNum(c) ? E.aggFor(c) : 'count';
  const al = (m, a) => m ? `${AG[a] || a} de ${m}` : 'Registros';

  const serie = vis => (f, p) => {
    const dc = col(p, f.dim); if (!dc) return { err: 'Escolha o campo de agrupamento.' };
    const b = { kind: 'chart', chart: vis, m: f.m || null, agg: f.m ? f.agg : 'count', limit: +f.limit || 0, sort: f.sort || undefined, span: 6 };
    return dc.type === 'date' ? { ...b, data: 'time', date: dc.name, grain: f.grain || 'auto', ma: f.ma ? 3 : undefined, trend: f.trend ? true : undefined } : { ...b, data: 'group', dim: dc.name };
  };
  const matrix = vis => (f, p) => {
    const a = col(p, f.dim), b = col(p, f.dim2); if (!a || !b || a === b) return { err: 'Escolha duas dimensões diferentes.' };
    return { kind: 'chart', data: 'stacked', chart: vis, m: f.m || null, agg: f.m ? f.agg : 'count', dim: a.name, dim2: b.name, grain: f.grain || 'auto', limit: +f.limit || 0, sort: f.sort || undefined, span: 12 };
  };
  const S = ['m', 'agg', 'dim', 'grain', 'limit', 'sort'], ST = ['m', 'agg', 'dim', 'grain', 'tr', 'limit', 'sort'], M = ['m', 'agg', 'dim', 'dim2', 'limit', 'sort'];
  const T = (id, g, l, h, f, mk, o) => ({ id, g, l, h, f, mk, o: o || {} });

  const TYPES = [
    T('kpi', 'Indicadores', 'Indicador (KPI)', 'Um número de destaque. Aceita qualquer campo: soma, média, mediana, contagem, contagem distinta ou lista de valores. Meta opcional.', ['m', 'agg', 'goal'], f => ({ kind: 'kpi', m: f.m || null, agg: f.m ? f.agg : 'count', goal: +f.goal > 0 ? +f.goal : undefined, span: 3 }), { list: true }),
    T('bar', 'Comparação', 'Barras verticais', 'Compara categorias. Com muitas categorias vira barras horizontais automaticamente.', ST, serie('bar')),
    T('hbar', 'Comparação', 'Barras horizontais', 'Ideal para rankings e listas longas de nomes.', S, serie('hbar')),
    T('line', 'Evolução', 'Linha', 'Evolução no tempo (ou entre categorias ordenadas).', ST, serie('line')),
    T('area', 'Evolução', 'Área', 'Linha com área preenchida.', ST, serie('area')),
    T('combo', 'Evolução', 'Combinado (barras + linha)', 'Duas medidas no mesmo gráfico, com eixo duplo.', ['dim', 'grain', 'm', 'agg', 'm2', 'agg2', 'limit', 'sort'], (f, p) => { const dc = col(p, f.dim); if (!dc) return { err: 'Escolha o campo de agrupamento.' }; return { kind: 'chart', data: 'combo', chart: 'bar', dim: dc.name, grain: f.grain || 'auto', m: f.m || null, agg: f.m ? f.agg : 'count', m2: f.m2 || null, agg2: f.m2 ? f.agg2 : 'count', limit: +f.limit || 0, sort: f.sort || undefined, span: 12 }; }, { m2empty: true }),
    T('doughnut', 'Proporção', 'Rosca', 'Participação de cada categoria no total.', S, serie('doughnut')),
    T('pie', 'Proporção', 'Pizza', 'Participação de cada categoria no total.', S, serie('pie')),
    T('treemap', 'Proporção', 'Treemap', 'Retângulos proporcionais ao valor de cada categoria.', S, serie('treemap')),
    T('polar', 'Proporção', 'Área polar', 'Setores com raio proporcional ao valor.', S, serie('polar')),
    T('radar', 'Comparação', 'Radar', 'Perfil de poucas categorias em um único contorno.', S, serie('radar')),
    T('funnel', 'Fluxo', 'Funil', 'Etapas ordenadas do maior para o menor valor.', S, serie('funnel')),
    T('waterfall', 'Fluxo', 'Cascata', 'Contribuição acumulada de cada categoria até o total.', S, serie('waterfall')),
    T('stacked', 'Cruzamento', 'Barras empilhadas', 'Duas dimensões: soma das séries em cada categoria.', M, matrix('stacked')),
    T('stacked100', 'Cruzamento', 'Barras 100% empilhadas', 'Participação percentual de cada série em cada categoria.', M, matrix('stacked100')),
    T('grouped', 'Cruzamento', 'Barras agrupadas', 'Duas dimensões lado a lado.', M, matrix('bar')),
    T('mlines', 'Cruzamento', 'Linhas por série', 'Uma linha para cada valor da segunda dimensão.', M, matrix('line')),
    T('heatmap', 'Cruzamento', 'Mapa de calor', 'Intensidade do valor no cruzamento de duas dimensões.', ['m', 'agg', 'dim', 'dim2'], (f, p) => { const a = col(p, f.dim), b = col(p, f.dim2); if (!a || !b || a === b) return { err: 'Escolha duas dimensões diferentes.' }; return { kind: 'heatmap', m: f.m || null, agg: f.m ? f.agg : 'count', dim: a.name, dim2: b.name, grain: f.grain || 'auto', span: 12 }; }),
    T('pareto', 'Estratégico', 'Pareto (80/20)', 'Barras ordenadas com porcentagem acumulada. Requer soma ou contagem.', ['m', 'agg', 'dim', 'limit'], (f, p) => { const dc = col(p, f.dim); if (!dc || dc.type === 'date') return { err: 'Escolha um campo de categoria.' }; if (f.m && !['sum', 'count', 'distinct'].includes(f.agg)) return { err: 'O Pareto precisa de soma ou contagem.' }; return { kind: 'chart', data: 'pareto', chart: 'pareto', m: f.m || null, agg: f.m ? f.agg : 'count', dim: dc.name, limit: +f.limit || 20, span: 12 }; }, { aggs: ['sum', 'count', 'distinct'], noDate: true }),
    T('compare', 'Estratégico', 'Realizado × meta', 'Duas medidas por categoria (ex.: valor realizado e meta).', ['m', 'm2', 'agg', 'dim', 'limit', 'sort'], (f, p) => { const dc = col(p, f.dim); if (!dc || dc.type === 'date' || !f.m || !f.m2) return { err: 'Escolha o campo de categoria e as duas medidas.' }; return { kind: 'chart', data: 'compare', chart: 'bar', m: f.m, m2: f.m2, agg: f.agg || 'sum', dim: dc.name, limit: +f.limit || 0, sort: f.sort || undefined, span: 12 }; }, { numM: true, numM2: true, noDate: true }),
    T('scatter', 'Distribuição', 'Dispersão', 'Relação entre duas medidas, um ponto por registro.', ['m', 'm2'], f => (f.m && f.m2 && f.m !== f.m2) ? { kind: 'chart', data: 'scatter', chart: 'scatter', m: f.m, m2: f.m2, span: 6 } : { err: 'Escolha duas medidas numéricas diferentes.' }, { numM: true, numM2: true }),
    T('bubble', 'Distribuição', 'Bolhas', 'Por categoria: eixo X, eixo Y e tamanho da bolha.', ['dim', 'm', 'agg', 'm2', 'm3', 'limit'], (f, p) => { const dc = col(p, f.dim); if (!dc || dc.type === 'date' || !f.m || !f.m2) return { err: 'Escolha a categoria e as medidas dos eixos X e Y.' }; return { kind: 'chart', data: 'bubble', chart: 'bubble', dim: dc.name, m: f.m, m2: f.m2, m3: f.m3 || null, agg: f.agg || 'sum', limit: +f.limit || 0, span: 12 }; }, { numM: true, numM2: true, m3: true, noDate: true }),
    T('hist', 'Distribuição', 'Histograma', 'Como os valores de uma medida se distribuem em faixas.', ['m'], f => f.m ? { kind: 'chart', data: 'hist', chart: 'bar', m: f.m, span: 6 } : { err: 'Escolha uma medida numérica.' }, { numM: true }),
    T('list', 'Listas e tabelas', 'Lista de valores (nomes)', 'Lista todos os valores distintos de um campo (ex.: nomes de professores), com um valor opcional ao lado.', ['dim', 'grain', 'm', 'agg', 'showVal', 'style', 'limit', 'sort'], (f, p) => { const dc = col(p, f.dim); if (!dc) return { err: 'Escolha o campo a listar.' }; return { kind: 'list', dim: dc.name, grain: f.grain || 'auto', m: f.m || null, agg: f.m ? f.agg : 'count', showVal: f.showVal !== false, style: f.style || 'chips', limit: +f.limit || 0, sort: f.sort || undefined, span: 6 }; }),
    T('table', 'Listas e tabelas', 'Tabela personalizada', 'Agrupa por um campo e calcula quantas colunas quiser (soma, contagem distinta, lista de nomes…).', ['dim', 'grain', 'cols', 'limit', 'sort'], (f, p) => { const dc = f.dim ? col(p, f.dim) : null; const cols = (f.cols || []).filter(c => c.agg); return { kind: 'table', dim: dc ? dc.name : '', grain: f.grain || 'auto', cols: cols.length ? cols.map(c => ({ f: c.f || '', agg: c.f ? c.agg : 'count' })) : [{ f: '', agg: 'count' }], limit: +f.limit || 0, sort: f.sort || undefined, span: 12 }; }, { list: true, optDim: true }),
    T('text', 'Notas', 'Nota / comentário', 'Texto livre para registrar conclusões e recomendações junto aos gráficos.', ['text'], f => ({ kind: 'text', text: f.text || '', span: 6 }), { noData: true })
  ];
  const byId = id => TYPES.find(t => t.id === id);
  const SERIES_IDS = ['bar', 'hbar', 'line', 'area', 'doughnut', 'pie', 'treemap', 'polar', 'radar', 'funnel', 'waterfall'];

  function typeOf(w) {
    if (w.kind === 'kpi' || w.kind === 'heatmap' || w.kind === 'table' || w.kind === 'list' || w.kind === 'text') return w.kind;
    if (w.kind !== 'chart') return null;
    if (w.data === 'group' || w.data === 'time') return SERIES_IDS.includes(w.chart) ? w.chart : 'bar';
    if (w.data === 'stacked') return { stacked: 'stacked', sbar: 'stacked', stacked100: 'stacked100', sbar100: 'stacked100', bar: 'grouped', hbar: 'grouped', line: 'mlines' }[w.chart] || 'stacked';
    return ['combo', 'pareto', 'compare', 'scatter', 'bubble', 'hist'].includes(w.data) ? w.data : null;
  }
  function toForm(w) {
    return { type: typeOf(w), title: w.title, m: w.m || '', agg: w.agg || 'count', m2: w.m2 || '', agg2: w.agg2 || '', m3: w.m3 || '', dim: w.dim || w.date || '', dim2: w.dim2 || '', grain: w.grain || 'auto', ma: !!w.ma, trend: !!w.trend, limit: +w.limit || 0, sort: w.sort || '', goal: w.goal || '', showVal: w.showVal !== false, style: w.style || 'chips', text: w.text || '', cols: (w.cols || []).map(c => ({ ...c })), where: JSON.parse(JSON.stringify(w.where || [])), labels: w.labels === true ? 'on' : w.labels === false ? 'off' : '', lblFmt: w.lblFmt || 'both', color: w.color || '' };
  }
  function autoTitle(f) {
    const a = al(f.m, f.agg), by = f.dim ? ` por ${f.dim}` : '';
    switch (f.type) {
      case 'kpi': return f.agg === 'list' ? `Valores de ${f.m}` : a;
      case 'combo': return `${a} × ${al(f.m2, f.agg2 || f.agg)}${by}`;
      case 'scatter': return `${f.m} × ${f.m2}`;
      case 'bubble': return `${f.dim}: ${f.m} × ${f.m2}`;
      case 'pareto': return `Pareto: ${a}${by}`;
      case 'compare': return `${f.m} × ${f.m2}${by}`;
      case 'hist': return `Distribuição de ${f.m}`;
      case 'table': return `Tabela${by}`;
      case 'list': return `Lista de ${f.dim}`;
      case 'text': return 'Nota';
      case 'heatmap': return `Mapa de calor: ${f.dim} × ${f.dim2}`;
      case 'stacked': case 'stacked100': case 'grouped': case 'mlines': return `${a}: ${f.dim} × ${f.dim2}`;
      default: return `${a}${by}`;
    }
  }
  function build(f, p) {
    const t = byId(f.type); if (!t) return { err: 'Escolha um tipo de visualização.' };
    const s = t.mk(f, p); if (s.err) return s;
    s.title = (f.title || '').trim() || autoTitle(f);
    if (!t.o.noData) {
      const wh = (f.where || []).filter(x => x.values ? x.values.length : (x.from !== '' || x.to !== '')).map(x => x.values ? { col: x.col, values: x.values } : { col: x.col, from: x.from, to: x.to });
      if (wh.length) s.where = wh;
    }
    if (f.labels === 'on') s.labels = true; else if (f.labels === 'off') s.labels = false;
    if (f.lblFmt && f.lblFmt !== 'both') s.lblFmt = f.lblFmt;
    if (f.color) s.color = f.color;
    return s;
  }
  return { TYPES, byId, typeOf, toForm, build, autoTitle, aggsFor, defAgg, isNum };
})();
