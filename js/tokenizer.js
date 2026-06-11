// Tokenizer for Salesforce formula syntax. Every token carries its
// [start, end) character span so the UI can highlight source ranges.
(function () {
  class FormulaError extends Error {
    constructor(message, start, end) {
      super(message);
      this.start = start;
      this.end = end;
    }
  }

  // Multi-char operators must come before their single-char prefixes.
  const OPS = ['==', '!=', '<>', '<=', '>=', '&&', '||', '~=', '=', '<', '>', '+', '-', '*', '/', '^', '&', '!'];
  const MERGE_RE = /^%([A-Za-z_$][A-Za-z0-9_$:.]*)%/;

  // `omni` enables OmniStudio syntax: %MergeField% references, the %
  // percentage operator, and ':' in field paths (Account:Contact:Birthdate).
  function tokenize(src, omni) {
    const identChar = omni ? /[A-Za-z0-9_$.:]/ : /[A-Za-z0-9_$.]/;
    const tokens = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end === -1) throw new FormulaError('Unterminated comment', i, n);
        i = end + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        let val = '';
        while (j < n && src[j] !== c) {
          // OmniStudio strings support backslash escapes, e.g. DESERIALIZE("{\"key\":\"value\"}")
          if (omni && src[j] === '\\' && j + 1 < n) {
            val += src[j + 1];
            j += 2;
            continue;
          }
          val += src[j];
          j++;
        }
        if (j >= n) throw new FormulaError('Unterminated string', i, n);
        tokens.push({ type: 'string', value: val, start: i, end: j + 1 });
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i;
        while (j < n && /[0-9]/.test(src[j])) j++;
        if (src[j] === '.') {
          j++;
          while (j < n && /[0-9]/.test(src[j])) j++;
        }
        tokens.push({ type: 'number', value: parseFloat(src.slice(i, j)), start: i, end: j });
        i = j;
        continue;
      }
      if (c === '%' && omni) {
        const m = MERGE_RE.exec(src.slice(i));
        if (m) {
          tokens.push({ type: 'ident', value: m[1], start: i, end: i + m[0].length });
          i += m[0].length;
        } else {
          tokens.push({ type: 'op', value: '%', start: i, end: i + 1 });
          i++;
        }
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < n && identChar.test(src[j])) j++;
        tokens.push({ type: 'ident', value: src.slice(i, j), start: i, end: j });
        i = j;
        continue;
      }
      if (c === '(') { tokens.push({ type: 'lparen', start: i, end: i + 1 }); i++; continue; }
      if (c === ')') { tokens.push({ type: 'rparen', start: i, end: i + 1 }); i++; continue; }
      if (c === ',') { tokens.push({ type: 'comma', start: i, end: i + 1 }); i++; continue; }
      const op = OPS.find(o => src.startsWith(o, i));
      if (op) {
        tokens.push({ type: 'op', value: op, start: i, end: i + op.length });
        i += op.length;
        continue;
      }
      throw new FormulaError(`Unexpected character "${c}"`, i, i + 1);
    }
    return tokens;
  }

  window.SFTokenizer = { tokenize, FormulaError };
})();
