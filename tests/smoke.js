// Smoke tests for the formula engine. Run with: node tests/smoke.js
// The browser files attach to `window`, so we run them in a vm context
// where window === globalThis.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['values.js', 'tokenizer.js', 'parser.js', 'functions.js', 'evaluator.js', 'omni-functions.js', 'examples.js']) {
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
  const { results, chosen } = ctx.SFEvaluator.evaluate(ast, record, opts || { blankAsZero: true });
  return { root: results.get(ast.id), ast, results, chosen };
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

// missing-fields-as-blank option (off by default, errors tested above)
const MAB = { blankAsZero: true, missingAsBlank: true };
check('ISBLANK(Nope__c)', true, MAB);
check('Nope__c > 1', false, MAB);
check('BLANKVALUE(Nope__c, 5)', 5, MAB);
check('Bogus.Email & "!"', '!', MAB); // whole missing relation is blank too
check('Nope__c + 1', null, { blankAsZero: false, missingAsBlank: true });

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

// chosen-branch tracking for IF / CASE / BLANKVALUE
{
  // Name is 'foo', so the else branch ("bar") should be chosen
  const r1 = evalRoot('IF(Name == "ACME", "foo", "bar")');
  const okIf = !r1.chosen.has(r1.ast.args[1].id) && r1.chosen.has(r1.ast.args[2].id);

  // StageName matches the first pair, so its result (the literal 1) is chosen
  const r2 = evalRoot('CASE(StageName, "Closed Won", 1, "Closed Lost", 2, 0)');
  const okCase = r2.chosen.has(r2.ast.args[2].id) && !r2.chosen.has(r2.ast.args[4].id) && !r2.chosen.has(r2.ast.args[5].id);

  // Missing__c is blank, so the fallback is chosen
  const r3 = evalRoot('BLANKVALUE(Missing__c, 5)');
  const okBlank = r3.chosen.has(r3.ast.args[1].id) && !r3.chosen.has(r3.ast.args[0].id);

  if (okIf && okCase && okBlank) {
    console.log('ok    chosen branches: IF -> else, CASE -> first match, BLANKVALUE -> fallback');
  } else {
    failures++;
    console.log(`FAIL  chosen branches (IF=${okIf}, CASE=${okCase}, BLANKVALUE=${okBlank})`);
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

// every bundled example must evaluate cleanly with the right value type
{
  const EXPECTED_TYPE = {
    Checkbox: 'boolean', Currency: 'number', Date: 'date',
    'Date/Time': 'datetime', Number: 'number', Percent: 'number', Text: 'text'
  };
  for (const ex of ctx.SFExamples.items) {
    const omni = ex.mode === 'omni';
    const ast = ctx.SFParser.parse(ex.formula, { omni });
    const { results } = ctx.SFEvaluator.evaluate(ast, ex.record, { blankAsZero: true, mode: ex.mode });
    const root = results.get(ast.id);
    if (root.error || root.value.type !== EXPECTED_TYPE[ex.rettype]) {
      failures++;
      console.log(`FAIL  example "${ex.label}"`, root.error || `wrong type ${root.value.type}`);
    } else {
      console.log(`ok    example "${ex.label}" => ${ctx.SFValues.display(root.value)}`);
    }
  }
  // The standard Text example's tail depends on TODAY(); assert the stable prefix.
  const textEx = ctx.SFExamples.items.find(e => e.label === 'Text');
  const textAst = ctx.SFParser.parse(textEx.formula);
  const textRoot = ctx.SFEvaluator.evaluate(textAst, textEx.record, { blankAsZero: true }).results.get(textAst.id);
  if (!textRoot.value.value.startsWith('[HOT] Acme Corp - $2425 discount, ')) {
    failures++;
    console.log('FAIL  Text example prefix', textRoot);
  }
}

// ---------- OmniStudio (managed package) mode ----------

const omniRecord = {
  Color: 'Red',
  Price: '$1200',
  InputDate: '1999-06-15',
  Customer: { FirstName: 'Ada', LastName: 'Lovelace' },
  Items: [
    { Name: 'Basic', Amount: 100 },
    { Name: 'Pro', Amount: 250 },
    { Name: 'Pro Max', Amount: 400 }
  ],
  Data: { Name: { FirstName: 'Thomas', MiddleName: 'Alva', LastName: 'Edison' } },
  GetGroup: 'Name',
  GetField: 'FirstName'
};

function omniCheck(formula, expected) {
  try {
    const ast = ctx.SFParser.parse(formula, { omni: true });
    const { results } = ctx.SFEvaluator.evaluate(ast, omniRecord, { blankAsZero: true, mode: 'omni' });
    const root = results.get(ast.id);
    let actual;
    if (root.error) actual = 'ERROR: ' + root.error;
    else {
      const v = root.value;
      actual = v.type === 'date' ? ctx.SFValues.fmtDate(v.value)
        : v.type === 'datetime' ? 'datetime'
        : v.type === 'null' ? null
        : v.type === 'list' ? JSON.stringify(v.value)
        : v.value;
    }
    const pass = expected === 'ERROR' ? String(actual).startsWith('ERROR') : actual === expected;
    if (!pass) {
      failures++;
      console.log(`FAIL  [omni] ${formula}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    } else {
      console.log(`ok    [omni] ${formula}  =>  ${JSON.stringify(actual)}`);
    }
  } catch (e) {
    failures++;
    console.log(`FAIL  [omni] ${formula}\n      threw ${e.message}`);
  }
}

// operators & precedence — first case is straight from the Salesforce docs
omniCheck('"ABC" LIKE "B" && 44 - 5 * 2 ^ 3 == 4', true);
omniCheck('50 % 20', 10);
omniCheck('2 ^ 3 % 100', 8); // ^ and % same level, left to right: (2^3) % 100
omniCheck('"ABC" ~= "abc"', true);
omniCheck('"ABC" NOTLIKE "A"', false);
omniCheck('1 == "1"', true); // loose typing
omniCheck('InputDate < "2000-01-01"', true); // text dates compare as dates

// AND()/OR()/NOT() function forms (not in the docs, but the runtime has them)
omniCheck('AND(Color == "Red", SUM(Items:Amount) > 500)', true);
omniCheck('AND(Color == "Red", SUM(Items:Amount) > 999)', false);
omniCheck('OR(Color == "Blue", "ABC" LIKE "B")', true);
omniCheck('OR(false, Bogus > 1)', 'ERROR'); // no true arg, so the error surfaces
omniCheck('OR(true, Bogus > 1)', true); // short-circuits past the error
omniCheck('NOT(Color ~= "RED")', false);

// merge fields & colon paths
omniCheck('IF(%Color% == "Red", "Black", %Color%)', 'Black');
omniCheck('Customer:FirstName', 'Ada');
omniCheck('SUM(Items:Amount)', 750); // arrays map over the path

// lists
omniCheck('AVG(1,2,3,4,5,6,7,8,9,10)', 5.5);
omniCheck('MAX(Items:Amount)', 400);
omniCheck('LISTSIZE(Items)', 3);
omniCheck("LISTSIZE(FILTER(LIST(Items), 'Amount >= 200'))", 2);
omniCheck('ISBLANK(FILTER(LIST(Items), \'Amount > 999\'))', true);
omniCheck('LISTSIZE(LIST(DESERIALIZE("[{\\"k\\":1},{\\"k\\":2}]")))', 2);
omniCheck('VALUELOOKUP(Data, GetGroup, GetField)', 'Thomas');

// strings & loose typing
omniCheck('CONCAT("a", NULL, 1, "b")', 'a1b');
omniCheck('SUBSTRING("The quick brown fox jumped over the lazy dog.", "q", "n")', 'quick brow');
omniCheck('SUBSTRING(Price, 1) % 20', 240); // "$1200" -> "1200" -> number
omniCheck('STRINGINDEXOF("This is the test String","test")', 12);
omniCheck('MAXSTRING("Amy","Ziggy")', 'Ziggy');

// rounding
omniCheck('ROUND(3.1415 * 3)', 9.42); // default precision is 2
omniCheck('ROUND(2.575, 2, HALF_UP)', 2.58);
omniCheck('ROUND(2.575, 2, HALF_DOWN)', 2.57);
omniCheck('ROUND(2.572, 0, CEILING)', 3);
omniCheck('ROUND(2.572, 0, FLOOR)', 2);

// dates
omniCheck('DATEDIFF("1900-01-01","2000-01-01")', 36524);
omniCheck('DATEDIFF("2000-01-01","1999-01-01")', -365);
omniCheck('AGEON("1990-04-15", "2024-07-09")', 34);
omniCheck('FORMATDATETIME(ADDDAY("1999-01-01",100), "yyyy-MM-dd")', '1999-04-11');
omniCheck('FORMATDATETIME(EOM("2026-02-10"), "yyyy-MM-dd")', '2026-02-28');
omniCheck('YEAR("1999-01-11")', 1999);
omniCheck('MONTH("1999-01-11")', 1);
omniCheck("DATETIMETOUNIX('11/30/2016 07:15:34')", 1480490134000);

// org-dependent functions fail with a clear message
omniCheck('QUERY("SELECT Id FROM Account")', 'ERROR');

// standard-mode functions aren't leaked into omni mode
omniCheck('ISPICKVAL(Color, "Red")', 'ERROR');

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
