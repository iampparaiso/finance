import { get } from './api.js';
import { buildMonthCalendar } from './calendar.js';
import { peso } from './format.js';

// Map event type -> badge class
const TYPE_BADGE = {
  income:       'ok',
  bill:         'danger',
  loan:         'danger',
  subscription: 'info',
};

// Human-readable label for badge text
const TYPE_LABEL = {
  income:       'PAY',
  bill:         'DUE',
  loan:         'DUE',
  subscription: 'SUB',
};

export async function renderCalendarView(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Calendar</h1>
      <span class="page-date" id="cal-period"></span>
    </div>
    <div id="cal-content"><div class="loading-spinner">Loading...</div></div>
  `;

  const [billsRes, loansRes, subsRes, installRes] = await Promise.all([
    get('getBills'),
    get('getLoans'),
    get('getSubscriptions'),
    get('getInstallments'),
  ]);

  const bills        = billsRes.ok   ? billsRes.data   : [];
  const loans        = loansRes.ok   ? loansRes.data   : [];
  const subs         = subsRes.ok    ? subsRes.data    : [];
  const installs     = installRes.ok ? installRes.data : [];

  const now     = new Date();
  const content = document.getElementById('cal-content');

  // Render 2 months: current and next
  let html = '';
  for (let offset = 0; offset < 2; offset++) {
    const baseMonth = now.getMonth() + offset;
    const year      = baseMonth >= 12 ? now.getFullYear() + 1 : now.getFullYear();
    const month     = baseMonth % 12;

    const monthName = new Date(year, month, 1)
      .toLocaleString('en-PH', { month: 'long', year: 'numeric' })
      .toUpperCase();

    // byDay is keyed by day number (1-based); each value is an array of event objects:
    // { day, type, label, amount }
    const byDay = buildMonthCalendar(year, month, bills, loans, subs, installs);
    const days  = Object.keys(byDay).map(Number).sort((a, b) => a - b);

    // Only include days that actually have events
    const activeDays = days.filter(d => byDay[d].length > 0);
    if (!activeDays.length) continue;

    html += `<p class="section-title" style="border-left:3px solid var(--acc);padding-left:var(--sp3);color:var(--acc)">${monthName}</p>`;

    activeDays.forEach(day => {
      byDay[day].forEach(ev => {
        const badgeClass = TYPE_BADGE[ev.type] || 'info';
        const badgeText  = TYPE_LABEL[ev.type]  || ev.type.toUpperCase();
        const shortMonth = new Date(year, month, day)
          .toLocaleString('en-PH', { month: 'short' });

        html += `
          <div style="display:flex;align-items:flex-start;gap:var(--sp4);background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp3) var(--sp4);margin-bottom:var(--sp2);box-shadow:var(--shadow1)">
            <div style="text-align:center;flex-shrink:0;width:44px;border-right:1px solid var(--border);padding-right:var(--sp3)">
              <div style="font-size:1.4rem;font-weight:700;line-height:1">${day}</div>
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase">${shortMonth}</div>
            </div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.9rem">${ev.label}</div>
              ${ev.amount ? `<div style="font-size:0.78rem;color:var(--muted2);margin-top:2px">${peso(ev.amount)}</div>` : ''}
            </div>
            <span class="badge ${badgeClass}" style="flex-shrink:0;align-self:center;text-transform:uppercase">${badgeText}</span>
          </div>
        `;
      });
    });
  }

  document.getElementById('cal-period').textContent =
    new Date(now.getFullYear(), now.getMonth(), 1)
      .toLocaleString('en-PH', { month: 'long', year: 'numeric' }) +
    ' – ' +
    new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleString('en-PH', { month: 'long', year: 'numeric' });

  content.innerHTML = html ||
    '<p class="muted" style="text-align:center;padding:var(--sp7)">No events found.</p>';
}
