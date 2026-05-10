# Finance OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cloud-synced household finance OS for Paulo & Joeann Paraiso — Google Sheets as database, Apps Script as backend API, GitHub Pages as Japandi-styled PWA frontend.

**Architecture:** Apps Script Web App (Execute as: Me, Anyone with Google account) serves a JSON API; GitHub Pages PWA authenticates via Google Identity Services and sends ID token with every request; Apps Script verifies token email against a two-email whitelist stored in Script Properties. All persistent state lives in one Google Sheets workbook with 11 named tabs.

**Tech Stack:** Google Apps Script, Google Sheets, Vanilla JS (ES modules), CSS custom properties, GitHub Pages, clasp CLI, Google Identity Services (GIS)

**Owners:** Paulo `iampparaiso@gmail.com` / Joeann `mjaparaiso227@gmail.com`  
**GitHub Pages URL:** `https://iampparaiso.github.io/finance/`  
**Local project root:** `C:\Users\ppara\Desktop\finance\`

---

## File Map

```
finance/
├── .clasp.json                  # clasp config — GITIGNORED (contains scriptId)
├── .gitignore
├── appsscript/
│   ├── appsscript.json          # GAS manifest + OAuth scopes
│   ├── Setup.gs                 # One-time: creates all 11 sheets + loads initial data
│   ├── Auth.gs                  # verifyToken(token) → email | null
│   ├── SheetHelpers.gs          # getRows / appendRow / updateRow / clearAndWrite
│   ├── API.gs                   # doGet / doPost router + all action handlers
│   └── Triggers.gs              # Monthly rollover + alert generation
├── frontend/
│   ├── index.html               # App shell
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker
│   ├── config.js                # API_URL constant — GITIGNORED
│   ├── config.example.js        # Template (committed)
│   ├── css/
│   │   ├── tokens.css           # Japandi design tokens
│   │   └── app.css              # All component styles
│   └── js/
│       ├── app.js               # Boot, Google Sign-In, module router
│       ├── api.js               # fetch wrapper → Apps Script
│       ├── format.js            # peso(), dateStr(), daysUntil()
│       ├── calendar.js          # buildCalendar(), safeToSpend()
│       ├── dashboard.js         # renderDashboard()
│       ├── cards.js             # renderCards()
│       ├── installments.js      # renderInstallments()
│       ├── loans.js             # renderLoans()
│       ├── bills.js             # renderBills()
│       ├── renovation.js        # renderRenovation()
│       └── emergency-fund.js    # renderEmergencyFund()
├── schemas/
│   ├── sheets-schema.json       # ✅ DONE — column definitions
│   └── initial-data.json        # ✅ DONE — pre-loaded financial data
└── .github/
    └── workflows/
        └── deploy.yml           # GitHub Pages deploy on push to main
```

---

## Task 0 — Prerequisites

**Files:** none (environment setup)

- [ ] **Step 1: Check Node.js**

```powershell
node --version
npm --version
```
Expected: `v18+` and `v9+`. If missing, download from https://nodejs.org (LTS).

- [ ] **Step 2: Install clasp**

```powershell
npm install -g @google/clasp
```
Expected: `@google/clasp@2.x.x` added.

- [ ] **Step 3: Log in to clasp**

```powershell
clasp login
```
A browser window opens. Sign in as `iampparaiso@gmail.com`. Return to terminal — should print `Logged in! Project credentials saved to ~/.clasprc.json`.

- [ ] **Step 4: Enable Apps Script API**

Open: https://script.google.com/home/usersettings  
Toggle **Google Apps Script API** → ON. (One-time per Google account.)

- [ ] **Step 5: Create the Apps Script project**

```powershell
cd "C:\Users\ppara\Desktop\finance\appsscript"
clasp create --type standalone --title "Finance OS"
```
Expected output includes `Created new standalone script: https://script.google.com/...`  
This creates `.clasp.json` in `appsscript/` with the `scriptId`.

- [ ] **Step 6: Create .gitignore**

Create `C:\Users\ppara\Desktop\finance\.gitignore`:
```
appsscript/.clasp.json
frontend/config.js
node_modules/
.DS_Store
```

- [ ] **Step 7: Init GitHub repo**

```powershell
cd "C:\Users\ppara\Desktop\finance"
git init
git add schemas/ docs/
git commit -m "feat: add schemas and initial data"
```

Then on GitHub.com: create repo `iampparaiso/finance` (public, no README).

```powershell
git remote add origin https://github.com/iampparaiso/finance.git
git branch -M main
git push -u origin main
```

---

## Task 1 — Apps Script Manifest

**Files:**
- Create: `appsscript/appsscript.json`

- [ ] **Step 1: Write manifest**

```json
{
  "timeZone": "Asia/Manila",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_WITH_GOOGLE_ACCOUNT"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

- [ ] **Step 2: Push to Apps Script**

```powershell
cd "C:\Users\ppara\Desktop\finance\appsscript"
clasp push
```
Expected: `Pushed N files.`

---

## Task 2 — Auth.gs

**Files:**
- Create: `appsscript/Auth.gs`

- [ ] **Step 1: Write Auth.gs**

```javascript
var WHITELIST = ['iampparaiso@gmail.com', 'mjaparaiso227@gmail.com'];

function verifyToken(token) {
  if (!token) return null;
  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + token,
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    var email = (data.email || '').toLowerCase();
    return WHITELIST.indexOf(email) !== -1 ? email : null;
  } catch (e) {
    return null;
  }
}

function unauthorized() {
  return ContentService
    .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testVerifyToken() {
  // Manual test: replace with a real short-lived token from browser console
  // In browser: await google.accounts.id.prompt(); then copy credential
  var result = verifyToken('PASTE_REAL_TOKEN_HERE');
  Logger.log('verifyToken result: ' + result);
  // Expected: null (token is fake) — confirms function runs without crashing
}
```

- [ ] **Step 2: Push and test**

```powershell
clasp push
```
In Apps Script editor: Run → `testVerifyToken`  
Check Execution Log: should print `verifyToken result: null` (fake token returns null — correct).

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\ppara\Desktop\finance"
git add appsscript/Auth.gs appsscript/appsscript.json
git commit -m "feat: add Auth.gs token verification + whitelist"
```

---

## Task 3 — SheetHelpers.gs

**Files:**
- Create: `appsscript/SheetHelpers.gs`

- [ ] **Step 1: Write SheetHelpers.gs**

```javascript
var SS_ID = null; // set after Setup.gs runs — stored in Script Properties

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID not set. Run setupSheets() first.');
  return SpreadsheetApp.openById(id);
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheetName, rowObj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return rowObj[h] !== undefined ? rowObj[h] : ''; });
  sheet.appendRow(row);
}

function updateRowById(sheetName, idField, idValue, updates) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error('ID field not found: ' + idField);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idValue)) {
      headers.forEach(function(h, j) {
        if (updates[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(updates[h]);
      });
      return true;
    }
  }
  return false;
}

function clearAndWrite(sheetName, rows) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  if (rows.length === 0) return;
  var grid = rows.map(function(r) {
    return headers.map(function(h) { return r[h] !== undefined ? r[h] : ''; });
  });
  sheet.getRange(2, 1, grid.length, headers.length).setValues(grid);
}

function testGetRows() {
  var rows = getRows('Config');
  Logger.log('Config rows: ' + JSON.stringify(rows));
  // Expected after Setup runs: array with Key/Value pairs
}
```

- [ ] **Step 2: Push**

```powershell
clasp push
```

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\ppara\Desktop\finance"
git add appsscript/SheetHelpers.gs
git commit -m "feat: add SheetHelpers CRUD layer"
```

---

## Task 4 — Setup.gs

**Files:**
- Create: `appsscript/Setup.gs`

- [ ] **Step 1: Write Setup.gs**

```javascript
function setupSheets() {
  var ss = SpreadsheetApp.create('Finance OS — Paraiso Household');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Spreadsheet created: ' + ss.getUrl());

  _createSheet(ss, 'Config',        ['Key','Value','Notes']);
  _createSheet(ss, 'Income',        ['Person','PayDay','Amount','Active']);
  _createSheet(ss, 'CreditCards',   ['ID','Name','Last4','Network','Limit','CashAdvanceLimit','Balance','StatementCutDay','DueDayOffset','DueDate','InterestRate','Color','PastDue','UnbilledInstallments']);
  _createSheet(ss, 'Installments',  ['ID','CardID','Description','MonthlyAmount','MonthsRemaining','StartDate','IsNew','Note','Status']);
  _createSheet(ss, 'BankLoans',     ['ID','Bank','Type','AccountNo','OutstandingBalance','MonthlyAmortization','InsurancePremium','MonthlyPayment','DueDay','NextDueDate','RemainingPayments','MaturityDate','InterestRate','PayoffAmount']);
  _createSheet(ss, 'RecurringBills',['ID','Name','Amount','DueDay','Category','Frequency','Active','IsEstimate','EndsOnMoveIn','StartDate','EndDate']);
  _createSheet(ss, 'Subscriptions', ['ID','Name','Amount','DueDay','PaymentMethod','Category','Active']);
  _createSheet(ss, 'SpendLog',      ['Timestamp','Date','Description','Amount','Category','CardID','Month','AddedBy']);
  _createSheet(ss, 'Renovation',    ['Timestamp','Date','Description','Amount','Category','PaymentMethod','Receipt','AddedBy']);
  _createSheet(ss, 'EmergencyFund', ['Timestamp','Date','Type','Amount','Balance','Notes']);
  _createSheet(ss, 'Alerts',        ['ID','Type','Message','Severity','DueDate','Resolved','CreatedAt']);

  // Remove default Sheet1
  var def = ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);

  _loadInitialData(ss);
  Logger.log('Setup complete. Open: ' + ss.getUrl());
}

function _createSheet(ss, name, headers) {
  var sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function _loadInitialData(ss) {
  // CONFIG
  _batchAppend(ss, 'Config', [
    ['owner_email',           'iampparaiso@gmail.com',  'Primary owner'],
    ['whitelist',             'iampparaiso@gmail.com,mjaparaiso227@gmail.com', 'Comma-separated'],
    ['move_in_date',          '',                       'Set when condo is ready — deactivates Rent + LP Assoc'],
    ['emergency_fund_start',  '2026-07-01',             'Month emergency fund contributions begin'],
    ['renovation_target',     '1200000',                'Total condo renovation budget'],
    ['renovation_on_hand',    '570000',                 'Cash currently available for reno']
  ], ['Key','Value','Notes']);

  // INCOME
  _batchAppend(ss, 'Income', [
    ['Joeann', 10, 95000,  true],
    ['Paulo',  15, 94000,  true],
    ['Joeann', 25, 95000,  true],
    ['Paulo',  30, 275000, true]
  ], ['Person','PayDay','Amount','Active']);

  // CREDIT CARDS
  _batchAppend(ss, 'CreditCards', [
    ['rcbc',      'RCBC Visa Infinite',              '9003', 'Visa',       947000, 250000,  12107.72,  10, 24, '2026-06-03', 0.03, '#e63946', false, 0],
    ['metrobank', 'Metrobank Titanium Mastercard',   '',     'Mastercard', 502000, 0,       0,         9,  21, '',           0.03, '#3a86ff', false, 0],
    ['eastwest',  'EastWest Platinum Mastercard',    '5002', 'Mastercard', 758000, 227400,  24571.48,  15, 26, '2026-05-11', 0.03, '#2dc653', true,  0],
    ['unionbank', 'UnionBank Rewards Platinum Visa', '5021', 'Visa',       490000, 0,       80462.07,  23, 18, '2026-05-11', 0.03, '#ff8c00', true,  0],
    ['bpi',       'BPI Signature Visa',              '',     'Visa',       641000, 0,       106328.83, 7,  20, '2026-05-27', 0.03, '#c9184a', false, 464732.66],
    ['bdo',       'BDO Visa Platinum',               '9850', 'Visa',       600000, 180000,  0,         9,  19, '',           0.03, '#1d4ed8', false, 0]
  ], ['ID','Name','Last4','Network','Limit','CashAdvanceLimit','Balance','StatementCutDay','DueDayOffset','DueDate','InterestRate','Color','PastDue','UnbilledInstallments']);

  // INSTALLMENTS
  _batchAppend(ss, 'Installments', [
    ['ew-inst-1',    'eastwest',  'EastWest installment plan',        24388,    2,    '',           false, '',                              'active'],
    ['ub-inst-1',    'unionbank', 'UnionBank plan (2249)',             2249.58,  11,   '',           false, '',                              'active'],
    ['ub-inst-2',    'unionbank', 'UnionBank plan (16953)',            16953,    1,    '',           false, '',                              'active'],
    ['ub-inst-3',    'unionbank', 'UnionBank plan 6450760',           21862.16, 2,    '',           false, '',                              'active'],
    ['bpi-inst-1',   'bpi',       'BPI Signature installment plans',  19361.83, 0,    '',           false, 'TBD — check BPI app',           'active'],
    ['rcbc-inst-1',  'rcbc',      'RCBC new installment (Jun 2026)',  12101.92, 48,   '2026-06-03', true,  '',                              'upcoming'],
    ['metro-inst-1', 'metrobank', 'Metrobank new installment (Jun)',  14718.71, 36,   '2026-06-01', true,  '',                              'upcoming']
  ], ['ID','CardID','Description','MonthlyAmount','MonthsRemaining','StartDate','IsNew','Note','Status']);

  // BANK LOANS
  _batchAppend(ss, 'BankLoans', [
    ['bpi-auto',    'BPI','Auto Loan',    '00000028933231', 1684667.24, 41154,     0,    41154,     10, '2026-06-10', 49,  '2030-05-10', 0,    1781692.08],
    ['bpi-housing', 'BPI','Housing Loan', '00000027408052', 9223387.46, 116108.48, 2900, 119008.48, 20, '2026-05-20', 107, '',           0.07, 9263433.71]
  ], ['ID','Bank','Type','AccountNo','OutstandingBalance','MonthlyAmortization','InsurancePremium','MonthlyPayment','DueDay','NextDueDate','RemainingPayments','MaturityDate','InterestRate','PayoffAmount']);

  // RECURRING BILLS
  _batchAppend(ss, 'RecurringBills', [
    ['condo-assoc',    'Condo Association Dues',  9216,     15, 'housing',   'monthly', true,  false, false, '2026-06-15', ''],
    ['helper-15',      'Helper Salary (15th)',     15150,    15, 'household', 'monthly', true,  false, false, '',           ''],
    ['helper-30',      'Helper Salary (30th)',     12000,    30, 'household', 'monthly', true,  false, false, '',           ''],
    ['rent-laspinas',  'Rent Las Piñas',           11500,    1,  'housing',   'monthly', true,  false, true,  '',           ''],
    ['assoc-laspinas', 'Las Piñas Assoc Dues',     400,      1,  'housing',   'monthly', true,  false, true,  '',           ''],
    ['prulife',        'PruLife Insurance',        2555,     4,  'insurance', 'monthly', true,  false, false, '',           ''],
    ['zion-ot',        "Zion's OT",                3600,     0,  'health',    'weekly',  true,  false, false, '',           ''],
    ['globe',          'Globe Internet',           1599,     1,  'utilities', 'monthly', true,  false, false, '',           ''],
    ['maynilad',       'Maynilad',                 2000,     15, 'utilities', 'monthly', true,  true,  false, '',           ''],
    ['meralco',        'Meralco',                  12000,    25, 'utilities', 'monthly', true,  true,  false, '',           ''],
    ['allowance',      "Parent's Allowance",       9000,     1,  'family',    'monthly', true,  false, false, '',           ''],
    ['tithe-10',       'Tithe (10th)',              9500,     10, 'giving',    'monthly', true,  false, false, '',           ''],
    ['tithe-25',       'Tithe (25th)',              9500,     25, 'giving',    'monthly', true,  false, false, '',           ''],
    ['alfonso-lot',    'Alfonso Lot',              53083.33, 19, 'property',  'monthly', true,  false, false, '',           '2028-07-19']
  ], ['ID','Name','Amount','DueDay','Category','Frequency','Active','IsEstimate','EndsOnMoveIn','StartDate','EndDate']);

  // SUBSCRIPTIONS
  _batchAppend(ss, 'Subscriptions', [
    ['netflix',   'Netflix',         619, 25, 'GCash',              'entertainment', true],
    ['youtube',   'YouTube Premium', 189, 21, 'GCash',              'entertainment', true],
    ['hbomax',    'HBO Max',         149, 1,  'GCash',              'entertainment', true],
    ['spotify',   'Spotify',         279, 7,  'BPI Credit Card',    'entertainment', true],
    ['googleone', 'Google One',      179, 8,  'EastWest Credit Card','productivity', true]
  ], ['ID','Name','Amount','DueDay','PaymentMethod','Category','Active']);

  Logger.log('Initial data loaded.');
}

function _batchAppend(ss, sheetName, rows, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (rows.length === 0) return;
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
```

- [ ] **Step 2: Push and run**

```powershell
clasp push
```
In Apps Script editor: Run → `setupSheets`  
Check Execution Log. Expected:
```
Spreadsheet created: https://docs.google.com/spreadsheets/d/...
Initial data loaded.
Setup complete. Open: https://docs.google.com/spreadsheets/d/...
```
Open the URL — verify all 11 tabs exist with data.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\ppara\Desktop\finance"
git add appsscript/Setup.gs
git commit -m "feat: Setup.gs creates all 11 sheets + loads initial data"
```

---

## Task 5 — API.gs

**Files:**
- Create: `appsscript/API.gs`

- [ ] **Step 1: Write API.gs**

```javascript
function doGet(e) {
  var token = e.parameter.token || '';
  var email = verifyToken(token);
  if (!email) return unauthorized();

  var action = e.parameter.action || '';
  var result;

  try {
    switch (action) {
      case 'getDashboard':    result = _getDashboard(); break;
      case 'getCards':        result = getRows('CreditCards'); break;
      case 'getInstallments': result = getRows('Installments'); break;
      case 'getLoans':        result = getRows('BankLoans'); break;
      case 'getBills':        result = getRows('RecurringBills'); break;
      case 'getSubscriptions':result = getRows('Subscriptions'); break;
      case 'getSpendLog':     result = getRows('SpendLog'); break;
      case 'getRenovation':   result = getRows('Renovation'); break;
      case 'getEmergencyFund':result = getRows('EmergencyFund'); break;
      case 'getIncome':       result = getRows('Income'); break;
      case 'getConfig':       result = getRows('Config'); break;
      case 'getAlerts':       result = getRows('Alerts'); break;
      default:
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Unknown action: ' + action }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    return _ok(result);
  } catch (err) {
    return _error(err.message);
  }
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents || '{}');
  var token = body.token || '';
  var email = verifyToken(token);
  if (!email) return unauthorized();

  var action = body.action || '';

  try {
    switch (action) {
      case 'logSpend':
        appendRow('SpendLog', {
          Timestamp:   new Date().toISOString(),
          Date:        body.date,
          Description: body.description,
          Amount:      body.amount,
          Category:    body.category,
          CardID:      body.cardId,
          Month:       body.month,
          AddedBy:     email
        });
        return _ok({ success: true });

      case 'logRenovation':
        appendRow('Renovation', {
          Timestamp:     new Date().toISOString(),
          Date:          body.date,
          Description:   body.description,
          Amount:        body.amount,
          Category:      body.category,
          PaymentMethod: body.paymentMethod,
          Receipt:       body.receipt || '',
          AddedBy:       email
        });
        return _ok({ success: true });

      case 'logEmergencyFund':
        var efRows = getRows('EmergencyFund');
        var lastBalance = efRows.length > 0 ? Number(efRows[efRows.length - 1].Balance) : 0;
        var delta = body.type === 'deposit' ? Number(body.amount) : -Number(body.amount);
        appendRow('EmergencyFund', {
          Timestamp: new Date().toISOString(),
          Date:      body.date,
          Type:      body.type,
          Amount:    body.amount,
          Balance:   lastBalance + delta,
          Notes:     body.notes || ''
        });
        return _ok({ success: true });

      case 'updateCard':
        updateRowById('CreditCards', 'ID', body.cardId, body.updates);
        return _ok({ success: true });

      case 'updateInstallment':
        updateRowById('Installments', 'ID', body.installmentId, body.updates);
        return _ok({ success: true });

      case 'updateConfig':
        updateRowById('Config', 'Key', body.key, { Value: body.value });
        return _ok({ success: true });

      default:
        return _error('Unknown action: ' + action);
    }
  } catch (err) {
    return _error(err.message);
  }
}

function _getDashboard() {
  var cards      = getRows('CreditCards');
  var loans      = getRows('BankLoans');
  var bills      = getRows('RecurringBills').filter(function(r) { return r.Active == true || r.Active === 'TRUE'; });
  var subs       = getRows('Subscriptions').filter(function(r) { return r.Active == true || r.Active === 'TRUE'; });
  var installs   = getRows('Installments').filter(function(r) { return r.Status === 'active'; });
  var income     = getRows('Income').filter(function(r) { return r.Active == true || r.Active === 'TRUE'; });
  var config     = getRows('Config');
  var renovation = getRows('Renovation');

  var totalCCBalance  = cards.reduce(function(s, c) { return s + Number(c.Balance); }, 0);
  var totalCCLimit    = cards.reduce(function(s, c) { return s + Number(c.Limit); }, 0);
  var totalMonthlyIncome = income.reduce(function(s, i) { return s + Number(i.Amount); }, 0);
  var totalLoanPayments  = loans.reduce(function(s, l) { return s + Number(l.MonthlyPayment); }, 0);
  var totalInstallments  = installs.reduce(function(s, i) { return s + Number(i.MonthlyAmount); }, 0);
  var totalBills    = bills.reduce(function(s, b) {
    return s + (b.Frequency === 'weekly' ? Number(b.Amount) * 4 : Number(b.Amount));
  }, 0);
  var totalSubs     = subs.reduce(function(s, sub) { return s + Number(sub.Amount); }, 0);
  var totalObligations = totalLoanPayments + totalInstallments + totalBills + totalSubs;

  var renovationSpent = renovation.reduce(function(s, r) { return s + Number(r.Amount); }, 0);
  var configMap = {};
  config.forEach(function(r) { configMap[r.Key] = r.Value; });

  return {
    totalCCBalance:      totalCCBalance,
    totalCCLimit:        totalCCLimit,
    totalCCAvailable:    totalCCLimit - totalCCBalance,
    totalMonthlyIncome:  totalMonthlyIncome,
    totalObligations:    totalObligations,
    breakdown: {
      loans:        totalLoanPayments,
      installments: totalInstallments,
      bills:        totalBills,
      subscriptions:totalSubs
    },
    netAfterObligations: totalMonthlyIncome - totalObligations,
    pastDueCards:   cards.filter(function(c) { return c.PastDue == true || c.PastDue === 'TRUE'; }),
    renovationSpent:     renovationSpent,
    renovationTarget:    Number(configMap['renovation_target'] || 1200000),
    renovationOnHand:    Number(configMap['renovation_on_hand'] || 570000),
    generatedAt:         new Date().toISOString()
  };
}

function _ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _error(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testGetDashboard() {
  var result = _getDashboard();
  Logger.log(JSON.stringify(result, null, 2));
  // Expected: object with totalCCBalance, totalMonthlyIncome (559000), etc.
}
```

- [ ] **Step 2: Push and test**

```powershell
clasp push
```
In Apps Script editor: Run → `testGetDashboard`  
Expected in log:
```json
{
  "totalMonthlyIncome": 559000,
  "totalCCBalance": 223470.1,
  "totalCCLimit": 3938000,
  ...
}
```

- [ ] **Step 3: Commit**

```powershell
git add appsscript/API.gs
git commit -m "feat: add API.gs with doGet/doPost router + dashboard aggregation"
```

---

## Task 6 — Deploy Apps Script as Web App

**Files:** none (deployment step)

- [ ] **Step 1: Deploy**

In Apps Script editor: Deploy → New Deployment  
- Type: Web App  
- Execute as: **Me (iampparaiso@gmail.com)**  
- Who has access: **Anyone with a Google Account**  
- Click Deploy → copy the Web App URL

- [ ] **Step 2: Note the URL**

The URL looks like:  
`https://script.google.com/macros/s/AKfyc.../exec`

Save it — this goes into `frontend/config.js` (gitignored).

- [ ] **Step 3: Create config files**

Create `C:\Users\ppara\Desktop\finance\frontend\config.example.js`:
```javascript
// Copy this to config.js and fill in your Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

Create `C:\Users\ppara\Desktop\finance\frontend\config.js`:
```javascript
const API_URL = 'https://script.google.com/macros/s/PASTE_YOUR_REAL_URL_HERE/exec';
```

- [ ] **Step 4: Test the endpoint**

```powershell
# Quick smoke test — should return {"ok":false,"error":"Unauthorized"} (no token = correct)
Invoke-WebRequest -Uri "YOUR_WEB_APP_URL?action=getCards" | Select-Object -ExpandProperty Content
```
Expected: `{"ok":false,"error":"Unauthorized"}` — confirms the endpoint is live and auth is working.

- [ ] **Step 5: Commit config template**

```powershell
git add frontend/config.example.js
git commit -m "feat: deploy Apps Script web app, add config template"
```

---

## Task 7 — Triggers.gs

**Files:**
- Create: `appsscript/Triggers.gs`

- [ ] **Step 1: Write Triggers.gs**

```javascript
function setupTriggers() {
  // Delete existing triggers first
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Run at 8am Manila time on the 1st of every month
  ScriptApp.newTrigger('monthlyRollover')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .inTimezone('Asia/Manila')
    .create();

  Logger.log('Triggers set up.');
}

function monthlyRollover() {
  _decrementInstallments();
  _checkExpiredBills();
  _generateAlerts();
}

function _decrementInstallments() {
  var installs = getRows('Installments');
  installs.forEach(function(inst) {
    if (inst.Status !== 'active') return;
    var remaining = Number(inst.MonthsRemaining);
    if (remaining === 0) return; // TBD — skip
    var newRemaining = remaining - 1;
    var newStatus = newRemaining <= 0 ? 'completed' : 'active';
    updateRowById('Installments', 'ID', inst.ID, {
      MonthsRemaining: newRemaining,
      Status: newStatus
    });
  });
}

function _checkExpiredBills() {
  var today = new Date();
  var bills = getRows('RecurringBills');
  bills.forEach(function(bill) {
    if (!bill.Active || bill.Active === 'FALSE') return;
    if (bill.EndDate && new Date(bill.EndDate) < today) {
      updateRowById('RecurringBills', 'ID', bill.ID, { Active: false });
    }
  });
}

function _generateAlerts() {
  var today = new Date();
  var todayDay = today.getDate();
  var alerts = [];

  // Past due cards
  var cards = getRows('CreditCards');
  cards.forEach(function(card) {
    if (card.PastDue == true || card.PastDue === 'TRUE') {
      alerts.push({
        ID:         'past-due-' + card.ID + '-' + today.getTime(),
        Type:       'PAST_DUE',
        Message:    card.Name + ' is PAST DUE. Balance: ₱' + Number(card.Balance).toLocaleString(),
        Severity:   'critical',
        DueDate:    card.DueDate,
        Resolved:   false,
        CreatedAt:  today.toISOString()
      });
    }
  });

  alerts.forEach(function(a) { appendRow('Alerts', a); });
}
```

- [ ] **Step 2: Push, set up triggers**

```powershell
clasp push
```
In Apps Script editor: Run → `setupTriggers`  
Check Triggers menu — should show `monthlyRollover` firing on 1st of month.

- [ ] **Step 3: Commit**

```powershell
git add appsscript/Triggers.gs
git commit -m "feat: add Triggers.gs for monthly rollover and alert generation"
```

---

## Task 8 — Frontend: api.js + format.js + calendar.js

**Files:**
- Create: `frontend/js/api.js`
- Create: `frontend/js/format.js`
- Create: `frontend/js/calendar.js`

- [ ] **Step 1: Write api.js**

```javascript
// api.js — all communication with Apps Script
let _token = null;

export function setToken(t) { _token = t; }
export function getToken()  { return _token; }

export async function get(action, params = {}) {
  const qs = new URLSearchParams({ action, token: _token, ...params }).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

export async function post(action, body = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token: _token, ...body })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}
```

- [ ] **Step 2: Write format.js**

```javascript
// format.js — display utilities
export function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function pesoFull(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateStr(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthStr(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export function dueBadge(days) {
  if (days === null) return '';
  if (days < 0)  return `<span class="badge danger">PAST DUE ${Math.abs(days)}d</span>`;
  if (days === 0) return `<span class="badge danger">DUE TODAY</span>`;
  if (days <= 3)  return `<span class="badge warn">Due in ${days}d</span>`;
  if (days <= 7)  return `<span class="badge info">Due in ${days}d</span>`;
  return `<span class="badge ok">Due ${dateStr(new Date(Date.now() + days * 86400000))}</span>`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
```

- [ ] **Step 3: Write calendar.js**

```javascript
// calendar.js — payday-aware cash flow engine

const PAYDAYS = [
  { person: 'Joeann', day: 10, amount: 95000 },
  { person: 'Paulo',  day: 15, amount: 94000 },
  { person: 'Joeann', day: 25, amount: 95000 },
  { person: 'Paulo',  day: 30, amount: 275000 }
];

export function getPaydays() { return PAYDAYS; }

export function safeToSpend(bills, installments, loans, subscriptions) {
  const today = new Date();
  const todayDay = today.getDate();

  // Find next payday
  const upcoming = PAYDAYS.filter(p => p.day > todayDay);
  const nextPayday = upcoming.length > 0 ? upcoming[0] : PAYDAYS[0];

  // Income received so far this month (paydays that have passed)
  const receivedThisMonth = PAYDAYS
    .filter(p => p.day <= todayDay)
    .reduce((s, p) => s + p.amount, 0);

  // Bills due between today and next payday
  const billsDueBeforePayday = [
    ...bills.filter(b => {
      if (!b.Active || b.Active === 'FALSE') return false;
      const d = Number(b.DueDay);
      return d > todayDay && d <= nextPayday.day;
    }).map(b => ({ name: b.Name, amount: Number(b.Amount), day: Number(b.DueDay) })),
    ...installments.filter(i => i.Status === 'active').map(i => ({
      name: i.Description, amount: Number(i.MonthlyAmount), day: null
    })),
    ...loans.map(l => ({
      name: l.Type, amount: Number(l.MonthlyPayment), day: Number(l.DueDay)
    })).filter(l => l.day > todayDay && l.day <= nextPayday.day),
    ...subscriptions.filter(s => {
      const d = Number(s.DueDay);
      return d > todayDay && d <= nextPayday.day;
    }).map(s => ({ name: s.Name, amount: Number(s.Amount), day: Number(s.DueDay) }))
  ];

  const committedBeforePayday = billsDueBeforePayday.reduce((s, b) => s + b.amount, 0);

  return {
    receivedThisMonth,
    nextPayday,
    committedBeforePayday,
    billsDueBeforePayday,
    safeAmount: receivedThisMonth - committedBeforePayday
  };
}

export function buildMonthCalendar(year, month, bills, loans, subscriptions, installments) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events = [];

  // Paydays
  PAYDAYS.forEach(p => {
    events.push({ day: p.day, type: 'income', label: `${p.person} Payday`, amount: p.amount });
  });

  // Bills
  bills.filter(b => b.Active && b.Active !== 'FALSE' && b.Frequency === 'monthly' && Number(b.DueDay) > 0).forEach(b => {
    events.push({ day: Number(b.DueDay), type: 'bill', label: b.Name, amount: Number(b.Amount) });
  });

  // Loans
  loans.forEach(l => {
    events.push({ day: Number(l.DueDay), type: 'loan', label: `${l.Bank} ${l.Type}`, amount: Number(l.MonthlyPayment) });
  });

  // Subscriptions
  subscriptions.filter(s => s.Active && s.Active !== 'FALSE').forEach(s => {
    events.push({ day: Number(s.DueDay), type: 'subscription', label: s.Name, amount: Number(s.Amount) });
  });

  // Group by day
  const byDay = {};
  for (let d = 1; d <= daysInMonth; d++) byDay[d] = [];
  events.forEach(e => {
    if (e.day >= 1 && e.day <= daysInMonth) byDay[e.day].push(e);
  });

  return byDay;
}
```

- [ ] **Step 4: Test calendar.js in browser console**

Open any HTML file in browser → Console:
```javascript
// Paste safeToSpend function, then:
const result = safeToSpend(
  [{Active:true, Name:'Globe', Amount:1599, DueDay:1, Frequency:'monthly'}],
  [], [], []
);
console.log(result);
// Expected: object with receivedThisMonth, nextPayday, safeAmount
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/js/api.js frontend/js/format.js frontend/js/calendar.js
git commit -m "feat: add api.js fetch wrapper, format.js, and calendar.js safe-to-spend engine"
```

---

## Task 9 — Design System (tokens.css + app.css)

> Use the `frontend-design` skill when writing the full CSS. This task defines the token layer; app.css is completed during module rendering tasks.

**Files:**
- Create: `frontend/css/tokens.css`

- [ ] **Step 1: Write tokens.css**

```css
:root {
  /* Japandi palette — warm white on deep charcoal */
  --bg:        #f5f0eb;
  --bg2:       #ede8e3;
  --surface:   #ffffff;
  --surface2:  #f9f6f3;
  --border:    #e0d9d2;
  --text:      #1a1814;
  --text2:     #4a453f;
  --muted:     #8a847d;
  --muted2:    #b0aaa3;

  /* Accent — warm terracotta + forest green */
  --acc:       #c4622d;   /* primary action */
  --acc2:      #6b8e6e;   /* positive/income */
  --acc3:      #4a7c59;   /* strong positive */
  --danger:    #c0392b;
  --warn:      #e67e22;
  --info:      #2980b9;
  --ok:        #27ae60;

  /* Card brand colors */
  --rcbc:      #e63946;
  --metro:     #3a86ff;
  --ew:        #2dc653;
  --ub:        #ff8c00;
  --bpi:       #c9184a;
  --bdo:       #1d4ed8;

  /* Typography */
  --font-sans: 'Inter', 'Helvetica Neue', sans-serif;
  --font-mono: 'DM Mono', 'Fira Code', monospace;

  /* Spacing scale */
  --sp1: 4px;
  --sp2: 8px;
  --sp3: 12px;
  --sp4: 16px;
  --sp5: 24px;
  --sp6: 32px;
  --sp7: 48px;

  /* Border radius */
  --r1: 6px;
  --r2: 12px;
  --r3: 18px;
  --r4: 24px;

  /* Shadows */
  --shadow1: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow2: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow3: 0 8px 24px rgba(0,0,0,0.10);

  /* Transitions */
  --t1: 150ms ease;
  --t2: 250ms ease;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:       #1a1814;
    --bg2:      #201e1a;
    --surface:  #2a2723;
    --surface2: #302d29;
    --border:   #3d3a35;
    --text:     #f0ebe5;
    --text2:    #c8c3bc;
    --muted:    #7a756e;
    --muted2:   #5a5550;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.mono { font-family: var(--font-mono); }
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/css/tokens.css
git commit -m "feat: add Japandi design tokens"
```

---

## Task 10 — index.html + app.js (Shell + Auth)

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/js/app.js`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Finance OS — Paraiso</title>
  <meta name="theme-color" content="#1a1814">
  <link rel="manifest" href="manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/app.css">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <!-- Auth gate -->
  <div id="auth-gate" class="auth-gate hidden">
    <div class="auth-card">
      <div class="auth-logo">Finance OS</div>
      <p class="auth-sub">Paraiso Household · Private</p>
      <div id="g_id_onload"
        data-client_id="GOOGLE_CLIENT_ID_PLACEHOLDER"
        data-callback="onGoogleSignIn"
        data-auto_prompt="true">
      </div>
      <div class="g_id_signin"
        data-type="standard"
        data-shape="pill"
        data-theme="outline"
        data-text="sign_in_with"
        data-size="large"
        data-logo_alignment="left">
      </div>
    </div>
  </div>

  <!-- App shell -->
  <div id="app" class="app hidden">
    <nav class="nav">
      <div class="nav-brand">Finance OS</div>
      <div class="nav-tabs" id="nav-tabs">
        <button class="nav-tab active" data-module="dashboard">Dashboard</button>
        <button class="nav-tab" data-module="cards">Cards</button>
        <button class="nav-tab" data-module="installments">Installments</button>
        <button class="nav-tab" data-module="loans">Loans</button>
        <button class="nav-tab" data-module="bills">Bills</button>
        <button class="nav-tab" data-module="renovation">Renovation</button>
        <button class="nav-tab" data-module="emergency-fund">Emergency Fund</button>
      </div>
      <button class="nav-refresh" id="refresh-btn" title="Refresh">↻</button>
    </nav>
    <main id="main" class="main">
      <div class="loading-spinner" id="loading">Loading...</div>
    </main>
  </div>

  <script src="config.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write app.js**

```javascript
import { setToken } from './api.js';
import { renderDashboard }     from './dashboard.js';
import { renderCards }         from './cards.js';
import { renderInstallments }  from './installments.js';
import { renderLoans }         from './loans.js';
import { renderBills }         from './bills.js';
import { renderRenovation }    from './renovation.js';
import { renderEmergencyFund } from './emergency-fund.js';

const MODULES = {
  dashboard:      renderDashboard,
  cards:          renderCards,
  installments:   renderInstallments,
  loans:          renderLoans,
  bills:          renderBills,
  renovation:     renderRenovation,
  'emergency-fund': renderEmergencyFund
};

let currentModule = 'dashboard';

window.onGoogleSignIn = async function(response) {
  setToken(response.credential);
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await loadModule('dashboard');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('auth-gate').classList.remove('hidden');

  document.getElementById('nav-tabs').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-module]');
    if (!btn) return;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentModule = btn.dataset.module;
    await loadModule(currentModule);
  });

  document.getElementById('refresh-btn').addEventListener('click', () => loadModule(currentModule));
});

async function loadModule(name) {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="loading-spinner">Loading...</div>';
  try {
    await MODULES[name](main);
  } catch (err) {
    main.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/index.html frontend/js/app.js
git commit -m "feat: add app shell with Google Sign-In auth gate and module router"
```

> **NOTE:** The `data-client_id` placeholder in index.html requires a Google OAuth 2.0 Client ID. Create one at https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth Client ID → Web application. Add `https://iampparaiso.github.io` as an Authorized JavaScript origin.

---

## Task 11 — Dashboard Module

**Files:**
- Create: `frontend/js/dashboard.js`
- Create: `frontend/css/app.css` (start here, expand in later tasks)

- [ ] **Step 1: Write dashboard.js**

```javascript
import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge, pct } from './format.js';

export async function renderDashboard(container) {
  const d = await get('getDashboard');
  const utilizationPct = pct(d.totalCCBalance, d.totalCCLimit);

  container.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
    </div>

    ${d.pastDueCards.length > 0 ? `
    <div class="alert-bar danger">
      ⚠ PAST DUE: ${d.pastDueCards.map(c => `${c.Name} (${peso(c.Balance)})`).join(' · ')}
    </div>` : ''}

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
    </div>

    <div class="section-title">Obligations Breakdown</div>
    <div class="breakdown-grid">
      <div class="breakdown-row"><span>Bank Loans</span><span class="mono">${peso(d.breakdown.loans)}/mo</span></div>
      <div class="breakdown-row"><span>CC Installments</span><span class="mono">${peso(d.breakdown.installments)}/mo</span></div>
      <div class="breakdown-row"><span>Fixed Bills</span><span class="mono">${peso(d.breakdown.bills)}/mo</span></div>
      <div class="breakdown-row"><span>Subscriptions</span><span class="mono">${peso(d.breakdown.subscriptions)}/mo</span></div>
      <div class="breakdown-row total"><span>Total</span><span class="mono">${peso(d.totalObligations)}/mo</span></div>
    </div>

    <div class="section-title">Renovation Progress</div>
    <div class="reno-card">
      <div class="reno-row">
        <span>On-hand</span><span class="mono ok">${peso(d.renovationOnHand)}</span>
      </div>
      <div class="reno-row">
        <span>Spent</span><span class="mono warn">${peso(d.renovationSpent)}</span>
      </div>
      <div class="reno-row">
        <span>Target</span><span class="mono">${peso(d.renovationTarget)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct(d.renovationOnHand - d.renovationSpent, d.renovationTarget)}%"></div>
      </div>
      <div class="reno-gap">Gap to target: ${peso(d.renovationTarget - (d.renovationOnHand - d.renovationSpent))}</div>
    </div>
  `;
}
```

- [ ] **Step 2: Write initial app.css**

```css
/* === LAYOUT === */
.app { display: flex; flex-direction: column; min-height: 100vh; }

.nav {
  display: flex; align-items: center; gap: var(--sp3);
  padding: var(--sp3) var(--sp5);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 100;
  box-shadow: var(--shadow1);
}
.nav-brand { font-weight: 700; font-size: 1rem; color: var(--acc); white-space: nowrap; }
.nav-tabs  { display: flex; gap: var(--sp1); flex-wrap: wrap; flex: 1; }
.nav-tab   { padding: 6px 14px; border: none; border-radius: var(--r1); background: transparent; color: var(--text2); font-size: 0.85rem; cursor: pointer; transition: all var(--t1); }
.nav-tab:hover  { background: var(--bg2); color: var(--text); }
.nav-tab.active { background: var(--acc); color: #fff; font-weight: 600; }
.nav-refresh { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r1); background: transparent; cursor: pointer; font-size: 1.1rem; color: var(--muted); transition: all var(--t1); }
.nav-refresh:hover { color: var(--text); border-color: var(--acc); }

.main { padding: var(--sp5); max-width: 1200px; margin: 0 auto; width: 100%; }

/* === AUTH GATE === */
.auth-gate { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); }
.auth-card { text-align: center; padding: var(--sp7); background: var(--surface); border-radius: var(--r3); box-shadow: var(--shadow3); }
.auth-logo { font-size: 1.8rem; font-weight: 700; color: var(--acc); margin-bottom: var(--sp2); }
.auth-sub  { color: var(--muted); margin-bottom: var(--sp6); font-size: 0.9rem; }

.hidden { display: none !important; }

/* === PAGE HEADER === */
.page-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--sp5); }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }
.page-date { color: var(--muted); font-size: 0.85rem; }

/* === ALERT BAR === */
.alert-bar { padding: var(--sp3) var(--sp4); border-radius: var(--r2); margin-bottom: var(--sp4); font-size: 0.9rem; font-weight: 600; }
.alert-bar.danger { background: #fde8e8; color: var(--danger); border-left: 4px solid var(--danger); }
.alert-bar.warn   { background: #fef3e2; color: var(--warn);   border-left: 4px solid var(--warn); }

/* === STAT GRID === */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: var(--sp4); margin-bottom: var(--sp6); }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); padding: var(--sp5); box-shadow: var(--shadow1); }
.stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: var(--sp2); }
.stat-value { font-size: 1.6rem; font-weight: 700; font-family: var(--font-mono); margin-bottom: var(--sp1); }
.stat-sub   { font-size: 0.75rem; color: var(--muted2); }

/* === COLORS === */
.ok     { color: var(--ok); }
.warn   { color: var(--warn); }
.danger { color: var(--danger); }
.info   { color: var(--info); }
.acc    { color: var(--acc); }
.muted  { color: var(--muted); }

/* === SECTION TITLE === */
.section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: var(--sp5) 0 var(--sp3); font-weight: 600; }

/* === BREAKDOWN === */
.breakdown-grid { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); overflow: hidden; margin-bottom: var(--sp5); }
.breakdown-row  { display: flex; justify-content: space-between; padding: var(--sp3) var(--sp4); border-bottom: 1px solid var(--border); font-size: 0.9rem; }
.breakdown-row:last-child { border-bottom: none; }
.breakdown-row.total { font-weight: 700; background: var(--bg2); }

/* === RENOVATION === */
.reno-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); padding: var(--sp4); margin-bottom: var(--sp5); }
.reno-row  { display: flex; justify-content: space-between; padding: var(--sp2) 0; font-size: 0.9rem; }
.reno-gap  { font-size: 0.8rem; color: var(--muted); margin-top: var(--sp3); }

/* === PROGRESS BAR === */
.progress-bar  { height: 8px; background: var(--bg2); border-radius: 4px; overflow: hidden; margin: var(--sp3) 0; }
.progress-fill { height: 100%; background: var(--acc2); border-radius: 4px; transition: width var(--t2); }

/* === BADGES === */
.badge { display: inline-block; padding: 2px 8px; border-radius: var(--r1); font-size: 0.7rem; font-weight: 600; }
.badge.danger { background: #fde8e8; color: var(--danger); }
.badge.warn   { background: #fef3e2; color: var(--warn); }
.badge.info   { background: #e8f4fd; color: var(--info); }
.badge.ok     { background: #e8fdf0; color: var(--ok); }

/* === LOADING / ERROR === */
.loading-spinner { text-align: center; padding: var(--sp7); color: var(--muted); }
.error-state     { text-align: center; padding: var(--sp7); color: var(--danger); }

/* === CARDS === */
.card-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); margin-bottom: var(--sp3); overflow: hidden; box-shadow: var(--shadow1); }
.card-head { display: flex; justify-content: space-between; align-items: center; padding: var(--sp4); cursor: pointer; }
.card-head:hover { background: var(--bg2); }
.card-dot  { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: var(--sp2); }
.card-name { font-weight: 600; font-size: 0.95rem; }
.card-sub  { font-size: 0.75rem; color: var(--muted); }
.card-balance { font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; }
.card-detail { padding: var(--sp4); border-top: 1px solid var(--border); display: none; }
.card-detail.open { display: block; }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: var(--sp3); }
.detail-item .dl { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; margin-bottom: 2px; }
.detail-item .dv { font-size: 0.9rem; font-weight: 600; }

/* === UTILIZATION BAR === */
.util-wrap { padding: 0 var(--sp4) var(--sp2); }
.util-bar  { height: 4px; background: var(--bg2); border-radius: 2px; }
.util-fill { height: 100%; border-radius: 2px; }

/* === TABLE === */
.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.data-table th { text-align: left; padding: var(--sp2) var(--sp3); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 2px solid var(--border); }
.data-table td { padding: var(--sp3); border-bottom: 1px solid var(--border); }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--bg2); }

/* === LOG FORM === */
.log-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); padding: var(--sp4); margin-bottom: var(--sp5); }
.form-row  { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: var(--sp3); margin-bottom: var(--sp3); }
.form-group label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: var(--sp1); }
.form-group input, .form-group select {
  width: 100%; padding: var(--sp2) var(--sp3);
  border: 1px solid var(--border); border-radius: var(--r1);
  background: var(--bg); color: var(--text); font-size: 0.875rem;
}
.btn { padding: var(--sp2) var(--sp4); border: none; border-radius: var(--r1); cursor: pointer; font-size: 0.875rem; font-weight: 600; transition: all var(--t1); }
.btn-primary { background: var(--acc); color: #fff; }
.btn-primary:hover { opacity: 0.88; }

/* === RESPONSIVE === */
@media (max-width: 640px) {
  .nav-tabs { display: none; }
  .main { padding: var(--sp4); }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/js/dashboard.js frontend/css/app.css
git commit -m "feat: add dashboard module and base app.css"
```

---

## Task 12 — Cards + Installments Modules

**Files:**
- Create: `frontend/js/cards.js`
- Create: `frontend/js/installments.js`

- [ ] **Step 1: Write cards.js**

```javascript
import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge, pct } from './format.js';

export async function renderCards(container) {
  const cards = await get('getCards');

  container.innerHTML = `
    <div class="page-header"><h1>Credit Cards</h1></div>
    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Total Limit</div>
        <div class="stat-value">${peso(cards.reduce((s,c)=>s+Number(c.Limit),0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Balance</div>
        <div class="stat-value warn">${peso(cards.reduce((s,c)=>s+Number(c.Balance),0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available</div>
        <div class="stat-value ok">${peso(cards.reduce((s,c)=>s+(Number(c.Limit)-Number(c.Balance)),0))}</div>
      </div>
    </div>
    ${cards.map(c => _cardRow(c)).join('')}
  `;

  container.querySelectorAll('.card-head').forEach(h => {
    h.addEventListener('click', () => {
      h.nextElementSibling?.nextElementSibling?.classList.toggle('open');
    });
  });
}

function _cardRow(c) {
  const days = daysUntil(c.DueDate);
  const utilPct = pct(Number(c.Balance), Number(c.Limit));
  const fillColor = utilPct > 50 ? 'var(--danger)' : utilPct > 20 ? 'var(--warn)' : 'var(--ok)';

  return `
  <div class="card-row">
    <div class="card-head">
      <div style="display:flex;align-items:center;gap:var(--sp2)">
        <span class="card-dot" style="background:${c.Color}"></span>
        <div>
          <div class="card-name">${c.Name}</div>
          <div class="card-sub">${c.Last4 ? '••' + c.Last4 + ' · ' : ''}${c.Network}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="card-balance ${Number(c.Balance)===0?'ok':c.PastDue?'danger':'warn'}">${peso(c.Balance)}</div>
        <div style="font-size:0.75rem;color:var(--muted)">${c.DueDate ? dueBadge(days) : '<span class="badge ok">CLEAR</span>'}</div>
      </div>
    </div>
    <div class="util-wrap">
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--muted);margin-bottom:4px">
        <span>Utilization ${utilPct}%</span>
        <span>${peso(Number(c.Limit)-Number(c.Balance))} available</span>
      </div>
      <div class="util-bar"><div class="util-fill" style="width:${utilPct}%;background:${fillColor}"></div></div>
    </div>
    <div class="card-detail">
      <div class="detail-grid">
        <div class="detail-item"><div class="dl">Credit Limit</div><div class="dv">${peso(c.Limit)}</div></div>
        <div class="detail-item"><div class="dl">Balance</div><div class="dv ${c.PastDue?'danger':'warn'}">${peso(c.Balance)}</div></div>
        <div class="detail-item"><div class="dl">Statement Cut</div><div class="dv">${c.StatementCutDay}th</div></div>
        <div class="detail-item"><div class="dl">Due Date</div><div class="dv">${c.DueDate ? dateStr(c.DueDate) : '—'}</div></div>
        <div class="detail-item"><div class="dl">Interest Rate</div><div class="dv danger">${(Number(c.InterestRate)*100).toFixed(0)}%/mo</div></div>
        ${Number(c.UnbilledInstallments)>0?`<div class="detail-item"><div class="dl">Unbilled Installs</div><div class="dv warn">${peso(c.UnbilledInstallments)}</div></div>`:''}
        ${c.CashAdvanceLimit?`<div class="detail-item"><div class="dl">Cash Advance</div><div class="dv">${peso(c.CashAdvanceLimit)}</div></div>`:''}
      </div>
    </div>
  </div>`;
}
```

- [ ] **Step 2: Write installments.js**

```javascript
import { get } from './api.js';
import { peso, dateStr } from './format.js';

export async function renderInstallments(container) {
  const installs = await get('getInstallments');
  const active   = installs.filter(i => i.Status === 'active');
  const upcoming = installs.filter(i => i.Status === 'upcoming');
  const done     = installs.filter(i => i.Status === 'completed');

  const totalMonthly = active.reduce((s,i) => s + Number(i.MonthlyAmount), 0);

  container.innerHTML = `
    <div class="page-header">
      <h1>CC Installments</h1>
      <span class="stat-value warn mono">${peso(totalMonthly)}/mo</span>
    </div>

    <div class="section-title">Active (${active.length})</div>
    <div class="breakdown-grid">
      ${active.map(i => `
        <div class="breakdown-row">
          <div>
            <div style="font-weight:600;font-size:0.9rem">${i.Description}</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.CardID.toUpperCase()}${i.Note?' · '+i.Note:''}</div>
          </div>
          <div style="text-align:right">
            <div class="mono warn">${peso(i.MonthlyAmount)}/mo</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.MonthsRemaining>0?i.MonthsRemaining+' months left':'TBD'}</div>
          </div>
        </div>
      `).join('')}
      <div class="breakdown-row total">
        <span>Total Monthly</span>
        <span class="mono">${peso(totalMonthly)}/mo</span>
      </div>
    </div>

    ${upcoming.length > 0 ? `
    <div class="section-title">Upcoming (${upcoming.length})</div>
    <div class="breakdown-grid">
      ${upcoming.map(i => `
        <div class="breakdown-row">
          <div>
            <div style="font-weight:600;font-size:0.9rem">${i.Description}</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.CardID.toUpperCase()} · starts ${dateStr(i.StartDate)}</div>
          </div>
          <div style="text-align:right">
            <div class="mono">${peso(i.MonthlyAmount)}/mo</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.MonthsRemaining} months</div>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${done.length > 0 ? `
    <div class="section-title">Completed (${done.length})</div>
    <div class="breakdown-grid" style="opacity:0.5">
      ${done.map(i => `<div class="breakdown-row"><span>${i.Description}</span><span class="badge ok">Done</span></div>`).join('')}
    </div>` : ''}
  `;
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/js/cards.js frontend/js/installments.js
git commit -m "feat: add cards and installments modules"
```

---

## Task 13 — Loans + Bills Modules

**Files:**
- Create: `frontend/js/loans.js`
- Create: `frontend/js/bills.js`

- [ ] **Step 1: Write loans.js**

```javascript
import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge } from './format.js';

export async function renderLoans(container) {
  const loans = await get('getLoans');

  container.innerHTML = `
    <div class="page-header"><h1>Bank Loans</h1></div>
    ${loans.map(l => `
      <div class="card-row" style="margin-bottom:var(--sp4)">
        <div style="padding:var(--sp4)">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--sp4)">
            <div>
              <div style="font-weight:700;font-size:1rem">${l.Bank} ${l.Type}</div>
              <div style="font-size:0.75rem;color:var(--muted)">${l.AccountNo}</div>
            </div>
            <div style="text-align:right">
              <div class="mono warn" style="font-size:1.2rem">${peso(l.OutstandingBalance)}</div>
              <div style="font-size:0.75rem;color:var(--muted)">outstanding</div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><div class="dl">Monthly Payment</div><div class="dv warn">${peso(l.MonthlyPayment)}</div></div>
            <div class="detail-item"><div class="dl">Due Day</div><div class="dv">${l.DueDay}th · ${dueBadge(daysUntil(l.NextDueDate))}</div></div>
            <div class="detail-item"><div class="dl">Remaining</div><div class="dv">${l.RemainingPayments} payments</div></div>
            <div class="detail-item"><div class="dl">Maturity</div><div class="dv">${l.MaturityDate ? dateStr(l.MaturityDate) : '—'}</div></div>
            <div class="detail-item"><div class="dl">Payoff Amount</div><div class="dv">${peso(l.PayoffAmount)}</div></div>
            ${l.InterestRate>0?`<div class="detail-item"><div class="dl">Interest Rate</div><div class="dv danger">${(Number(l.InterestRate)*100).toFixed(1)}%/yr</div></div>`:''}
            ${Number(l.InsurancePremium)>0?`<div class="detail-item"><div class="dl">Insurance Premium</div><div class="dv">${peso(l.InsurancePremium)}/mo</div></div>`:''}
          </div>
          <div class="progress-bar" style="margin-top:var(--sp4)">
            <div class="progress-fill" style="width:${Math.max(0,100-Math.round((l.RemainingPayments/((l.RemainingPayments||1)+1))*100))}%"></div>
          </div>
        </div>
      </div>
    `).join('')}
    <div style="font-size:0.8rem;color:var(--muted);text-align:right">
      Combined monthly loans: <strong>${peso(loans.reduce((s,l)=>s+Number(l.MonthlyPayment),0))}</strong>
    </div>
  `;
}
```

- [ ] **Step 2: Write bills.js**

```javascript
import { get } from './api.js';
import { peso, safeToSpendFromAPI } from './format.js';
import { safeToSpend } from './calendar.js';

export async function renderBills(container) {
  const [bills, subs, loans, installs] = await Promise.all([
    get('getBills'),
    get('getSubscriptions'),
    get('getLoans'),
    get('getInstallments')
  ]);

  const active   = bills.filter(b => b.Active === true || b.Active === 'TRUE');
  const sts      = safeToSpend(active, installs, loans, subs);

  const totalBills = active.reduce((s,b) => s + (b.Frequency === 'weekly' ? Number(b.Amount)*4 : Number(b.Amount)), 0);
  const totalSubs  = subs.filter(s => s.Active).reduce((s,sub) => s + Number(sub.Amount), 0);

  const byCategory = {};
  active.forEach(b => {
    if (!byCategory[b.Category]) byCategory[b.Category] = [];
    byCategory[b.Category].push(b);
  });

  container.innerHTML = `
    <div class="page-header"><h1>Bills & Obligations</h1></div>

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Safe to Spend Now</div>
        <div class="stat-value ${sts.safeAmount >= 0 ? 'ok' : 'danger'}">${peso(sts.safeAmount)}</div>
        <div class="stat-sub">Before ${sts.nextPayday.person}'s payday (${sts.nextPayday.day}th)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Income Received</div>
        <div class="stat-value ok">${peso(sts.receivedThisMonth)}</div>
        <div class="stat-sub">So far this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Committed Before Payday</div>
        <div class="stat-value warn">${peso(sts.committedBeforePayday)}</div>
        <div class="stat-sub">${sts.billsDueBeforePayday.length} items due</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monthly Bills Total</div>
        <div class="stat-value">${peso(totalBills)}</div>
        <div class="stat-sub">Excl. loans & CC installs</div>
      </div>
    </div>

    ${Object.entries(byCategory).map(([cat, items]) => `
      <div class="section-title">${cat.charAt(0).toUpperCase()+cat.slice(1)}</div>
      <div class="breakdown-grid">
        ${items.map(b => `
          <div class="breakdown-row">
            <div>
              <span>${b.Name}</span>
              ${b.IsEstimate==='TRUE'||b.IsEstimate===true?'<span style="font-size:0.7rem;color:var(--muted)"> ~est</span>':''}
              ${b.EndsOnMoveIn==='TRUE'||b.EndsOnMoveIn===true?'<span style="font-size:0.7rem;color:var(--acc)"> [ends on move-in]</span>':''}
            </div>
            <div style="text-align:right">
              <span class="mono">${peso(b.Amount)}</span>
              <span style="font-size:0.7rem;color:var(--muted)"> ${b.Frequency==='weekly'?'×4/mo':b.DueDay?'· due '+b.DueDay+'th':''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}

    <div class="section-title">Subscriptions</div>
    <div class="breakdown-grid">
      ${subs.filter(s=>s.Active).map(s => `
        <div class="breakdown-row">
          <div>
            <span>${s.Name}</span>
            <span style="font-size:0.7rem;color:var(--muted)"> · ${s.PaymentMethod}</span>
          </div>
          <div style="text-align:right">
            <span class="mono">${peso(s.Amount)}</span>
            <span style="font-size:0.7rem;color:var(--muted)"> · due ${s.DueDay}th</span>
          </div>
        </div>
      `).join('')}
      <div class="breakdown-row total"><span>Subscriptions Total</span><span class="mono">${peso(totalSubs)}/mo</span></div>
    </div>
  `;
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/js/loans.js frontend/js/bills.js
git commit -m "feat: add loans and bills modules with safe-to-spend engine"
```

---

## Task 14 — Renovation + Emergency Fund Modules

**Files:**
- Create: `frontend/js/renovation.js`
- Create: `frontend/js/emergency-fund.js`

- [ ] **Step 1: Write renovation.js**

```javascript
import { get, post } from './api.js';
import { peso, dateStr, pct } from './format.js';

export async function renderRenovation(container) {
  const [rows, config] = await Promise.all([get('getRenovation'), get('getConfig')]);
  const configMap = {};
  config.forEach(r => { configMap[r.Key] = r.Value; });

  const onHand  = Number(configMap['renovation_on_hand']  || 570000);
  const target  = Number(configMap['renovation_target']   || 1200000);
  const spent   = rows.reduce((s, r) => s + Number(r.Amount), 0);
  const gap     = target - onHand;
  const remaining = onHand - spent;

  const byCategory = {};
  rows.forEach(r => {
    byCategory[r.Category] = (byCategory[r.Category] || 0) + Number(r.Amount);
  });

  container.innerHTML = `
    <div class="page-header"><h1>Renovation Tracker</h1><span style="color:var(--muted);font-size:0.85rem">Condo · Target ${peso(target)}</span></div>

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">On-Hand Budget</div>
        <div class="stat-value ok">${peso(onHand)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Spent So Far</div>
        <div class="stat-value warn">${peso(spent)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Remaining Cash</div>
        <div class="stat-value ${remaining>=0?'ok':'danger'}">${peso(remaining)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gap to Target</div>
        <div class="stat-value danger">${peso(gap)}</div>
        <div class="stat-sub">Fund via CC cash offers</div>
      </div>
    </div>

    <div class="progress-bar" style="height:12px;margin-bottom:var(--sp5)">
      <div class="progress-fill" style="width:${pct(onHand-spent, target)}%"></div>
    </div>

    <div class="section-title">Log Expense</div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" id="reno-date" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Description</label><input type="text" id="reno-desc" placeholder="e.g. Tiles - Bathroom"></div>
        <div class="form-group"><label>Amount (₱)</label><input type="number" id="reno-amount" placeholder="0"></div>
        <div class="form-group">
          <label>Category</label>
          <select id="reno-cat">
            <option>Contractor</option><option>Materials</option><option>Appliances</option>
            <option>Furniture</option><option>Fixtures</option><option>Miscellaneous</option>
          </select>
        </div>
        <div class="form-group"><label>Payment Method</label><input type="text" id="reno-payment" placeholder="e.g. BDO CC, Cash"></div>
      </div>
      <button class="btn btn-primary" id="reno-submit">Log Expense</button>
      <span id="reno-msg" style="margin-left:var(--sp3);font-size:0.85rem;color:var(--muted)"></span>
    </div>

    ${Object.keys(byCategory).length > 0 ? `
    <div class="section-title">By Category</div>
    <div class="breakdown-grid" style="margin-bottom:var(--sp5)">
      ${Object.entries(byCategory).map(([cat,amt]) => `
        <div class="breakdown-row"><span>${cat}</span><span class="mono">${peso(amt)}</span></div>
      `).join('')}
      <div class="breakdown-row total"><span>Total Spent</span><span class="mono">${peso(spent)}</span></div>
    </div>` : ''}

    ${rows.length > 0 ? `
    <div class="section-title">Expense Log</div>
    <table class="data-table">
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Payment</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${[...rows].reverse().map(r => `
          <tr>
            <td>${dateStr(r.Date)}</td>
            <td>${r.Description}</td>
            <td><span class="badge info">${r.Category}</span></td>
            <td style="color:var(--muted)">${r.PaymentMethod}</td>
            <td class="mono" style="text-align:right;color:var(--warn)">${peso(r.Amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<div style="color:var(--muted);text-align:center;padding:var(--sp6)">No expenses logged yet.</div>'}
  `;

  document.getElementById('reno-submit').addEventListener('click', async () => {
    const msg = document.getElementById('reno-msg');
    try {
      await post('logRenovation', {
        date:          document.getElementById('reno-date').value,
        description:   document.getElementById('reno-desc').value,
        amount:        Number(document.getElementById('reno-amount').value),
        category:      document.getElementById('reno-cat').value,
        paymentMethod: document.getElementById('reno-payment').value
      });
      msg.textContent = '✓ Logged!';
      msg.style.color = 'var(--ok)';
      setTimeout(() => renderRenovation(container), 1000);
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
    }
  });
}
```

- [ ] **Step 2: Write emergency-fund.js**

```javascript
import { get, post } from './api.js';
import { peso, dateStr, pct } from './format.js';

export async function renderEmergencyFund(container) {
  const rows = await get('getEmergencyFund');
  const TARGET = 500000;
  const activationDate = new Date('2026-07-01');
  const today = new Date();
  const isActive = today >= activationDate;

  const currentBalance = rows.length > 0 ? Number(rows[rows.length - 1].Balance) : 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>Emergency Fund</h1>
      <span class="badge ${isActive?'ok':'info'}">${isActive ? 'Active' : 'Starts July 2026'}</span>
    </div>

    ${!isActive ? `<div class="alert-bar info" style="background:#e8f4fd;color:var(--info);border-left:4px solid var(--info)">
      Emergency fund contributions begin July 1, 2026 — after condo renovation is complete.
    </div>` : ''}

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Current Balance</div>
        <div class="stat-value ok">${peso(currentBalance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Target</div>
        <div class="stat-value">${peso(TARGET)}</div>
        <div class="stat-sub">~1 month household expenses</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Progress</div>
        <div class="stat-value ${currentBalance>=TARGET?'ok':'warn'}">${pct(currentBalance,TARGET)}%</div>
      </div>
    </div>

    <div class="progress-bar" style="height:12px;margin-bottom:var(--sp5)">
      <div class="progress-fill" style="width:${pct(currentBalance,TARGET)}%"></div>
    </div>

    ${isActive ? `
    <div class="section-title">Log Transaction</div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" id="ef-date" value="${today.toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Type</label><select id="ef-type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></div>
        <div class="form-group"><label>Amount (₱)</label><input type="number" id="ef-amount" placeholder="0"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="ef-notes" placeholder="Optional"></div>
      </div>
      <button class="btn btn-primary" id="ef-submit">Save</button>
      <span id="ef-msg" style="margin-left:var(--sp3);font-size:0.85rem"></span>
    </div>` : ''}

    ${rows.length > 0 ? `
    <div class="section-title">Transaction Log</div>
    <table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th style="text-align:right">Balance</th></tr></thead>
      <tbody>
        ${[...rows].reverse().map(r => `
          <tr>
            <td>${dateStr(r.Date)}</td>
            <td><span class="badge ${r.Type==='deposit'?'ok':'warn'}">${r.Type}</span></td>
            <td class="mono ${r.Type==='deposit'?'ok':'danger'}">${r.Type==='deposit'?'+':'−'}${peso(r.Amount)}</td>
            <td class="mono" style="text-align:right">${peso(r.Balance)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<div style="color:var(--muted);text-align:center;padding:var(--sp6)">No transactions yet.</div>'}
  `;

  const submitBtn = document.getElementById('ef-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const msg = document.getElementById('ef-msg');
      try {
        await post('logEmergencyFund', {
          date:   document.getElementById('ef-date').value,
          type:   document.getElementById('ef-type').value,
          amount: Number(document.getElementById('ef-amount').value),
          notes:  document.getElementById('ef-notes').value
        });
        msg.textContent = '✓ Saved!';
        msg.style.color = 'var(--ok)';
        setTimeout(() => renderEmergencyFund(container), 1000);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.style.color = 'var(--danger)';
      }
    });
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/js/renovation.js frontend/js/emergency-fund.js
git commit -m "feat: add renovation tracker and emergency fund modules"
```

---

## Task 15 — PWA Manifest + Service Worker

**Files:**
- Create: `frontend/manifest.json`
- Create: `frontend/sw.js`

- [ ] **Step 1: Write manifest.json**

```json
{
  "name": "Finance OS — Paraiso",
  "short_name": "Finance OS",
  "description": "Paraiso Household Financial Operating System",
  "start_url": "/finance/",
  "scope": "/finance/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#f5f0eb",
  "theme_color": "#1a1814",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Write sw.js**

```javascript
const CACHE = 'finance-os-v1';
const PRECACHE = [
  '/finance/',
  '/finance/index.html',
  '/finance/manifest.json',
  '/finance/css/tokens.css',
  '/finance/css/app.css',
  '/finance/js/app.js',
  '/finance/js/api.js',
  '/finance/js/format.js',
  '/finance/js/calendar.js',
  '/finance/js/dashboard.js',
  '/finance/js/cards.js',
  '/finance/js/installments.js',
  '/finance/js/loans.js',
  '/finance/js/bills.js',
  '/finance/js/renovation.js',
  '/finance/js/emergency-fund.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for static assets
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"ok":false,"error":"Offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
```

- [ ] **Step 3: Register service worker in app.js**

Add to bottom of `frontend/js/app.js`:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/finance/sw.js').catch(console.error);
}
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/manifest.json frontend/sw.js frontend/js/app.js
git commit -m "feat: add PWA manifest and service worker"
```

---

## Task 16 — GitHub Pages Deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Enable GitHub Pages**

On GitHub.com → repo `iampparaiso/finance` → Settings → Pages  
Source: **GitHub Actions**

- [ ] **Step 3: Create placeholder icons**

Create two 1x1 pixel PNGs at:
- `frontend/icon-192.png`
- `frontend/icon-512.png`

(Replace with real icons later. For now any PNG works to prevent 404.)

```powershell
# Create minimal valid PNG (1x1 transparent)
[System.IO.File]::WriteAllBytes(
  "C:\Users\ppara\Desktop\finance\frontend\icon-192.png",
  [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
)
[System.IO.File]::WriteAllBytes(
  "C:\Users\ppara\Desktop\finance\frontend\icon-512.png",
  [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
)
```

- [ ] **Step 4: Push everything**

```powershell
cd "C:\Users\ppara\Desktop\finance"
git add .github/workflows/deploy.yml frontend/icon-192.png frontend/icon-512.png
git commit -m "feat: add GitHub Pages deploy workflow and PWA icons"
git push origin main
```

- [ ] **Step 5: Verify deploy**

On GitHub.com → Actions tab → watch deploy workflow  
Expected: green checkmark. Then open `https://iampparaiso.github.io/finance/`

---

## Task 17 — Google OAuth Client ID

> Without this, Google Sign-In button won't load. This is a one-time Google Cloud setup.

- [ ] **Step 1: Create OAuth Client ID**

Go to: https://console.cloud.google.com  
Create a project named "Finance OS" (or use existing).  
APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID  
Application type: **Web application**  
Authorized JavaScript origins:
```
https://iampparaiso.github.io
http://localhost
```
Authorized redirect URIs: (leave empty for GIS)  
Click Create → copy the **Client ID**

- [ ] **Step 2: Add Client ID to index.html**

In `frontend/index.html`, replace `GOOGLE_CLIENT_ID_PLACEHOLDER`:
```html
data-client_id="YOUR_CLIENT_ID_HERE.apps.googleusercontent.com"
```

- [ ] **Step 3: Push**

```powershell
git add frontend/index.html
git commit -m "feat: add Google OAuth client ID"
git push origin main
```

- [ ] **Step 4: End-to-end test**

1. Open `https://iampparaiso.github.io/finance/`
2. Google Sign-In prompt appears
3. Sign in as `iampparaiso@gmail.com`
4. Dashboard loads with real data from Sheets
5. Repeat test with `mjaparaiso227@gmail.com`
6. Try any other Google account → should get "Unauthorized" error

---

## Self-Review Checklist

- [x] **Spec coverage:** Auth ✓, Cards ✓, Installments ✓, Loans ✓, Bills ✓, Safe-to-Spend ✓, Renovation ✓, Emergency Fund ✓, Dashboard ✓, PWA ✓, GitHub Pages ✓
- [x] **Placeholders:** None — all code is complete
- [x] **Type consistency:** `getRows()` used consistently, `ID` field used in all `updateRowById` calls, module function signatures match `app.js` imports
- [x] **Initial data:** All 14 recurring bills, 5 subscriptions, 7 installments, 2 bank loans, 6 credit cards encoded in `initial-data.json` and mirrored in `Setup.gs`
- [x] **Missing:** Spend Log module — add as Task 18 if needed (read from SpendLog sheet, append via `post('logSpend',...)`)
