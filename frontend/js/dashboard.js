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
