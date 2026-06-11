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

  V.isNull = v => v.type === 'null';
  V.isBlank = v => v.type === 'null' || (v.type === 'text' && v.value === '');

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
    date: 'Date', datetime: 'Date/Time', null: 'Blank'
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
    }
  };

  // --- coercions (throw on type mismatch, like Salesforce's compile errors) ---

  V.toNumber = (v, blankAsZero) => {
    if (v.type === 'number') return v.value;
    if (v.type === 'null') return blankAsZero ? 0 : null;
    throw new Error(`Expected a Number but got ${V.typeName(v)} (${V.display(v)}). Use VALUE() to convert text.`);
  };

  V.toText = v => {
    if (v.type === 'text') return v.value;
    if (v.type === 'null') return '';
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
      default: return false;
    }
  };

  window.SFValues = V;
})();
