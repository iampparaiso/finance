function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

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
    if (remaining === 0) return;
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
  var alerts = [];

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
