import { get, post } from './api.js';
import { peso, dateStr } from './format.js';
import { getPaydays } from './calendar.js';

const TYPE_LABELS = {
  topup:      '+ Income',
  spend_cash: '- Cash spend',
  pay_card:   '- Card payment',
  loan_debit: '- Loan debit',
  reno_cash:  '- Renovation'
};

export function renderCashTracker(container, { cashOnHand, cashLog, loans, cards }) {
  const now      = new Date();
  const monthStr = now.toISOString().slice(0, 7);
  const color    = cashOnHand >= 100000 ? 'ok' : cashOnHand >= 50000 ? 'warn' : 'danger';

  // Scheduled debits — loans not yet recorded this month
  const debitedLoanIds = (cashLog || [])
    .filter(r => r.Type === 'loan_debit' && String(r.Date).slice(0, 7) === monthStr)
    .map(r => String(r.LinkedID));
  const pendingDebits = (loans || []).filter(l => !debitedLoanIds.includes(String(l.ID)));

  // Runway computation
  const runway = _computeRunway(cashOnHand, cashLog || []);

  // Recent activity (last 5)
  const recent = [...(cashLog || [])].reverse().slice(0, 5);

  container.innerHTML = `
    <div class="cash-tracker-widget" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp4);margin-bottom:var(--sp4)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp2)">
        <div>
          <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Cash on Hand</div>
          <div class="stat-value ${color}" style="font-size:1.8rem">${peso(cashOnHand)}</div>
          ${runway ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:4px">${runway}</div>` : ''}
        </div>
        <div style="display:flex;gap:var(--sp2)">
          <button class="btn btn-primary" id="ct-add-cash" style="font-size:0.82rem;padding:6px 14px">+ Add Cash</button>
          <div style="position:relative">
            <button class="btn" id="ct-pay-card-btn" style="font-size:0.82rem;padding:6px 14px">Pay Card ▾</button>
            <div id="ct-card-dropdown" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);z-index:100;min-width:220px;box-shadow:0 4px 16px rgba(0,0,0,.3)">
              ${(cards || []).filter(c => Number(c.Balance) > 0).map(c => `
                <div class="ct-pay-card-item" data-card-id="${c.ID}" style="padding:10px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border)">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.Color};margin-right:8px"></span>
                  ${c.Name} <span class="mono warn" style="float:right">${peso(c.Balance)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="util-bar" style="margin-bottom:var(--sp3)">
        <div class="util-fill" style="width:${Math.min(100, (cashOnHand / 500000) * 100)}%;background:var(--${color});transition:width .3s"></div>
      </div>

      ${pendingDebits.length > 0 ? `
      <div style="margin-bottom:var(--sp3)">
        <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;margin-bottom:var(--sp2)">Scheduled Debits This Month</div>
        ${pendingDebits.map(l => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <div>
              <span style="font-size:0.85rem">${l.Bank} ${l.Type}</span>
              <span style="font-size:0.75rem;color:var(--muted)"> · due ${l.DueDay}th</span>
            </div>
            <div style="display:flex;align-items:center;gap:var(--sp2)">
              <span class="mono warn">${peso(l.MonthlyPayment)}</span>
              <button class="ct-mark-debit btn" data-loan-id="${l.ID}" style="font-size:0.72rem;padding:3px 8px">Mark Debited</button>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      ${recent.length > 0 ? `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp2)">
          <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase">Recent Activity</div>
        </div>
        ${recent.map(r => {
          const isIn  = r.Type === 'topup';
          const label = TYPE_LABELS[r.Type] || r.Type;
          return `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:3px 0;color:var(--text2)">
            <span>${dateStr(r.Date)} · ${label}${r.Notes ? ' — ' + r.Notes : ''}</span>
            <span class="mono ${isIn ? 'ok' : 'warn'}">${isIn ? '+' : '-'}${peso(Math.abs(Number(r.Amount)))}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>
  `;

  // Wire Add Cash button
  container.querySelector('#ct-add-cash').addEventListener('click', () => {
    openAddCashModal(cards, async (result) => {
      if (result.source === 'payday') _showPaydayAllocationPrompt(result, loans);
    });
  });

  // Wire Pay Card dropdown toggle
  const payBtn   = container.querySelector('#ct-pay-card-btn');
  const dropdown = container.querySelector('#ct-card-dropdown');
  payBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { dropdown.style.display = 'none'; }, { once: true });

  container.querySelectorAll('.ct-pay-card-item').forEach(el => {
    el.addEventListener('click', () => {
      dropdown.style.display = 'none';
      openPayCardModal(cards, el.dataset.cardId);
    });
  });

  // Wire Mark Debited buttons
  container.querySelectorAll('.ct-mark-debit').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      await post('payLoanDebit', { loanId: btn.dataset.loanId, date: new Date().toISOString().slice(0, 10), notes: '' });
      container.dispatchEvent(new CustomEvent('cash-updated'));
    });
  });
}

export function openAddCashModal(cards, onSuccess) {
  const overlay = _createOverlay();
  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(420px,90vw)">
      <h2 style="margin:0 0 var(--sp4);font-size:1.1rem">Add Cash</h2>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Date</label><input type="date" id="ac-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Amount (₱)</label><input type="number" id="ac-amount" placeholder="0" min="0" step="1"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)">
        <label>Source</label>
        <select id="ac-source">
          <option value="payday">Payday</option>
          <option value="bonus">Bonus</option>
          <option value="gift">Gift</option>
          <option value="sale">Sale / Asset</option>
          <option value="refund">Refund / Insurance</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:var(--sp4)"><label>Notes (optional)</label><input type="text" id="ac-notes" placeholder="e.g. Paulo 30th, Performance bonus"></div>
      <div style="display:flex;gap:var(--sp2)">
        <button class="btn btn-primary" id="ac-submit">Add Cash</button>
        <button class="btn" id="ac-cancel">Cancel</button>
      </div>
      <div id="ac-msg" style="margin-top:var(--sp2);font-size:0.82rem;color:var(--danger)"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#ac-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#ac-submit').addEventListener('click', async () => {
    const btn    = overlay.querySelector('#ac-submit');
    const amount = parseFloat(overlay.querySelector('#ac-amount').value);
    const source = overlay.querySelector('#ac-source').value;
    if (!amount || amount <= 0) { overlay.querySelector('#ac-msg').textContent = 'Enter a valid amount'; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    const res = await post('addCash', {
      date:   overlay.querySelector('#ac-date').value,
      amount, source,
      notes:  overlay.querySelector('#ac-notes').value.trim()
    });
    overlay.remove();
    if (onSuccess) onSuccess({ source, amount, newBalance: res.newBalance });
    document.dispatchEvent(new CustomEvent('cash-updated'));
  });
}

export function openPayCardModal(cards, preselectedCardId) {
  const overlay     = _createOverlay();
  const cardOptions = cards.map(c =>
    `<option value="${c.ID}" ${c.ID === preselectedCardId ? 'selected' : ''}>${c.Name} — bal ${peso(Number(c.Balance))}</option>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(420px,90vw)">
      <h2 style="margin:0 0 var(--sp4);font-size:1.1rem">Pay Credit Card</h2>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Card</label><select id="pc-card">${cardOptions}</select></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Payment Amount (₱)</label><input type="number" id="pc-amount" placeholder="0" min="0" step="1"></div>
      <div id="pc-preview" style="font-size:0.82rem;color:var(--muted);margin-bottom:var(--sp3)"></div>
      <div class="form-group" style="margin-bottom:var(--sp3)"><label>Date</label><input type="date" id="pc-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group" style="margin-bottom:var(--sp4)"><label>Notes (optional)</label><input type="text" id="pc-notes"></div>
      <div style="display:flex;gap:var(--sp2)">
        <button class="btn btn-primary" id="pc-submit">Pay Card</button>
        <button class="btn" id="pc-cancel">Cancel</button>
      </div>
      <div id="pc-msg" style="margin-top:var(--sp2);font-size:0.82rem;color:var(--danger)"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cardSel  = overlay.querySelector('#pc-card');
  const amtInput = overlay.querySelector('#pc-amount');
  const preview  = overlay.querySelector('#pc-preview');

  function updatePreview() {
    const card = cards.find(c => c.ID === cardSel.value);
    const amt  = parseFloat(amtInput.value) || 0;
    if (!card) return;
    const after = Math.max(0, Number(card.Balance) - amt);
    preview.textContent = `Balance after payment: ${peso(after)}${after <= 0 ? ' ✓ CLEARED' : ''}`;
  }
  cardSel.addEventListener('change', updatePreview);
  amtInput.addEventListener('input', updatePreview);
  updatePreview();

  overlay.querySelector('#pc-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#pc-submit').addEventListener('click', async () => {
    const btn    = overlay.querySelector('#pc-submit');
    const amount = parseFloat(amtInput.value);
    if (!amount || amount <= 0) { overlay.querySelector('#pc-msg').textContent = 'Enter a valid amount'; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    await post('payCreditCard', {
      cardId: cardSel.value, amount,
      date:   overlay.querySelector('#pc-date').value,
      notes:  overlay.querySelector('#pc-notes').value.trim()
    });
    overlay.remove();
    document.dispatchEvent(new CustomEvent('cash-updated'));
  });
}

function _showPaydayAllocationPrompt(result, loans) {
  const today    = new Date();
  const todayDay = today.getDate();
  const paydays  = getPaydays();
  const upcoming = paydays.filter(p => p.day > todayDay);
  const next     = upcoming.length > 0 ? upcoming[0] : paydays[0];

  const loansBeforePayday = (loans || []).filter(l => {
    const d = Number(l.DueDay);
    return d > todayDay && d <= next.day;
  });
  const loanTotal  = loansBeforePayday.reduce((s, l) => s + Number(l.MonthlyPayment), 0);
  const freeToSpend = result.amount - loanTotal;

  const overlay = _createOverlay();
  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp5);width:min(460px,92vw)">
      <h2 style="margin:0 0 var(--sp3);font-size:1rem;color:var(--ok)">${peso(result.amount)} received</h2>
      <p style="font-size:0.82rem;color:var(--muted);margin:0 0 var(--sp3)">Before ${next.person}'s payday (${next.day}th):</p>
      ${loansBeforePayday.map(l => `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border)">
          <span>${l.Bank} ${l.Type} due ${l.DueDay}th</span>
          <span class="mono warn">${peso(l.MonthlyPayment)}</span>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;font-size:0.9rem;padding:var(--sp2) 0;margin-top:var(--sp2);font-weight:700">
        <span>Free to spend</span>
        <span class="mono ${freeToSpend >= 0 ? 'ok' : 'danger'}">${peso(freeToSpend)}</span>
      </div>
      <button class="btn btn-primary" id="pa-close" style="margin-top:var(--sp3);width:100%">Got it</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#pa-close').addEventListener('click', () => overlay.remove());
}

function _computeRunway(cashOnHand, cashLog) {
  const now    = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 14);
  const cutStr = cutoff.toISOString().slice(0, 10);

  const burnEntries = cashLog.filter(r =>
    String(r.Date) >= cutStr &&
    String(r.Date) <= now.toISOString().slice(0, 10) &&
    ['spend_cash', 'reno_cash'].includes(r.Type)
  );

  if (burnEntries.length < 3) return 'Not enough spend data yet';

  const total14   = burnEntries.reduce((s, r) => s + Number(r.Amount || 0), 0);
  const dailyRate = total14 / 14;
  if (dailyRate <= 0) return 'No recent cash spending';

  const days = Math.floor(cashOnHand / dailyRate);
  if (days > 60) return `At current pace (~${peso(Math.round(dailyRate))}/day), cash covers 60+ days`;

  const zeroDate = new Date(now);
  zeroDate.setDate(now.getDate() + days);
  const zeroStr  = zeroDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `At current pace (~${peso(Math.round(dailyRate))}/day), cash covers ~${days} days · until ~${zeroStr}`;
}

function _createOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:var(--sp4)';
  return overlay;
}
