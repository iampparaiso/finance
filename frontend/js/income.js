import { get } from './api.js';
import { peso } from './format.js';

export async function renderIncome(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Income &amp; Cash Flow</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
    </div>
    <div id="income-content"><div class="loading-spinner">Loading...</div></div>
  `;

  const dashRes = await get('getDashboard');
  const dash = dashRes.ok ? dashRes.data : {};

  const totalIncome = dash.totalMonthlyIncome || 559000;
  const totalObligations = dash.totalObligations || 0;
  const net = dash.netAfterObligations || (totalIncome - totalObligations);
  const breakdown = dash.breakdown || {};

  document.getElementById('income-content').innerHTML = `
    <!-- Income structure -->
    <p class="section-title">Household Income Structure</p>
    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Paulo</div>
        <div class="stat-value ok">${peso(369000)}/mo</div>
        <div class="stat-sub">${peso(94000)} on 15th · ${peso(275000)} on 30th</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Joeann</div>
        <div class="stat-value ok">${peso(190000)}/mo</div>
        <div class="stat-sub">${peso(95000)} on 10th · ${peso(95000)} on 25th</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Combined Monthly</div>
        <div class="stat-value acc">${peso(totalIncome)}</div>
        <div class="stat-sub">4 paydays per month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net After Obligations</div>
        <div class="stat-value ${net >= 0 ? 'ok' : 'danger'}">${peso(net)}</div>
        <div class="stat-sub">After loans, installments &amp; bills</div>
      </div>
    </div>

    <!-- Monthly obligations breakdown -->
    <p class="section-title">Monthly Obligations Breakdown</p>
    <div class="breakdown-grid" style="margin-bottom:var(--sp5)">
      <div class="breakdown-row">
        <span>Bank Loans (Auto + Housing)</span>
        <span class="mono danger">${peso(breakdown.loans || 0)}</span>
      </div>
      <div class="breakdown-row">
        <span>CC Installments</span>
        <span class="mono danger">${peso(breakdown.installments || 0)}</span>
      </div>
      <div class="breakdown-row">
        <span>Recurring Bills</span>
        <span class="mono warn">${peso(breakdown.bills || 0)}</span>
      </div>
      <div class="breakdown-row">
        <span>Subscriptions</span>
        <span class="mono muted">${peso(breakdown.subscriptions || 0)}</span>
      </div>
      <div class="breakdown-row total">
        <span>Total Obligations</span>
        <span class="mono danger">${peso(totalObligations)}</span>
      </div>
      <div class="breakdown-row total">
        <span>Net Available</span>
        <span class="mono ${net >= 0 ? 'ok' : 'danger'}">${peso(net)}</span>
      </div>
    </div>

    <!-- Payday schedule -->
    <p class="section-title">Payday Schedule</p>
    <div class="breakdown-grid" style="margin-bottom:var(--sp5)">
      <div class="breakdown-row">
        <span>Joeann — 10th</span>
        <span class="mono ok">${peso(95000)}</span>
      </div>
      <div class="breakdown-row">
        <span>Paulo — 15th</span>
        <span class="mono ok">${peso(94000)}</span>
      </div>
      <div class="breakdown-row">
        <span>Joeann — 25th</span>
        <span class="mono ok">${peso(95000)}</span>
      </div>
      <div class="breakdown-row">
        <span>Paulo — 30th</span>
        <span class="mono ok">${peso(275000)}</span>
      </div>
    </div>
  `;
}
