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
  _createSheet(ss, 'SpendLog',      ['Timestamp','Date','Description','Amount','Category','CardID','Month','Notes','AddedBy']);
  _createSheet(ss, 'Renovation',    ['Timestamp','Date','Description','Amount','Category','PaymentMethod','Receipt','AddedBy']);
  _createSheet(ss, 'EmergencyFund', ['Timestamp','Date','Type','Amount','Balance','Notes']);
  _createSheet(ss, 'Alerts',        ['ID','Type','Message','Severity','DueDate','Resolved','CreatedAt']);

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
  _batchAppend(ss, 'Config', [
    ['owner_email',           'iampparaiso@gmail.com',  'Primary owner'],
    ['whitelist',             'iampparaiso@gmail.com,mjaparaiso227@gmail.com', 'Comma-separated'],
    ['move_in_date',          '',                       'Set when condo is ready — deactivates Rent + LP Assoc'],
    ['emergency_fund_start',  '2026-07-01',             'Month emergency fund contributions begin'],
    ['renovation_target',     '1200000',                'Total condo renovation budget'],
    ['renovation_on_hand',    '570000',                 'Cash currently available for reno']
  ], ['Key','Value','Notes']);

  _batchAppend(ss, 'Income', [
    ['Joeann', 10, 95000,  true],
    ['Paulo',  15, 94000,  true],
    ['Joeann', 25, 95000,  true],
    ['Paulo',  30, 275000, true]
  ], ['Person','PayDay','Amount','Active']);

  _batchAppend(ss, 'CreditCards', [
    ['rcbc',      'RCBC Visa Infinite',              '9003', 'Visa',       947000, 250000,  12107.72,  10, 24, '2026-06-03', 0.03, '#e63946', false, 0],
    ['metrobank', 'Metrobank Titanium Mastercard',   '',     'Mastercard', 502000, 0,       0,         9,  21, '',           0.03, '#3a86ff', false, 0],
    ['eastwest',  'EastWest Platinum Mastercard',    '5002', 'Mastercard', 758000, 227400,  24571.48,  15, 26, '2026-05-11', 0.03, '#2dc653', true,  0],
    ['unionbank', 'UnionBank Rewards Platinum Visa', '5021', 'Visa',       490000, 0,       80462.07,  23, 18, '2026-05-11', 0.03, '#ff8c00', true,  0],
    ['bpi',       'BPI Signature Visa',              '',     'Visa',       641000, 0,       106328.83, 7,  20, '2026-05-27', 0.03, '#c9184a', false, 464732.66],
    ['bdo',       'BDO Visa Platinum',               '9850', 'Visa',       600000, 180000,  0,         9,  19, '',           0.03, '#1d4ed8', false, 0]
  ], ['ID','Name','Last4','Network','Limit','CashAdvanceLimit','Balance','StatementCutDay','DueDayOffset','DueDate','InterestRate','Color','PastDue','UnbilledInstallments']);

  _batchAppend(ss, 'Installments', [
    ['ew-inst-1',    'eastwest',  'EastWest installment plan',        24388,    2,    '',           false, '',                              'active'],
    ['ub-inst-1',    'unionbank', 'UnionBank plan (2249)',             2249.58,  11,   '',           false, '',                              'active'],
    ['ub-inst-2',    'unionbank', 'UnionBank plan (16953)',            16953,    1,    '',           false, '',                              'active'],
    ['ub-inst-3',    'unionbank', 'UnionBank plan 6450760',           21862.16, 2,    '',           false, '',                              'active'],
    ['bpi-inst-1',   'bpi',       'BPI Signature installment plans',  19361.83, 0,    '',           false, 'TBD — check BPI app',           'active'],
    ['rcbc-inst-1',  'rcbc',      'RCBC new installment (Jun 2026)',  12101.92, 48,   '2026-06-03', true,  '',                              'upcoming'],
    ['metro-inst-1', 'metrobank', 'Metrobank new installment (Jun)',  14718.71, 36,   '2026-06-01', true,  '',                              'upcoming']
  ], ['ID','CardID','Description','MonthlyAmount','MonthsRemaining','StartDate','IsNew','Note','Status']);

  _batchAppend(ss, 'BankLoans', [
    ['bpi-auto',    'BPI','Auto Loan',    '00000028933231', 1684667.24, 41154,     0,    41154,     10, '2026-06-10', 49,  '2030-05-10', 0,    1781692.08],
    ['bpi-housing', 'BPI','Housing Loan', '00000027408052', 9223387.46, 116108.48, 2900, 119008.48, 20, '2026-05-20', 107, '',           0.07, 9263433.71]
  ], ['ID','Bank','Type','AccountNo','OutstandingBalance','MonthlyAmortization','InsurancePremium','MonthlyPayment','DueDay','NextDueDate','RemainingPayments','MaturityDate','InterestRate','PayoffAmount']);

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
