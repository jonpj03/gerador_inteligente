/* Smart Dash Studio — leitura e tipagem de dados */
const SDParser = (() => {
  const MONTHS = { jan:1, fev:2, feb:2, mar:3, abr:4, apr:4, mai:5, may:5, jun:6, jul:7, ago:8, aug:8, set:9, sep:9, out:10, oct:10, nov:11, dez:12, dec:12 };
  const EXTS = ['xlsx', 'xls', 'csv', 'tsv', 'txt', 'json'];
  const MAX_BYTES = 15 * 1024 * 1024;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const blank = v => v == null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && isNaN(v));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const day = d => { const t = new Date(d.getTime() + 30 * 60000); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

  function parseNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? { n: v, kind: 'number' } : null;
    if (typeof v !== 'string') return null;
    let s = v.trim(), kind = 'number', neg = false;
    if (!s) return null;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/(R\$|US\$|\$|€)/.test(s)) { kind = 'currency'; s = s.replace(/R\$|US\$|\$|€/g, ''); }
    if (/%\s*$/.test(s)) { kind = 'percent'; s = s.replace(/%\s*$/, ''); }
    s = s.replace(/\s/g, '');
    if (!/^[-+]?[\d.,]+$/.test(s) || /^[-+]?0\d+$/.test(s)) return null;
    let t;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) t = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc > -1) t = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
    else if (ld > -1) {
      if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) t = s.replace(/\./g, '');
      else if ((s.match(/\./g) || []).length > 1) return null;
      else t = s;
    } else t = s;
    const n = parseFloat(t);
    return isNaN(n) ? null : { n: neg ? -n : n, kind };
  }

  function mk(y, m, d) {
    if (y < 100) y += 2000;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 ? dt : null;
  }
  function parseDate(v) {
    if (v instanceof Date) return isNaN(v) ? null : day(v);
    if (typeof v !== 'string') return null;
    const s = v.trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) return mk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:[\sT].*)?$/))) {
      let d = +m[1], mo = +m[2];
      if (mo > 12 && d <= 12) [d, mo] = [mo, d];
      return mk(+m[3], mo, d);
    }
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{4})$/))) return mk(+m[2], +m[1], 1);
    if ((m = s.match(/^([a-zA-Zçç]{3,10})\.?[\s\/\-]*(?:de\s+)?(\d{2}|\d{4})$/))) {
      const k = MONTHS[norm(m[1]).slice(0, 3)];
      if (k) return mk(+m[2], k, 1);
    }
    return null;
  }

  /* ---------- CSV / texto ---------- */
  function split(line, d) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"' && cur === '') q = true;
      else if (c === d) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  const cnt = (l, d) => split(l, d).length - 1;

  function detectBlock(lines) {
    let best = null;
    for (const d of ['\t', ';', '|', ',']) {
      let i = 0;
      while (i < lines.length) {
        const c = lines[i].trim() ? cnt(lines[i], d) : 0;
        if (c < 1) { i++; continue; }
        let j = i + 1;
        while (j < lines.length && lines[j].trim() && cnt(lines[j], d) === c) j++;
        const len = j - i;
        if (len >= 2) {
          const cells = lines.slice(i, j).flatMap(l => split(l, d));
          const avg = cells.reduce((a, x) => a + x.length, 0) / cells.length;
          if (avg < 40 && (d !== ',' || c >= 2 || len >= 4)) {
            const score = len * (c + 1) * (d === ',' ? 0.9 : 1);
            if (!best || score > best.score) best = { start: i, end: j, d, score };
          }
        }
        i = j;
      }
    }
    return best;
  }

  function detectHeaderIdx(matrix) {
    const counts = matrix.slice(0, 20).map(r => r.filter(c => !blank(c)).length);
    const mx = Math.max(...counts, 0);
    const i = counts.findIndex(c => c >= Math.max(2, Math.ceil(mx * 0.6)));
    return i < 0 ? 0 : i;
  }

  function fromMatrix(matrix, source) {
    if (!matrix.length) return null;
    const h = detectHeaderIdx(matrix);
    const header = matrix[h];
    const body = matrix.slice(h + 1);
    return buildDataset(header, body, source);
  }

  function fromObjects(arr, source) {
    const keys = [];
    const flat = arr.map(o => {
      const r = {};
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o)) {
          if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) r[k + '.' + k2] = v2;
          else r[k] = Array.isArray(v) ? v.join(', ') : v;
        }
      } else r.valor = o;
      Object.keys(r).forEach(k => { if (!keys.includes(k)) keys.push(k); });
      return r;
    });
    return buildDataset(keys, flat.map(r => keys.map(k => r[k])), source);
  }

  function fromJSON(text, source) {
    let j = JSON.parse(text);
    if (Array.isArray(j)) {
      if (j.length && Array.isArray(j[0])) return fromMatrix(j, source);
      return fromObjects(j, source);
    }
    if (j && typeof j === 'object') {
      const arrs = Object.entries(j).filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === 'object');
      if (arrs.length) { arrs.sort((a, b) => b[1].length - a[1].length); return Array.isArray(arrs[0][1][0]) ? fromMatrix(arrs[0][1], source) : fromObjects(arrs[0][1], source); }
      const ent = Object.entries(j).filter(([, v]) => parseNumber(v));
      if (ent.length >= 2) return buildDataset(['Indicador', 'Valor'], ent, source);
    }
    return null;
  }

  function fromDelimited(text, source) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const first = lines[0];
    const d = ['\t', ';', '|', ','].map(x => [x, cnt(first, x)]).sort((a, b) => b[1] - a[1])[0];
    if (!d[1]) return null;
    return fromMatrix(lines.map(l => split(l, d[0])), source);
  }

  function extract(text) {
    const lines = text.split(/\r?\n/);
    const blk = detectBlock(lines);
    if (blk) {
      const matrix = lines.slice(blk.start, blk.end).map(l => split(l, blk.d));
      const instruction = [...lines.slice(0, blk.start), ...lines.slice(blk.end)].join(' ').replace(/\s+/g, ' ').trim();
      return { ds: fromMatrix(matrix, 'texto colado'), instruction };
    }
    const kv = [], rest = [];
    lines.forEach(l => {
      const m = l.match(/^\s*[-•*]?\s*(.{2,60}?)\s*[:=]\s*(.+?)\s*$/);
      if (m && parseNumber(m[2])) kv.push([m[1], m[2]]); else rest.push(l);
    });
    if (kv.length >= 2) return { ds: buildDataset(['Indicador', 'Valor'], kv, 'texto colado'), instruction: rest.join(' ').replace(/\s+/g, ' ').trim() };
    return { ds: null, instruction: text.replace(/\s+/g, ' ').trim() };
  }

  function parseText(text) {
    const t = (text || '').trim(), notes = [];
    if (!t) return { ds: null, instruction: '', notes };
    if (/^[\[{]/.test(t)) { try { const ds = fromJSON(t, 'JSON colado'); if (ds) return { ds, instruction: '', notes }; } catch (e) { /* texto comum */ } }
    const r = extract(t);
    return { ds: r.ds, instruction: r.instruction, notes };
  }

  function validateFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!EXTS.includes(ext)) return `"${f.name}": formato não suportado. Use XLSX, XLS, CSV, TXT ou JSON.`;
    if (!f.size) return `"${f.name}" está vazio.`;
    if (f.size > MAX_BYTES) return `"${f.name}" excede o limite de 15 MB.`;
    return null;
  }

  async function parseFile(file) {
    const err = validateFile(file);
    if (err) throw new Error(err);
    const ext = file.name.split('.').pop().toLowerCase(), notes = [];
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        if (typeof XLSX === 'undefined') throw new Error('A biblioteca de planilhas não carregou. Verifique a conexão e recarregue a página.');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        let best = null;
        for (const sn of wb.SheetNames) {
          const m = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
          const size = m.length * Math.max(0, ...m.slice(0, 20).map(r => r.length));
          if (m.length >= 2 && (!best || size > best.size)) best = { sn, m, size };
        }
        if (!best) throw new Error(`"${file.name}": nenhuma aba com dados tabulares.`);
        if (wb.SheetNames.length > 1) notes.push(`Planilha com ${wb.SheetNames.length} abas: usei "${best.sn}".`);
        return { ds: fromMatrix(best.m, file.name), instruction: '', notes };
      }
      const text = await file.text();
      if (ext === 'json') return { ds: fromJSON(text, file.name), instruction: '', notes };
      if (ext === 'csv' || ext === 'tsv') return { ds: fromDelimited(text, file.name), instruction: '', notes };
      const r = parseText(text);
      if (r.ds) r.ds.source = file.name;
      return r;
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(`"${file.name}": JSON inválido.`);
      throw e;
    }
  }

  function combine(list, notes) {
    const ok = list.filter(Boolean);
    if (!ok.length) return null;
    if (ok.length === 1) return ok[0];
    const sig = d => d.columns.map(c => c.name).join('|');
    const same = ok.filter(d => sig(d) === sig(ok[0]));
    if (same.length === ok.length) {
      const ds = { columns: ok[0].columns, rows: ok.flatMap(d => d.rows), source: 'arquivos combinados', notes: [] };
      refreshStats(ds); notes.push(`${ok.length} fontes com as mesmas colunas foram combinadas.`);
      return ds;
    }
    ok.sort((a, b) => b.rows.length * b.columns.length - a.rows.length * a.columns.length);
    notes.push('As fontes têm colunas diferentes; usei a maior e ignorei as demais.');
    return ok[0];
  }

  /* ---------- tipagem ---------- */
  const ID_RX = /(^id$|^id[\s_]|[\s_]id$|codigo|matricula|cpf|cnpj|protocolo|ticket|^n[o°º]$|numero)/;
  function infer(name, vals) {
    const nn = vals.filter(v => !blank(v)), n = nn.length, nm = norm(name);
    if (!n) return { type: 'text', conv: () => null, invalid: 0 };
    const dOK = nn.filter(v => parseDate(v)).length;
    if (dOK / n >= 0.9) return { type: 'date', conv: v => blank(v) ? null : parseDate(v), invalid: n - dOK };
    const nums = nn.map(parseNumber), nOK = nums.filter(Boolean);
    const uniq = new Set(nn.map(v => String(v).trim())).size;
    if (nOK.length / n >= 0.9) {
      const pc = nOK.filter(x => x.kind === 'percent').length, cu = nOK.filter(x => x.kind === 'currency').length;
      const kind = pc > nOK.length / 2 ? 'percent' : cu > nOK.length / 2 ? 'currency' : 'number';
      const ints = nOK.every(x => Number.isInteger(x.n));
      if (/^(ano|year)$/.test(nm) && ints && nOK.every(x => x.n >= 1900 && x.n <= 2100)) return { type: 'category', conv: v => blank(v) ? null : String(parseNumber(v).n), invalid: 0 };
      if (ID_RX.test(nm) && uniq / n >= 0.9) return { type: 'id', conv: v => blank(v) ? null : String(v).trim(), invalid: 0 };
      return { type: kind, conv: v => { const x = parseNumber(v); return x ? x.n : null; }, invalid: n - nOK.length };
    }
    const conv = v => blank(v) ? null : String(v).trim();
    if (ID_RX.test(nm) && uniq / n >= 0.9) return { type: 'id', conv, invalid: 0 };
    if (uniq <= 40 && (uniq / n <= 0.8 || n <= 40)) return { type: 'category', conv, invalid: 0 };
    return { type: 'text', conv, invalid: 0 };
  }

  function refreshStats(ds) {
    ds.columns.forEach(c => {
      const vals = ds.rows.map(r => r[c.name]).filter(v => v != null);
      c.nulls = ds.rows.length - vals.length;
      c.unique = new Set(vals.map(v => v instanceof Date ? v.getTime() : v)).size;
      if (c.type === 'date' && vals.length) { c.min = new Date(Math.min(...vals)); c.max = new Date(Math.max(...vals)); }
      if (['number', 'percent', 'currency'].includes(c.type) && vals.length) { c.min = Math.min(...vals); c.max = Math.max(...vals); }
    });
  }

  function buildDataset(header, body, source) {
    const names = [];
    header.forEach((h, i) => {
      let n = blank(h) ? 'Coluna ' + (i + 1) : String(h).trim(), k = 2, base = n;
      while (names.includes(n)) n = `${base} (${k++})`;
      names.push(n);
    });
    const matrix = body.filter(r => r.some(c => !blank(c)));
    const keep = names.map((n, i) => matrix.some(r => !blank(r[i])) || !/^Coluna \d+$/.test(n));
    const idx = names.map((_, i) => i).filter(i => keep[i] && matrix.some(r => !blank(r[i])));
    const columns = [], convs = [];
    idx.forEach(i => {
      const inf = infer(names[i], matrix.map(r => r[i]));
      columns.push({ name: names[i], type: inf.type, invalid: inf.invalid });
      convs.push(inf.conv);
    });
    const rows = matrix.map(r => { const o = {}; idx.forEach((i, k) => { o[columns[k].name] = convs[k](r[i]); }); return o; });
    const ds = { columns, rows, source: source || '', notes: [] };
    refreshStats(ds);
    return ds.columns.length && ds.rows.length ? ds : null;
  }

  return { norm, blank, parseNumber, parseDate, ymd, fmtDate, parseText, parseFile, validateFile, combine, refreshStats, EXTS };
})();
