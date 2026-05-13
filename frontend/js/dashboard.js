import { get } from './api.js';
import { peso, pct, animateValue } from './format.js';
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

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <div style="font-size:0.85rem;color:var(--muted);margin-top:2px">${_greeting(d)}</div>
      </div>
      <span class="page-date">${new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
    </div>
    <div id="dash-alerts"></div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Monthly Income</div>
        <div class="stat-value ok" data-animate="${d.totalMonthlyIncome}">${peso(d.totalMonthlyIncome)}</div>
        <div class="stat-sub">Combined household</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Obligations</div>
        <div class="stat-value warn" data-animate="${d.totalObligations}">${peso(d.totalObligations)}</div>
        <div class="stat-sub">Loans + Bills + CC installs</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net After Obligations</div>
        <div class="stat-value ${d.netAfterObligations >= 0 ? 'ok' : 'danger'}" data-animate="${d.netAfterObligations}">${peso(d.netAfterObligations)}</div>
        <div class="stat-sub">Available for spending/saving</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CC Utilization</div>
        <div class="stat-value ${utilizationPct > 30 ? 'warn' : 'ok'}">${utilizationPct}%</div>
        <div class="stat-sub">${peso(d.totalCCBalance)} of ${peso(d.totalCCLimit)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cash on Hand</div>
        <div class="stat-value ${cashColor}" data-animate="${cashOnHand}">${peso(cashOnHand)}</div>
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
    cards, installments: d.installments || installments, spendLog: spendLogData || [],
    cashOnHand, cashLog, totalObligations: d.totalObligations || 0
  });
  renderAlertBanners(document.getElementById('dash-alerts'), alerts, {
    onPayCard: (cardId) => openPayCardModal(cards, cardId)
  });

  // Runway blurb on cash stat card
  const runway = _runwaySummary(cashOnHand, cashLog);
  if (runway) document.getElementById('dash-runway').textContent = runway;

  // Stat counter animations
  container.querySelectorAll('[data-animate]').forEach(el => {
    animateValue(el, parseFloat(el.dataset.animate), peso);
  });
}

function _greeting(d) {
  const h      = new Date().getHours();
  const past   = d.pastDueCards && d.pastDueCards.length > 0;
  const oblPct = d.totalMonthlyIncome > 0 ? d.totalObligations / d.totalMonthlyIncome : 0;
  if (past)             return 'Heads up — a couple of cards need attention.';
  if (h >= 23 || h < 5) return 'Late night budgeting? Respect.';
  if (oblPct > 0.6)     return 'Heavy month. Making it work.';
  if (h < 12)           return 'Good morning. You\'re on top of it.';
  if (h < 18)           return 'Afternoon check-in. Looking solid.';
  return 'Evening. Numbers are in check.';
}

function _renderInstallmentRelief(installments) {
  const now    = new Date();
  const active = (installments || []).filter(i => i.Status === 'active' && Number(i.MonthsRemaining) > 0);
  if (!active.length) return '';

  const withEnd = active.map(i => {
    const endDate = new Date(now.getFullYear(), now.getMonth() + Number(i.MonthsRemaining), 1);
    return { ...i, endDate, endLabel: endDate.toLocaleDateString('en-PH',{month:'short',year:'numeric'}) };
  }).sort((a, b) => a.endDate - b.endDate);

  const latestLabel = withEnd[withEnd.length - 1].endLabel;
  const totalFreed  = withEnd.reduce((s, i) => s + Number(i.MonthlyAmount), 0);

  return `
    <div class="section-title">Upcoming Installment Relief</div>
    <div class="breakdown-grid" style="margin-bottom:var(--sp3)">
      ${withEnd.map(i => `
        <div class="breakdown-row">
          <span style="font-size:0.85rem">${i.endLabel} &mdash; ${i.CardID ? i.CardID.toUpperCase() : ''}${i.Description ? ' · ' + i.Description : ''}</span>
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
