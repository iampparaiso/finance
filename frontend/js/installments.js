import { get } from './api.js';
import { peso, dateStr } from './format.js';

export async function renderInstallments(container) {
  const installs = await get('getInstallments');
  const active   = installs.filter(i => i.Status === 'active');
  const upcoming = installs.filter(i => i.Status === 'upcoming');
  const done     = installs.filter(i => i.Status === 'completed');

  const totalMonthly = active.reduce((s,i) => s + Number(i.MonthlyAmount), 0);

  container.innerHTML = `
    <div class="page-header">
      <h1>CC Installments</h1>
      <span class="stat-value warn mono">${peso(totalMonthly)}/mo</span>
    </div>

    <div class="section-title">Active (${active.length})</div>
    <div class="breakdown-grid">
      ${active.map(i => `
        <div class="breakdown-row">
          <div>
            <div style="font-weight:600;font-size:0.9rem">${i.Description}</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.CardID.toUpperCase()}${i.Note?' · '+i.Note:''}</div>
          </div>
          <div style="text-align:right">
            <div class="mono warn">${peso(i.MonthlyAmount)}/mo</div>
            <div style="font-size:0.75rem;color:var(--muted)">${Number(i.MonthsRemaining)>0?i.MonthsRemaining+' months left':'TBD'}</div>
          </div>
        </div>
      `).join('')}
      <div class="breakdown-row total">
        <span>Total Monthly</span>
        <span class="mono">${peso(totalMonthly)}/mo</span>
      </div>
    </div>

    ${upcoming.length > 0 ? `
    <div class="section-title">Upcoming (${upcoming.length})</div>
    <div class="breakdown-grid">
      ${upcoming.map(i => `
        <div class="breakdown-row">
          <div>
            <div style="font-weight:600;font-size:0.9rem">${i.Description}</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.CardID.toUpperCase()} · starts ${dateStr(i.StartDate)}</div>
          </div>
          <div style="text-align:right">
            <div class="mono">${peso(i.MonthlyAmount)}/mo</div>
            <div style="font-size:0.75rem;color:var(--muted)">${i.MonthsRemaining} months</div>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${done.length > 0 ? `
    <div class="section-title">Completed (${done.length})</div>
    <div class="breakdown-grid" style="opacity:0.5">
      ${done.map(i => `<div class="breakdown-row"><span>${i.Description}</span><span class="badge ok">Done</span></div>`).join('')}
    </div>` : ''}
  `;
}
