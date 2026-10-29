/* Smart Dash Studio — comandos em linguagem natural (interpretação local por regras) */
const SDCommands = (() => {
  const N = SDParser.norm;
  const COLORS = { azul: 'Azul', verde: 'Verde', laranja: 'Laranja', roxo: 'Roxo', violeta: 'Roxo', cinza: 'Grafite', grafite: 'Grafite', turquesa: 'Turquesa', teal: 'Turquesa', magenta: 'Magenta', corporativo: 'Corporativo', rosa: 'Magenta', multicor: 'Multicor', colorido: 'Multicor' };
  const EXTRA = { vermelho: '#C62828', amarelo: '#F9A825', marrom: '#6D4C41' };
  const TYPES = [['barras horizontais', 'hbar'], ['barra horizontal', 'hbar'], ['rosca', 'doughnut'], ['donut', 'doughnut'], ['pizza', 'pie'], ['colunas', 'bar'], ['coluna', 'bar'], ['barras', 'bar'], ['barra', 'bar'], ['linhas', 'line'], ['linha', 'line'], ['area', 'area']];
  const TNAME = { bar: 'barras', hbar: 'barras horizontais', doughnut: 'rosca', pie: 'pizza', line: 'linha', area: 'área' };
  const TABS = { executivo: 'executive', operacional: 'operational', analitico: 'analytical', personalizado: 'custom', insights: 'insights' };

  const typeIn = s => { for (const [w, t] of TYPES) { const i = s.indexOf(w); if (i > -1) return { t, i, w }; } return null; };
  const ok = msg => ({ ok: true, msg }), no = msg => ({ ok: false, msg });

  const handlers = [
    (n, c) => {
      if (!/(restaur|resete|reset|voltar ao padrao|tema original)/.test(n) || /filtro/.test(n)) return null;
      c.restoreTheme(); return ok('Tema original restaurado (branco e magenta).');
    },
    (n, c) => {
      if (!/\b(cor|cores|tom|tons|paleta|pinte|colori|tema)\b/.test(n) && !/#[0-9a-f]{6}/.test(n)) return null;
      if (/tema (escuro|claro)/.test(n)) return null;
      const hx = n.match(/#[0-9a-f]{6}/);
      if (hx) { c.setColor(hx[0].toUpperCase(), null); return ok(`Cor principal alterada para ${hx[0].toUpperCase()}.`); }
      for (const k of Object.keys(COLORS)) if (new RegExp('\\b' + k + 's?\\b').test(n)) { c.setColor(null, COLORS[k]); return ok(`Paleta "${COLORS[k]}" aplicada a todos os dashboards.`); }
      for (const k of Object.keys(EXTRA)) if (new RegExp('\\b' + k + 's?\\b').test(n)) { c.setColor(EXTRA[k], null); return ok(`Cor ${k} aplicada a todos os dashboards.`); }
      return no('Não reconheci a cor. Tente: azul, verde, laranja, roxo, vermelho, turquesa, cinza, magenta, multicor ou um código como #1565C0.');
    },
    (n, c) => {
      if (/(tema|modo|fundo) (escuro|dark)/.test(n)) { c.setTheme('dark'); return ok('Tema escuro ativado.'); }
      if (/(tema|modo|fundo) (claro|light)/.test(n)) { c.setTheme('light'); return ok('Tema claro ativado.'); }
      return null;
    },
    (n, c) => {
      if (!/legenda/.test(n)) return null;
      if (/(ocult|esconda|remov|tire|sem)/.test(n)) { c.setLegend(false); return ok('Legendas ocultas.'); }
      if (/(mostr|exib|ative|ligue|com)/.test(n)) { c.setLegend(true); return ok('Legendas exibidas.'); }
      return null;
    },
    (n, c) => {
      if (!/(troque|trocar|mude|mudar|substitu|convert|altere|alterar|transforme|use)/.test(n)) return null;
      const t = typeIn(n); if (!t) return null;
      const split = n.match(/(.*?)\b(por|para|em)\b(.*)/);
      let from = null, to = t;
      if (split) { const a = typeIn(split[1]), b = typeIn(split[3]); if (a && b) { from = a; to = b; } else if (b) to = b; else if (a && !b) return null; }
      const nChg = c.setChartType(from ? from.t : null, to.t);
      return nChg ? ok(`${nChg} gráfico(s) ${from ? `de ${TNAME[from.t]} ` : ''}alterado(s) para ${TNAME[to.t]}. Gráficos empilhados, dispersão e histogramas mantêm o formato.`) : no('Nenhum gráfico compatível encontrado para essa troca.');
    },
    (n, c) => {
      const m = n.match(/\btop\s*(\d{1,2})\b/);
      if (!m) return null;
      return ok(`Rankings limitados aos ${m[1]} maiores (${c.setLimit(+m[1])} gráfico(s) atualizado(s)).`);
    },
    (n, c) => {
      if (/(limpar|remover|resetar|tirar|sem).*filtro/.test(n)) { c.clearFilters(); return ok('Filtros removidos.'); }
      return null;
    },
    (n, c) => {
      if (!/(apenas|somente|so os|so as|so o|so a|filtr|mostr|exib|resultados? de|dados de|considere)/.test(n) || /(limpar|remov|reset|tirar|sem)\w*\b.*filtro/.test(n)) return null;
      if (/legenda|dashboard (executivo|operacional)|compar|indicador|grafico de/.test(n) && !/(apenas|somente|filtr)/.test(n)) return null;
      const f = { months: [], years: [], dims: {} };
      SDEngine.MFULL.forEach((m, i) => { if (new RegExp('\\b' + m + '\\b').test(n) || (m !== 'maio' && new RegExp('\\b' + SDEngine.MPT[i] + '(\\b|/)').test(n) && /\b(mes|meses|em|de)\b/.test(n) && false)) f.months.push(i + 1); });
      (n.match(/\b(20\d\d)\b/g) || []).forEach(y => f.years.push(+y));
      let found = f.months.length || f.years.length;
      if (found && !c.hasDate()) return no('Os dados não têm coluna de datas, então não consigo filtrar por período.');
      c.dimValues().forEach(({ col, values }) => values.forEach(v => {
        const nv = N(v); if (nv.length < 2) return;
        if (new RegExp('(^|[^a-z0-9])' + nv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(n)) { (f.dims[col] = f.dims[col] || []).push(v); found = true; }
      }));
      if (!found) return /(apenas|somente|filtr)/.test(n) ? no('Não encontrei nos dados um mês, ano ou valor correspondente ao filtro pedido.') : null;
      c.mergeFilters(f);
      const desc = [...(f.months.length ? ['mês: ' + f.months.map(m => SDEngine.MFULL[m - 1]).join(', ')] : []), ...(f.years.length ? ['ano: ' + f.years.join(', ')] : []), ...Object.entries(f.dims).map(([k, v]) => `${k}: ${v.join(', ')}`)];
      return ok(`Filtro aplicado (${desc.join(' · ')}). ${c.rowCount()} registro(s) considerados.`);
    },
    (n, c) => {
      if (!/(remov|exclu|retir|tire|oculte|esconda)/.test(n) || !/financeir/.test(n)) return null;
      const k = c.removeWidgets(w => { const col = w.m && c.col(w.m); return col && SDEngine.isFin(col); });
      return k ? ok(`${k} visualização(ões) financeira(s) removida(s).`) : no('Não encontrei indicadores financeiros (valores, custos, receitas) nos dashboards.');
    },
    (n, c) => {
      const m = n.match(/(?:remov\w*|exclu\w*|retir\w*|tire|oculte)\s+(?:o |a |os |as )?(?:graficos? |indicadores? |cards? |visualizac\w+ )?(?:de |do |da |dos |das )?(.{3,40})$/);
      if (!m || /financeir|legenda|filtro/.test(n)) return null;
      const term = m[1].replace(/\b(do|da|de|dashboard|o|a)\b/g, '').trim();
      if (term.length < 3) return null;
      const k = c.removeWidgets(w => N(w.title).includes(term));
      return k ? ok(`${k} visualização(ões) com "${term}" removida(s).`) : no(`Não encontrei visualização com "${term}" no título.`);
    },
    (n, c) => {
      if (!/(apresentacao|executiv)/.test(n) || !/(organiz|prepar|ajust|modo|monte)/.test(n)) return null;
      c.presentation(); return ok('Dashboard executivo organizado para apresentação: indicadores primeiro, tabelas removidas, cards maiores e legendas visíveis.');
    },
    (n, c) => {
      if (!/compar|cruz/.test(n)) return null;
      const m = n.match(/\b(?:por|entre|de)\s+(?:cada\s+)?(.+)$/); if (!m) return null;
      const t = N(m[1]);
      const aliases = [['responsavel', c.person()], ['colaborador', c.person()], ['equipe', c.person()], ['pessoa', c.person()], ['status', c.status()], ['situacao', c.status()]];
      let dim = c.dims().find(d => t.includes(N(d.name)) || N(d.name).includes(t.replace(/s$/, '')) && t.length > 3);
      if (!dim) { const a = aliases.find(([k, v]) => t.includes(k) && v); if (a) dim = a[1]; }
      if (!dim) return no(`Não encontrei uma coluna de categoria correspondente a "${m[1].trim()}". Colunas disponíveis: ${c.dims().map(d => d.name).join(', ') || 'nenhuma'}.`);
      const meas = c.measures().find(x => n.includes(N(x.name))) || c.primaryMeasure();
      c.addWidget('custom', { kind: 'chart', data: 'group', chart: 'bar', title: `Comparação: ${meas ? meas.name : 'registros'} por ${dim.name}`, m: meas && meas.name, agg: meas ? SDEngine.aggFor(meas) : 'count', dim: dim.name, limit: 12, span: 12 });
      c.goTab('custom'); return ok(`Comparação por ${dim.name} adicionada ao Dashboard Personalizado.`);
    },
    (n, c) => {
      const m = n.match(/(?:abr\w*|ir para|va para|mostr\w*|exib\w*)\s+(?:o |a )?(?:dashboard |painel |aba )(executivo|operacional|analitico|personalizado)|\b(insights)\b/);
      if (!m) return null;
      const t = m[1] || m[2]; c.goTab(TABS[t]); return ok(`Abrindo ${t === 'insights' ? 'Insights & Melhorias' : 'Dashboard ' + t}.`);
    }
  ];

  function run(text, ctx, silent) {
    const n = N(text), res = [];
    for (const h of handlers) { const r = h(n, ctx); if (r && (r.ok || !silent)) res.push(r); }
    if (!res.length) return silent ? null : no('Não consegui executar esse comando. Posso: trocar cores/tema, filtrar por mês/ano/valor (ex.: "mostre apenas outubro"), trocar tipo de gráfico (ex.: "troque rosca por barras"), ocultar legendas, remover indicadores financeiros, criar comparação por uma coluna, organizar para apresentação ou limpar filtros.');
    return { ok: res.some(r => r.ok), msg: res.map(r => r.msg).join(' ') };
  }
  return { run };
})();
