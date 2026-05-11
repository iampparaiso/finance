import { peso } from './format.js';

export function computeAlerts({ cards, installments, spendLog, cashOnHand, cashLog, totalObligations, monthlyIncome = 559000 }) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // Alert 1: overdue cards
  const overdueCards = cards.filter(c => c.PastDue === true || c.PastDue === 'TRUE');

  // Alert 2: card payability — billed balance + unbilled SpendLog + active installments
  const totalExposure = cards.reduce((sum, card) => {
    const billed  = Number(card.Balance || 0);
    const cutDay  = parseInt(card.StatementCutDay) || 25;
    const cutDate = _lastCutDate(cutDay, now);
    const unbilled = (spendLog || [])
      .filter(r => r.CardID === card.ID && new Date(r.Date) > cutDate)
      .reduce((s, r) => s + Number(r.Amount || 0), 0);
    const installs = (installments || [])
      .filter(i => i.CardID === card.ID && i.Status === 'active')
      .reduce((s, i) => s + Number(i.MonthlyAmount || 0), 0);
    return sum + billed + unbilled + installs;
  }, 0);

  const payRatio = cashOnHand > 0 ? totalExposure / cashOnHand : Infinity;
  const payLevel = payRatio >= 1 ? 'red' : payRatio >= 0.7 ? 'yellow' : null;

  // Alert 3A: cash burn this month
  const cashOut = (cashLog || [])
    .filter(r => String(r.Date) >= monthStart && ['spend_cash', 'reno_cash', 'pay_card', 'loan_debit'].includes(r.Type))
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const cashIn = (cashLog || [])
    .filter(r => String(r.Date) >= monthStart && r.Type === 'topup')
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const burnRatio = cashIn > 0 ? cashOut / cashIn : 0;
  const burnLevel = burnRatio >= 1 ? 'red' : burnRatio >= 0.8 ? 'yellow' : null;

  // Alert 3B: card debt building vs income
  const cardSpend = (spendLog || [])
    .filter(r => r.CardID && String(r.Date) >= monthStart)
    .reduce((s, r) => s + Number(r.Amount || 0), 0);
  const debtTotal = (totalObligations || 0) + cardSpend;
  const debtLevel = debtTotal > monthlyIncome ? 'red' : debtTotal > monthlyIncome - 50000 ? 'yellow' : null;

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
