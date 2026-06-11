# Salesforce Formula Evaluator

A zero-dependency web app for debugging Salesforce formulas against a record.
Paste a record as JSON, paste a formula, pick the return type — and see not
just the final result but the value of **every subexpression**.

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

## Formula language support

Operators: `+ - * / ^` , `&` or `+` (text concatenation), `= <> < <= > >=`, `&& ||`,
parentheses, `/* comments */`, and literals `TRUE FALSE NULL`.

Lenient extras beyond strict Salesforce syntax: `==` / `!=` aliases and infix
`AND` / `OR` / `NOT` keywords.

~60 functions across logic (`IF`, `CASE`, `AND`, `OR`, `NOT`, `ISBLANK`,
`BLANKVALUE`, `ISPICKVAL`, …), text (`TEXT`, `VALUE`, `CONTAINS`, `BEGINS`,
`LEFT/RIGHT/MID`, `SUBSTITUTE`, `FIND`, …), math (`ROUND`, `FLOOR`, `CEILING`,
`MOD`, `MIN/MAX`, …) and dates (`TODAY`, `DATE`, `DATEVALUE`, `ADDMONTHS`,
`YEAR/MONTH/DAY`, …). The full list is shown in the app.

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
