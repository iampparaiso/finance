import { get, post } from './api.js';
import { peso, dateStr, pct } from './format.js';

export async function renderEmergencyFund(container) {
  const rows = await get('getEmergencyFund');
  const TARGET = 500000;
  const activationDate = new Date('2026-07-01');
  const today = new Date();
  const isActive = today >= activationDate;

  const currentBalance = rows.length > 0 ? Number(rows[rows.length - 1].Balance) : 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>Emergency Fund</h1>
      <span class="badge ${isActive?'ok':'info'}">${isActive ? 'Active' : 'Starts July 2026'}</span>
    </div>

    ${!isActive ? `<div class="alert-bar info">
      Emergency fund contributions begin July 1, 2026 — after condo renovation is complete.
    </div>` : ''}

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Current Balance</div>
        <div class="stat-value ok">${peso(currentBalance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Target</div>
        <div class="stat-value">${peso(TARGET)}</div>
        <div class="stat-sub">~1 month household expenses</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Progress</div>
        <div class="stat-value ${currentBalance>=TARGET?'ok':'warn'}">${pct(currentBalance,TARGET)}%</div>
      </div>
    </div>

    <div class="progress-bar" style="height:12px;margin-bottom:var(--sp5)">
      <div class="progress-fill" style="width:${pct(currentBalance,TARGET)}%"></div>
    </div>

    ${isActive ? `
    <div class="section-title">Log Transaction</div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" id="ef-date" value="${today.toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Type</label><select id="ef-type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></div>
        <div class="form-group"><label>Amount (₱)</label><input type="number" id="ef-amount" placeholder="0"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="ef-notes" placeholder="Optional"></div>
      </div>
      <button class="btn btn-primary" id="ef-submit">Save</button>
      <span id="ef-msg" style="margin-left:var(--sp3);font-size:0.85rem"></span>
    </div>` : ''}

    ${rows.length > 0 ? `
    <div class="section-title">Transaction Log</div>
    <table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th style="text-align:right">Balance</th></tr></thead>
      <tbody>
        ${[...rows].reverse().map(r => `
          <tr>
            <td>${dateStr(r.Date)}</td>
            <td><span class="badge ${r.Type==='deposit'?'ok':'warn'}">${r.Type}</span></td>
            <td class="mono ${r.Type==='deposit'?'ok':'danger'}">${r.Type==='deposit'?'+':'−'}${peso(r.Amount)}</td>
            <td class="mono" style="text-align:right">${peso(r.Balance)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<div style="color:var(--muted);text-align:center;padding:var(--sp6)">No transactions yet.</div>'}
  `;

  const submitBtn = document.getElementById('ef-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const msg = document.getElementById('ef-msg');
      try {
        await post('logEmergencyFund', {
          date:   document.getElementById('ef-date').value,
          type:   document.getElementById('ef-type').value,
          amount: Number(document.getElementById('ef-amount').value),
          notes:  document.getElementById('ef-notes').value
        });
        msg.textContent = '✓ Saved!';
        msg.style.color = 'var(--ok)';
        setTimeout(() => renderEmergencyFund(container), 1000);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.style.color = 'var(--danger)';
      }
    });
  }
}
