import { get, post } from './api.js';
import { peso, dateStr } from './format.js';
import { computeAlerts, renderAlertBanners } from './alerts.js';
import { renderCashTracker, openPayCardModal } from './cash-tracker.js';

const CATEGORIES = ['Food', 'Groceries', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];

function _estimateDue(txDate, card) {
  if (!card) return null;
  const cutDay = parseInt(card.StatementCutDay) || 25;
  const dueOffset = 21;
  const d = new Date(txDate);
  let cutMonth = new Date(d.getFullYear(), d.getMonth(), cutDay);
  if (d.getDate() > cutDay) {
    cutMonth = new Date(d.getFullYear(), d.getMonth() + 1, cutDay);
  }
  const due = new Date(cutMonth);
  due.setDate(due.getDate() + dueOffset);
  return due;
}

export async function renderSpendLog(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Spend Log</h1>
      <span class="page-date">${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
    </div>
    <div id="sl-alerts"></div>
    <div id="sl-cash-tracker"></div>
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
        <div class="form-group">
          <label>Notes (optional)</label>
          <input type="text" id="sl-notes" placeholder="e.g. 6-month installment, Split with Joeann">
        </div>
      </div>
      <button class="btn btn-primary" id="sl-submit">Log Expense</button>
    </div>
    <div id="sl-content"><div class="loading-spinner">Loading...</div></div>
  `;

  const [logData, cardsData, dash] = await Promise.all([
    get('getSpendLog'),
    get('getCards'),
    get('getDashboard')
  ]);

  const cards        = cardsData || [];
  const cashOnHand   = Number(dash.cashOnHand || 0);
  const cashLog      = dash.recentCashLog || [];
  const installments = dash.installments || [];
  const loans        = await get('getLoans');

  const cardMap = {};
  cards.forEach(c => { cardMap[c.ID] = c; });

  // Populate card dropdown
  const sel = document.getElementById('sl-card');
  cards.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.ID;
    opt.textContent = c.Name;
    sel.appendChild(opt);
  });

  // Render alert banners
  const alerts = computeAlerts({
    cards, installments, spendLog: logData || [], cashOnHand, cashLog,
    totalObligations: dash.totalObligations || 0
  });
  renderAlertBanners(document.getElementById('sl-alerts'), alerts, {
    onPayCard: (cardId) => openPayCardModal(cards, cardId)
  });

  // Render cash tracker widget
  renderCashTracker(document.getElementById('sl-cash-tracker'), { cashOnHand, cashLog, loans, cards });

  // Re-render on cash-updated event
  document.addEventListener('cash-updated', () => renderSpendLog(container), { once: true });

  // Log expense submit
  document.getElementById('sl-submit').addEventListener('click', async () => {
    const date        = document.getElementById('sl-date').value;
    const description = document.getElementById('sl-desc').value.trim();
    const amount      = parseFloat(document.getElementById('sl-amount').value);
    const category    = document.getElementById('sl-cat').value;
    const cardId      = document.getElementById('sl-card').value;
    const notes       = document.getElementById('sl-notes').value.trim();
    if (!date || !description || isNaN(amount) || amount <= 0) return;
    const btn = document.getElementById('sl-submit');
    btn.disabled = true; btn.textContent = 'Saving...';
    const res = await post('logSpend', { date, description, amount, category, cardId, notes });
    if (res) {
      document.getElementById('sl-desc').value   = '';
      document.getElementById('sl-amount').value = '';
      document.getElementById('sl-notes').value  = '';
      renderSpendLog(container);
    } else {
      btn.disabled = false; btn.textContent = 'Log Expense';
    }
  });

  const content = document.getElementById('sl-content');
  if (!logData || !logData.length) {
    content.innerHTML = '<p class="muted" style="text-align:center;padding:var(--sp7)">No expenses logged yet.</p>';
    return;
  }

  const rows      = [...logData].reverse();
  const now       = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthRows = rows.filter(r => (r.Month || (r.Date ? r.Date.slice(0, 7) : '')) === thisMonth);
  const monthTotal = monthRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
  const totalAll   = rows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);

  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(now.getDate() + 7);
  let dueSoon = 0, overdue = 0;
  rows.forEach(r => {
    if (!r.CardID) return;
    const card = cardMap[r.CardID];
    if (!card) return;
    const due = _estimateDue(r.Date, card);
    if (!due) return;
    if (due < now)                overdue += parseFloat(r.Amount || 0);
    else if (due <= sevenDaysOut) dueSoon  += parseFloat(r.Amount || 0);
  });

  const byCat = {};
  monthRows.forEach(r => { const cat = r.Category || 'Other'; byCat[cat] = (byCat[cat] || 0) + parseFloat(r.Amount || 0); });
  const catBreakdown = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  content.innerHTML = `
    <div class="stat-grid" style="margin-bottom:var(--sp4)">
      <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value acc">${peso(monthTotal)}</div><div class="stat-sub">${monthRows.length} transaction${monthRows.length !== 1 ? 's' : ''}</div></div>
      <div class="stat-card"><div class="stat-label">All Time</div><div class="stat-value">${peso(totalAll)}</div><div class="stat-sub">${rows.length} total entries</div></div>
      ${dueSoon > 0 ? `<div class="stat-card"><div class="stat-label">Due in 7 Days</div><div class="stat-value warn">${peso(dueSoon)}</div><div class="stat-sub">estimated from card cycles</div></div>` : ''}
      ${overdue > 0 ? `<div class="stat-card"><div class="stat-label">Overdue (Est.)</div><div class="stat-value danger">${peso(overdue)}</div><div class="stat-sub">check your due dates</div></div>` : ''}
    </div>
    ${catBreakdown.length ? `<p class="section-title">By Category — ${now.toLocaleString('en-PH',{month:'long'})}</p><div class="breakdown-grid" style="margin-bottom:var(--sp5)">${catBreakdown.map(([cat,amt]) => `<div class="breakdown-row"><span>${cat}</span><span class="mono">${peso(amt)}</span></div>`).join('')}</div>` : ''}
    <p class="section-title">All Transactions</p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table class="data-table" id="sl-table">
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Card</th><th>Notes</th><th style="text-align:right">Amount</th><th></th></tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const card = r.CardID ? cardMap[r.CardID] : null;
            const due  = card ? _estimateDue(r.Date, card) : null;
            const dueStr = due ? due.toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '';
            return `<tr data-row="${i}">
              <td class="mono">${dateStr(r.Date)}</td>
              <td>${r.Description || '—'}</td>
              <td><span class="badge info">${r.Category || '—'}</span></td>
              <td class="muted">${card ? card.Name : (r.CardID ? r.CardID : '—')}</td>
              <td class="muted" style="font-size:0.8rem">${r.Notes || (dueStr ? `Due ~${dueStr}` : '—')}</td>
              <td class="mono" style="text-align:right;font-weight:600">${peso(parseFloat(r.Amount || 0))}</td>
              <td style="text-align:center"><button class="sl-del-btn" data-row-id="${r.Timestamp || i}" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:2px 6px" title="Delete">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  content.querySelectorAll('.sl-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.dataset.rowId;
      if (!confirm('Delete this transaction?')) return;
      btn.disabled = true; btn.textContent = '…';
      const res = await post('deleteSpend', { id: rowId });
      if (res) renderSpendLog(container);
      else { btn.disabled = false; btn.textContent = '✕'; }
    });
  });
}
