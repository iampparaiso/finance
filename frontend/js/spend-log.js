import { get, post } from './api.js';
import { peso, dateStr } from './format.js';
import { showToast } from './toast.js';
import { computeAlerts, renderAlertBanners } from './alerts.js';
import { renderCashTracker, openPayCardModal } from './cash-tracker.js';

const CATEGORIES = ['Food', 'Groceries', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];

let _queue     = [];
let _container = null;
export function hasUnsavedQueue() { return _queue.length > 0; }
export function getQueueLength()  { return _queue.length; }

function _renderQueue(cards) {
  const panel = document.getElementById('sl-queue-panel');
  if (!panel) return;
  if (!_queue.length) { panel.innerHTML = ''; return; }

  const total   = _queue.reduce((s, e) => s + e.amount, 0);
  const cardMap = {};
  cards.forEach(c => { cardMap[c.ID] = c.Name; });

  panel.innerHTML = `
    <div style="margin-top:var(--sp4);background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
      <div style="padding:var(--sp3) var(--sp4);font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);border-bottom:1px solid var(--border)">
        Queued (${_queue.length} item${_queue.length !== 1 ? 's' : ''})
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="data-table" style="min-width:520px">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Card</th><th style="text-align:right">Amount</th><th></th></tr></thead>
          <tbody>
            ${_queue.map((e, i) => `
              <tr>
                <td class="mono" style="font-size:0.8rem">${e.date}</td>
                <td style="font-size:0.85rem">${e.description}</td>
                <td><span class="badge info">${e.category}</span></td>
                <td class="muted" style="font-size:0.8rem">${e.cardId ? (cardMap[e.cardId] || e.cardId) : 'Cash'}</td>
                <td class="mono" style="text-align:right;font-weight:600">${peso(e.amount)}</td>
                <td style="text-align:center"><button class="queue-remove-btn" data-idx="${i}" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:2px 6px">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp3) var(--sp4);border-top:1px solid var(--border);flex-wrap:wrap;gap:var(--sp2)">
        <span class="mono" style="font-weight:700">Total: ${peso(total)}</span>
        <div style="display:flex;gap:var(--sp2)">
          <button id="queue-clear-btn" class="btn" style="font-size:0.8rem">Clear Queue</button>
          <button id="queue-submit-btn" class="btn btn-primary" style="font-size:0.8rem">Submit All (${_queue.length})</button>
        </div>
      </div>
    </div>
  `;

  panel.querySelectorAll('.queue-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _queue.splice(Number(btn.dataset.idx), 1);
      _renderQueue(cards);
    });
  });

  document.getElementById('queue-clear-btn').addEventListener('click', () => {
    if (confirm('Clear all queued items?')) { _queue = []; _renderQueue(cards); }
  });

  document.getElementById('queue-submit-btn').addEventListener('click', async () => {
    const submitBtn = document.getElementById('queue-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    try {
      const entries = _queue.map(e => ({
        date: e.date, description: e.description, amount: e.amount,
        category: e.category, cardId: e.cardId, notes: e.notes
      }));
      await post('bulkLogSpend', { entries });
      const count = _queue.length;
      _queue = [];
      showToast(`${count} expense${count !== 1 ? 's' : ''} saved.`);
      renderSpendLog(_container);
    } catch (err) {
      showToast('Failed to save queue: ' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = `Submit All (${_queue.length})`;
    }
  });
}

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
  _container = container;
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
      <div style="display:flex;gap:var(--sp2);flex-wrap:wrap">
        <button class="btn btn-primary" id="sl-add-queue">Add to Queue</button>
        <button class="btn" id="sl-submit">Save Now</button>
      </div>
      <div id="sl-queue-panel"></div>
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

  // Re-render queue panel with current card data
  _renderQueue(cards);

  function _getFormValues() {
    return {
      date:        document.getElementById('sl-date').value,
      description: document.getElementById('sl-desc').value.trim(),
      amount:      parseFloat(document.getElementById('sl-amount').value),
      category:    document.getElementById('sl-cat').value,
      cardId:      document.getElementById('sl-card').value,
      notes:       document.getElementById('sl-notes').value.trim(),
    };
  }

  function _clearFormPartial() {
    document.getElementById('sl-desc').value   = '';
    document.getElementById('sl-amount').value = '';
    document.getElementById('sl-notes').value  = '';
    document.getElementById('sl-date').value   = new Date().toISOString().slice(0, 10);
    document.getElementById('sl-desc').focus();
  }

  document.getElementById('sl-add-queue').addEventListener('click', () => {
    const v = _getFormValues();
    if (!v.date || !v.description || isNaN(v.amount) || v.amount <= 0) {
      showToast('Fill in date, description, and amount first.', 'info');
      return;
    }
    _queue.push(v);
    _clearFormPartial();
    _renderQueue(cards);
  });

  document.getElementById('sl-submit').addEventListener('click', async () => {
    const v = _getFormValues();
    if (!v.date || !v.description || isNaN(v.amount) || v.amount <= 0) return;
    const btn = document.getElementById('sl-submit');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await post('logSpend', { date: v.date, description: v.description, amount: v.amount, category: v.category, cardId: v.cardId, notes: v.notes });
      showToast('Expense saved.');
      renderSpendLog(container);
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Save Now';
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
              <td class="muted" style="font-size:0.8rem" data-row-ts="${r.Timestamp || i}">
                <span class="notes-text">${r.Notes || (dueStr ? `Due ~${dueStr}` : '—')}</span>
                <button class="notes-edit-btn" title="Edit note">✏</button>
              </td>
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
      const row = btn.closest('tr');
      btn.disabled = true; btn.textContent = '…';
      row.classList.add('sl-row-removing');
      const res = await post('deleteSpend', { id: rowId });
      if (res) {
        setTimeout(() => renderSpendLog(container), 200);
      } else {
        row.classList.remove('sl-row-removing');
        btn.disabled = false; btn.textContent = '✕';
        showToast('Could not delete entry.', 'error');
      }
    });
  });

  content.querySelectorAll('.notes-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const td      = btn.closest('td');
      const span    = td.querySelector('.notes-text');
      const rowTs   = td.dataset.rowTs;
      const current = span.textContent;

      const input = document.createElement('input');
      input.className = 'notes-edit-input';
      input.value = (current === '—' || current.startsWith('Due ~')) ? '' : current;
      input.placeholder = 'Add note…';

      span.replaceWith(input);
      btn.style.opacity = '0';
      input.focus();

      let _done = false;
      const save = async () => {
        if (_done) return;
        _done = true;
        const newNotes = input.value.trim();
        try {
          await post('updateSpend', { id: rowTs, notes: newNotes });
          const newSpan = document.createElement('span');
          newSpan.className = 'notes-text';
          newSpan.textContent = newNotes || '—';
          input.replaceWith(newSpan);
          btn.style.opacity = '';
          showToast('Note updated.');
        } catch (err) {
          _done = false;
          showToast('Failed to save note.', 'error');
          input.focus();
        }
      };

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { _done = true; input.replaceWith(span); btn.style.opacity = ''; }
      });
      input.addEventListener('blur', save);
    });
  });
}
