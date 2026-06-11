// Smoke tests for the formula engine. Run with: node tests/smoke.js
// The browser files attach to `window`, so we run them in a vm context
// where window === globalThis.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['values.js', 'tokenizer.js', 'parser.js', 'functions.js', 'evaluator.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

const record = {
  Name: 'foo',
  Revenue__c: 123,
  StageName: 'Closed Won',
  CloseDate: '2026-07-15',
  IsActive__c: true,
  Missing__c: null,
  Account: { Name: 'Acme', Parent: null },
  Manager: null
};

let failures = 0;

function evalRoot(formula, opts) {
  const ast = ctx.SFParser.parse(formula);
  const { results } = ctx.SFEvaluator.evaluate(ast, record, opts || { blankAsZero: true });
  return { root: results.get(ast.id), ast, results };
}

function check(formula, expected, opts) {
  try {
    const { root } = evalRoot(formula, opts);
    let actual;
    if (root.error) actual = 'ERROR: ' + root.error;
    else {
      const v = root.value;
      actual = v.type === 'date' ? ctx.SFValues.fmtDate(v.value)
        : v.type === 'datetime' ? 'datetime'
        : v.type === 'null' ? null
        : v.value;
    }
    const pass = expected === 'ERROR' ? String(actual).startsWith('ERROR') : actual === expected;
    if (!pass) {
      failures++;
      console.log(`FAIL  ${formula}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    } else {
      console.log(`ok    ${formula}  =>  ${JSON.stringify(actual)}`);
    }
  } catch (e) {
    failures++;
    console.log(`FAIL  ${formula}\n      threw ${e.message}`);
  }
}

// the user's original example: left of OR true, right false
check("Revenue__c > 0 OR Name == 'bar'", true);
check("Name == 'bar'", false);
check("Name = 'foo'", true);

// arithmetic & precedence
check('1 + 2 * 3', 7);
check('(1 + 2) * 3', 9);
check('2 ^ 3 ^ 2', 512); // right-assoc
check('10 / 4', 2.5);
check('5 / 0', 'ERROR');
check('MOD(7, 3)', 1);
check('ROUND(2.345, 2)', 2.35);
check('ROUND(-2.5, 0)', -3);
check('FLOOR(-2.5)', -2);
check('CEILING(-2.5)', -3);
check('MFLOOR(-2.5)', -3);

// logic & functions
check('IF(CONTAINS(TEXT(StageName), "Closed"), "won", "open")', 'won');
check('AND(IsActive__c, Revenue__c > 100)', true);
check('OR(false, false)', false);
check('NOT IsActive__c', false);
check('TRUE && FALSE', false);
check('ISBLANK(Missing__c)', true);
check('BLANKVALUE(Missing__c, 5)', 5);
check('CASE(StageName, "Closed Won", 1, "Closed Lost", 2, 0)', 1);
check('CASE(StageName, "Nope", 1, 99)', 99);

// text
check('TEXT(LEN(Name)) & "!"', '3!');
check('Name + "bar"', 'foobar');
check('"a" + NULL + "b"', 'ab');
check('Name + 1', 'ERROR'); // Text + Number still needs TEXT()
check('"a" - "b"', 'ERROR');
check('"a" & NULL & "b"', 'ab');
check('UPPER(LEFT(Name, 2))', 'FO');
check('SUBSTITUTE("a-b-c", "-", "+")', 'a+b+c');
check('FIND("o", Name)', 2);
check('FIND("z", Name)', 0);
check('VALUE("12.5")', 12.5);
check('VALUE("abc")', 'ERROR');
check('LEN(Name) & "x"', 'ERROR'); // number & text -> needs TEXT()
check('ISPICKVAL(StageName, "Closed Won")', true);

// nested / cross-object
check('Account.Name = "Acme"', true);
check('Nope__c > 1', 'ERROR'); // unknown field

// null relations: all fields through them are blank, not errors
check('ISBLANK(Manager.Email)', true);
check('Manager.IsPublic = TRUE', false); // blank checkbox is false
check('Manager.IsPublic = FALSE', true);
check('ISBLANK(Account.Parent.Name)', true); // null relation deeper in the path
check('Bogus.Email', 'ERROR'); // relation itself absent is still an error

// dates (CloseDate is a text field coerced in date context)
check('YEAR(DATEVALUE("2026-06-11"))', 2026);
check('DATE(2026, 2, 30)', 'ERROR');
check('TEXT(ADDMONTHS(DATEVALUE("2026-01-31"), 1))', '2026-02-28');
check('DATEVALUE(CloseDate) > TODAY()', true);
check('DATEVALUE(CloseDate) - DATE(2026, 7, 10)', 5);
check('TEXT(DATE(2026, 7, 10) + 5)', '2026-07-15');

// blank handling modes
check('Missing__c + 1', 1, { blankAsZero: true });
check('Missing__c + 1', null, { blankAsZero: false });
check('Missing__c = 0', true, { blankAsZero: true });
check('Missing__c = 0', false, { blankAsZero: false });

// error short-circuit: OR is true even though the right side errors
check('Revenue__c > 0 || Bogus__c > 1', true);
check('Revenue__c < 0 || Bogus__c > 1', 'ERROR');

// sub-result recording (the core feature): check left/right of the OR
{
  const { ast, results } = evalRoot("Revenue__c > 0 OR Name == 'bar'");
  const left = results.get(ast.left.id);
  const right = results.get(ast.right.id);
  if (left.value.value === true && right.value.value === false) {
    console.log('ok    sub-results: left of OR is TRUE, right is FALSE');
  } else {
    failures++;
    console.log('FAIL  sub-results of OR', left, right);
  }
}

// SOQL field collection: deduped (case-insensitive), first-appearance order, $-globals skipped
{
  const ast = ctx.SFParser.parse(
    'IF(Revenue__c > 0 OR contains(TEXT(StageName), Name), Account.Name & TEXT(REVENUE__C), $User.Id)');
  const fields = ctx.SFParser.collectFields(ast);
  const soql = `SELECT ${fields.join(', ')} FROM `;
  const expected = 'SELECT Revenue__c, StageName, Name, Account.Name FROM ';
  if (soql === expected) {
    console.log(`ok    collectFields => ${soql}`);
  } else {
    failures++;
    console.log(`FAIL  collectFields\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(soql)}`);
  }
}

// parse errors carry positions
try {
  ctx.SFParser.parse('1 + ');
  failures++;
  console.log('FAIL  expected parse error for "1 + "');
} catch (e) {
  console.log(`ok    parse error: "${e.message}" at ${e.start}`);
}

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
