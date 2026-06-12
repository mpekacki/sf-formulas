# Salesforce Formula Evaluator

A zero-dependency web app for debugging Salesforce formulas against a record.
Paste a record as JSON, paste a formula, pick the return type — and see not
just the final result but the value of **every subexpression**.

Two dialects are supported via the **Dialect** picker:

- **Salesforce (standard)** — classic formula fields / validation rules.
- **OmniStudio (managed package)** — the expression language used in Data
  Mappers and Integration Procedures, per the "Function Reference (Managed
  Package)" help article.

## Running

Just open `index.html` in a browser. No build step, no server, no dependencies.

To run the engine smoke tests: `node tests/smoke.js`

## Features

- **Formula breakdown view** — the formula is rendered with every
  subexpression hoverable. Boolean parts are tinted green (true) / red
  (false), so for `Revenue__c > 0 OR Name == 'bar'` you can see at a glance
  that the left side of the `OR` is true and the right side is false.
  Hovering any part shows its type and computed value.
- **Evaluation tree** — every subexpression listed with its value, hover to
  cross-highlight with the formula view.
- **Chosen-branch tracking** — the branch actually picked by `IF`, `CASE`,
  `BLANKVALUE` or `NULLVALUE` is tagged "✓ chosen" in the evaluation tree and
  in the hover tooltip, so for `IF(Name == "ACME", "foo", "bar")` you can see
  which result won.
- **Return type picker** (Checkbox, Currency, Date, Date/Time, Number,
  Percent, Text) with a warning when the formula's actual type doesn't match.
- **Error pinpointing** — parse errors highlight the offending characters;
  runtime errors (unknown field, division by zero, type mismatch) mark the
  exact subexpression that failed, with ancestors dimmed.
- **Blank handling toggle** — "treat blank fields as zeroes" vs. blank-as-blank,
  mirroring the Salesforce formula option.
- **SOQL query generator** — builds `SELECT <every field the formula
  references> FROM ` (object name unknown, so it ends at `FROM`) with a copy
  button. Fields are deduped case-insensitively in order of first appearance;
  `$User`-style globals are excluded since they aren't queryable columns.
- Inputs persist in `localStorage`.
- **Built-in examples** — the "Load example…" dropdown has one showcase
  formula per return type (all sharing the same record), defined in
  `js/examples.js` and covered by the test suite.

## Formula language support

### Salesforce (standard) dialect

Operators: `+ - * / ^` , `&` or `+` (text concatenation), `= <> < <= > >=`, `&& ||`,
parentheses, `/* comments */`, and literals `TRUE FALSE NULL`.

Lenient extras beyond strict Salesforce syntax: `==` / `!=` aliases and infix
`AND` / `OR` / `NOT` keywords.

~60 functions across logic (`IF`, `CASE`, `AND`, `OR`, `NOT`, `ISBLANK`,
`BLANKVALUE`, `ISPICKVAL`, …), text (`TEXT`, `VALUE`, `CONTAINS`, `BEGINS`,
`LEFT/RIGHT/MID`, `SUBSTITUTE`, `FIND`, …), math (`ROUND`, `FLOOR`, `CEILING`,
`MOD`, `MIN/MAX`, …) and dates (`TODAY`, `DATE`, `DATEVALUE`, `ADDMONTHS`,
`YEAR/MONTH/DAY`, …). The full list is shown in the app.

### OmniStudio (managed package) dialect

Adds on top of the parser: the `%` percentage operator (`50 % 20` → 10, same
precedence as `^`, left to right), `LIKE` / `NOTLIKE` (contains) and `~=`
(case-insensitive equality) operators, `%MergeField%` references, colon field
paths (`Account:Contact:Birthdate`), backslash escapes in strings, and bare
`ROUND` direction keywords (`HALF_UP`, `CEILING`, …).

Semantics are loosely typed like the real runtime: numeric strings work in
math (`SUBSTRING("$1200", 1) / 100`), `1 == "1"` is true, and `+`
concatenates when either side is text. JSON lists and objects are first-class
values — paths map over arrays (`Items:Amount` → `[100, 250, 400]`), feeding
`SUM` / `AVG` / `MIN` / `MAX`, `LIST`, `LISTSIZE`, `FILTER` (the condition
string is parsed and evaluated per item), `SORTBY`, `LISTMERGE`,
`LISTMERGEPRIMARY` and `VALUELOOKUP`.

Other functions: `IF`, `AND` / `OR` / `NOT` (function forms — not in the
managed-package docs, but the runtime supports them), `ISBLANK`,
`ISNOTBLANK`, `CONCAT`, `SUBSTRING` (with
search-string indexes), `STRINGINDEXOF`, `MAXSTRING`, `TOSTRING`,
`SERIALIZE` / `DESERIALIZE` / `RESERIALIZE`, `BASE64ENCODE`, `BASEURL`,
`GENERATEGLOBALKEY`, `ROUND` (default 2 decimals + Java RoundingMode
directions), `ABS`, `SQRT`, and dates: `TODAY` / `NOW` (optional
SimpleDateFormat pattern), `ADDDAY` / `ADDMONTH` / `ADDYEAR`, `EOM`,
`DATEDIFF`, `AGE` / `AGEON`, `MONTH` / `YEAR`, `DATETIMETOUNIX` /
`UNIXTODATETIME`, `FORMATDATETIME` / `FORMATDATETIMEGMT` (GMT only).

Org-dependent functions (`QUERY`, `COUNTQUERY`, `FUNCTION`, `INVOKEIP`,
`ORDERITEMATTRIBUTES`) are recognized but fail with a clear "needs a live
Salesforce org" message. Time zone names in `FORMATDATETIME` other than
GMT/UTC aren't supported.

## Assumptions & limitations

- Field types are inferred from the JSON values (string → Text,
  number → Number, `true/false` → Checkbox, `null` → blank). Text that looks
  like an ISO date (`2026-07-15`) is coerced to a Date when used in a date
  context (comparisons against dates, `DATEVALUE`, `YEAR`, …).
- Cross-object references work via nested JSON objects (`Account.Name`) or a
  literal dotted key (`"Account.Name": "Acme"`). `$User`-style globals can be
  provided the same way (`"$User": { "Id": "..." }`).
- A field referenced by the formula but missing from the JSON is an error (so
  typos surface) — add it with `null` to model a blank field. A `null`
  relation (`{"Account": null}`) makes every field reached through it blank
  (`Account.IsPublic`, `Account.Parent.Name`, …), matching Salesforce's
  null-lookup behavior.
- Dates are handled in UTC; text comparison is case-sensitive (matching
  Salesforce formula semantics, unlike SOQL).
- `FLOOR`/`CEILING` round toward/away from zero like Salesforce;
  `MFLOOR`/`MCEILING` are the mathematical versions.
- Not implemented: `HYPERLINK`, `IMAGE`, `REGEX`, `VLOOKUP`,
  `PRIORVALUE`/`ISCHANGED` (no "prior" record), and multi-select picklist
  semantics for `INCLUDES`.
