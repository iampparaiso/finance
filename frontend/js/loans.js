import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge } from './format.js';

export async function renderLoans(container) {
  const loans = await get('getLoans');

  container.innerHTML = `
    <div class="page-header"><h1>Bank Loans</h1></div>
    ${loans.map(l => `
      <div class="card-row" style="margin-bottom:var(--sp4)">
        <div style="padding:var(--sp4)">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--sp4)">
            <div>
              <div style="font-weight:700;font-size:1rem">${l.Bank} ${l.Type}</div>
              <div style="font-size:0.75rem;color:var(--muted)">${l.AccountNo}</div>
            </div>
            <div style="text-align:right">
              <div class="mono warn" style="font-size:1.2rem">${peso(l.OutstandingBalance)}</div>
              <div style="font-size:0.75rem;color:var(--muted)">outstanding</div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><div class="dl">Monthly Payment</div><div class="dv warn">${peso(l.MonthlyPayment)}</div></div>
            <div class="detail-item"><div class="dl">Due Day</div><div class="dv">${l.DueDay}th · ${dueBadge(daysUntil(l.NextDueDate))}</div></div>
            <div class="detail-item"><div class="dl">Remaining</div><div class="dv">${l.RemainingPayments} payments</div></div>
            <div class="detail-item"><div class="dl">Maturity</div><div class="dv">${l.MaturityDate ? dateStr(l.MaturityDate) : '—'}</div></div>
            <div class="detail-item"><div class="dl">Payoff Amount</div><div class="dv">${peso(l.PayoffAmount)}</div></div>
            ${Number(l.InterestRate)>0?`<div class="detail-item"><div class="dl">Interest Rate</div><div class="dv danger">${(Number(l.InterestRate)*100).toFixed(1)}%/yr</div></div>`:''}
            ${Number(l.InsurancePremium)>0?`<div class="detail-item"><div class="dl">Insurance Premium</div><div class="dv">${peso(l.InsurancePremium)}/mo</div></div>`:''}
          </div>
        </div>
      </div>
    `).join('')}
    <div style="font-size:0.8rem;color:var(--muted);text-align:right">
      Combined monthly loans: <strong>${peso(loans.reduce((s,l)=>s+Number(l.MonthlyPayment),0))}</strong>
    </div>
  `;
}
