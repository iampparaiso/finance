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

  const upcoming = PAYDAYS.filter(p => p.day > todayDay);
  const nextPayday = upcoming.length > 0 ? upcoming[0] : PAYDAYS[0];

  const receivedThisMonth = PAYDAYS
    .filter(p => p.day <= todayDay)
    .reduce((s, p) => s + p.amount, 0);

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

  PAYDAYS.forEach(p => {
    events.push({ day: p.day, type: 'income', label: `${p.person} Payday`, amount: p.amount });
  });

  bills.filter(b => b.Active && b.Active !== 'FALSE' && b.Frequency === 'monthly' && Number(b.DueDay) > 0).forEach(b => {
    events.push({ day: Number(b.DueDay), type: 'bill', label: b.Name, amount: Number(b.Amount) });
  });

  loans.forEach(l => {
    events.push({ day: Number(l.DueDay), type: 'loan', label: `${l.Bank} ${l.Type}`, amount: Number(l.MonthlyPayment) });
  });

  subscriptions.filter(s => s.Active && s.Active !== 'FALSE').forEach(s => {
    events.push({ day: Number(s.DueDay), type: 'subscription', label: s.Name, amount: Number(s.Amount) });
  });

  const byDay = {};
  for (let d = 1; d <= daysInMonth; d++) byDay[d] = [];
  events.forEach(e => {
    if (e.day >= 1 && e.day <= daysInMonth) byDay[e.day].push(e);
  });

  return byDay;
}
