import { get, post } from './api.js';
import { peso, dateStr, pct } from './format.js';

export async function renderRenovation(container) {
  const [rows, config] = await Promise.all([get('getRenovation'), get('getConfig')]);
  const configMap = {};
  config.forEach(r => { configMap[r.Key] = r.Value; });

  if (!configMap['renovation_on_hand'] || !configMap['renovation_target']) {
    container.innerHTML = '<div class="error-state">Config error: renovation_on_hand or renovation_target missing from Sheets. Run setupSheets() first.</div>';
    return;
  }

  const onHand  = Number(configMap['renovation_on_hand']  || 570000);
  const target  = Number(configMap['renovation_target']   || 1200000);
  const spent   = rows.reduce((s, r) => s + Number(r.Amount), 0);
  const gap     = target - onHand;
  const remaining = onHand - spent;

  const byCategory = {};
  rows.forEach(r => {
    byCategory[r.Category] = (byCategory[r.Category] || 0) + Number(r.Amount);
  });

  container.innerHTML = `
    <div class="page-header"><h1>Renovation Tracker</h1><span style="color:var(--muted);font-size:0.85rem">Condo · Target ${peso(target)}</span></div>

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">On-Hand Budget</div>
        <div class="stat-value ok">${peso(onHand)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Spent So Far</div>
        <div class="stat-value warn">${peso(spent)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Remaining Cash</div>
        <div class="stat-value ${remaining>=0?'ok':'danger'}">${peso(remaining)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gap to Target</div>
        <div class="stat-value danger">${peso(gap)}</div>
        <div class="stat-sub">Fund via CC cash offers</div>
      </div>
    </div>

    <div class="progress-bar" style="height:12px;margin-bottom:var(--sp5)">
      <div class="progress-fill" style="width:${pct(onHand-spent, target)}%"></div>
    </div>

    <div class="section-title">Log Expense</div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" id="reno-date" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Description</label><input type="text" id="reno-desc" placeholder="e.g. Tiles - Bathroom"></div>
        <div class="form-group"><label>Amount (₱)</label><input type="number" id="reno-amount" placeholder="0"></div>
        <div class="form-group">
          <label>Category</label>
          <select id="reno-cat">
            <option>Contractor</option><option>Materials</option><option>Appliances</option>
            <option>Furniture</option><option>Fixtures</option><option>Miscellaneous</option>
          </select>
        </div>
        <div class="form-group"><label>Payment Method</label><input type="text" id="reno-payment" placeholder="e.g. BDO CC, Cash"></div>
      </div>
      <button class="btn btn-primary" id="reno-submit">Log Expense</button>
      <span id="reno-msg" style="margin-left:var(--sp3);font-size:0.85rem;color:var(--muted)"></span>
    </div>

    ${Object.keys(byCategory).length > 0 ? `
    <div class="section-title">By Category</div>
    <div class="breakdown-grid" style="margin-bottom:var(--sp5)">
      ${Object.entries(byCategory).map(([cat,amt]) => `
        <div class="breakdown-row"><span>${cat}</span><span class="mono">${peso(amt)}</span></div>
      `).join('')}
      <div class="breakdown-row total"><span>Total Spent</span><span class="mono">${peso(spent)}</span></div>
    </div>` : ''}

    ${rows.length > 0 ? `
    <div class="section-title">Expense Log</div>
    <table class="data-table">
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Payment</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${[...rows].reverse().map(r => `
          <tr>
            <td>${dateStr(r.Date)}</td>
            <td>${r.Description}</td>
            <td><span class="badge info">${r.Category}</span></td>
            <td style="color:var(--muted)">${r.PaymentMethod}</td>
            <td class="mono" style="text-align:right;color:var(--warn)">${peso(r.Amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<div style="color:var(--muted);text-align:center;padding:var(--sp6)">No expenses logged yet.</div>'}
  `;

  document.getElementById('reno-submit').addEventListener('click', async () => {
    const msg = document.getElementById('reno-msg');
    try {
      await post('logRenovation', {
        date:          document.getElementById('reno-date').value,
        description:   document.getElementById('reno-desc').value,
        amount:        Number(document.getElementById('reno-amount').value),
        category:      document.getElementById('reno-cat').value,
        paymentMethod: document.getElementById('reno-payment').value
      });
      msg.textContent = '✓ Logged!';
      msg.style.color = 'var(--ok)';
      setTimeout(() => renderRenovation(container), 1000);
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
    }
  });
}
