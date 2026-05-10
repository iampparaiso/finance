import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge, pct } from './format.js';

export async function renderCards(container) {
  const cards = await get('getCards');

  container.innerHTML = `
    <div class="page-header"><h1>Credit Cards</h1></div>
    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Total Limit</div>
        <div class="stat-value">${peso(cards.reduce((s,c)=>s+Number(c.Limit),0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Balance</div>
        <div class="stat-value warn">${peso(cards.reduce((s,c)=>s+Number(c.Balance),0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available</div>
        <div class="stat-value ok">${peso(cards.reduce((s,c)=>s+(Number(c.Limit)-Number(c.Balance)),0))}</div>
      </div>
    </div>
    ${cards.map(c => _cardRow(c)).join('')}
  `;

  container.querySelectorAll('.card-head').forEach(h => {
    h.addEventListener('click', () => {
      h.closest('.card-row')?.querySelector('.card-detail')?.classList.toggle('open');
    });
  });
}

function _cardRow(c) {
  const days = daysUntil(c.DueDate);
  const utilPct = pct(Number(c.Balance), Number(c.Limit));
  const fillColor = utilPct > 50 ? 'var(--danger)' : utilPct > 20 ? 'var(--warn)' : 'var(--ok)';

  return `
  <div class="card-row">
    <div class="card-head">
      <div style="display:flex;align-items:center;gap:var(--sp2)">
        <span class="card-dot" style="background:${c.Color}"></span>
        <div>
          <div class="card-name">${c.Name}</div>
          <div class="card-sub">${c.Last4 ? '••' + c.Last4 + ' · ' : ''}${c.Network}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="card-balance ${Number(c.Balance)===0?'ok':c.PastDue?'danger':'warn'}">${peso(c.Balance)}</div>
        <div style="font-size:0.75rem;color:var(--muted)">${c.DueDate ? dueBadge(days) : '<span class="badge ok">CLEAR</span>'}</div>
      </div>
    </div>
    <div class="util-wrap">
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--muted);margin-bottom:4px">
        <span>Utilization ${utilPct}%</span>
        <span>${peso(Number(c.Limit)-Number(c.Balance))} available</span>
      </div>
      <div class="util-bar"><div class="util-fill" style="width:${utilPct}%;background:${fillColor}"></div></div>
    </div>
    <div class="card-detail">
      <div class="detail-grid">
        <div class="detail-item"><div class="dl">Credit Limit</div><div class="dv">${peso(c.Limit)}</div></div>
        <div class="detail-item"><div class="dl">Balance</div><div class="dv ${c.PastDue?'danger':'warn'}">${peso(c.Balance)}</div></div>
        <div class="detail-item"><div class="dl">Statement Cut</div><div class="dv">${c.StatementCutDay}th</div></div>
        <div class="detail-item"><div class="dl">Due Date</div><div class="dv">${c.DueDate ? dateStr(c.DueDate) : '—'}</div></div>
        <div class="detail-item"><div class="dl">Interest Rate</div><div class="dv danger">${(Number(c.InterestRate)*100).toFixed(0)}%/mo</div></div>
        ${Number(c.UnbilledInstallments)>0?`<div class="detail-item"><div class="dl">Unbilled Installs</div><div class="dv warn">${peso(c.UnbilledInstallments)}</div></div>`:''}
        ${c.CashAdvanceLimit?`<div class="detail-item"><div class="dl">Cash Advance</div><div class="dv">${peso(c.CashAdvanceLimit)}</div></div>`:''}
      </div>
    </div>
  </div>`;
}
