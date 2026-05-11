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
