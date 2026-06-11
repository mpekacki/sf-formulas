// One showcase formula per return type, all sharing the same record.
// Kept DOM-free so tests/smoke.js can verify every example evaluates cleanly.
(function () {
  const record = {
    Name: 'Acme Renewal Q3',
    StageName: 'Negotiation',
    Amount: 48500,
    Probability: 60,
    Discount__c: null,
    CloseDate: '2026-07-15',
    CreatedDate: '2026-05-30T14:30:00Z',
    Account: {
      Name: 'Acme Corp',
      Rating: 'Hot',
      Parent: null
    },
    Owner: { LastName: 'Doe' }
  };

  const formulas = {
    Checkbox: `/* Is this a hot deal? */
AND(
  Amount > 10000,
  NOT ISPICKVAL(StageName, "Closed Lost"),
  OR(ISPICKVAL(Account.Rating, "Hot"), Probability >= 75)
)`,

    Currency: `/* Forecasted revenue: weighted by probability, minus discount
   (Discount__c is null, so BLANKVALUE falls back to 5%) */
Amount * (Probability / 100) * (1 - BLANKVALUE(Discount__c, 0.05))`,

    Date: `/* Next QBR: first day of the close month, pushed out a quarter */
ADDMONTHS(
  DATE(YEAR(DATEVALUE(CloseDate)), MONTH(DATEVALUE(CloseDate)), 1),
  3
)`,

    'Date/Time': `/* SLA: first response due 48 hours after creation */
DATETIMEVALUE(CreatedDate) + 2`,

    Number: `/* Days left to close (never negative) */
MAX(DATEVALUE(CloseDate) - TODAY(), 0)`,

    Percent: `/* Effective win probability: hot accounts get a +10 pt boost, capped at 100% */
IF(
  ISPICKVAL(Account.Rating, "Hot"),
  MIN(Probability / 100 + 0.1, 1),
  Probability / 100
)`,

    Text: `/* Opportunity health check */
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
)`
  };

  window.SFExamples = { record, formulas };
})();
