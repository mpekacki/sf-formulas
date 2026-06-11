// Recursive-descent parser producing an AST where every node has a unique id
// and a [start, end) source span. Precedence (low to high):
//   || / OR   →   && / AND   →   comparisons   →   &   →   + -   →   * /   →   ^   →   unary   →   primary
// Lenient extras beyond strict Salesforce syntax: infix AND / OR / NOT
// keywords, and == / != as aliases for = / <>.
// OmniStudio mode (opts.omni) adds the LIKE / NOTLIKE / ~= comparison
// operators and the % percentage operator (^ and % share the highest math
// precedence, applied left to right, per the managed-package docs).
(function () {
  const { FormulaError } = window.SFTokenizer;

  // Bare ROUND() direction keywords; in OmniStudio mode they're literals,
  // not field references: ROUND(2.575, 2, HALF_UP).
  const ROUND_MODES = ['UP', 'DOWN', 'HALF_UP', 'HALF_DOWN', 'HALF_EVEN', 'CEILING', 'FLOOR'];

  function parse(src, opts) {
    const omni = !!(opts && opts.omni);
    const tokens = window.SFTokenizer.tokenize(src, omni);
    if (tokens.length === 0) throw new FormulaError('Formula is empty', 0, src.length);
    let pos = 0;
    let nextId = 1;

    const peek = () => tokens[pos];
    const mk = props => Object.assign({ id: nextId++ }, props);
    const isOp = (t, ...vals) => !!t && t.type === 'op' && vals.includes(t.value);
    // AND/OR/NOT keywords only count when they're plain words (no dots).
    const isKw = (t, kw) => !!t && t.type === 'ident' && t.value.toUpperCase() === kw;

    function expect(type, what) {
      const t = peek();
      if (!t || t.type !== type) {
        const at = t ? t.start : src.length;
        throw new FormulaError(`Expected ${what}`, at, t ? t.end : src.length);
      }
      pos++;
      return t;
    }

    function binaryLevel(nextFn, matcher) {
      return function () {
        let left = nextFn();
        for (;;) {
          const op = matcher(peek());
          if (!op) return left;
          pos++;
          const right = nextFn();
          left = mk({ type: 'binary', op, left, right, start: left.start, end: right.end });
        }
      };
    }

    function parsePrimary() {
      const t = peek();
      if (!t) throw new FormulaError('Unexpected end of formula', src.length, src.length);
      if (t.type === 'number') { pos++; return mk({ type: 'number', value: t.value, start: t.start, end: t.end }); }
      if (t.type === 'string') { pos++; return mk({ type: 'string', value: t.value, start: t.start, end: t.end }); }
      if (t.type === 'lparen') {
        pos++;
        const inner = parseExpression();
        const rp = expect('rparen', '")"');
        // Widen the inner node's span to include the parentheses.
        inner.start = t.start;
        inner.end = rp.end;
        return inner;
      }
      if (t.type === 'ident') {
        pos++;
        if (peek() && peek().type === 'lparen') {
          pos++;
          const args = [];
          if (!(peek() && peek().type === 'rparen')) {
            for (;;) {
              args.push(parseExpression());
              if (peek() && peek().type === 'comma') { pos++; continue; }
              break;
            }
          }
          const rp = expect('rparen', '")" or ","');
          return mk({ type: 'call', name: t.value.toUpperCase(), args, start: t.start, end: rp.end });
        }
        const up = t.value.toUpperCase();
        if (up === 'TRUE' || up === 'FALSE') {
          return mk({ type: 'literal', value: window.SFValues.boolean(up === 'TRUE'), start: t.start, end: t.end });
        }
        if (up === 'NULL') {
          return mk({ type: 'literal', value: window.SFValues.NULL, start: t.start, end: t.end });
        }
        if (omni && ROUND_MODES.includes(up)) {
          return mk({ type: 'literal', value: window.SFValues.text(up), start: t.start, end: t.end });
        }
        return mk({ type: 'ident', name: t.value, start: t.start, end: t.end });
      }
      throw new FormulaError(`Unexpected "${src.slice(t.start, t.end)}"`, t.start, t.end);
    }

    function parseUnary() {
      const t = peek();
      if (isOp(t, '-', '!')) {
        pos++;
        const operand = parseUnary();
        return mk({ type: 'unary', op: t.value, operand, start: t.start, end: operand.end });
      }
      // NOT as a keyword (NOT(x) is handled as a function call in parsePrimary).
      if (isKw(t, 'NOT') && !(tokens[pos + 1] && tokens[pos + 1].type === 'lparen')) {
        pos++;
        const operand = parseUnary();
        return mk({ type: 'unary', op: '!', operand, start: t.start, end: operand.end });
      }
      return parsePrimary();
    }

    function parseExponent() {
      const base = parseUnary();
      if (isOp(peek(), '^')) {
        pos++;
        const exp = parseExponent(); // right-associative
        return mk({ type: 'binary', op: '^', left: base, right: exp, start: base.start, end: exp.end });
      }
      return base;
    }

    // OmniStudio: ^ and % share a precedence level and apply left to right.
    const parsePow = omni
      ? binaryLevel(parseUnary, t => (isOp(t, '^', '%') ? t.value : null))
      : parseExponent;
    const parseMul = binaryLevel(parsePow, t => (isOp(t, '*', '/') ? t.value : null));
    const parseAdd = binaryLevel(parseMul, t => (isOp(t, '+', '-') ? t.value : null));
    const parseConcat = binaryLevel(parseAdd, t => (isOp(t, '&') ? '&' : null));
    const parseCompare = binaryLevel(parseConcat, t => {
      if (isOp(t, '=', '==', '<>', '!=', '<', '<=', '>', '>=')) return t.value;
      if (omni) {
        if (isOp(t, '~=')) return '~=';
        if (isKw(t, 'LIKE')) return 'LIKE';
        if (isKw(t, 'NOTLIKE')) return 'NOTLIKE';
      }
      return null;
    });
    // In these two levels we're always right after a complete operand, so a
    // bare AND/OR keyword here is an infix operator (AND(...) at operand
    // position is parsed as a function call by parsePrimary instead).
    const parseAnd = binaryLevel(parseCompare, t => (isOp(t, '&&') || isKw(t, 'AND') ? '&&' : null));
    const parseOr = binaryLevel(parseAnd, t => (isOp(t, '||') || isKw(t, 'OR') ? '||' : null));

    function parseExpression() { return parseOr(); }

    const root = parseExpression();
    if (pos < tokens.length) {
      const t = peek();
      throw new FormulaError(`Unexpected "${src.slice(t.start, t.end)}" after the end of the formula`, t.start, t.end);
    }
    return root;
  }

  function childrenOf(node) {
    switch (node.type) {
      case 'binary': return [node.left, node.right];
      case 'unary': return [node.operand];
      case 'call': return node.args;
      default: return [];
    }
  }

  // All record fields referenced by the formula, deduped case-insensitively,
  // in order of first appearance. Skips $-globals ($User.Id etc.) since those
  // aren't queryable columns.
  function collectFields(ast) {
    const seen = new Set();
    const fields = [];
    (function walk(node) {
      if (node.type === 'ident' && !node.name.startsWith('$')) {
        const key = node.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          fields.push(node.name);
        }
      }
      childrenOf(node).forEach(walk);
    })(ast);
    return fields;
  }

  window.SFParser = { parse, childrenOf, collectFields };
})();
