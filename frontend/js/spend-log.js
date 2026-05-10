import { get, post } from './api.js';
import { peso, dateStr } from './format.js';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];

export async function renderSpendLog(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Spend Log</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
    </div>
    <div class="log-form">
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="sl-date" value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="sl-desc" placeholder="e.g. Jollibee lunch">
        </div>
        <div class="form-group">
          <label>Amount (₱)</label>
          <input type="number" id="sl-amount" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="sl-cat">
            ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Card</label>
          <select id="sl-card"><option value="">Cash / Other</option></select>
        </div>
      </div>
      <button class="btn btn-primary" id="sl-submit">Log Expense</button>
    </div>
    <div id="sl-content"><div class="loading-spinner">Loading...</div></div>
  `;

  const [logRes, cardsRes] = await Promise.all([get('getSpendLog'), get('getCards')]);

  // Populate card dropdown
  if (cardsRes.ok && cardsRes.data) {
    const sel = document.getElementById('sl-card');
    cardsRes.data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.ID;
      opt.textContent = c.Name;
      sel.appendChild(opt);
    });
  }

  // Card name lookup map
  const cardMap = {};
  if (cardsRes.ok && cardsRes.data) {
    cardsRes.data.forEach(c => { cardMap[c.ID] = c.Name; });
  }

  // Submit handler
  document.getElementById('sl-submit').addEventListener('click', async () => {
    const date = document.getElementById('sl-date').value;
    const description = document.getElementById('sl-desc').value.trim();
    const amount = parseFloat(document.getElementById('sl-amount').value);
    const category = document.getElementById('sl-cat').value;
    const cardId = document.getElementById('sl-card').value;

    if (!date || !description || isNaN(amount) || amount <= 0) return;

    const btn = document.getElementById('sl-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const res = await post('logSpend', { date, description, amount, category, cardId });
    if (res.ok) {
      document.getElementById('sl-desc').value = '';
      document.getElementById('sl-amount').value = '';
      renderSpendLog(container);
    } else {
      btn.disabled = false;
      btn.textContent = 'Log Expense';
    }
  });

  // Render log
  const content = document.getElementById('sl-content');

  if (!logRes.ok || !logRes.data || !logRes.data.length) {
    content.innerHTML = '<p class="muted" style="text-align:center;padding:var(--sp7)">No expenses logged yet.</p>';
    return;
  }

  const rows = [...logRes.data].reverse();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRows = rows.filter(r => {
    const m = r.Month || (r.Date ? r.Date.slice(0, 7) : '');
    return m === thisMonth;
  });
  const monthTotal = monthRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);

  const byCat = {};
  monthRows.forEach(r => {
    const cat = r.Category || 'Other';
    byCat[cat] = (byCat[cat] || 0) + parseFloat(r.Amount || 0);
  });

  const catBreakdown = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  content.innerHTML = `
    <div class="stat-grid" style="margin-bottom:var(--sp4)">
      <div class="stat-card">
        <div class="stat-label">This Month</div>
        <div class="stat-value acc">${peso(monthTotal)}</div>
        <div class="stat-sub">${monthRows.length} transaction${monthRows.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    ${catBreakdown.length ? `
    <p class="section-title">By Category — ${new Date().toLocaleString('en-PH', { month: 'long' })}</p>
    <div class="breakdown-grid" style="margin-bottom:var(--sp5)">
      ${catBreakdown.map(([cat, amt]) => `
        <div class="breakdown-row">
          <span>${cat}</span>
          <span class="mono">${peso(amt)}</span>
        </div>
      `).join('')}
    </div>` : ''}
    <p class="section-title">All Transactions</p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
      <table class="data-table">
        <thead><tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Card</th>
          <th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td class="mono">${dateStr(r.Date)}</td>
            <td>${r.Description || '—'}</td>
            <td><span class="badge info">${r.Category || '—'}</span></td>
            <td class="muted">${cardMap[r.CardID] || r.CardID || '—'}</td>
            <td class="mono" style="text-align:right;font-weight:600">${peso(parseFloat(r.Amount || 0))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
