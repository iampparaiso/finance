import { get } from './api.js';
import { peso } from './format.js';
import { safeToSpend } from './calendar.js';

export async function renderBills(container) {
  const [bills, subs, loans, installs] = await Promise.all([
    get('getBills'),
    get('getSubscriptions'),
    get('getLoans'),
    get('getInstallments')
  ]);

  const active   = bills.filter(b => b.Active === true || b.Active === 'TRUE');
  const sts      = safeToSpend(active, installs, loans, subs);

  const totalBills = active.reduce((s,b) => s + (b.Frequency === 'weekly' ? Number(b.Amount)*4 : Number(b.Amount)), 0);
  const totalSubs  = subs.filter(s => s.Active === true || s.Active === 'TRUE').reduce((s,sub) => s + Number(sub.Amount), 0);

  const byCategory = {};
  active.forEach(b => {
    if (!byCategory[b.Category]) byCategory[b.Category] = [];
    byCategory[b.Category].push(b);
  });

  container.innerHTML = `
    <div class="page-header"><h1>Bills & Obligations</h1></div>

    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Safe to Spend Now</div>
        <div class="stat-value ${sts.safeAmount >= 0 ? 'ok' : 'danger'}">${peso(sts.safeAmount)}</div>
        <div class="stat-sub">Before ${sts.nextPayday.person}'s payday (${sts.nextPayday.day}th)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Income Received</div>
        <div class="stat-value ok">${peso(sts.receivedThisMonth)}</div>
        <div class="stat-sub">So far this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Committed Before Payday</div>
        <div class="stat-value warn">${peso(sts.committedBeforePayday)}</div>
        <div class="stat-sub">${sts.billsDueBeforePayday.length} items due</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monthly Bills Total</div>
        <div class="stat-value">${peso(totalBills)}</div>
        <div class="stat-sub">Excl. loans & CC installs</div>
      </div>
    </div>

    ${Object.entries(byCategory).map(([cat, items]) => `
      <div class="section-title">${cat.charAt(0).toUpperCase()+cat.slice(1)}</div>
      <div class="breakdown-grid">
        ${items.map(b => `
          <div class="breakdown-row">
            <div>
              <span>${b.Name}</span>
              ${b.IsEstimate==='TRUE'||b.IsEstimate===true?'<span style="font-size:0.7rem;color:var(--muted)"> ~est</span>':''}
              ${b.EndsOnMoveIn==='TRUE'||b.EndsOnMoveIn===true?'<span style="font-size:0.7rem;color:var(--acc)"> [ends on move-in]</span>':''}
            </div>
            <div style="text-align:right">
              <span class="mono">${peso(b.Amount)}</span>
              <span style="font-size:0.7rem;color:var(--muted)"> ${b.Frequency==='weekly'?'×4/mo':b.DueDay?'· due '+b.DueDay+'th':''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}

    <div class="section-title">Subscriptions</div>
    <div class="breakdown-grid">
      ${subs.filter(s=>s.Active===true||s.Active==='TRUE').map(s => `
        <div class="breakdown-row">
          <div>
            <span>${s.Name}</span>
            <span style="font-size:0.7rem;color:var(--muted)"> · ${s.PaymentMethod}</span>
          </div>
          <div style="text-align:right">
            <span class="mono">${peso(s.Amount)}</span>
            <span style="font-size:0.7rem;color:var(--muted)"> · due ${s.DueDay}th</span>
          </div>
        </div>
      `).join('')}
      <div class="breakdown-row total"><span>Subscriptions Total</span><span class="mono">${peso(totalSubs)}/mo</span></div>
    </div>
  `;
}
