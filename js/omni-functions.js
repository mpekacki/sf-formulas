// OmniStudio (managed package) formula function library, per the
// "Function Reference (Managed Package)" help article. OmniStudio is loosely
// typed and JSON-based, so coercions use the `loose` flag and lists/objects
// are first-class values. Same registry shape as functions.js.
(function () {
  const V = window.SFValues;
  const F = {};

  function def(name, min, max, impl, opts) {
    F[name] = Object.assign({ min, max, impl }, opts);
  }

  const txt = v => V.toText(v, true);
  const num = (v, env) => V.toNumber(v, env.blankAsZero, true);

  // ---------- date helpers ----------

  const US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

  function parseDateLike(v, fname) {
    if (v.type === 'date' || v.type === 'datetime') return v.value;
    if (v.type === 'null') return null;
    if (v.type === 'text') {
      const s = v.value.trim();
      const d = V.parseDate(s) || V.parseDateTime(s);
      if (d) return d;
      const m = US_RE.exec(s);
      if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    }
    throw new Error(`${fname}: ${V.display(v)} is not a date`);
  }

  function addMonthsClamped(d, months) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m + months, Math.min(day, lastDay),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  }

  // SimpleDateFormat subset: yyyy yy MM dd HH hh mm ss SSS a E Z and 'quoted' literals.
  function sdf(d, pattern) {
    const pad = (n, l) => String(n).padStart(l, '0');
    let out = '';
    let i = 0;
    while (i < pattern.length) {
      const c = pattern[i];
      if (c === "'") {
        let j = i + 1, lit = '';
        while (j < pattern.length) {
          if (pattern[j] === "'") {
            if (pattern[j + 1] === "'") { lit += "'"; j += 2; continue; }
            j++;
            break;
          }
          lit += pattern[j++];
        }
        if (lit === '') lit = "'"; // '' is an escaped quote
        out += lit;
        i = j;
        continue;
      }
      let run = 1;
      while (pattern[i + run] === c) run++;
      switch (c) {
        case 'y': out += run === 2 ? pad(d.getUTCFullYear() % 100, 2) : pad(d.getUTCFullYear(), run); break;
        case 'M': out += pad(d.getUTCMonth() + 1, run); break;
        case 'd': out += pad(d.getUTCDate(), run); break;
        case 'H': out += pad(d.getUTCHours(), run); break;
        case 'h': out += pad(d.getUTCHours() % 12 || 12, run); break;
        case 'm': out += pad(d.getUTCMinutes(), run); break;
        case 's': out += pad(d.getUTCSeconds(), run); break;
        case 'S': out += pad(d.getUTCMilliseconds(), 3).slice(0, run).padEnd(run, '0'); break;
        case 'a': out += d.getUTCHours() < 12 ? 'AM' : 'PM'; break;
        case 'E': out += ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]; break;
        case 'Z': out += '+0000'; break;
        default: out += c.repeat(run);
      }
      i += run;
    }
    return out;
  }

  // ---------- math ----------

  function defMath(name, arity, fn) {
    def(name, arity, arity, (a, env) => {
      const nums = a.map(v => num(v, env));
      if (nums.some(x => x === null)) return V.NULL;
      const r = fn(...nums);
      if (typeof r !== 'number' || !isFinite(r)) throw new Error(`${name}: result is not a valid number`);
      return V.number(r);
    });
  }

  defMath('ABS', 1, Math.abs);
  defMath('SQRT', 1, x => {
    if (x < 0) throw new Error('SQRT of a negative number');
    return Math.sqrt(x);
  });

  // Java RoundingMode semantics for ROUND's direction parameter.
  function roundWithMode(n, precision, mode) {
    const f = Math.pow(10, precision);
    let x = n * f;
    x = Math.round(x * 1e9) / 1e9; // kill float fuzz like 257.49999999999997
    let r;
    switch (mode) {
      case 'UP': r = Math.sign(x) * Math.ceil(Math.abs(x)); break;
      case 'DOWN': r = Math.trunc(x); break;
      case 'CEILING': r = Math.ceil(x); break;
      case 'FLOOR': r = Math.floor(x); break;
      case 'HALF_DOWN': r = Math.sign(x) * Math.ceil(Math.abs(x) - 0.5); break;
      case 'HALF_EVEN': {
        const fl = Math.floor(x);
        const diff = x - fl;
        r = diff > 0.5 ? fl + 1 : diff < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1);
        break;
      }
      case 'HALF_UP': r = Math.sign(x) * Math.round(Math.abs(x)); break;
      default: throw new Error(`ROUND: unknown direction "${mode}" (use UP, DOWN, HALF_UP, HALF_DOWN, HALF_EVEN, CEILING, or FLOOR)`);
    }
    return r / f;
  }

  def('ROUND', 1, 3, (a, env) => {
    const n = num(a[0], env);
    if (n === null) return V.NULL;
    const precision = a.length > 1 ? Math.trunc(num(a[1], env) || 0) : 2; // docs: defaults to 2 decimals
    const mode = a.length > 2 ? txt(a[2]).toUpperCase() : 'HALF_UP';
    return V.number(roundWithMode(n, precision, mode));
  });

  // Aggregates accept either variadic numbers or JSON lists.
  function collectNumbers(args) {
    const out = [];
    const pushRaw = raw => {
      if (typeof raw === 'number' && isFinite(raw)) out.push(raw);
      else if (typeof raw === 'string' && raw.trim() !== '' && !isNaN(Number(raw))) out.push(Number(raw));
    };
    for (const v of args) {
      if (v.type === 'list') v.value.forEach(pushRaw);
      else if (v.type !== 'null') pushRaw(V.raw(v));
    }
    return out;
  }

  def('SUM', 1, Infinity, a => {
    const nums = collectNumbers(a);
    return V.number(nums.reduce((s, x) => s + x, 0));
  });
  def('AVG', 1, Infinity, a => {
    const nums = collectNumbers(a);
    return nums.length ? V.number(nums.reduce((s, x) => s + x, 0) / nums.length) : V.NULL;
  });
  def('MIN', 1, Infinity, a => {
    const nums = collectNumbers(a);
    return nums.length ? V.number(Math.min(...nums)) : V.NULL;
  });
  def('MAX', 1, Infinity, a => {
    const nums = collectNumbers(a);
    return nums.length ? V.number(Math.max(...nums)) : V.NULL;
  });
  def('MAXSTRING', 1, Infinity, a => {
    const strs = a.filter(v => v.type !== 'null').map(txt);
    return strs.length ? V.text(strs.reduce((m, s) => (s > m ? s : m))) : V.NULL;
  });

  // ---------- logical ----------

  def('IF', 3, 3, (nodes, env) => {
    const cond = env.evalSafe(nodes[0]);
    const yes = env.evalSafe(nodes[1]);
    const no = env.evalSafe(nodes[2]);
    if (cond.error) throw cond.error;
    const takeYes = V.toBoolean(cond.value);
    env.markChosen(takeYes ? nodes[1] : nodes[2]);
    const chosen = takeYes ? yes : no;
    if (chosen.error) throw chosen.error;
    return chosen.value;
  }, { lazy: true });

  // Not in the managed-package function reference, but supported by the runtime.
  def('AND', 1, Infinity, (nodes, env) => {
    let anyFalse = false;
    let firstErr = null;
    for (const n of nodes) {
      const r = env.evalSafe(n);
      if (r.error) { if (!firstErr) firstErr = r.error; continue; }
      if (!V.toBoolean(r.value)) anyFalse = true;
    }
    if (anyFalse) return V.boolean(false); // short-circuit past errors
    if (firstErr) throw firstErr;
    return V.boolean(true);
  }, { lazy: true });

  def('OR', 1, Infinity, (nodes, env) => {
    let anyTrue = false;
    let firstErr = null;
    for (const n of nodes) {
      const r = env.evalSafe(n);
      if (r.error) { if (!firstErr) firstErr = r.error; continue; }
      if (V.toBoolean(r.value)) anyTrue = true;
    }
    if (anyTrue) return V.boolean(true);
    if (firstErr) throw firstErr;
    return V.boolean(false);
  }, { lazy: true });

  def('NOT', 1, 1, a => V.boolean(!V.toBoolean(a[0])));

  def('ISBLANK', 1, 1, a => V.boolean(V.isBlank(a[0])));
  def('ISNOTBLANK', 1, 1, a => V.boolean(!V.isBlank(a[0])));

  // ---------- text ----------

  def('CONCAT', 1, Infinity, a => V.text(a.map(v => (v.type === 'null' ? '' : txt(v))).join('')));

  def('SUBSTRING', 1, 3, a => {
    const s = txt(a[0]);
    // Index args can be integers or search strings (position of the match).
    const resolve = (v, isEnd) => {
      const dflt = isEnd ? s.length : 0;
      if (!v || v.type === 'null') return dflt;
      if (v.type === 'number') return Math.trunc(v.value);
      if (v.type === 'text') {
        const t = v.value;
        const n = Number(t);
        if (t.trim() !== '' && !isNaN(n)) return Math.trunc(n);
        const idx = s.indexOf(t);
        return idx === -1 ? dflt : idx;
      }
      throw new Error(`SUBSTRING: index must be a number or a search string, got ${V.typeName(v)}`);
    };
    const start = Math.max(0, resolve(a[1], false));
    const end = Math.min(s.length, resolve(a[2], true));
    return V.text(s.slice(start, Math.max(start, end)));
  });

  def('STRINGINDEXOF', 2, 2, a => V.number(txt(a[0]).indexOf(txt(a[1]))));

  def('BASE64ENCODE', 1, 1, a => {
    const s = txt(a[0]);
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(s, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(s)));
    return V.text(b64);
  });

  def('BASEURL', 0, 0, () => V.text('https://yourInstance.my.salesforce.com'));

  def('GENERATEGLOBALKEY', 0, 1, a => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    const prefix = a.length ? txt(a[0]) : '';
    return V.text(prefix ? `${prefix}-${uuid}` : uuid);
  });

  function toStringRaw(raw) {
    if (raw === null || raw === undefined) return '';
    if (Array.isArray(raw)) return raw.map(toStringRaw).join(',');
    if (typeof raw === 'object') {
      return '{' + Object.entries(raw).map(([k, v]) => `${k}=${toStringRaw(v)}`).join(', ') + '}';
    }
    return String(raw);
  }
  def('TOSTRING', 1, 1, a => V.text(toStringRaw(V.raw(a[0]))));

  def('SERIALIZE', 1, 1, a => V.text(JSON.stringify(V.raw(a[0]))));
  def('DESERIALIZE', 1, 1, a => {
    try {
      return V.wrap(JSON.parse(txt(a[0])));
    } catch (e) {
      throw new Error('DESERIALIZE: invalid JSON string');
    }
  });
  def('RESERIALIZE', 1, 1, a => {
    try {
      return V.wrap(JSON.parse(txt(a[0])));
    } catch (e) {
      throw new Error('RESERIALIZE: invalid JSON string');
    }
  });

  // ---------- lists ----------

  def('LIST', 0, Infinity, a => {
    if (a.length === 1 && a[0].type === 'list') return a[0];
    const out = [];
    for (const v of a) {
      if (v.type === 'list') out.push(...v.value);
      else if (v.type !== 'null') out.push(V.raw(v));
    }
    return V.list(out);
  });

  def('LISTSIZE', 1, 1, a => {
    if (a[0].type === 'list') return V.number(a[0].value.length);
    if (a[0].type === 'null') return V.number(0);
    return V.number(1);
  });

  def('FILTER', 2, 2, (a, env) => {
    if (a[0].type !== 'list') throw new Error('FILTER: first argument must be a list (wrap it in LIST())');
    const cond = txt(a[1]);
    const ast = window.SFParser.parse(cond, { omni: true }); // bad condition syntax -> FILTER errors
    const out = [];
    for (const item of a[0].value) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
      const { results } = window.SFEvaluator.evaluate(ast, item, { mode: 'omni', blankAsZero: env.blankAsZero });
      const r = results.get(ast.id);
      // Items the condition can't be evaluated against are excluded.
      if (!r.error && r.value.type === 'boolean' && r.value.value) out.push(item);
    }
    return V.list(out);
  });

  def('SORTBY', 2, Infinity, a => {
    if (a[0].type !== 'list') throw new Error('SORTBY: first argument must be a list (wrap it in LIST())');
    let keys = a.slice(1).map(txt);
    let dir = 1;
    if (keys[keys.length - 1] === '[:DSC]') { dir = -1; keys.pop(); }
    if (!keys.length) throw new Error('SORTBY: specify at least one key to sort by');
    const sorted = a[0].value.slice().sort((x, y) => {
      for (const k of keys) {
        const xv = x === null || typeof x !== 'object' ? undefined : x[k];
        const yv = y === null || typeof y !== 'object' ? undefined : y[k];
        if (xv === yv) continue;
        if (xv === undefined) return 1 * dir;
        if (yv === undefined) return -1 * dir;
        return (xv < yv ? -1 : 1) * dir;
      }
      return 0;
    });
    return V.list(sorted);
  });

  function listMerge(a, primaryOnly, fname) {
    const keys = [];
    const lists = [];
    for (const v of a) {
      if (v.type === 'list') lists.push(v.value);
      else if (!lists.length) keys.push(...txt(v).split(',').map(s => s.trim()).filter(Boolean));
    }
    if (!keys.length || !lists.length) {
      throw new Error(`${fname}: pass quoted merge key name(s) followed by LIST(...) arguments`);
    }
    const keyOf = item => keys.map(k => JSON.stringify(item[k])).join('|');
    const map = new Map();
    const order = [];
    lists.forEach((list, li) => {
      for (const item of list) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
        const k = keyOf(item);
        if (map.has(k)) Object.assign(map.get(k), item);
        else if (!primaryOnly || li === 0) {
          map.set(k, Object.assign({}, item));
          order.push({ k, primary: item });
        }
      }
    });
    return V.list(order.map(({ k, primary }) => {
      const merged = map.get(k);
      if (!primaryOnly) return merged;
      const out = {};
      for (const key of Object.keys(primary)) out[key] = merged[key];
      return out;
    }));
  }
  def('LISTMERGE', 2, Infinity, a => listMerge(a, false, 'LISTMERGE'));
  def('LISTMERGEPRIMARY', 2, Infinity, a => listMerge(a, true, 'LISTMERGEPRIMARY'));

  def('VALUELOOKUP', 2, Infinity, a => {
    let cur = V.raw(a[0]);
    for (const v of a.slice(1)) {
      const k = txt(v);
      cur = cur !== null && typeof cur === 'object' && !Array.isArray(cur) ? cur[k] : undefined;
    }
    return V.wrap(cur === undefined ? null : cur);
  });

  // ---------- date / time ----------

  def('TODAY', 0, 1, a => {
    const n = new Date();
    const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    return a.length ? V.text(sdf(d, txt(a[0]))) : V.date(d);
  });

  def('NOW', 0, 1, a => {
    const d = new Date();
    return a.length ? V.text(sdf(d, txt(a[0]))) : V.datetime(d);
  });

  def('ADDDAY', 2, 2, (a, env) => {
    const d = parseDateLike(a[0], 'ADDDAY');
    const n = num(a[1], env);
    if (!d || n === null) return V.NULL;
    return V.datetime(new Date(d.getTime() + n * 86400000));
  });
  def('ADDMONTH', 2, 2, (a, env) => {
    const d = parseDateLike(a[0], 'ADDMONTH');
    const n = num(a[1], env);
    if (!d || n === null) return V.NULL;
    return V.datetime(addMonthsClamped(d, Math.trunc(n)));
  });
  def('ADDYEAR', 2, 2, (a, env) => {
    const d = parseDateLike(a[0], 'ADDYEAR');
    const n = num(a[1], env);
    if (!d || n === null) return V.NULL;
    return V.datetime(addMonthsClamped(d, Math.trunc(n) * 12));
  });

  def('EOM', 1, 1, a => {
    const d = parseDateLike(a[0], 'EOM');
    if (!d) return V.NULL;
    return V.datetime(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  });

  def('MONTH', 1, 1, a => {
    const d = parseDateLike(a[0], 'MONTH');
    return d ? V.number(d.getUTCMonth() + 1) : V.NULL;
  });
  def('YEAR', 1, 1, a => {
    const d = parseDateLike(a[0], 'YEAR');
    return d ? V.number(d.getUTCFullYear()) : V.NULL;
  });

  def('DATEDIFF', 2, 2, a => {
    const d1 = parseDateLike(a[0], 'DATEDIFF');
    const d2 = parseDateLike(a[1], 'DATEDIFF');
    if (!d1 || !d2) return V.NULL;
    return V.number((d2.getTime() - d1.getTime()) / 86400000);
  });

  function ageBetween(birth, on) {
    let years = on.getUTCFullYear() - birth.getUTCFullYear();
    const m = on.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) years--;
    return years;
  }
  def('AGE', 1, 1, a => {
    const b = parseDateLike(a[0], 'AGE');
    if (!b) return V.NULL;
    const n = new Date();
    return V.number(ageBetween(b, new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))));
  });
  def('AGEON', 2, 2, a => {
    const b = parseDateLike(a[0], 'AGEON');
    const on = parseDateLike(a[1], 'AGEON');
    if (!b || !on) return V.NULL;
    return V.number(ageBetween(b, on));
  });

  def('DATETIMETOUNIX', 1, 1, a => {
    const d = parseDateLike(a[0], 'DATETIMETOUNIX');
    return d ? V.number(d.getTime()) : V.NULL;
  });
  def('UNIXTODATETIME', 1, 1, (a, env) => {
    const n = num(a[0], env);
    if (n === null) return V.NULL;
    const d = new Date(n);
    if (isNaN(d.getTime())) throw new Error('UNIXTODATETIME: invalid epoch value');
    return V.datetime(d);
  });

  const DEFAULT_DT_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSZ";
  function formatDt(fname, a) {
    const d = parseDateLike(a[0], fname);
    if (!d) return V.NULL;
    const format = a.length > 1 && !V.isBlank(a[1]) ? txt(a[1]) : DEFAULT_DT_FORMAT;
    if (a.length > 2 && !V.isBlank(a[2])) {
      const tz = txt(a[2]).toUpperCase();
      if (tz !== 'GMT' && tz !== 'UTC') {
        throw new Error(`${fname}: only GMT/UTC time zones are supported in this evaluator`);
      }
    }
    return V.text(sdf(d, format));
  }
  def('FORMATDATETIME', 1, 3, a => formatDt('FORMATDATETIME', a));
  // Signature is (datetime, timezone, format), so swap args before delegating.
  def('FORMATDATETIMEGMT', 1, 3, a =>
    formatDt('FORMATDATETIMEGMT', [a[0], a[2] !== undefined ? a[2] : V.NULL, a[1] !== undefined ? a[1] : V.NULL]));

  // ---------- org-dependent functions we can't run locally ----------

  ['QUERY', 'COUNTQUERY', 'FUNCTION', 'INVOKEIP', 'ORDERITEMATTRIBUTES', 'INPUT'].forEach(name => {
    def(name, 0, Infinity, () => {
      throw new Error(`${name}() needs a live Salesforce org, so this evaluator can't run it`);
    });
  });

  window.SFOmniFunctions = F;
})();
