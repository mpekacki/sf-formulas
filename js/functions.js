// Salesforce formula function library.
// Eager functions get (values[], env); lazy ones get (argNodes[], env) and
// decide what to evaluate themselves — but they still evaluate every branch
// via env.evalSafe so the UI can show values for branches that weren't taken.
// env = { eval(node), evalSafe(node) -> {value}|{error}, blankAsZero }
(function () {
  const V = window.SFValues;
  const F = {};

  function def(name, min, max, impl, opts) {
    F[name] = Object.assign({ min, max, impl }, opts);
  }

  // Numeric helper: blank propagates as blank (or 0 in blank-as-zero mode).
  function defMath(name, arity, fn) {
    def(name, arity, arity, (a, env) => {
      const nums = a.map(v => V.toNumber(v, env.blankAsZero));
      if (nums.some(x => x === null)) return V.NULL;
      const r = fn(...nums);
      if (typeof r !== 'number' || !isFinite(r)) throw new Error(`${name}: result is not a valid number`);
      return V.number(r);
    });
  }

  function dateArg(v, fname) {
    if (v.type === 'date') return v.value;
    if (v.type === 'datetime') return V.datePart(v.value);
    if (v.type === 'null') return null;
    if (v.type === 'text') {
      const d = V.parseDate(v.value) || (V.parseDateTime(v.value) && V.datePart(V.parseDateTime(v.value)));
      if (d) return d;
      throw new Error(`${fname}: "${v.value}" is not a date (expected YYYY-MM-DD)`);
    }
    throw new Error(`${fname} expects a Date, got ${V.typeName(v)}`);
  }

  function datetimeArg(v, fname) {
    if (v.type === 'datetime') return v.value;
    if (v.type === 'date') return v.value;
    if (v.type === 'null') return null;
    if (v.type === 'text') {
      const d = V.parseDateTime(v.value) || V.parseDate(v.value);
      if (d) return d;
      throw new Error(`${fname}: "${v.value}" is not a date/time`);
    }
    throw new Error(`${fname} expects a Date/Time, got ${V.typeName(v)}`);
  }

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
  def('ISNULL', 1, 1, a => V.boolean(V.isNull(a[0])));
  def('ISNUMBER', 1, 1, a => {
    if (V.isBlank(a[0])) return V.boolean(false);
    const t = V.toText(a[0]).trim();
    return V.boolean(t !== '' && !isNaN(Number(t)));
  });
  def('ISPICKVAL', 2, 2, a => V.boolean(V.toText(a[0]) === V.toText(a[1])));

  def('BLANKVALUE', 2, 2, (nodes, env) => {
    const r = env.evalSafe(nodes[0]);
    const fb = env.evalSafe(nodes[1]);
    if (r.error) throw r.error;
    if (V.isBlank(r.value)) {
      env.markChosen(nodes[1]);
      if (fb.error) throw fb.error;
      return fb.value;
    }
    env.markChosen(nodes[0]);
    return r.value;
  }, { lazy: true });

  def('NULLVALUE', 2, 2, (nodes, env) => {
    const r = env.evalSafe(nodes[0]);
    const fb = env.evalSafe(nodes[1]);
    if (r.error) throw r.error;
    if (V.isNull(r.value)) {
      env.markChosen(nodes[1]);
      if (fb.error) throw fb.error;
      return fb.value;
    }
    env.markChosen(nodes[0]);
    return r.value;
  }, { lazy: true });

  def('CASE', 4, Infinity, (nodes, env) => {
    if (nodes.length % 2 !== 0) {
      throw new Error('CASE needs an even number of arguments: CASE(expression, value1, result1, ..., else_result)');
    }
    const rs = nodes.map(n => env.evalSafe(n));
    if (rs[0].error) throw rs[0].error;
    const expr = rs[0].value;
    let chosenIdx = nodes.length - 1; // else branch
    for (let i = 1; i < nodes.length - 1; i += 2) {
      if (rs[i].error) throw rs[i].error;
      if (V.equals(expr, rs[i].value, env.blankAsZero)) { chosenIdx = i + 1; break; }
    }
    env.markChosen(nodes[chosenIdx]);
    const chosen = rs[chosenIdx];
    if (chosen.error) throw chosen.error;
    return chosen.value;
  }, { lazy: true });

  // ---------- text ----------

  def('TEXT', 1, 1, a => {
    const v = a[0];
    switch (v.type) {
      case 'null': return V.text('');
      case 'text': return V.text(v.value);
      case 'number': return V.text(V.fmtNumber(v.value));
      case 'boolean': return V.text(v.value ? 'true' : 'false');
      case 'date': return V.text(V.fmtDate(v.value));
      case 'datetime': return V.text(v.value.toISOString().slice(0, 19).replace('T', ' ') + 'Z');
    }
  });

  def('VALUE', 1, 1, a => {
    if (V.isBlank(a[0])) return V.NULL;
    const t = V.toText(a[0]).trim();
    const n = Number(t);
    if (t === '' || isNaN(n)) throw new Error(`VALUE() could not convert "${t}" to a number`);
    return V.number(n);
  });

  def('CONTAINS', 2, 2, a => V.boolean(V.toText(a[0]).includes(V.toText(a[1]))));
  def('BEGINS', 2, 2, a => V.boolean(V.toText(a[0]).startsWith(V.toText(a[1]))));
  def('LEN', 1, 1, a => V.number(V.toText(a[0]).length));
  def('LEFT', 2, 2, (a, env) => {
    const n = V.toNumber(a[1], env.blankAsZero);
    return V.text(V.toText(a[0]).slice(0, Math.max(0, Math.trunc(n || 0))));
  });
  def('RIGHT', 2, 2, (a, env) => {
    const s = V.toText(a[0]);
    const n = Math.max(0, Math.trunc(V.toNumber(a[1], env.blankAsZero) || 0));
    return V.text(n === 0 ? '' : s.slice(Math.max(0, s.length - n)));
  });
  def('MID', 3, 3, (a, env) => {
    const s = V.toText(a[0]);
    const start = Math.max(1, Math.trunc(V.toNumber(a[1], env.blankAsZero) || 0));
    const len = Math.max(0, Math.trunc(V.toNumber(a[2], env.blankAsZero) || 0));
    return V.text(s.substr(start - 1, len));
  });
  def('TRIM', 1, 1, a => V.text(V.toText(a[0]).trim()));
  def('UPPER', 1, 1, a => V.text(V.toText(a[0]).toUpperCase()));
  def('LOWER', 1, 1, a => V.text(V.toText(a[0]).toLowerCase()));
  def('FIND', 2, 3, (a, env) => {
    const search = V.toText(a[0]);
    const text = V.toText(a[1]);
    const start = a.length > 2 ? Math.max(1, Math.trunc(V.toNumber(a[2], env.blankAsZero) || 1)) : 1;
    return V.number(text.indexOf(search, start - 1) + 1); // 0 when not found, like Salesforce
  });
  def('SUBSTITUTE', 3, 3, a => {
    const text = V.toText(a[0]);
    const oldT = V.toText(a[1]);
    if (oldT === '') return V.text(text);
    return V.text(text.split(oldT).join(V.toText(a[2])));
  });
  def('LPAD', 2, 3, (a, env) => {
    const s = V.toText(a[0]);
    const len = Math.max(0, Math.trunc(V.toNumber(a[1], env.blankAsZero) || 0));
    const pad = a.length > 2 ? V.toText(a[2]) : ' ';
    if (s.length >= len || pad === '') return V.text(s.slice(0, len));
    return V.text(pad.repeat(Math.ceil((len - s.length) / pad.length)).slice(0, len - s.length) + s);
  });
  def('RPAD', 2, 3, (a, env) => {
    const s = V.toText(a[0]);
    const len = Math.max(0, Math.trunc(V.toNumber(a[1], env.blankAsZero) || 0));
    const pad = a.length > 2 ? V.toText(a[2]) : ' ';
    if (s.length >= len || pad === '') return V.text(s.slice(0, len));
    return V.text(s + pad.repeat(Math.ceil((len - s.length) / pad.length)).slice(0, len - s.length));
  });
  def('BR', 0, 0, () => V.text('\n'));

  // ---------- math ----------

  defMath('ABS', 1, Math.abs);
  defMath('SQRT', 1, x => {
    if (x < 0) throw new Error('SQRT of a negative number');
    return Math.sqrt(x);
  });
  defMath('EXP', 1, Math.exp);
  defMath('LN', 1, x => {
    if (x <= 0) throw new Error('LN requires a positive number');
    return Math.log(x);
  });
  defMath('LOG', 1, x => {
    if (x <= 0) throw new Error('LOG requires a positive number');
    return Math.log10(x);
  });
  // Salesforce FLOOR/CEILING round toward/away from zero; MFLOOR/MCEILING are the mathematical versions.
  defMath('FLOOR', 1, Math.trunc);
  defMath('CEILING', 1, x => Math.sign(x) * Math.ceil(Math.abs(x)));
  defMath('MFLOOR', 1, Math.floor);
  defMath('MCEILING', 1, Math.ceil);
  defMath('ROUND', 2, (n, d) => {
    const f = Math.pow(10, Math.trunc(d));
    return (Math.sign(n) * Math.round(Math.abs(n) * f)) / f; // half away from zero
  });
  defMath('MOD', 2, (a, b) => {
    if (b === 0) throw new Error('MOD by zero');
    return a % b;
  });
  def('TRUNC', 1, 2, (a, env) => {
    const n = V.toNumber(a[0], env.blankAsZero);
    if (n === null) return V.NULL;
    let d = 0;
    if (a.length > 1) {
      const dd = V.toNumber(a[1], env.blankAsZero);
      if (dd === null) return V.NULL;
      d = Math.trunc(dd);
    }
    const f = Math.pow(10, d);
    return V.number(Math.trunc(n * f) / f);
  });
  def('MIN', 1, Infinity, (a, env) => {
    const nums = a.map(v => V.toNumber(v, env.blankAsZero)).filter(x => x !== null);
    return nums.length ? V.number(Math.min(...nums)) : V.NULL;
  });
  def('MAX', 1, Infinity, (a, env) => {
    const nums = a.map(v => V.toNumber(v, env.blankAsZero)).filter(x => x !== null);
    return nums.length ? V.number(Math.max(...nums)) : V.NULL;
  });

  // ---------- date / time ----------

  def('TODAY', 0, 0, () => {
    const n = new Date();
    return V.date(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  });
  def('NOW', 0, 0, () => V.datetime(new Date()));
  def('DATE', 3, 3, (a, env) => {
    const ns = a.map(v => V.toNumber(v, env.blankAsZero));
    if (ns.some(x => x === null)) return V.NULL;
    const [y, m, d] = ns.map(Math.trunc);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      throw new Error(`DATE(${y}, ${m}, ${d}) is not a valid date`);
    }
    return V.date(dt);
  });
  def('DATEVALUE', 1, 1, a => {
    const d = dateArg(a[0], 'DATEVALUE');
    return d ? V.date(d) : V.NULL;
  });
  def('DATETIMEVALUE', 1, 1, a => {
    const d = datetimeArg(a[0], 'DATETIMEVALUE');
    return d ? V.datetime(d) : V.NULL;
  });
  def('YEAR', 1, 1, a => {
    const d = dateArg(a[0], 'YEAR');
    return d ? V.number(d.getUTCFullYear()) : V.NULL;
  });
  def('MONTH', 1, 1, a => {
    const d = dateArg(a[0], 'MONTH');
    return d ? V.number(d.getUTCMonth() + 1) : V.NULL;
  });
  def('DAY', 1, 1, a => {
    const d = dateArg(a[0], 'DAY');
    return d ? V.number(d.getUTCDate()) : V.NULL;
  });
  def('WEEKDAY', 1, 1, a => {
    const d = dateArg(a[0], 'WEEKDAY');
    return d ? V.number(d.getUTCDay() + 1) : V.NULL; // 1 = Sunday
  });
  def('HOUR', 1, 1, a => {
    const d = datetimeArg(a[0], 'HOUR');
    return d ? V.number(d.getUTCHours()) : V.NULL;
  });
  def('MINUTE', 1, 1, a => {
    const d = datetimeArg(a[0], 'MINUTE');
    return d ? V.number(d.getUTCMinutes()) : V.NULL;
  });
  def('SECOND', 1, 1, a => {
    const d = datetimeArg(a[0], 'SECOND');
    return d ? V.number(d.getUTCSeconds()) : V.NULL;
  });
  def('ADDMONTHS', 2, 2, (a, env) => {
    const d = dateArg(a[0], 'ADDMONTHS');
    const n = V.toNumber(a[1], env.blankAsZero);
    if (!d || n === null) return V.NULL;
    const months = Math.trunc(n);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
    return V.date(new Date(Date.UTC(y, m + months, Math.min(day, lastDay))));
  });

  window.SFFunctions = F;
})();
