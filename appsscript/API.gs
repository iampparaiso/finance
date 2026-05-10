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
        var ts = new Date().toISOString();
        appendRow('SpendLog', {
          Timestamp:   ts,
          Date:        body.date,
          Description: body.description,
          Amount:      body.amount,
          Category:    body.category,
          CardID:      body.cardId,
          Month:       (body.date || '').slice(0, 7),
          Notes:       body.notes || '',
          AddedBy:     email
        });
        return _ok({ success: true, id: ts });

      case 'deleteSpend':
        var deleted = _deleteSpendRow(body.id);
        return deleted ? _ok({ success: true }) : _error('Row not found');


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
