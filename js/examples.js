// Showcase examples for the "Load example…" dropdown: one per return type in
// the standard Salesforce dialect, plus OmniStudio (managed package) ones.
// Kept DOM-free so tests/smoke.js can verify every example evaluates cleanly.
(function () {
  const standardRecord = {
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

  const omniRecord = {
    Color: 'Red',
    Price: '$1200',
    Birthdate: '1990-04-15',
    Customer: { FirstName: 'Ada', LastName: 'Lovelace' },
    Items: [
      { Name: 'Basic', Amount: 100 },
      { Name: 'Pro', Amount: 250 },
      { Name: 'Pro Max', Amount: 400 }
    ]
  };

  const items = [
    {
      label: 'Checkbox',
      mode: 'standard',
      rettype: 'Checkbox',
      record: standardRecord,
      formula: `/* Is this a hot deal? */
AND(
  Amount > 10000,
  NOT ISPICKVAL(StageName, "Closed Lost"),
  OR(ISPICKVAL(Account.Rating, "Hot"), Probability >= 75)
)`
    },
    {
      label: 'Currency',
      mode: 'standard',
      rettype: 'Currency',
      record: standardRecord,
      formula: `/* Forecasted revenue: weighted by probability, minus discount
   (Discount__c is null, so BLANKVALUE falls back to 5%) */
Amount * (Probability / 100) * (1 - BLANKVALUE(Discount__c, 0.05))`
    },
    {
      label: 'Date',
      mode: 'standard',
      rettype: 'Date',
      record: standardRecord,
      formula: `/* Next QBR: first day of the close month, pushed out a quarter */
ADDMONTHS(
  DATE(YEAR(DATEVALUE(CloseDate)), MONTH(DATEVALUE(CloseDate)), 1),
  3
)`
    },
    {
      label: 'Date/Time',
      mode: 'standard',
      rettype: 'Date/Time',
      record: standardRecord,
      formula: `/* SLA: first response due 48 hours after creation */
DATETIMEVALUE(CreatedDate) + 2`
    },
    {
      label: 'Number',
      mode: 'standard',
      rettype: 'Number',
      record: standardRecord,
      formula: `/* Days left to close (never negative) */
MAX(DATEVALUE(CloseDate) - TODAY(), 0)`
    },
    {
      label: 'Percent',
      mode: 'standard',
      rettype: 'Percent',
      record: standardRecord,
      formula: `/* Effective win probability: hot accounts get a +10 pt boost, capped at 100% */
IF(
  ISPICKVAL(Account.Rating, "Hot"),
  MIN(Probability / 100 + 0.1, 1),
  Probability / 100
)`
    },
    {
      label: 'Text',
      mode: 'standard',
      rettype: 'Text',
      record: standardRecord,
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
)`
    },
    {
      label: 'OmniStudio · Text',
      mode: 'omni',
      rettype: 'Text',
      record: omniRecord,
      formula: `/* OmniStudio dialect: CONCAT, colon paths, %MergeFields%, ~= and lists */
CONCAT(
  Customer:FirstName, " ", Customer:LastName,
  ", age ", AGE(Birthdate),
  IF(%Color% ~= "RED", ", loves red", ""),
  " - cart total $", SUM(Items:Amount),
  " across ", LISTSIZE(Items), " items"
)`
    },
    {
      label: 'OmniStudio · Number',
      mode: 'omni',
      rettype: 'Number',
      record: omniRecord,
      formula: `/* Deposit: 20% of the cart (the % operator!) plus $50 per premium item,
   plus 1% of the price parsed out of the text "$1200" (loose typing) */
SUM(Items:Amount) % 20
  + LISTSIZE(FILTER(LIST(Items), 'Amount >= 200')) * 50
  + SUBSTRING(Price, 1) / 100`
    }
  ];

  window.SFExamples = { items };
})();
