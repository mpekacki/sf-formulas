// Evaluates an AST against a record and records the outcome of EVERY node in
// a Map keyed by node id: { value } on success, { error, propagated } on
// failure. "propagated" means the error originated in a subexpression — the
// UI dims those so the real source of the error stands out.
(function () {
  const V = window.SFValues;
  const MS_PER_DAY = 86400000;

  function evaluate(ast, record, opts) {
    const blankAsZero = !!(opts && opts.blankAsZero);
    const results = new Map();
    // Node ids of branches picked by IF/CASE/BLANKVALUE/NULLVALUE,
    // so the UI can highlight which alternative produced the result.
    const chosen = new Set();

    function evalNode(node) {
      try {
        const value = compute(node);
        results.set(node.id, { value });
        return value;
      } catch (e) {
        if (!results.has(node.id)) {
          results.set(node.id, { error: e.message, propagated: !!e.propagated });
        }
        const pe = new Error(e.message);
        pe.propagated = true;
        throw pe;
      }
    }

    function evalSafe(node) {
      try {
        return { value: evalNode(node) };
      } catch (e) {
        return { error: e };
      }
    }

    const env = { eval: evalNode, evalSafe, blankAsZero, markChosen: node => chosen.add(node.id) };

    function compute(node) {
      switch (node.type) {
        case 'number': return V.number(node.value);
        case 'string': return V.text(node.value);
        case 'literal': return node.value;
        case 'ident': return fieldValue(node.name);
        case 'unary': return unary(node);
        case 'binary': return binary(node);
        case 'call': return call(node);
        default: throw new Error('Internal error: unknown node type ' + node.type);
      }
    }

    // --- record field lookup (supports "A.B" both as a literal key and as nested objects) ---

    function findKey(obj, name) {
      if (Object.prototype.hasOwnProperty.call(obj, name)) return name;
      const lower = name.toLowerCase();
      return Object.keys(obj).find(k => k.toLowerCase() === lower);
    }

    function fieldValue(path) {
      let cur = record;
      if (Object.prototype.hasOwnProperty.call(record, path)) {
        cur = record[path];
      } else {
        const parts = path.split('.');
        for (let i = 0; i < parts.length; i++) {
          // A null relation mid-path (e.g. {"Account": null} for Account.IsPublic)
          // means every field reached through it is blank, like in Salesforce.
          if (i > 0 && (cur === null || cur === undefined)) return V.NULL;
          const key = (cur !== null && typeof cur === 'object' && !Array.isArray(cur)) ? findKey(cur, parts[i]) : undefined;
          if (key === undefined) {
            throw new Error(`Field "${path}" is not in the record JSON. Add it to the record (use null for a blank value).`);
          }
          cur = cur[key];
        }
      }
      return infer(cur, path);
    }

    function infer(raw, path) {
      if (raw === null || raw === undefined) return V.NULL;
      switch (typeof raw) {
        case 'number':
          if (!isFinite(raw)) throw new Error(`Field "${path}" is not a finite number`);
          return V.number(raw);
        case 'string': return V.text(raw);
        case 'boolean': return V.boolean(raw);
        default:
          throw new Error(`Field "${path}" is an ${Array.isArray(raw) ? 'array' : 'object'} — reference a nested field like ${path}.SomeField`);
      }
    }

    // --- operators ---

    function unary(node) {
      const v = evalNode(node.operand);
      if (node.op === '-') {
        const n = V.toNumber(v, blankAsZero);
        return n === null ? V.NULL : V.number(-n);
      }
      return V.boolean(!V.toBoolean(v));
    }

    function binary(node) {
      if (node.op === '||' || node.op === '&&') return orAnd(node, node.op === '||');
      // Evaluate both sides via evalSafe so the UI always gets a value for
      // each side, then surface the first error.
      const l = evalSafe(node.left);
      const r = evalSafe(node.right);
      if (l.error) throw l.error;
      if (r.error) throw r.error;
      const a = l.value, b = r.value;
      switch (node.op) {
        case '+': return addSub(a, b, +1);
        case '-': return addSub(a, b, -1);
        case '*': case '/': case '^': return mulDivPow(node.op, a, b);
        case '&': return V.text(V.toText(a) + V.toText(b));
        case '=': case '==': return V.boolean(V.equals(a, b, blankAsZero));
        case '<>': case '!=': return V.boolean(!V.equals(a, b, blankAsZero));
        case '<': case '<=': case '>': case '>=': return compareOp(node.op, a, b);
        default: throw new Error('Internal error: unknown operator ' + node.op);
      }
    }

    // OR/AND short-circuit across errors: TRUE || <error> is still TRUE,
    // FALSE && <error> is still FALSE — but both sides are always evaluated
    // so the breakdown view can show them.
    function orAnd(node, isOr) {
      const l = evalSafe(node.left);
      const r = evalSafe(node.right);
      const lv = l.error ? null : V.toBoolean(l.value);
      const rv = r.error ? null : V.toBoolean(r.value);
      if (isOr) {
        if (lv === true || rv === true) return V.boolean(true);
      } else {
        if (lv === false || rv === false) return V.boolean(false);
      }
      if (l.error) throw l.error;
      if (r.error) throw r.error;
      return V.boolean(isOr ? lv || rv : lv && rv);
    }

    const isDateLike = v => v.type === 'date' || v.type === 'datetime';

    function shiftDays(d, days) {
      if (d.type === 'date') return V.date(new Date(d.value.getTime() + Math.trunc(days) * MS_PER_DAY));
      return V.datetime(new Date(d.value.getTime() + days * MS_PER_DAY));
    }

    function addSub(a, b, sign) {
      if (isDateLike(a) && b.type === 'number') return shiftDays(a, sign * b.value);
      if (sign > 0 && a.type === 'number' && isDateLike(b)) return shiftDays(b, a.value);
      if (sign < 0 && isDateLike(a) && isDateLike(b)) {
        const [x, y] = V.unifyTypes(a, b);
        return V.number((x.value.getTime() - y.value.getTime()) / MS_PER_DAY);
      }
      if (a.type === 'text' || b.type === 'text') {
        // + concatenates text like &, but mixing Text with other types is
        // still an error (toText says "Use TEXT() to convert").
        if (sign > 0) return V.text(V.toText(a) + V.toText(b));
        throw new Error('Cannot use - on Text. Use & or + to concatenate.');
      }
      const x = V.toNumber(a, blankAsZero);
      const y = V.toNumber(b, blankAsZero);
      if (x === null || y === null) return V.NULL;
      return V.number(sign > 0 ? x + y : x - y);
    }

    function mulDivPow(op, a, b) {
      const x = V.toNumber(a, blankAsZero);
      const y = V.toNumber(b, blankAsZero);
      if (x === null || y === null) return V.NULL;
      let r;
      if (op === '*') r = x * y;
      else if (op === '/') {
        if (y === 0) throw new Error('Division by zero');
        r = x / y;
      } else r = Math.pow(x, y);
      if (!isFinite(r)) throw new Error('Result is not a valid number');
      return V.number(r);
    }

    function compareOp(op, a, b) {
      if (V.isNull(a) || V.isNull(b)) {
        if (blankAsZero) {
          if (a.type === 'null' && (b.type === 'number' || b.type === 'null')) a = V.number(0);
          if (b.type === 'null' && a.type === 'number') b = V.number(0);
        }
        if (V.isNull(a) || V.isNull(b)) return V.boolean(false);
      }
      const [x, y] = V.unifyTypes(a, b);
      let cmp;
      if (x.type === 'number') cmp = x.value - y.value;
      else if (x.type === 'date' || x.type === 'datetime') cmp = x.value.getTime() - y.value.getTime();
      else throw new Error(`Cannot use ${op} on ${V.typeName(x)} values`);
      switch (op) {
        case '<': return V.boolean(cmp < 0);
        case '<=': return V.boolean(cmp <= 0);
        case '>': return V.boolean(cmp > 0);
        case '>=': return V.boolean(cmp >= 0);
      }
    }

    function call(node) {
      const spec = window.SFFunctions[node.name];
      if (!spec) throw new Error(`Unknown function ${node.name}(). See the supported-functions list.`);
      const n = node.args.length;
      if (n < spec.min || n > spec.max) {
        const want = spec.min === spec.max ? `${spec.min}`
          : spec.max === Infinity ? `at least ${spec.min}`
          : `${spec.min}–${spec.max}`;
        throw new Error(`${node.name}() expects ${want} argument(s), got ${n}`);
      }
      if (spec.lazy) return spec.impl(node.args, env);
      const evals = node.args.map(evalSafe);
      const firstErr = evals.find(r => r.error);
      if (firstErr) throw firstErr.error;
      return spec.impl(evals.map(r => r.value), env);
    }

    let rootError = null;
    try {
      evalNode(ast);
    } catch (e) {
      rootError = e;
    }
    return { results, chosen, rootError };
  }

  window.SFEvaluator = { evaluate };
})();
