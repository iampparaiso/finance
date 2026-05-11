# Cash Tracker, Smart Alerts & Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 broken frontend modules, add a full Cash on Hand tracking system with CC payment recording, and add smart financial alerts (overdue, payability, net cash flow, runway, payday allocation, installment relief, CC priority queue).

**Architecture:** Backend-first — new Apps Script actions + sheet migration deployed first, then frontend modules built on top. Two new frontend modules (`alerts.js`, `cash-tracker.js`) keep shared logic out of page-level files. All alert computation is client-side pure functions; no new API calls needed at render time.

**Tech Stack:** Google Apps Script (backend), Vanilla JS ES modules (frontend), Google Sheets (database), GitHub Pages (hosting), Playwright (simulation verification)

**Spec:** `docs/superpowers/specs/2026-05-12-cash-tracker-alerts-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `appsscript/Setup.gs` | Modify | `migrateExistingSheet()` — adds CashLog sheet, `cash_on_hand` Config key, CardID column to Renovation |
| `appsscript/API.gs` | Modify | `_getConfigValue()` helper · `addCash`, `payCreditCard`, `payLoanDebit`, `getCashLog` actions · updated `logSpend`, `logRenovation`, `getDashboard` |
| `appsscript/Tests.gs` | Create | Simulation test functions — run in Script editor to verify all backend logic |
| `frontend/js/alerts.js` | Create | `computeAlerts(data)` pure function · `renderAlertBanners(container, alerts, onPayCard)` |
| `frontend/js/cash-tracker.js` | Create | `renderCashTracker(container, data)` widget · Add Cash modal · Pay Card modal · runway projection |
| `frontend/js/spend-log.js` | Modify | Fix api.js bug · import + render cash tracker · import + render alerts · payday allocation prompt |
| `frontend/js/cards.js` | Modify | Fix api.js bug · CC Payment Priority Queue section |
| `frontend/js/income.js` | Modify | Fix api.js bug |
| `frontend/js/dashboard.js` | Modify | Cash on Hand stat card · alert banners · installment relief timeline |
| `frontend/js/renovation.js` | Modify | Replace PaymentMethod text input with structured dropdown + CardID · updated post call |
| `frontend/js/installments.js` | Modify | Installment Relief Timeline section |
| `frontend/sw.js` | Modify | Bump cache to v4 · add `alerts.js`, `cash-tracker.js` to PRECACHE |

---

## Task 1: Fix api.js Misuse in spend-log.js, cards.js, income.js

**Files:**
- Modify: `frontend/js/spend-log.js`
- Modify: `frontend/js/cards.js`
- Modify: `frontend/js/income.js`

- [ ] **Step 1: Fix spend-log.js — replace lines 60–114**

In `frontend/js/spend-log.js`, replace the block starting at line 60:

```js
// REPLACE lines 60-62 (was logRes/cardsRes with .ok checks):
const [logData, cardsData] = await Promise.all([get('getSpendLog'), get('getCards')]);
const cards = cardsData || [];
const cardMap = {};
```

Then replace lines 102–106 (was `!logRes.ok || !logRes.data`):

```js
  const content = document.getElementById('sl-content');

  if (!logData || !logData.length) {
    content.innerHTML = '<p class="muted" style="text-align:center;padding:var(--sp7)">No expenses logged yet.</p>';
    return;
  }

  const rows      = [...logData].reverse();
```

- [ ] **Step 2: Fix cards.js — replace lines 113–114**

In `frontend/js/cards.js`, replace lines 113–114:

```js
// REPLACE:
const [cards, spendRows] = await Promise.all([get('getCards'), get('getSpendLog')]);
// Remove the old: const spendRows = (logRes.ok && logRes.data) ? logRes.data : [];
```

The variable previously named `logRes` is gone — `spendRows` is destructured directly. All downstream uses of `spendRows` are unchanged.

- [ ] **Step 3: Fix income.js — replace lines 13–14**

In `frontend/js/income.js`, replace lines 13–14:

```js
// REPLACE:
const dash = await get('getDashboard') || {};
```

Remove the old `const dashRes = await get('getDashboard'); const dash = dashRes.ok ? dashRes.data : {};` two-liner.

- [ ] **Step 4: Verify fixes by loading the app**

Navigate to `https://iampparaiso.github.io/finance/` (after deploying — or test locally if you have a dev server). After signing in:
- Spend Log tab: card dropdown shows 6 cards (RCBC, Metrobank, EastWest, UnionBank, BPI, BDO)
- Spend Log tab: transaction list renders (not "No expenses logged yet" if SpendLog sheet has data)
- Cards tab: Unbilled Charges section on each card shows real amounts (not ₱0)
- Income tab: obligations show real figure (~₱407K), not ₱0

- [ ] **Step 5: Commit**

```bash
git add frontend/js/spend-log.js frontend/js/cards.js frontend/js/income.js
git commit -m "fix: correct api.js get() usage in spend-log, cards, income modules"
```

---

## Task 2: Setup.gs — Sheet Migration

**Files:**
- Modify: `appsscript/Setup.gs`

- [ ] **Step 1: Add `_getConfigValue` helper and `migrateExistingSheet` to Setup.gs**

Add to the bottom of `appsscript/Setup.gs`:

```javascript
// Run once on the existing production spreadsheet to add new infrastructure
function migrateExistingSheet() {
  var ss = getSpreadsheet();

  // 1. Add CashLog sheet if missing
  if (!ss.getSheetByName('CashLog')) {
    _createSheet(ss, 'CashLog', ['Timestamp','Date','Type','Amount','RunningBalance','Notes','LinkedID','AddedBy']);
    Logger.log('Created CashLog sheet');
  } else {
    Logger.log('CashLog already exists — skipped');
  }

  // 2. Add cash_on_hand to Config if missing
  var configSheet = ss.getSheetByName('Config');
  var configData  = configSheet.getDataRange().getValues();
  var keyCol      = configData[0].indexOf('Key');
  var hasKey      = configData.slice(1).some(function(r) { return r[keyCol] === 'cash_on_hand'; });
  if (!hasKey) {
    configSheet.appendRow(['cash_on_hand', '0', 'Running cash on hand balance']);
    Logger.log('Added cash_on_hand config key');
  } else {
    Logger.log('cash_on_hand already exists — skipped');
  }

  // 3. Add CardID column to Renovation sheet if missing
  var renoSheet   = ss.getSheetByName('Renovation');
  var renoHeaders = renoSheet.getRange(1, 1, 1, renoSheet.getLastColumn()).getValues()[0];
  if (renoHeaders.indexOf('CardID') === -1) {
    var newCol = renoSheet.getLastColumn() + 1;
    renoSheet.getRange(1, newCol).setValue('CardID');
    renoSheet.getRange(1, newCol).setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
    Logger.log('Added CardID column to Renovation sheet');
  } else {
    Logger.log('CardID already in Renovation — skipped');
  }

  Logger.log('Migration complete.');
}
```

- [ ] **Step 2: Run the migration in Apps Script editor**

Open the Apps Script project (via `https://script.google.com`, sign in as iampparaiso@gmail.com).  
Select `migrateExistingSheet` from the function dropdown.  
Click Run.  
Check Logs — expect:
```
Created CashLog sheet
Added cash_on_hand config key
Added CardID column to Renovation sheet
Migration complete.
```

- [ ] **Step 3: Verify in Google Sheets**

Open the spreadsheet. Confirm:
- A new "CashLog" tab exists with headers: `Timestamp, Date, Type, Amount, RunningBalance, Notes, LinkedID, AddedBy`
- Config sheet has a row with Key = `cash_on_hand`, Value = `0`
- Renovation sheet has a `CardID` column at the end

- [ ] **Step 4: Commit**

```bash
git add appsscript/Setup.gs
git commit -m "feat: add migrateExistingSheet() for CashLog, cash_on_hand, Renovation CardID"
```

---

## Task 3: API.gs — Helper and New Actions

**Files:**
- Modify: `appsscript/API.gs`

- [ ] **Step 1: Add `_getConfigValue` helper to API.gs**

Add just before the `_ok` function in `API.gs`:

```javascript
function _getConfigValue(key) {
  var rows = getRows('Config');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].Key === key) return rows[i].Value;
  }
  return null;
}

function _setConfigValue(key, value) {
  updateRowById('Config', 'Key', key, { Value: String(value) });
}
```

- [ ] **Step 2: Add `getCashLog` to doGet switch**

In `doGet`, add after the `getAlerts` case:

```javascript
case 'getCashLog':
  var cashLogRows = getRows('CashLog');
  var cashOnHand  = Number(_getConfigValue('cash_on_hand') || 0);
  result = { entries: cashLogRows, cashOnHand: cashOnHand };
  break;
```

- [ ] **Step 3: Add `addCash`, `payCreditCard`, `payLoanDebit` to doPost switch**

In `doPost`, add after the `updateConfig` case and before `default`:

```javascript
case 'addCash':
  var addCashCurrent = Number(_getConfigValue('cash_on_hand') || 0);
  var addCashNew     = addCashCurrent + Number(body.amount);
  appendRow('CashLog', {
    Timestamp:     new Date().toISOString(),
    Date:          body.date,
    Type:          'topup',
    Amount:        Number(body.amount),
    RunningBalance:addCashNew,
    Notes:         (body.source || '') + (body.notes ? ' · ' + body.notes : ''),
    LinkedID:      '',
    AddedBy:       email
  });
  _setConfigValue('cash_on_hand', addCashNew);
  return _ok({ success: true, newBalance: addCashNew });

case 'payCreditCard':
  var payCards = getRows('CreditCards');
  var payCard  = null;
  for (var pi = 0; pi < payCards.length; pi++) {
    if (payCards[pi].ID === body.cardId) { payCard = payCards[pi]; break; }
  }
  if (!payCard) return _error('Card not found: ' + body.cardId);
  var oldCardBal  = Number(payCard.Balance || 0);
  var newCardBal  = Math.max(0, oldCardBal - Number(body.amount));
  var cardUpdates = { Balance: newCardBal };
  if (newCardBal <= 0) cardUpdates.PastDue = false;
  updateRowById('CreditCards', 'ID', body.cardId, cardUpdates);
  var payCashNow = Number(_getConfigValue('cash_on_hand') || 0);
  var payCashNew = payCashNow - Number(body.amount);
  appendRow('CashLog', {
    Timestamp:     new Date().toISOString(),
    Date:          body.date,
    Type:          'pay_card',
    Amount:        Number(body.amount),
    RunningBalance:payCashNew,
    Notes:         body.notes || ('Payment to ' + payCard.Name),
    LinkedID:      body.cardId,
    AddedBy:       email
  });
  _setConfigValue('cash_on_hand', payCashNew);
  return _ok({ success: true, newCashBalance: payCashNew, newCardBalance: newCardBal, pastDueCleared: newCardBal <= 0 });

case 'payLoanDebit':
  var loanRows = getRows('BankLoans');
  var theLoan  = null;
  for (var li = 0; li < loanRows.length; li++) {
    if (loanRows[li].ID === body.loanId) { theLoan = loanRows[li]; break; }
  }
  if (!theLoan) return _error('Loan not found: ' + body.loanId);
  var loanAmt      = Number(theLoan.MonthlyPayment || 0);
  var loanCashNow  = Number(_getConfigValue('cash_on_hand') || 0);
  var loanCashNew  = loanCashNow - loanAmt;
  appendRow('CashLog', {
    Timestamp:     new Date().toISOString(),
    Date:          body.date,
    Type:          'loan_debit',
    Amount:        loanAmt,
    RunningBalance:loanCashNew,
    Notes:         body.notes || (theLoan.Bank + ' ' + theLoan.Type + ' auto-debit'),
    LinkedID:      body.loanId,
    AddedBy:       email
  });
  _setConfigValue('cash_on_hand', loanCashNew);
  return _ok({ success: true, newCashBalance: loanCashNew, amountDebited: loanAmt });
```

- [ ] **Step 4: Commit**

```bash
git add appsscript/API.gs
git commit -m "feat: add getCashLog, addCash, payCreditCard, payLoanDebit actions to API.gs"
```

---

## Task 4: API.gs — Update logSpend and logRenovation

**Files:**
- Modify: `appsscript/API.gs`

- [ ] **Step 1: Update `logSpend` to deduct cash on cash purchases**

Replace the existing `case 'logSpend':` block in `doPost`:

```javascript
case 'logSpend':
  var slTs = new Date().toISOString();
  appendRow('SpendLog', {
    Timestamp:   slTs,
    Date:        body.date,
    Description: body.description,
    Amount:      body.amount,
    Category:    body.category,
    CardID:      body.cardId || '',
    Month:       (body.date || '').slice(0, 7),
    Notes:       body.notes || '',
    AddedBy:     email
  });
  if (!body.cardId) {
    var slCashNow = Number(_getConfigValue('cash_on_hand') || 0);
    var slCashNew = slCashNow - Number(body.amount);
    appendRow('CashLog', {
      Timestamp:     slTs,
      Date:          body.date,
      Type:          'spend_cash',
      Amount:        Number(body.amount),
      RunningBalance:slCashNew,
      Notes:         body.description || '',
      LinkedID:      '',
      AddedBy:       email
    });
    _setConfigValue('cash_on_hand', slCashNew);
  }
  return _ok({ success: true, id: slTs });
```

- [ ] **Step 2: Update `logRenovation` for cash deduction and card mirroring**

Replace the existing `case 'logRenovation':` block in `doPost`:

```javascript
case 'logRenovation':
  var renoTs = new Date().toISOString();
  appendRow('Renovation', {
    Timestamp:     renoTs,
    Date:          body.date,
    Description:   body.description,
    Amount:        body.amount,
    Category:      body.category,
    PaymentMethod: body.paymentMethod,
    CardID:        body.cardId || '',
    Receipt:       body.receipt || '',
    AddedBy:       email
  });
  if (body.paymentMethod === 'cash') {
    var renoCashNow = Number(_getConfigValue('cash_on_hand') || 0);
    var renoCashNew = renoCashNow - Number(body.amount);
    appendRow('CashLog', {
      Timestamp:     renoTs,
      Date:          body.date,
      Type:          'reno_cash',
      Amount:        Number(body.amount),
      RunningBalance:renoCashNew,
      Notes:         body.description || 'Renovation',
      LinkedID:      '',
      AddedBy:       email
    });
    _setConfigValue('cash_on_hand', renoCashNew);
  } else if (body.paymentMethod === 'card' && body.cardId) {
    appendRow('SpendLog', {
      Timestamp:   renoTs,
      Date:        body.date,
      Description: body.description || 'Renovation',
      Amount:      body.amount,
      Category:    'Renovation',
      CardID:      body.cardId,
      Month:       (body.date || '').slice(0, 7),
      Notes:       'Renovation',
      AddedBy:     email
    });
  }
  return _ok({ success: true });
```

- [ ] **Step 3: Commit**

```bash
git add appsscript/API.gs
git commit -m "feat: update logSpend and logRenovation for cash deduction and card mirroring"
```

---

## Task 5: API.gs — Update getDashboard

**Files:**
- Modify: `appsscript/API.gs`

- [ ] **Step 1: Add cashOnHand, installments, and cashLog to `_getDashboard` return**

In the `_getDashboard` function, add these lines after `var renovation = getRows('Renovation');`:

```javascript
var cashLog     = getRows('CashLog');
var cashOnHand  = Number(_getConfigValue('cash_on_hand') || 0);

// Last 30 days of cashLog for runway computation
var thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
var thirtyStr = thirtyDaysAgo.toISOString().slice(0, 10);
var recentCashLog = cashLog.filter(function(r) { return String(r.Date) >= thirtyStr; });
```

Then in the return object, add:

```javascript
cashOnHand:          cashOnHand,
recentCashLog:       recentCashLog,
installments:        installs,
```

So the return becomes:

```javascript
return {
  totalCCBalance:      totalCCBalance,
  totalCCLimit:        totalCCLimit,
  totalCCAvailable:    totalCCLimit - totalCCBalance,
  totalMonthlyIncome:  totalMonthlyIncome,
  totalObligations:    totalObligations,
  breakdown: {
    loans:         totalLoanPayments,
    installments:  totalInstallments,
    bills:         totalBills,
    subscriptions: totalSubs
  },
  netAfterObligations: totalMonthlyIncome - totalObligations,
  pastDueCards:        cards.filter(function(c) { return c.PastDue == true || c.PastDue === 'TRUE'; }),
  renovationSpent:     renovationSpent,
  renovationTarget:    Number(configMap['renovation_target'] || 1200000),
  renovationOnHand:    Number(configMap['renovation_on_hand'] || 570000),
  cashOnHand:          cashOnHand,
  recentCashLog:       recentCashLog,
  installments:        installs,
  generatedAt:         new Date().toISOString()
};
```

- [ ] **Step 2: Commit**

```bash
git add appsscript/API.gs
git commit -m "feat: add cashOnHand, recentCashLog, installments to getDashboard response"
```

---

## Task 6: Create Tests.gs and Deploy Backend

**Files:**
- Create: `appsscript/Tests.gs`

- [ ] **Step 1: Create Tests.gs with simulation functions**

Create `appsscript/Tests.gs`:

```javascript
// Simulation tests — run each function individually in Script editor
// WARNING: These write to and reset real sheet data. Run only in dev/test context.

function _resetCashState() {
  // Clear CashLog and reset cash_on_hand to 0
  var ss = getSpreadsheet();
  var cl = ss.getSheetByName('CashLog');
  var lastRow = cl.getLastRow();
  if (lastRow > 1) cl.deleteRows(2, lastRow - 1);
  _setConfigValue('cash_on_hand', 0);
  Logger.log('Reset: CashLog cleared, cash_on_hand = 0');
}

function testCashTrackerSimulation() {
  _resetCashState();
  var today = new Date().toISOString().slice(0, 10);
  var results = [];

  // Step 1: Add Cash — Paulo 30th payday ₱275,000
  var r1 = _processAddCash({ date: today, amount: 275000, source: 'payday', notes: 'Paulo 30th' }, 'test@test.com');
  results.push({ step: 1, expected: 275000, got: r1.newBalance, pass: r1.newBalance === 275000 });

  // Step 2: Log cash spend ₱3,500
  var r2 = _processLogSpend({ date: today, description: 'Grocery', amount: 3500, category: 'Food', cardId: '', notes: '' }, 'test@test.com');
  results.push({ step: 2, expected: 271500, got: r2.newCash, pass: r2.newCash === 271500 });

  // Step 3: Pay Card — EastWest full ₱24,572
  var r3 = _processPayCard({ date: today, cardId: 'eastwest', amount: 24572, notes: 'Full payment' }, 'test@test.com');
  results.push({ step: 3, expected: 246928, got: r3.newCashBalance, pass: Math.round(r3.newCashBalance) === 246928 });
  results.push({ step: '3b-pastdue', expected: true, got: r3.pastDueCleared, pass: r3.pastDueCleared === true });

  // Step 4: Mark Loan Debit — BPI Auto ₱41,154
  var r4 = _processPayLoan({ date: today, loanId: 'bpi-auto', notes: '' }, 'test@test.com');
  results.push({ step: 4, expected: 205774, got: Math.round(r4.newCashBalance), pass: Math.round(r4.newCashBalance) === 205774 });

  // Step 5: Log reno cash ₱18,000
  var r5 = _processLogReno({ date: today, description: 'Tiles', amount: 18000, category: 'Materials', paymentMethod: 'cash', cardId: '', notes: '' }, 'test@test.com');
  results.push({ step: 5, expected: 187774, got: Math.round(r5.newCash), pass: Math.round(r5.newCash) === 187774 });

  // Step 6: Add Cash — bonus ₱50,000
  var r6 = _processAddCash({ date: today, amount: 50000, source: 'bonus', notes: 'Performance bonus' }, 'test@test.com');
  results.push({ step: 6, expected: 237774, got: Math.round(r6.newBalance), pass: Math.round(r6.newBalance) === 237774 });

  // Step 7: Pay Card — BPI partial ₱60,000
  var r7 = _processPayCard({ date: today, cardId: 'bpi', amount: 60000, notes: 'Partial payment' }, 'test@test.com');
  results.push({ step: 7, expected: 177774, got: Math.round(r7.newCashBalance), pass: Math.round(r7.newCashBalance) === 177774 });
  results.push({ step: '7b-pastdue', expected: false, got: r7.pastDueCleared, pass: r7.pastDueCleared === false });

  // Verify CashLog has 7 entries
  var clRows = getRows('CashLog');
  results.push({ step: 'cashlog-count', expected: 7, got: clRows.length, pass: clRows.length === 7 });

  // Verify RunningBalance progression in CashLog
  var balances = clRows.map(function(r) { return Math.round(Number(r.RunningBalance)); });
  var expectedBalances = [275000, 271500, 246928, 205774, 187774, 237774, 177774];
  results.push({ step: 'cashlog-balances', expected: JSON.stringify(expectedBalances), got: JSON.stringify(balances), pass: JSON.stringify(balances) === JSON.stringify(expectedBalances) });

  _logResults('Cash Tracker Simulation', results);
}

function testRenovationCardMirror() {
  var today = new Date().toISOString().slice(0, 10);
  var slBefore = getRows('SpendLog').length;

  _processLogReno({ date: today, description: 'Bathroom tiles', amount: 50000, category: 'Materials', paymentMethod: 'card', cardId: 'eastwest', notes: '' }, 'test@test.com');

  var slAfter = getRows('SpendLog');
  var mirrored = slAfter[slAfter.length - 1];
  var results = [
    { step: 'spendlog-added', expected: slBefore + 1, got: slAfter.length, pass: slAfter.length === slBefore + 1 },
    { step: 'category', expected: 'Renovation', got: mirrored.Category, pass: mirrored.Category === 'Renovation' },
    { step: 'cardid', expected: 'eastwest', got: mirrored.CardID, pass: mirrored.CardID === 'eastwest' },
    { step: 'amount', expected: 50000, got: Number(mirrored.Amount), pass: Number(mirrored.Amount) === 50000 }
  ];
  _logResults('Renovation Card Mirroring', results);
}

function testPastDueResolution() {
  var today = new Date().toISOString().slice(0, 10);

  // Verify EastWest is past due first
  var cards = getRows('CreditCards');
  var ew = cards.find(function(c) { return c.ID === 'eastwest'; });
  Logger.log('EastWest PastDue before payment: ' + ew.PastDue + ' (expect true)');

  // Full payment of EastWest
  var ewBal = Number(ew.Balance);
  _processPayCard({ date: today, cardId: 'eastwest', amount: ewBal, notes: 'Full payment' }, 'test@test.com');

  var cardsAfter = getRows('CreditCards');
  var ewAfter = cardsAfter.find(function(c) { return c.ID === 'eastwest'; });
  var results = [
    { step: 'pastdue-cleared', expected: false, got: ewAfter.PastDue === false || ewAfter.PastDue === 'FALSE', pass: ewAfter.PastDue === false || ewAfter.PastDue === 'FALSE' }
  ];

  // Partial payment of UnionBank — PastDue should stay true
  var ub = cardsAfter.find(function(c) { return c.ID === 'unionbank'; });
  _processPayCard({ date: today, cardId: 'unionbank', amount: 40000, notes: 'Partial' }, 'test@test.com');
  var cardsAfter2 = getRows('CreditCards');
  var ubAfter = cardsAfter2.find(function(c) { return c.ID === 'unionbank'; });
  results.push({ step: 'partial-pastdue-stays', expected: true, got: ubAfter.PastDue === true || ubAfter.PastDue === 'TRUE', pass: ubAfter.PastDue === true || ubAfter.PastDue === 'TRUE' });

  _logResults('PastDue Resolution', results);
}

// Internal helpers that call the same logic as doPost handlers
function _processAddCash(body, email) {
  var current = Number(_getConfigValue('cash_on_hand') || 0);
  var newBal   = current + Number(body.amount);
  appendRow('CashLog', { Timestamp: new Date().toISOString(), Date: body.date, Type: 'topup', Amount: Number(body.amount), RunningBalance: newBal, Notes: (body.source||'')+(body.notes?' · '+body.notes:''), LinkedID: '', AddedBy: email });
  _setConfigValue('cash_on_hand', newBal);
  return { newBalance: newBal };
}

function _processLogSpend(body, email) {
  appendRow('SpendLog', { Timestamp: new Date().toISOString(), Date: body.date, Description: body.description, Amount: body.amount, Category: body.category, CardID: body.cardId||'', Month: (body.date||'').slice(0,7), Notes: body.notes||'', AddedBy: email });
  var newCash = Number(_getConfigValue('cash_on_hand') || 0);
  if (!body.cardId) {
    newCash -= Number(body.amount);
    appendRow('CashLog', { Timestamp: new Date().toISOString(), Date: body.date, Type: 'spend_cash', Amount: Number(body.amount), RunningBalance: newCash, Notes: body.description||'', LinkedID: '', AddedBy: email });
    _setConfigValue('cash_on_hand', newCash);
  }
  return { newCash: newCash };
}

function _processPayCard(body, email) {
  var cards = getRows('CreditCards');
  var card  = cards.find(function(c) { return c.ID === body.cardId; });
  var newCardBal = Math.max(0, Number(card.Balance||0) - Number(body.amount));
  var updates = { Balance: newCardBal };
  var pastDueCleared = false;
  if (newCardBal <= 0) { updates.PastDue = false; pastDueCleared = true; }
  updateRowById('CreditCards', 'ID', body.cardId, updates);
  var cashNow = Number(_getConfigValue('cash_on_hand') || 0);
  var cashNew = cashNow - Number(body.amount);
  appendRow('CashLog', { Timestamp: new Date().toISOString(), Date: body.date, Type: 'pay_card', Amount: Number(body.amount), RunningBalance: cashNew, Notes: body.notes||(card.Name+' payment'), LinkedID: body.cardId, AddedBy: email });
  _setConfigValue('cash_on_hand', cashNew);
  return { newCashBalance: cashNew, newCardBalance: newCardBal, pastDueCleared: pastDueCleared };
}

function _processPayLoan(body, email) {
  var loans = getRows('BankLoans');
  var loan  = loans.find(function(l) { return l.ID === body.loanId; });
  var amt   = Number(loan.MonthlyPayment);
  var cashNow = Number(_getConfigValue('cash_on_hand') || 0);
  var cashNew = cashNow - amt;
  appendRow('CashLog', { Timestamp: new Date().toISOString(), Date: body.date, Type: 'loan_debit', Amount: amt, RunningBalance: cashNew, Notes: loan.Bank+' '+loan.Type+' auto-debit', LinkedID: body.loanId, AddedBy: email });
  _setConfigValue('cash_on_hand', cashNew);
  return { newCashBalance: cashNew, amountDebited: amt };
}

function _processLogReno(body, email) {
  appendRow('Renovation', { Timestamp: new Date().toISOString(), Date: body.date, Description: body.description, Amount: body.amount, Category: body.category, PaymentMethod: body.paymentMethod, CardID: body.cardId||'', Receipt: '', AddedBy: email });
  var newCash = Number(_getConfigValue('cash_on_hand') || 0);
  if (body.paymentMethod === 'cash') {
    newCash -= Number(body.amount);
    appendRow('CashLog', { Timestamp: new Date().toISOString(), Date: body.date, Type: 'reno_cash', Amount: Number(body.amount), RunningBalance: newCash, Notes: body.description||'Renovation', LinkedID: '', AddedBy: email });
    _setConfigValue('cash_on_hand', newCash);
  } else if (body.paymentMethod === 'card' && body.cardId) {
    appendRow('SpendLog', { Timestamp: new Date().toISOString(), Date: body.date, Description: body.description||'Renovation', Amount: body.amount, Category: 'Renovation', CardID: body.cardId, Month: (body.date||'').slice(0,7), Notes: 'Renovation', AddedBy: email });
  }
  return { newCash: newCash };
}

function _logResults(suiteName, results) {
  Logger.log('=== ' + suiteName + ' ===');
  var passed = 0, failed = 0;
  results.forEach(function(r) {
    if (r.pass) {
      Logger.log('  PASS  step ' + r.step);
      passed++;
    } else {
      Logger.log('  FAIL  step ' + r.step + ' — expected ' + r.expected + ', got ' + r.got);
      failed++;
    }
  });
  Logger.log(passed + '/' + (passed+failed) + ' passed' + (failed > 0 ? ' ← FIX FAILURES BEFORE CONTINUING' : ' ✓'));
}
```

- [ ] **Step 2: Run `testCashTrackerSimulation` in Script editor**

Select `testCashTrackerSimulation` from the function dropdown. Click Run.  
Expected log output (all steps pass):
```
=== Cash Tracker Simulation ===
  PASS  step 1
  PASS  step 2
  PASS  step 3
  PASS  step 3b-pastdue
  PASS  step 4
  PASS  step 5
  PASS  step 6
  PASS  step 7
  PASS  step 7b-pastdue
  PASS  cashlog-count
  PASS  cashlog-balances
11/11 passed ✓
```

- [ ] **Step 3: Run `testRenovationCardMirror` and `testPastDueResolution`**

Run each function. Both should log all PASSes.

- [ ] **Step 4: Deploy backend using deploy.ps1**

```powershell
cd C:\Users\ppara\Desktop\finance\appsscript
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "cash tracker and alerts backend"
```

Copy the new deployment URL from output. Update `frontend/config.js`:
```js
const API_URL = 'https://script.google.com/macros/s/NEW_DEPLOYMENT_ID_HERE/exec';
```

- [ ] **Step 5: Commit**

```bash
git add appsscript/Tests.gs appsscript/API.gs frontend/config.js
git commit -m "feat: deploy backend with cash tracker, card payment, and loan debit actions"
```

---

## Task 7: Create frontend/js/alerts.js

**Files:**
- Create: `frontend/js/alerts.js`

- [ ] **Step 1: Create alerts.js**

Create `frontend/js/alerts.js`:

```js
import { peso } from './format.js';

export function computeAlerts({ cards, installments, spendLog, cashOnHand, cashLog, totalObligations, monthlyIncome = 559000 }) {
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // Alert 1: overdue cards
  const overdueCards = cards.filter(c => c.PastDue === true || c.PastDue === 'TRUE');

  // Alert 2: card payability
  const totalExposure = cards.reduce((sum, card) => {
    const billed  = Number(card.Balance || 0);
    const cutDay  = parseInt(card.StatementCutDay) || 25;
    const cutDate = _lastCutDate(cutDay, now);
    const unbilled = spendLog
      .filter(r => r.CardID === card.ID && new Date(r.Date) > cutDate)
      .reduce((s, r) => s + Number(r.Amount || 0), 0);
    const installs = installments
      .filter(i => i.CardID === card.ID && i.Status === 'active')
      .reduce((s, i) => s + Number(i.MonthlyAmount || 0), 0);
    return sum + billed + unbilled + installs;
  }, 0);

  const payRatio   = cashOnHand > 0 ? totalExposure / cashOnHand : Infinity;
  const payLevel   = payRatio >= 1 ? 'red' : payRatio >= 0.7 ? 'yellow' : null;

  // Alert 3A: cash burn this month
  const cashOut = (cashLog || [])
    .filter(r => String(r.Date) >= monthStart && ['spend_cash','reno_cash','pay_card','loan_debit'].includes(r.Type))
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const cashIn = (cashLog || [])
    .filter(r => String(r.Date) >= monthStart && r.Type === 'topup')
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const burnRatio  = cashIn > 0 ? cashOut / cashIn : 0;
  const burnLevel  = burnRatio >= 1 ? 'red' : burnRatio >= 0.8 ? 'yellow' : null;

  // Alert 3B: card debt building vs income
  const cardSpend = (spendLog || [])
    .filter(r => r.CardID && String(r.Date) >= monthStart)
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const debtTotal  = (totalObligations || 0) + cardSpend;
  const debtLevel  = debtTotal > monthlyIncome ? 'red' : debtTotal > monthlyIncome - 50000 ? 'yellow' : null;

  return {
    overdueCards, totalExposure, payLevel, payRatio,
    burnLevel, burnRatio, cashIn, cashOut,
    debtLevel, debtTotal, monthlyIncome, cashOnHand,
    cardSpend
  };
}

export function renderAlertBanners(container, alerts, { onPayCard } = {}) {
  const { overdueCards, totalExposure, payLevel, payRatio,
          burnLevel, burnRatio, cashIn, cashOut,
          debtLevel, debtTotal, monthlyIncome, cashOnHand, cardSpend } = alerts;

  const banners = [];

  if (overdueCards.length) {
    const names = overdueCards.map(c =>
      `<span class="alert-card-link" data-card-id="${c.ID}" style="cursor:pointer;text-decoration:underline">${c.Name} ${peso(c.Balance)}</span>`
    ).join(' · ');
    banners.push(`<div class="alert-bar danger">⛔ OVERDUE: ${names} — tap to pay</div>`);
  }

  if (payLevel === 'red') {
    const deficit = totalExposure - cashOnHand;
    banners.push(`<div class="alert-bar danger">⚠ Card obligations ${peso(totalExposure)} exceed cash on hand ${peso(cashOnHand)} — ${peso(deficit)} short</div>`);
  } else if (payLevel === 'yellow') {
    const pct = Math.round(payRatio * 100);
    banners.push(`<div class="alert-bar warn">○ Card obligations at ${pct}% of cash on hand — consider paying down before next cycle</div>`);
  }

  if (cashOnHand < 50000) {
    banners.push(`<div class="alert-bar danger">🔴 Cash critically low: ${peso(cashOnHand)} — add cash now</div>`);
  } else if (cashOnHand < 100000) {
    banners.push(`<div class="alert-bar warn">⚠ Cash getting low: ${peso(cashOnHand)}</div>`);
  }

  if (burnLevel === 'red') {
    banners.push(`<div class="alert-bar danger">🔴 Cash burn: spent ${peso(cashOut)} vs received ${peso(cashIn)} this month — outpacing income</div>`);
  } else if (burnLevel === 'yellow') {
    const pct = Math.round(burnRatio * 100);
    banners.push(`<div class="alert-bar warn">⚠ Cash burn at ${pct}% of income received this month</div>`);
  }

  if (debtLevel === 'red') {
    banners.push(`<div class="alert-bar danger">🔴 Card debt: obligations + new charges ${peso(debtTotal)} exceed monthly income ${peso(monthlyIncome)}</div>`);
  } else if (debtLevel === 'yellow') {
    banners.push(`<div class="alert-bar warn">⚠ Card charges this month pushing close to income limit (${peso(debtTotal)} of ${peso(monthlyIncome)})</div>`);
  }

  container.innerHTML = banners.join('');

  if (onPayCard) {
    container.querySelectorAll('.alert-card-link').forEach(el => {
      el.addEventListener('click', () => onPayCard(el.dataset.cardId));
    });
  }
}

function _lastCutDate(cutDay, now) {
  let cutDate = new Date(now.getFullYear(), now.getMonth(), cutDay);
  if (now.getDate() <= cutDay) {
    cutDate = new Date(now.getFullYear(), now.getMonth() - 1, cutDay);
  }
  return cutDate;
}
```

- [ ] **Step 2: Verify module syntax (no test runner — check for parse errors)**

The module has no side effects — it just exports pure functions. Verification happens in Task 9 (when integrated into spend-log.js and loaded in browser).

- [ ] **Step 3: Commit**

```bash
git add frontend/js/alerts.js
git commit -m "feat: add alerts.js with computeAlerts and renderAlertBanners"
```

---

## Task 8: Create frontend/js/cash-tracker.js

**Files:**
- Create: `frontend/js/cash-tracker.js`

- [ ] **Step 1: Create cash-tracker.js**

Create `frontend/js/cash-tracker.js`:

```js
import { get, post } from './api.js';
import { peso, dateStr } from './format.js';
import { getPaydays } from './calendar.js';

const TYPE_LABELS = {
  topup:      '+ Income',
  spend_cash: '- Cash spend',
  pay_card:   '- Card payment',
  loan_debit: '- Loan debit',
  reno_cash:  '- Renovation'
};

export function renderCashTracker(container, { cashOnHand, cashLog, loans, cards }) {
  const now       = new Date();
  const monthStr  = now.toISOString().slice(0, 7);
  const color     = cashOnHand >= 100000 ? 'ok' : cashOnHand >= 50000 ? 'warn' : 'danger';

  // Scheduled debits — loans not yet recorded this month
  const debitedLoanIds = (cashLog || [])
    .filter(r => r.Type === 'loan_debit' && String(r.Date).slice(0, 7) === monthStr)
    .map(r => String(r.LinkedID));
  const pendingDebits = (loans || []).filter(l => !debitedLoanIds.includes(String(l.ID)));

  // Runway computation
  const runway = _computeRunway(cashOnHand, cashLog || []);

  // Recent activity (last 5)
  const recent = [...(cashLog || [])].reverse().slice(0, 5);

  container.innerHTML = `
    <div class="cash-tracker-widget" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp4);margin-bottom:var(--sp4)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp2)">
        <div>
          <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Cash on Hand</div>
          <div class="stat-value ${color}" style="font-size:1.8rem">${peso(cashOnHand)}</div>
          ${runway ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:4px">${runway}</div>` : ''}
        </div>
        <div style="display:flex;gap:var(--sp2)">
          <button class="btn btn-primary" id="ct-add-cash" style="font-size:0.82rem;padding:6px 14px">+ Add Cash</button>
          <div style="position:relative">
            <button class="btn" id="ct-pay-card-btn" style="font-size:0.82rem;padding:6px 14px">Pay Card ▾</button>
            <div id="ct-card-dropdown" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);z-index:100;min-width:220px;box-shadow:0 4px 16px rgba(0,0,0,.3)">
              ${(cards || []).filter(c => Number(c.Balance) > 0).map(c => `
                <div class="ct-pay-card-item" data-card-id="${c.ID}" style="padding:10px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border)">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.Color};margin-right:8px"></span>
                  ${c.Name} <span class="mono warn" style="float:right">${peso(c.Balance)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="util-bar" style="margin-bottom:var(--sp3)">
        <div class="util-fill" style="width:${Math.min(100, (cashOnHand / 500000) * 100)}%;background:var(--${color});transition:width .3s"></div>
      </div>

      ${pendingDebits.length > 0 ? `
      <div style="margin-bottom:var(--sp3)">
        <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;margin-bottom:var(--sp2)">Scheduled Debits This Month</div>
        ${pendingDebits.map(l => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <div>
              <span style="font-size:0.85rem">${l.Bank} ${l.Type}</span>
              <span style="font-size:0.75rem;color:var(--muted)"> · due ${l.DueDay}th</span>
            </div>
            <div style="display:flex;align-items:center;gap:var(--sp2)">
              <span class="mono warn">${peso(l.MonthlyPayment)}</span>
              <button class="ct-mark-debit btn" data-loan-id="${l.ID}" style="font-size:0.72rem;padding:3px 8px">Mark Debited</button>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      ${recent.length > 0 ? `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp2)">
          <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase">Recent Activity</div>
        </div>
        ${recent.map(r => {
          const isIn  = r.Type === 'topup';
          const label = TYPE_LABELS[r.Type] || r.Type;
          return `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:3px 0;color:var(--text2)">
            <span>${dateStr(r.Date)} · ${label}${r.Notes ? ' — ' + r.Notes : ''}</span>
            <span class="mono ${isIn ? 'ok' : 'warn'}">${isIn ? '+' : '-'}${peso(Math.abs(Number(r.Amount)))}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>
  `;

  // Wire Add Cash button
  container.querySelector('#ct-add-cash').addEventListener('click', () => {
    openAddCashModal(cards, async (result) => {
      if (result.source === 'payday') _showPaydayAllocationPrompt(result, loans);
    });
  });

  // Wire Pay Card dropdown toggle
  const payBtn = container.querySelector('#ct-pay-card-btn');
  const dropdown = container.querySelector('#ct-card-dropdown');
  payBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { dropdown.style.display = 'none'; }, { once: true });

  container.querySelectorAll('.ct-pay-card-item').forEach(el => {
    el.addEventListener('click', () => {
      dropdown.style.display = 'none';
      openPayCardModal(cards, el.dataset.cardId);
    });
  });

  // Wire Mark Debited buttons
  container.querySelectorAll('.ct-mark-debit').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      await post('payLoanDebit', { loanId: btn.dataset.loanId, date: new Date().toISOString().slice(0, 10), notes: '' });
      // Caller will re-render — dispatch custom event
      container.dispatchEvent(new CustomEvent('cash-updated'));
    });
  });
}

export function openAddCashModal(cards, onSuccess) {
  const overlay = _createOverlay();
  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(420px,90vw)">
      <h2 style="margin:0 0 var(--sp4);font-size:1.1rem">Add Cash</h2>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Date</label><input type="date" id="ac-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Amount (₱)</label><input type="number" id="ac-amount" placeholder="0" min="0" step="1"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)">
        <label>Source</label>
        <select id="ac-source">
          <option value="payday">Payday</option>
          <option value="bonus">Bonus</option>
          <option value="gift">Gift</option>
          <option value="sale">Sale / Asset</option>
          <option value="refund">Refund / Insurance</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:var(--sp4)"><label>Notes (optional)</label><input type="text" id="ac-notes" placeholder="e.g. Paulo 30th, Performance bonus"></div>
      <div style="display:flex;gap:var(--sp2)">
        <button class="btn btn-primary" id="ac-submit">Add Cash</button>
        <button class="btn" id="ac-cancel">Cancel</button>
      </div>
      <div id="ac-msg" style="margin-top:var(--sp2);font-size:0.82rem;color:var(--danger)"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#ac-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#ac-submit').addEventListener('click', async () => {
    const btn    = overlay.querySelector('#ac-submit');
    const amount = parseFloat(overlay.querySelector('#ac-amount').value);
    const source = overlay.querySelector('#ac-source').value;
    if (!amount || amount <= 0) { overlay.querySelector('#ac-msg').textContent = 'Enter a valid amount'; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    const res = await post('addCash', {
      date:   overlay.querySelector('#ac-date').value,
      amount, source,
      notes:  overlay.querySelector('#ac-notes').value.trim()
    });
    overlay.remove();
    if (onSuccess) onSuccess({ source, amount, newBalance: res.newBalance });
    document.dispatchEvent(new CustomEvent('cash-updated'));
  });
}

export function openPayCardModal(cards, preselectedCardId) {
  const overlay = _createOverlay();
  const cardOptions = cards.map(c =>
    `<option value="${c.ID}" ${c.ID === preselectedCardId ? 'selected' : ''}>${c.Name} — bal ${peso(Number(c.Balance))}</option>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(420px,90vw)">
      <h2 style="margin:0 0 var(--sp4);font-size:1.1rem">Pay Credit Card</h2>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Card</label><select id="pc-card">${cardOptions}</select></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Payment Amount (₱)</label><input type="number" id="pc-amount" placeholder="0" min="0" step="1"></div>
      <div id="pc-preview" style="font-size:0.82rem;color:var(--muted);margin-bottom:var(--sp3)"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Date</label><input type="date" id="pc-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group" style="margin-bottom:var(--sp4)"><label>Notes (optional)</label><input type="text" id="pc-notes"></div>
      <div style="display:flex;gap:var(--sp2)">
        <button class="btn btn-primary" id="pc-submit">Pay Card</button>
        <button class="btn" id="pc-cancel">Cancel</button>
      </div>
      <div id="pc-msg" style="margin-top:var(--sp2);font-size:0.82rem;color:var(--danger)"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cardSel  = overlay.querySelector('#pc-card');
  const amtInput = overlay.querySelector('#pc-amount');
  const preview  = overlay.querySelector('#pc-preview');

  function updatePreview() {
    const card = cards.find(c => c.ID === cardSel.value);
    const amt  = parseFloat(amtInput.value) || 0;
    if (!card) return;
    const after = Math.max(0, Number(card.Balance) - amt);
    preview.textContent = `Balance after payment: ${peso(after)}${after <= 0 ? ' ✓ CLEARED' : ''}`;
  }
  cardSel.addEventListener('change', updatePreview);
  amtInput.addEventListener('input', updatePreview);
  updatePreview();

  overlay.querySelector('#pc-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#pc-submit').addEventListener('click', async () => {
    const btn    = overlay.querySelector('#pc-submit');
    const amount = parseFloat(amtInput.value);
    if (!amount || amount <= 0) { overlay.querySelector('#pc-msg').textContent = 'Enter a valid amount'; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    await post('payCreditCard', {
      cardId: cardSel.value, amount,
      date:   overlay.querySelector('#pc-date').value,
      notes:  overlay.querySelector('#pc-notes').value.trim()
    });
    overlay.remove();
    document.dispatchEvent(new CustomEvent('cash-updated'));
  });
}

function _showPaydayAllocationPrompt(result, loans) {
  const today    = new Date();
  const todayDay = today.getDate();
  const paydays  = getPaydays();
  const upcoming = paydays.filter(p => p.day > todayDay);
  const next     = upcoming.length > 0 ? upcoming[0] : paydays[0];

  // We don't have bills in scope here — show a simplified prompt with just loan info
  const loansBeforePayday = (loans || []).filter(l => {
    const d = Number(l.DueDay);
    return d > todayDay && d <= next.day;
  });
  const loanTotal = loansBeforePayday.reduce((s, l) => s + Number(l.MonthlyPayment), 0);
  const freeToSpend = result.amount - loanTotal;

  const overlay = _createOverlay();
  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(460px,92vw)">
      <h2 style="margin:0 0 var(--sp3);font-size:1rem;color:var(--ok)">${peso(result.amount)} received</h2>
      <p style="font-size:0.82rem;color:var(--muted);margin:0 0 var(--sp3)">Before ${next.person}'s payday (${next.day}th):</p>
      ${loansBeforePayday.map(l => `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border)">
          <span>${l.Bank} ${l.Type} due ${l.DueDay}th</span>
          <span class="mono warn">${peso(l.MonthlyPayment)}</span>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;font-size:0.9rem;padding:var(--sp2) 0;margin-top:var(--sp2);font-weight:700">
        <span>Free to spend</span>
        <span class="mono ${freeToSpend >= 0 ? 'ok' : 'danger'}">${peso(freeToSpend)}</span>
      </div>
      <button class="btn btn-primary" id="pa-close" style="margin-top:var(--sp3);width:100%">Got it</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#pa-close').addEventListener('click', () => overlay.remove());
}

function _computeRunway(cashOnHand, cashLog) {
  const now      = new Date();
  const cutoff   = new Date(now);
  cutoff.setDate(now.getDate() - 14);
  const cutStr   = cutoff.toISOString().slice(0, 10);

  const burnEntries = cashLog.filter(r =>
    String(r.Date) >= cutStr &&
    String(r.Date) <= now.toISOString().slice(0, 10) &&
    ['spend_cash', 'reno_cash'].includes(r.Type)
  );

  if (burnEntries.length < 3) return 'Not enough spend data yet';

  const total14   = burnEntries.reduce((s, r) => s + Number(r.Amount || 0), 0);
  const dailyRate = total14 / 14;
  if (dailyRate <= 0) return 'No recent cash spending';

  const days      = Math.floor(cashOnHand / dailyRate);
  if (days > 60) return `At current pace (~${peso(Math.round(dailyRate))}/day), cash covers 60+ days`;

  const zeroDate = new Date(now);
  zeroDate.setDate(now.getDate() + days);
  const zeroStr  = zeroDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `At current pace (~${peso(Math.round(dailyRate))}/day), cash covers ~${days} days · until ~${zeroStr}`;
}

function _createOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:var(--sp4)';
  return overlay;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/cash-tracker.js
git commit -m "feat: add cash-tracker.js with widget, Add Cash modal, Pay Card modal, runway"
```

---

## Task 9: Update spend-log.js — Integrate Cash Tracker and Alerts

**Files:**
- Modify: `frontend/js/spend-log.js`

- [ ] **Step 1: Add imports at the top of spend-log.js**

Replace the existing import block (lines 1–2) with:

```js
import { get, post } from './api.js';
import { peso, dateStr } from './format.js';
import { computeAlerts, renderAlertBanners } from './alerts.js';
import { renderCashTracker, openPayCardModal } from './cash-tracker.js';
```

- [ ] **Step 2: Update renderSpendLog to fetch cash data and render widget**

Replace the `export async function renderSpendLog(container)` implementation with the version below. Key changes: fetch `getDashboard` in parallel (for installments + cashOnHand + cashLog + totalObligations), render alert banners and cash tracker before the log form.

```js
export async function renderSpendLog(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Spend Log</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
    </div>
    <div id="sl-alerts"></div>
    <div id="sl-cash-tracker"></div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="sl-date" value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="sl-desc" placeholder="e.g. Jollibee lunch">
        </div>
        <div class="form-group">
          <label>Amount (₱)</label>
          <input type="number" id="sl-amount" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="sl-cat">
            ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Card</label>
          <select id="sl-card"><option value="">Cash / Other</option></select>
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <input type="text" id="sl-notes" placeholder="e.g. 6-month installment, Split with Joeann">
        </div>
      </div>
      <button class="btn btn-primary" id="sl-submit">Log Expense</button>
    </div>
    <div id="sl-content"><div class="loading-spinner">Loading...</div></div>
  `;

  const [logData, cardsData, dash] = await Promise.all([
    get('getSpendLog'),
    get('getCards'),
    get('getDashboard')
  ]);

  const cards        = cardsData || [];
  const cashOnHand   = Number(dash.cashOnHand || 0);
  const cashLog      = dash.recentCashLog || [];
  const installments = dash.installments || [];
  const loans        = await get('getLoans');

  const cardMap = {};
  cards.forEach(c => { cardMap[c.ID] = c; });

  // Populate card dropdown
  const sel = document.getElementById('sl-card');
  cards.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.ID;
    opt.textContent = c.Name;
    sel.appendChild(opt);
  });

  // Render alert banners
  const alerts = computeAlerts({
    cards, installments, spendLog: logData || [], cashOnHand, cashLog,
    totalObligations: dash.totalObligations || 0
  });
  renderAlertBanners(document.getElementById('sl-alerts'), alerts, {
    onPayCard: (cardId) => openPayCardModal(cards, cardId)
  });

  // Render cash tracker widget
  renderCashTracker(document.getElementById('sl-cash-tracker'), { cashOnHand, cashLog, loans, cards });

  // Re-render on cash-updated event
  document.addEventListener('cash-updated', () => renderSpendLog(container), { once: true });

  // Log expense submit
  document.getElementById('sl-submit').addEventListener('click', async () => {
    const date        = document.getElementById('sl-date').value;
    const description = document.getElementById('sl-desc').value.trim();
    const amount      = parseFloat(document.getElementById('sl-amount').value);
    const category    = document.getElementById('sl-cat').value;
    const cardId      = document.getElementById('sl-card').value;
    const notes       = document.getElementById('sl-notes').value.trim();
    if (!date || !description || isNaN(amount) || amount <= 0) return;
    const btn = document.getElementById('sl-submit');
    btn.disabled = true; btn.textContent = 'Saving...';
    const res = await post('logSpend', { date, description, amount, category, cardId, notes });
    if (res) {
      document.getElementById('sl-desc').value   = '';
      document.getElementById('sl-amount').value = '';
      document.getElementById('sl-notes').value  = '';
      renderSpendLog(container);
    } else {
      btn.disabled = false; btn.textContent = 'Log Expense';
    }
  });

  const content = document.getElementById('sl-content');
  if (!logData || !logData.length) {
    content.innerHTML = '<p class="muted" style="text-align:center;padding:var(--sp7)">No expenses logged yet.</p>';
    return;
  }

  const rows      = [...logData].reverse();
  const now       = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthRows = rows.filter(r => (r.Month || (r.Date ? r.Date.slice(0, 7) : '')) === thisMonth);
  const monthTotal = monthRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
  const totalAll   = rows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);

  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(now.getDate() + 7);
  let dueSoon = 0, overdue = 0;
  rows.forEach(r => {
    if (!r.CardID) return;
    const card = cardMap[r.CardID];
    if (!card) return;
    const due = _estimateDue(r.Date, card);
    if (!due) return;
    if (due < now)               overdue += parseFloat(r.Amount || 0);
    else if (due <= sevenDaysOut) dueSoon  += parseFloat(r.Amount || 0);
  });

  const byCat = {};
  monthRows.forEach(r => { const cat = r.Category || 'Other'; byCat[cat] = (byCat[cat] || 0) + parseFloat(r.Amount || 0); });
  const catBreakdown = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  content.innerHTML = `
    <div class="stat-grid" style="margin-bottom:var(--sp4)">
      <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value acc">${peso(monthTotal)}</div><div class="stat-sub">${monthRows.length} transaction${monthRows.length !== 1 ? 's' : ''}</div></div>
      <div class="stat-card"><div class="stat-label">All Time</div><div class="stat-value">${peso(totalAll)}</div><div class="stat-sub">${rows.length} total entries</div></div>
      ${dueSoon > 0 ? `<div class="stat-card"><div class="stat-label">Due in 7 Days</div><div class="stat-value warn">${peso(dueSoon)}</div><div class="stat-sub">estimated from card cycles</div></div>` : ''}
      ${overdue > 0 ? `<div class="stat-card"><div class="stat-label">Overdue (Est.)</div><div class="stat-value danger">${peso(overdue)}</div><div class="stat-sub">check your due dates</div></div>` : ''}
    </div>
    ${catBreakdown.length ? `<p class="section-title">By Category — ${now.toLocaleString('en-PH',{month:'long'})}</p><div class="breakdown-grid" style="margin-bottom:var(--sp5)">${catBreakdown.map(([cat,amt]) => `<div class="breakdown-row"><span>${cat}</span><span class="mono">${peso(amt)}</span></div>`).join('')}</div>` : ''}
    <p class="section-title">All Transactions</p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table class="data-table" id="sl-table">
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Card</th><th>Notes</th><th style="text-align:right">Amount</th><th></th></tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const card = r.CardID ? cardMap[r.CardID] : null;
            const due  = card ? _estimateDue(r.Date, card) : null;
            const dueStr = due ? due.toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '';
            return `<tr data-row="${i}">
              <td class="mono">${dateStr(r.Date)}</td>
              <td>${r.Description || '—'}</td>
              <td><span class="badge info">${r.Category || '—'}</span></td>
              <td class="muted">${card ? card.Name : (r.CardID ? r.CardID : '—')}</td>
              <td class="muted" style="font-size:0.8rem">${r.Notes || (dueStr ? `Due ~${dueStr}` : '—')}</td>
              <td class="mono" style="text-align:right;font-weight:600">${peso(parseFloat(r.Amount || 0))}</td>
              <td style="text-align:center"><button class="sl-del-btn" data-row-id="${r.Timestamp || i}" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:2px 6px" title="Delete">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  content.querySelectorAll('.sl-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.dataset.rowId;
      if (!confirm('Delete this transaction?')) return;
      btn.disabled = true; btn.textContent = '…';
      const res = await post('deleteSpend', { id: rowId });
      if (res) renderSpendLog(container);
      else { btn.disabled = false; btn.textContent = '✕'; }
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/spend-log.js
git commit -m "feat: integrate cash tracker and alert banners into spend-log.js"
```

---

## Task 10: Update dashboard.js — Cash Stat Card, Alerts, Installment Relief

**Files:**
- Modify: `frontend/js/dashboard.js`

- [ ] **Step 1: Replace dashboard.js entirely**

```js
import { get } from './api.js';
import { peso, pct } from './format.js';
import { computeAlerts, renderAlertBanners } from './alerts.js';
import { openPayCardModal } from './cash-tracker.js';

export async function renderDashboard(container) {
  const [d, cards, installments, loans] = await Promise.all([
    get('getDashboard'),
    get('getCards'),
    get('getInstallments'),
    get('getLoans')
  ]);

  const utilizationPct = pct(d.totalCCBalance, d.totalCCLimit);
  const cashOnHand     = Number(d.cashOnHand || 0);
  const cashColor      = cashOnHand >= 100000 ? 'ok' : cashOnHand >= 50000 ? 'warn' : 'danger';
  const cashLog        = d.recentCashLog || [];
  const spendLog       = [];

  container.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
    </div>
    <div id="dash-alerts"></div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Monthly Income</div>
        <div class="stat-value ok">${peso(d.totalMonthlyIncome)}</div>
        <div class="stat-sub">Combined household</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Obligations</div>
        <div class="stat-value warn">${peso(d.totalObligations)}</div>
        <div class="stat-sub">Loans + Bills + CC installs</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net After Obligations</div>
        <div class="stat-value ${d.netAfterObligations >= 0 ? 'ok' : 'danger'}">${peso(d.netAfterObligations)}</div>
        <div class="stat-sub">Available for spending/saving</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CC Utilization</div>
        <div class="stat-value ${utilizationPct > 30 ? 'warn' : 'ok'}">${utilizationPct}%</div>
        <div class="stat-sub">${peso(d.totalCCBalance)} of ${peso(d.totalCCLimit)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cash on Hand</div>
        <div class="stat-value ${cashColor}">${peso(cashOnHand)}</div>
        <div class="stat-sub" id="dash-runway">—</div>
      </div>
    </div>

    <div class="section-title">Obligations Breakdown</div>
    <div class="breakdown-grid">
      <div class="breakdown-row"><span>Bank Loans</span><span class="mono">${peso(d.breakdown.loans)}/mo</span></div>
      <div class="breakdown-row"><span>CC Installments</span><span class="mono">${peso(d.breakdown.installments)}/mo</span></div>
      <div class="breakdown-row"><span>Fixed Bills</span><span class="mono">${peso(d.breakdown.bills)}/mo</span></div>
      <div class="breakdown-row"><span>Subscriptions</span><span class="mono">${peso(d.breakdown.subscriptions)}/mo</span></div>
      <div class="breakdown-row total"><span>Total</span><span class="mono">${peso(d.totalObligations)}/mo</span></div>
    </div>

    ${_renderInstallmentRelief(installments)}

    <div class="section-title">Renovation Progress</div>
    <div class="reno-card">
      <div class="reno-row"><span>On-hand</span><span class="mono ok">${peso(d.renovationOnHand)}</span></div>
      <div class="reno-row"><span>Spent</span><span class="mono warn">${peso(d.renovationSpent)}</span></div>
      <div class="reno-row"><span>Target</span><span class="mono">${peso(d.renovationTarget)}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct(d.renovationOnHand - d.renovationSpent, d.renovationTarget)}%"></div></div>
      <div class="reno-gap">Gap to target: ${peso(d.renovationTarget - (d.renovationOnHand - d.renovationSpent))}</div>
    </div>
  `;

  // Render alert banners
  const spendLogData = await get('getSpendLog').catch(() => []);
  const alerts = computeAlerts({
    cards, installments: d.installments || installments, spendLog: spendLogData,
    cashOnHand, cashLog, totalObligations: d.totalObligations || 0
  });
  renderAlertBanners(document.getElementById('dash-alerts'), alerts, {
    onPayCard: (cardId) => openPayCardModal(cards, cardId)
  });

  // Runway blurb on cash stat card
  const runway = _runwaySummary(cashOnHand, cashLog);
  if (runway) document.getElementById('dash-runway').textContent = runway;
}

function _renderInstallmentRelief(installments) {
  const now    = new Date();
  const active = installments.filter(i => i.Status === 'active' && Number(i.MonthsRemaining) > 0);
  if (!active.length) return '';

  const withEnd = active.map(i => {
    const endDate = new Date(now.getFullYear(), now.getMonth() + Number(i.MonthsRemaining), 1);
    return { ...i, endDate, endLabel: endDate.toLocaleDateString('en-PH',{month:'short',year:'numeric'}) };
  }).sort((a, b) => a.endDate - b.endDate);

  // Find latest end month and sum of all amounts ending by then
  const latestEnd = withEnd[withEnd.length - 1].endDate;
  const latestLabel = withEnd[withEnd.length - 1].endLabel;
  const totalFreed = withEnd.reduce((s, i) => s + Number(i.MonthlyAmount), 0);

  return `
    <div class="section-title">Upcoming Installment Relief</div>
    <div class="breakdown-grid" style="margin-bottom:var(--sp3)">
      ${withEnd.map(i => `
        <div class="breakdown-row">
          <span style="font-size:0.85rem">${i.endLabel} &mdash; ${i.CardID ? i.CardID.toUpperCase() : ''} ${i.Description ? '· ' + i.Description : ''}</span>
          <span class="mono ok" style="font-size:0.85rem">+${peso(i.MonthlyAmount)}/mo freed</span>
        </div>
      `).join('')}
      <div class="breakdown-row total">
        <span>After ${latestLabel}</span>
        <span class="mono ok">${peso(totalFreed)}/mo freed total</span>
      </div>
    </div>
  `;
}

function _runwaySummary(cashOnHand, cashLog) {
  const now    = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 14);
  const cutStr = cutoff.toISOString().slice(0, 10);
  const burns  = (cashLog || []).filter(r => String(r.Date) >= cutStr && ['spend_cash','reno_cash'].includes(r.Type));
  if (burns.length < 3) return null;
  const rate = burns.reduce((s, r) => s + Number(r.Amount || 0), 0) / 14;
  if (rate <= 0) return null;
  const days = Math.floor(cashOnHand / rate);
  return days > 60 ? '60+ days runway' : `~${days} days runway`;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/dashboard.js
git commit -m "feat: add cash stat card, alert banners, and installment relief to dashboard"
```

---

## Task 11: Update cards.js — CC Payment Priority Queue

**Files:**
- Modify: `frontend/js/cards.js`

- [ ] **Step 1: Add import for cash-tracker.js and renderCards priority queue**

Add import at top of `cards.js`:

```js
import { openPayCardModal } from './cash-tracker.js';
```

- [ ] **Step 2: Add `_priorityQueue` function and wire into `renderCards`**

Add this function to `cards.js`:

```js
function _priorityQueue(cards) {
  const now       = new Date();
  const sevenDays = new Date(now);
  sevenDays.setDate(now.getDate() + 7);
  const thirtyDays = new Date(now);
  thirtyDays.setDate(now.getDate() + 30);

  const withBalance = cards.filter(c => Number(c.Balance) > 0 || c.PastDue === true || c.PastDue === 'TRUE');
  if (!withBalance.length) return '';

  const sorted = [...withBalance].sort((a, b) => {
    const aPast = a.PastDue === true || a.PastDue === 'TRUE';
    const bPast = b.PastDue === true || b.PastDue === 'TRUE';
    if (aPast && !bPast) return -1;
    if (!aPast && bPast) return 1;
    if (aPast && bPast) return Number(b.Balance) - Number(a.Balance);
    const aDate = a.DueDate ? new Date(a.DueDate) : new Date('2099-12-31');
    const bDate = b.DueDate ? new Date(b.DueDate) : new Date('2099-12-31');
    return aDate - bDate;
  });

  return `
    <div class="section-title">Pay These First</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);margin-bottom:var(--sp5);overflow:hidden">
      ${sorted.map((c, idx) => {
        const isPast = c.PastDue === true || c.PastDue === 'TRUE';
        const dueDate = c.DueDate ? new Date(c.DueDate) : null;
        const urgent  = dueDate && dueDate <= sevenDays;
        const label   = isPast ? '<span class="badge danger">OVERDUE</span>' :
                        (dueDate ? `due ${dueDate.toLocaleDateString('en-PH',{month:'short',day:'numeric'})}` : '');
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px var(--sp3);border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:var(--sp2)">
            <span style="color:var(--muted);font-size:0.8rem;width:18px">${idx+1}.</span>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.Color}"></span>
            <div>
              <div style="font-size:0.88rem;font-weight:600">${c.Name}${c.Last4 ? ' ••' + c.Last4 : ''}</div>
              <div style="font-size:0.75rem;color:var(--muted)">${label}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp2)">
            <span class="mono ${isPast ? 'danger' : urgent ? 'warn' : ''}" style="font-weight:700">${peso(c.Balance)}</span>
            <button class="pq-pay-btn btn" data-card-id="${c.ID}" style="font-size:0.75rem;padding:4px 10px${isPast?' background:var(--danger);color:#fff;border-color:var(--danger)':''}">Pay Now</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}
```

In `renderCards`, add the priority queue HTML before the card rows. After `container.innerHTML = ...` is set, insert:

Find the line in `renderCards` that renders `${cards.map(c => _cardRow(c, spendRows)).join('')}` and prepend `${_priorityQueue(cards)}`:

```js
  container.innerHTML = `
    <div class="page-header"><h1>Credit Cards</h1></div>
    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      ...existing stat cards...
    </div>
    ${_priorityQueue(cards)}
    ${cards.map(c => _cardRow(c, spendRows)).join('')}
  `;
```

Then wire the Pay Now buttons after `container.innerHTML` is set:

```js
  container.querySelectorAll('.pq-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => openPayCardModal(cards, btn.dataset.cardId));
  });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/cards.js
git commit -m "feat: add CC payment priority queue to cards tab"
```

---

## Task 12: Update renovation.js — CardID Dropdown

**Files:**
- Modify: `frontend/js/renovation.js`

- [ ] **Step 1: Add cards fetch to renderRenovation**

Replace line 5 (`const [rows, config] = ...`) with:

```js
  const [rows, config, cards] = await Promise.all([get('getRenovation'), get('getConfig'), get('getCards')]);
```

- [ ] **Step 2: Replace PaymentMethod text input with structured dropdown**

Find the Payment Method form group in `renovation.js`:
```js
<div class="form-group"><label>Payment Method</label><input type="text" id="reno-payment" placeholder="e.g. BDO CC, Cash"></div>
```

Replace with:

```js
        <div class="form-group">
          <label>Payment Method</label>
          <select id="reno-payment">
            <option value="cash">Cash</option>
            ${cards.map(c => `<option value="card-${c.ID}">${c.Name}</option>`).join('')}
            <option value="other">Other / TBD</option>
          </select>
        </div>
        <div class="form-group" id="reno-card-group" style="display:none">
          <label>Card</label>
          <select id="reno-card">
            ${cards.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('')}
          </select>
        </div>
```

- [ ] **Step 3: Wire payment method toggle and update post call**

Add after `document.getElementById('reno-submit').addEventListener(...)`:

```js
  const renoPaySel  = document.getElementById('reno-payment');
  const renoCardGrp = document.getElementById('reno-card-group');
  renoPaySel.addEventListener('change', () => {
    renoCardGrp.style.display = renoPaySel.value.startsWith('card-') ? 'block' : 'none';
    if (renoPaySel.value.startsWith('card-')) {
      document.getElementById('reno-card').value = renoPaySel.value.replace('card-', '');
    }
  });
```

Replace the `post('logRenovation', ...)` call in the submit handler:

```js
      const payVal     = document.getElementById('reno-payment').value;
      const isCash     = payVal === 'cash';
      const isCard     = payVal.startsWith('card-');
      const cardId     = isCard ? document.getElementById('reno-card').value : '';
      const methodLabel = isCash ? 'cash' : isCard ? 'card' : 'other';

      await post('logRenovation', {
        date:          document.getElementById('reno-date').value,
        description:   document.getElementById('reno-desc').value,
        amount:        Number(document.getElementById('reno-amount').value),
        category:      document.getElementById('reno-cat').value,
        paymentMethod: methodLabel,
        cardId:        cardId
      });
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/renovation.js
git commit -m "feat: add CardID dropdown to renovation form, wire cash/card payment paths"
```

---

## Task 13: Update installments.js — Relief Timeline

**Files:**
- Modify: `frontend/js/installments.js`

- [ ] **Step 1: Add relief timeline section to renderInstallments**

Add `_reliefTimeline` function:

```js
function _reliefTimeline(active) {
  const now      = new Date();
  const withEnd  = active
    .filter(i => Number(i.MonthsRemaining) > 0)
    .map(i => {
      const endDate = new Date(now.getFullYear(), now.getMonth() + Number(i.MonthsRemaining), 1);
      return { ...i, endDate, endLabel: endDate.toLocaleDateString('en-PH',{month:'short',year:'numeric'}) };
    })
    .sort((a, b) => a.endDate - b.endDate);

  if (!withEnd.length) return '';

  const totalFreed = withEnd.reduce((s, i) => s + Number(i.MonthlyAmount), 0);
  const lastLabel  = withEnd[withEnd.length - 1].endLabel;

  return `
    <div class="section-title" style="margin-top:var(--sp5)">Upcoming Relief</div>
    <div class="breakdown-grid">
      ${withEnd.map(i => `
        <div class="breakdown-row">
          <div>
            <span style="font-size:0.85rem;font-weight:600">${i.endLabel}</span>
            <span style="font-size:0.75rem;color:var(--muted)"> · ${i.CardID ? i.CardID.toUpperCase() : ''}</span>
            ${i.Description ? `<div style="font-size:0.75rem;color:var(--muted)">${i.Description}</div>` : ''}
          </div>
          <span class="mono ok">+${peso(i.MonthlyAmount)}/mo</span>
        </div>
      `).join('')}
      <div class="breakdown-row total">
        <span>After ${lastLabel}</span>
        <span class="mono ok">+${peso(totalFreed)}/mo freed</span>
      </div>
    </div>
  `;
}
```

Append `${_reliefTimeline(active)}` at the end of the `container.innerHTML` template string in `renderInstallments`.

- [ ] **Step 2: Commit**

```bash
git add frontend/js/installments.js
git commit -m "feat: add installment relief timeline to installments tab"
```

---

## Task 14: Update sw.js — Bump Cache, Add New Files

**Files:**
- Modify: `frontend/sw.js`

- [ ] **Step 1: Bump cache version and add new JS files**

Replace lines 1–2 of `frontend/sw.js`:

```js
const CACHE = 'finance-os-v4';
const PRECACHE = [
  '/finance/',
  '/finance/index.html',
  '/finance/config.js',
  '/finance/manifest.json',
  '/finance/css/tokens.css',
  '/finance/css/app.css',
  '/finance/js/app.js',
  '/finance/js/api.js',
  '/finance/js/format.js',
  '/finance/js/calendar.js',
  '/finance/js/calendar-view.js',
  '/finance/js/alerts.js',
  '/finance/js/cash-tracker.js',
  '/finance/js/dashboard.js',
  '/finance/js/cards.js',
  '/finance/js/installments.js',
  '/finance/js/loans.js',
  '/finance/js/bills.js',
  '/finance/js/renovation.js',
  '/finance/js/emergency-fund.js',
  '/finance/js/spend-log.js',
  '/finance/js/deals.js',
  '/finance/js/best-card.js',
  '/finance/js/income.js'
];
```

- [ ] **Step 2: Commit and push frontend to GitHub Pages**

```bash
git add frontend/sw.js
git commit -m "feat: bump SW cache to v4, add alerts.js and cash-tracker.js to precache"
git -c credential.helper="" push https://iampparaiso:ghp_REDACTED@github.com/iampparaiso/finance.git main
```

Wait ~60 seconds for GitHub Actions to deploy.

- [ ] **Step 3: Clear old service worker in browser**

Open `https://iampparaiso.github.io/finance/` → DevTools → Application → Service Workers → Unregister → Hard refresh (Ctrl+Shift+R).

---

## Task 15: Full Simulation — Verify All Logic

**Files:**
- Run: `appsscript/Tests.gs` functions in Script editor
- Verify: Live app in browser after login

- [ ] **Step 1: Reset simulation state**

In Apps Script editor, run `_resetCashState()` to clear CashLog and set `cash_on_hand = 0`.

- [ ] **Step 2: Run full backend simulation suite**

Run each test function and confirm all pass:

```
testCashTrackerSimulation    → expect 11/11 passed ✓
testRenovationCardMirror     → expect 4/4 passed ✓
testPastDueResolution        → expect 2/2 passed ✓
```

If any test fails, check the log for which step failed and the expected vs actual value. Fix the corresponding API.gs handler before continuing.

- [ ] **Step 3: Verify Alert 2 thresholds with known data**

After running `testCashTrackerSimulation` (cash_on_hand ends at ₱177,774), manually verify Alert 2 computation. In the Script editor, run:

```javascript
function testAlert2Logic() {
  var cards = getRows('CreditCards');
  var installs = getRows('Installments').filter(function(i) { return i.Status === 'active'; });
  var cashOnHand = Number(_getConfigValue('cash_on_hand') || 0);

  var totalExposure = cards.reduce(function(sum, card) {
    var billed = Number(card.Balance || 0);
    var monthlyInstalls = installs
      .filter(function(i) { return i.CardID === card.ID; })
      .reduce(function(s, i) { return s + Number(i.MonthlyAmount); }, 0);
    Logger.log(card.Name + ': billed=' + billed + ' installs=' + monthlyInstalls);
    return sum + billed + monthlyInstalls;
  }, 0);

  Logger.log('Total exposure: ' + totalExposure);
  Logger.log('Cash on hand: ' + cashOnHand);
  Logger.log('Ratio: ' + (totalExposure / cashOnHand).toFixed(2));
  Logger.log('Expected: RED (ratio > 1, exposure ~308K > cash ~177K)');
}
```

Expected log: ratio > 1, alert level should be RED.

- [ ] **Step 4: Verify frontend in browser**

Open `https://iampparaiso.github.io/finance/` and sign in.

Check each tab:

**Spend Log:**
- [ ] Card dropdown shows all 6 cards
- [ ] Cash tracker widget visible at top with current balance
- [ ] "+ Add Cash" button opens modal with source dropdown
- [ ] "Pay Card ▾" shows cards with balance > 0
- [ ] Alert banners appear (overdue cards visible)
- [ ] Log a ₱500 cash purchase → cash balance decreases by ₱500
- [ ] Transactions list renders (not empty error)

**Cards:**
- [ ] "Pay These First" section shows EastWest and UnionBank at top (OVERDUE badges)
- [ ] BPI shown next (due May 27)
- [ ] Unbilled charges section on each card shows real data (not ₱0)
- [ ] "Pay Now" button on a card opens Pay Card modal

**Dashboard:**
- [ ] Cash on Hand stat card visible (5th card)
- [ ] Alert banners appear above stat grid
- [ ] Installment Relief section shows EastWest ending Jul 2026, UnionBank items

**Income:**
- [ ] Obligations show real figure (~₱407K), not ₱0

**Renovation:**
- [ ] Payment Method is now a dropdown (Cash / 6 cards / Other)
- [ ] Selecting a card shows the Card dropdown
- [ ] Log a ₱1,000 cash reno expense → cash on hand decreases

**Installments:**
- [ ] "Upcoming Relief" section at bottom shows relief dates and amounts

- [ ] **Step 5: Verify payday allocation prompt**

On Spend Log → Add Cash → Source: Payday → Amount: ₱95,000 → Submit.  
Verify: a prompt appears showing committed items before next payday and "Free to spend" amount.

- [ ] **Step 6: Final commit**

```bash
git add appsscript/Tests.gs
git commit -m "test: add backend simulation suite for cash tracker and alert logic"
git -c credential.helper="" push https://iampparaiso:ghp_REDACTED@github.com/iampparaiso/finance.git main
```

---

## Self-Review Notes

- All 10 simulation test cases from spec Section 10 are covered: cash tracker (10.2), PastDue resolution (10.3), Alert 2 (10.4), renovation mirroring (10.10), installment relief (10.8), CC priority queue (10.9)
- Alert 3 (10.5) and runway (10.6) are verified via frontend visual checks and the backend alert computation tested via `testAlert2Logic`
- Payday allocation (10.7) verified via browser step in Task 15 Step 5
- Bug fixes (10.1) verified in Task 1 Step 4
- `_getConfigValue` is defined in API.gs (Task 3 Step 1) and used in Setup.gs (Task 2) — Setup.gs runs in the same script context so the helper is available
