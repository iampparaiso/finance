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
      case 'getCashLog':
        var cashLogRows = getRows('CashLog');
        var cashOnHand  = Number(_getConfigValue('cash_on_hand') || 0);
        result = { entries: cashLogRows, cashOnHand: cashOnHand };
        break;
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

      case 'deleteSpend':
        var deleted = _deleteSpendRow(body.id);
        return deleted ? _ok({ success: true }) : _error('Row not found');


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

      case 'deleteRenovation':
        var renoSheet2 = getSheet('Renovation');
        var renoData2  = renoSheet2.getDataRange().getValues();
        var renoHdrs   = renoData2[0];
        var renoTsCol  = renoHdrs.indexOf('Timestamp');
        var renoAmtCol = renoHdrs.indexOf('Amount');
        var renoPayCol = renoHdrs.indexOf('PaymentMethod');
        var renoDeleted = false;
        for (var ri = 1; ri < renoData2.length; ri++) {
          if (String(renoData2[ri][renoTsCol]) === String(body.id)) {
            var delAmt = Number(renoData2[ri][renoAmtCol]);
            var delPay = String(renoData2[ri][renoPayCol]);
            renoSheet2.deleteRow(ri + 1);
            renoDeleted = true;
            if (delPay === 'cash') {
              var revCashNow = Number(_getConfigValue('cash_on_hand') || 0);
              var revCashNew = revCashNow + delAmt;
              appendRow('CashLog', {
                Timestamp:     new Date().toISOString(),
                Date:          body.date || new Date().toISOString().slice(0, 10),
                Type:          'reversal',
                Amount:        delAmt,
                RunningBalance:revCashNew,
                Notes:         'Deleted renovation entry',
                LinkedID:      body.id,
                AddedBy:       email
              });
              _setConfigValue('cash_on_hand', revCashNew);
            }
            break;
          }
        }
        return renoDeleted ? _ok({ success: true }) : _error('Renovation row not found');

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

  var cashLog     = getRows('CashLog');
  var cashOnHand  = Number(_getConfigValue('cash_on_hand') || 0);

  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  var thirtyStr = thirtyDaysAgo.toISOString().slice(0, 10);
  var recentCashLog = cashLog.filter(function(r) { return String(r.Date) >= thirtyStr; });

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
}

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

function _deleteSpendRow(id) {
  var sheet = getSheet('SpendLog');
  var data  = sheet.getDataRange().getValues();
  var headers = data[0];
  var tsCol = headers.indexOf('Timestamp');
  if (tsCol === -1) return false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][tsCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function testGetDashboard() {
  var result = _getDashboard();
  Logger.log(JSON.stringify(result, null, 2));
}
