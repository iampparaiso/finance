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

    ${_reliefTimeline(active)}
  `;
}

function _reliefTimeline(active) {
  const now     = new Date();
  const withEnd = active
    .filter(i => Number(i.MonthsRemaining) > 0)
    .map(i => {
      const endDate = new Date(now.getFullYear(), now.getMonth() + Number(i.MonthsRemaining), 1);
      return { ...i, endDate, endLabel: endDate.toLocaleDateString('en-PH',{month:'short',year:'numeric'}) };
    })
    .sort((a, b) => a.endDate - b.endDate);

  if (!withEnd.length) return '';

  const totalFreed = withEnd.reduce((s, i) => s + Number(i.MonthlyAmount), 0);
  const lastLabel  = withEnd[withEnd.length - 1].endLabel;

  return `
    <div class="section-title" style="margin-top:var(--sp5)">Upcoming Relief</div>
    <div class="breakdown-grid">
      ${withEnd.map(i => `
        <div class="breakdown-row">
          <div>
            <span style="font-size:0.85rem;font-weight:600">${i.endLabel}</span>
            <span style="font-size:0.75rem;color:var(--muted)"> · ${i.CardID ? i.CardID.toUpperCase() : ''}</span>
            ${i.Description ? `<div style="font-size:0.75rem;color:var(--muted)">${i.Description}</div>` : ''}
          </div>
          <span class="mono ok">+${peso(i.MonthlyAmount)}/mo</span>
        </div>
      `).join('')}
      <div class="breakdown-row total">
        <span>After ${lastLabel}</span>
        <span class="mono ok">+${peso(totalFreed)}/mo freed</span>
      </div>
    </div>
  `;
}
