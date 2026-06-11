// UI wiring: inputs -> parse -> evaluate -> three result views
// (final result, annotated formula with hover tooltips, evaluation tree).
(function () {
  const V = window.SFValues;
  const { parse, childrenOf, collectFields } = window.SFParser;
  const $ = id => document.getElementById(id);

  const recordEl = $('record');
  const formulaEl = $('formula');
  const typeEl = $('rettype');
  const blankEl = $('blankzero');
  const errorsEl = $('errors');
  const finalEl = $('final');
  const formulaView = $('formulaView');
  const treeView = $('treeView');
  const tooltip = $('tooltip');
  const soqlCard = $('soqlCard');
  const soqlView = $('soqlView');

  const LS_KEY = 'sf-formula-eval';
  const DEFAULTS = {
    record: JSON.stringify({
      Name: 'Acme Renewal Q3',
      StageName: 'Negotiation',
      Amount: 48500,
      Discount__c: null,
      CloseDate: '2026-07-15',
      Account: {
        Name: 'Acme Corp',
        Rating: 'Hot',
        Parent: null
      },
      Owner: { LastName: 'Doe' }
    }, null, 2),
    formula: `/* Opportunity health check */
IF(
  ISPICKVAL(StageName, "Closed Won") OR ISPICKVAL(StageName, "Closed Lost"),
  "Closed out: " & StageName,
  CASE(Account.Rating, "Hot", "[HOT] ", "Cold", "[cold] ", "")
    & Account.Name
    & " - $" & TEXT(ROUND(BLANKVALUE(Discount__c, 0.05) * Amount, 0)) & " discount, "
    & IF(DATEVALUE(CloseDate) - TODAY() < 30,
         "closing in under 30 days! Call " & UPPER(Owner.LastName),
         "on track (" & TEXT(DATEVALUE(CloseDate) - TODAY()) & " days left)")
    & IF(ISBLANK(Account.Parent.Name), "", " [subsidiary]")
)`,
    rettype: 'Text',
    blankzero: true
  };

  // Current evaluation snapshot used by the hover handlers.
  let current = { src: '', results: new Map(), nodeById: new Map(), chosen: new Set() };

  // ---------- persistence ----------

  function loadState() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { /* corrupt -> defaults */ }
    recordEl.value = typeof s.record === 'string' ? s.record : DEFAULTS.record;
    formulaEl.value = typeof s.formula === 'string' ? s.formula : DEFAULTS.formula;
    typeEl.value = s.rettype || DEFAULTS.rettype;
    if (!typeEl.value) typeEl.value = DEFAULTS.rettype;
    blankEl.checked = typeof s.blankzero === 'boolean' ? s.blankzero : DEFAULTS.blankzero;
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        record: recordEl.value,
        formula: formulaEl.value,
        rettype: typeEl.value,
        blankzero: blankEl.checked
      }));
    } catch (e) { /* storage full/blocked — fine */ }
  }

  // ---------- main pipeline ----------

  function run() {
    saveState();
    hideError();
    tooltip.hidden = true;

    let record = {};
    const recText = recordEl.value.trim();
    if (recText) {
      try {
        record = JSON.parse(recText);
        if (record === null || typeof record !== 'object' || Array.isArray(record)) {
          throw new Error('the record must be a JSON object, like {"Name": "foo"}');
        }
      } catch (e) {
        showError('Record JSON: ' + e.message);
        clearResults();
        return;
      }
    }

    const src = formulaEl.value;
    if (!src.trim()) {
      clearResults('Enter a formula to evaluate.');
      return;
    }

    let ast;
    try {
      ast = parse(src);
    } catch (e) {
      showError('Formula: ' + e.message);
      renderParseError(src, e);
      finalEl.className = 'final';
      finalEl.textContent = '—';
      treeView.textContent = '';
      soqlCard.hidden = true;
      current = { src, results: new Map(), nodeById: new Map(), chosen: new Set() };
      return;
    }

    const { results, chosen } = window.SFEvaluator.evaluate(ast, record, { blankAsZero: blankEl.checked });
    const nodeById = new Map();
    (function index(n) {
      nodeById.set(n.id, n);
      childrenOf(n).forEach(index);
    })(ast);
    current = { src, results, nodeById, chosen };

    renderFinal(ast, results);
    renderFormula(src, ast, results, chosen);
    renderTree(src, ast, results, chosen);
    renderSoql(ast);
  }

  function renderSoql(ast) {
    const fields = collectFields(ast);
    if (fields.length === 0) {
      soqlCard.hidden = true;
      return;
    }
    soqlView.textContent = `SELECT ${fields.join(', ')} FROM `;
    soqlCard.hidden = false;
  }

  function clearResults(msg) {
    finalEl.className = 'final muted';
    finalEl.textContent = msg || '—';
    formulaView.textContent = formulaEl.value;
    treeView.textContent = '';
    soqlCard.hidden = true;
    current = { src: formulaEl.value, results: new Map(), nodeById: new Map(), chosen: new Set() };
  }

  function showError(msg) {
    errorsEl.textContent = msg;
    errorsEl.hidden = false;
  }
  function hideError() {
    errorsEl.hidden = true;
    errorsEl.textContent = '';
  }

  // ---------- final result ----------

  const TYPE_MAP = {
    Checkbox: 'boolean', Number: 'number', Currency: 'number',
    Percent: 'number', Text: 'text', Date: 'date', 'Date/Time': 'datetime'
  };

  function formatFinal(v, want) {
    if (v.type === 'null') return 'blank (null)';
    switch (want) {
      case 'Checkbox': return v.value ? 'TRUE ✓' : 'FALSE ✗';
      case 'Currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v.value);
      case 'Percent': return `${V.fmtNumber(v.value)} (= ${V.fmtNumber(v.value * 100)}%)`;
      case 'Number': return V.fmtNumber(v.value);
      case 'Text': return v.value === '' ? '"" (empty text)' : v.value;
      case 'Date': return V.fmtDate(v.value);
      case 'Date/Time': return V.fmtDateTime(v.value);
      default: return V.display(v);
    }
  }

  function renderFinal(ast, results) {
    const res = results.get(ast.id);
    const want = typeEl.value;
    finalEl.innerHTML = '';

    if (!res) {
      finalEl.className = 'final muted';
      finalEl.textContent = '—';
      return;
    }
    if (res.error) {
      finalEl.className = 'final error';
      const label = document.createElement('div');
      label.className = 'final-label';
      label.textContent = '#Error!';
      const msg = document.createElement('div');
      msg.className = 'final-msg';
      msg.textContent = res.error;
      finalEl.append(label, msg);
      return;
    }

    const v = res.value;
    const matches = v.type === 'null' || v.type === TYPE_MAP[want];
    finalEl.className = 'final ' + (v.type === 'boolean' ? (v.value ? 'ok' : 'no') : 'plain');

    const label = document.createElement('div');
    label.className = 'final-label';
    label.textContent = `${want} result`;
    const val = document.createElement('div');
    val.className = 'final-value';
    val.textContent = matches ? formatFinal(v, want) : V.display(v);
    finalEl.append(label, val);

    if (!matches) {
      const warn = document.createElement('div');
      warn.className = 'final-warn';
      warn.textContent = `⚠ The formula returned ${V.typeName(v)}, but the selected return type is ${want}.`;
      finalEl.append(warn);
    }
  }

  // ---------- annotated formula ----------

  function renderFormula(src, ast, results, chosen) {
    formulaView.innerHTML = '';
    formulaView.append(document.createTextNode(src.slice(0, ast.start)));
    formulaView.append(renderNode(ast, src, results, chosen));
    formulaView.append(document.createTextNode(src.slice(ast.end)));
  }

  function renderNode(node, src, results, chosen) {
    const span = document.createElement('span');
    span.className = 'node';
    span.dataset.id = node.id;
    const res = results.get(node.id);
    if (res) {
      if (res.error) {
        if (!res.propagated) span.classList.add('err');
      } else if (res.value.type === 'boolean') {
        span.classList.add(res.value.value ? 'bool-true' : 'bool-false');
      }
    }
    if (chosen.has(node.id)) span.classList.add('chosen');
    let cursor = node.start;
    for (const child of childrenOf(node)) {
      if (child.start > cursor) span.append(document.createTextNode(src.slice(cursor, child.start)));
      span.append(renderNode(child, src, results, chosen));
      cursor = child.end;
    }
    if (cursor < node.end) span.append(document.createTextNode(src.slice(cursor, node.end)));
    return span;
  }

  function renderParseError(src, err) {
    formulaView.innerHTML = '';
    const start = Math.min(err.start ?? src.length, src.length);
    const end = Math.min(Math.max(err.end ?? start, start), src.length);
    formulaView.append(document.createTextNode(src.slice(0, start)));
    const bad = document.createElement('span');
    bad.className = 'parse-err';
    bad.textContent = start === end ? '▌' : src.slice(start, end);
    formulaView.append(bad);
    formulaView.append(document.createTextNode(src.slice(end)));
  }

  // ---------- evaluation tree ----------

  function snippet(src, node) {
    const s = src.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  }

  function renderTree(src, ast, results, chosen) {
    treeView.innerHTML = '';
    (function addRows(node, depth) {
      // Literals are self-evident; skip them to keep the tree readable.
      const skip = node.type === 'number' || node.type === 'string' || node.type === 'literal';
      if (!skip) {
        const row = document.createElement('div');
        row.className = 'tree-row';
        row.dataset.id = node.id;
        row.style.paddingLeft = `${depth * 18 + 8}px`;

        const snip = document.createElement('span');
        snip.className = 't-snippet';
        snip.textContent = snippet(src, node);

        const badge = document.createElement('span');
        const res = results.get(node.id);
        if (!res) {
          badge.className = 'badge badge-skip';
          badge.textContent = 'not evaluated';
        } else if (res.error) {
          badge.className = 'badge badge-err' + (res.propagated ? ' dim' : '');
          badge.textContent = res.propagated ? '⚠ error in subexpression' : '⚠ ' + truncate(res.error, 60);
        } else {
          badge.className = 'badge ' + badgeClass(res.value);
          badge.textContent = truncate(V.display(res.value), 60);
        }

        row.append(snip, badge);
        if (chosen.has(node.id)) {
          const pick = document.createElement('span');
          pick.className = 'badge badge-chosen';
          pick.textContent = '✓ chosen';
          row.append(pick);
        }
        row.addEventListener('mouseenter', () => setHighlight(node.id, true));
        row.addEventListener('mouseleave', () => setHighlight(node.id, false));
        treeView.append(row);
      }
      const nextDepth = skip ? depth : depth + 1;
      childrenOf(node).forEach(c => addRows(c, nextDepth));
    })(ast, 0);
  }

  function badgeClass(v) {
    switch (v.type) {
      case 'boolean': return v.value ? 'badge-true' : 'badge-false';
      case 'number': return 'badge-num';
      case 'text': return 'badge-text';
      case 'date': case 'datetime': return 'badge-date';
      default: return 'badge-null';
    }
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // ---------- hover interactions ----------

  function setHighlight(id, on) {
    const span = formulaView.querySelector(`.node[data-id="${id}"]`);
    const row = treeView.querySelector(`.tree-row[data-id="${id}"]`);
    if (span) span.classList.toggle('hl', on);
    if (row) row.classList.toggle('hl', on);
  }

  let hoveredId = null;

  formulaView.addEventListener('mouseover', e => {
    const span = e.target.closest('.node');
    const id = span ? Number(span.dataset.id) : null;
    if (id === hoveredId) return;
    if (hoveredId !== null) setHighlight(hoveredId, false);
    hoveredId = id;
    if (id === null) {
      tooltip.hidden = true;
      return;
    }
    setHighlight(id, true);
    fillTooltip(id);
  });

  formulaView.addEventListener('mouseleave', () => {
    if (hoveredId !== null) setHighlight(hoveredId, false);
    hoveredId = null;
    tooltip.hidden = true;
  });

  formulaView.addEventListener('mousemove', e => {
    if (tooltip.hidden) return;
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const r = tooltip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  });

  function fillTooltip(id) {
    const node = current.nodeById.get(id);
    const res = current.results.get(id);
    tooltip.innerHTML = '';

    const expr = document.createElement('div');
    expr.className = 'tt-expr';
    expr.textContent = node ? snippet(current.src, node) : '';
    tooltip.append(expr);

    const val = document.createElement('div');
    if (!res) {
      val.className = 'tt-val tt-muted';
      val.textContent = 'not evaluated';
    } else if (res.error) {
      val.className = 'tt-val tt-err';
      val.textContent = (res.propagated ? '⚠ error in subexpression: ' : '⚠ ') + res.error;
    } else {
      val.className = 'tt-val';
      const type = document.createElement('span');
      type.className = 'tt-type';
      type.textContent = V.typeName(res.value);
      val.append(type, document.createTextNode(' ' + truncate(V.display(res.value), 160)));
    }
    if (current.chosen.has(id)) {
      const pick = document.createElement('div');
      pick.className = 'tt-chosen';
      pick.textContent = '✓ chosen branch';
      tooltip.append(val, pick);
    } else {
      tooltip.append(val);
    }
    tooltip.hidden = false;
  }

  // ---------- bootstrapping ----------

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  recordEl.addEventListener('input', schedule);
  formulaEl.addEventListener('input', schedule);
  typeEl.addEventListener('change', run);
  blankEl.addEventListener('change', run);
  $('reset').addEventListener('click', () => {
    recordEl.value = DEFAULTS.record;
    formulaEl.value = DEFAULTS.formula;
    typeEl.value = DEFAULTS.rettype;
    blankEl.checked = DEFAULTS.blankzero;
    run();
  });

  $('soqlCopy').addEventListener('click', async () => {
    const btn = $('soqlCopy');
    try {
      await navigator.clipboard.writeText(soqlView.textContent);
      btn.textContent = 'Copied!';
    } catch (e) {
      // Clipboard API is unavailable on file:// in some browsers — select the text instead.
      const range = document.createRange();
      range.selectNodeContents(soqlView);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });

  $('fnlist').textContent = Object.keys(window.SFFunctions).sort().map(n => n + '()').join('  ');

  loadState();
  run();
})();
