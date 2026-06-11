// Value model + coercions shared by the evaluator and the UI.
// A value is { type: 'number'|'text'|'boolean'|'date'|'datetime'|'null', value: ... }
(function () {
  const V = {};

  V.NULL = { type: 'null', value: null };
  V.number = v => ({ type: 'number', value: v });
  V.text = v => ({ type: 'text', value: v });
  V.boolean = v => ({ type: 'boolean', value: v });
  V.date = d => ({ type: 'date', value: d });
  V.datetime = d => ({ type: 'datetime', value: d });
  // OmniStudio mode works on JSON data, so lists and objects are first-class.
  V.list = arr => ({ type: 'list', value: arr });
  V.object = o => ({ type: 'object', value: o });

  V.isNull = v => v.type === 'null';
  V.isBlank = v => v.type === 'null' || (v.type === 'text' && v.value === '')
    || (v.type === 'list' && v.value.length === 0);

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

  V.parseDate = s => {
    if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
    const d = new Date(s + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  };

  V.parseDateTime = s => {
    if (typeof s !== 'string' || !DATETIME_RE.test(s)) return null;
    let iso = s.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += 'Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  V.datePart = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  V.fmtDate = d => d.toISOString().slice(0, 10);
  V.fmtDateTime = d => d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

  V.fmtNumber = n => {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    return String(Math.round(n * 1e10) / 1e10);
  };

  const TYPE_NAMES = {
    number: 'Number', text: 'Text', boolean: 'Boolean',
    date: 'Date', datetime: 'Date/Time', null: 'Blank',
    list: 'List', object: 'JSON Object'
  };
  V.typeName = v => TYPE_NAMES[v.type];

  V.display = v => {
    switch (v.type) {
      case 'null': return 'blank';
      case 'boolean': return v.value ? 'TRUE' : 'FALSE';
      case 'number': return V.fmtNumber(v.value);
      case 'text': return JSON.stringify(v.value);
      case 'date': return V.fmtDate(v.value);
      case 'datetime': return V.fmtDateTime(v.value);
      case 'list':
      case 'object': return JSON.stringify(v.value);
    }
  };

  // Unwrap a value back to plain JSON (dates become ISO strings).
  V.raw = v => {
    switch (v.type) {
      case 'date': return V.fmtDate(v.value);
      case 'datetime': return v.value.toISOString();
      default: return v.value;
    }
  };

  // Wrap plain JSON as a value (used by OmniStudio JSON functions).
  V.wrap = raw => {
    if (raw === null || raw === undefined) return V.NULL;
    if (Array.isArray(raw)) return V.list(raw);
    switch (typeof raw) {
      case 'number': return V.number(raw);
      case 'string': return V.text(raw);
      case 'boolean': return V.boolean(raw);
      default: return V.object(raw);
    }
  };

  // --- coercions (throw on type mismatch, like Salesforce's compile errors) ---

  // `loose` enables OmniStudio's weak typing: numeric strings count as numbers.
  V.toNumber = (v, blankAsZero, loose) => {
    if (v.type === 'number') return v.value;
    if (v.type === 'null') return blankAsZero ? 0 : null;
    if (loose && v.type === 'text') {
      const t = v.value.trim();
      const n = Number(t);
      if (t !== '' && !isNaN(n)) return n;
    }
    throw new Error(`Expected a Number but got ${V.typeName(v)} (${V.display(v)}). Use VALUE() to convert text.`);
  };

  V.toText = (v, loose) => {
    if (v.type === 'text') return v.value;
    if (v.type === 'null') return '';
    if (loose) {
      switch (v.type) {
        case 'number': return V.fmtNumber(v.value);
        case 'boolean': return v.value ? 'true' : 'false';
        case 'date': return V.fmtDate(v.value);
        case 'datetime': return v.value.toISOString();
        case 'list':
        case 'object': return JSON.stringify(v.value);
      }
    }
    throw new Error(`Expected Text but got ${V.typeName(v)} (${V.display(v)}). Use TEXT() to convert.`);
  };

  V.toBoolean = v => {
    if (v.type === 'boolean') return v.value;
    if (v.type === 'null') return false; // a blank checkbox is false
    throw new Error(`Expected TRUE/FALSE but got ${V.typeName(v)} (${V.display(v)})`);
  };

  // Bring two values to a common type for comparison. Text that looks like an
  // ISO date is coerced when compared against a Date/Datetime (the record JSON
  // can't tell us the field is a date, so we infer from context).
  V.unifyTypes = (a, b) => {
    if (a.type === b.type) return [a, b];
    const coerceText = (target, t) => {
      const d = target.type === 'date' ? (V.parseDate(t.value) || (V.parseDateTime(t.value) && V.datePart(V.parseDateTime(t.value))))
                                       : V.parseDateTime(t.value) || (V.parseDate(t.value));
      return d ? { type: target.type, value: d } : null;
    };
    if ((a.type === 'date' || a.type === 'datetime') && b.type === 'text') {
      const c = coerceText(a, b); if (c) return [a, c];
    }
    if ((b.type === 'date' || b.type === 'datetime') && a.type === 'text') {
      const c = coerceText(b, a); if (c) return [c, b];
    }
    if (a.type === 'date' && b.type === 'datetime') return [V.datetime(a.value), b];
    if (a.type === 'datetime' && b.type === 'date') return [a, V.datetime(b.value)];
    throw new Error(`Cannot compare ${V.typeName(a)} and ${V.typeName(b)}`);
  };

  V.equals = (a, b, blankAsZero) => {
    if (a.type === 'null' || b.type === 'null') {
      const other = a.type === 'null' ? b : a;
      switch (other.type) {
        case 'null': return true;
        case 'text': return other.value === '';
        case 'number': return blankAsZero ? other.value === 0 : false;
        case 'boolean': return other.value === false;
        default: return false;
      }
    }
    const [x, y] = V.unifyTypes(a, b);
    switch (x.type) {
      case 'number': return x.value === y.value;
      case 'text': return x.value === y.value; // Salesforce formula comparison is case-sensitive
      case 'boolean': return x.value === y.value;
      case 'date':
      case 'datetime': return x.value.getTime() === y.value.getTime();
      case 'list':
      case 'object': return JSON.stringify(x.value) === JSON.stringify(y.value);
      default: return false;
    }
  };

  // OmniStudio equality: loosely typed, so 1 == "1" and true == "true".
  V.omniEquals = (a, b, blankAsZero) => {
    if (a.type === 'null' || b.type === 'null') return V.equals(a, b, blankAsZero);
    if (a.type === b.type) return V.equals(a, b, blankAsZero);
    const pair = (t1, t2) => (a.type === t1 && b.type === t2) || (a.type === t2 && b.type === t1);
    if (pair('number', 'text')) {
      const t = a.type === 'text' ? a : b;
      const n = a.type === 'number' ? a : b;
      const parsed = Number(t.value.trim());
      return t.value.trim() !== '' && !isNaN(parsed) && parsed === n.value;
    }
    if (pair('boolean', 'text')) {
      const t = (a.type === 'text' ? a : b).value.trim().toLowerCase();
      const bo = a.type === 'boolean' ? a : b;
      return (t === 'true' || t === 'false') && (t === 'true') === bo.value;
    }
    try { return V.equals(a, b, blankAsZero); } catch (e) { return false; }
  };

  window.SFValues = V;
})();
