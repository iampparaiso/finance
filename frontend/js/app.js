import { setToken } from './api.js';
import { hasUnsavedQueue, getQueueLength } from './spend-log.js';
import { renderDashboard }     from './dashboard.js';
import { renderCards }         from './cards.js';
import { renderInstallments }  from './installments.js';
import { renderLoans }         from './loans.js';
import { renderBills }         from './bills.js';
import { renderRenovation }    from './renovation.js';
import { renderEmergencyFund } from './emergency-fund.js';
import { renderSpendLog }      from './spend-log.js';
import { renderDeals }         from './deals.js';
import { renderBestCard }      from './best-card.js';
import { renderCalendarView }  from './calendar-view.js';
import { renderIncome }        from './income.js';

const MODULES = {
  dashboard:        renderDashboard,
  cards:            renderCards,
  installments:     renderInstallments,
  loans:            renderLoans,
  bills:            renderBills,
  renovation:       renderRenovation,
  'emergency-fund': renderEmergencyFund,
  'spend-log':      renderSpendLog,
  deals:            renderDeals,
  'best-card':      renderBestCard,
  calendar:         renderCalendarView,
  income:           renderIncome
};

let currentModule = 'dashboard';

window.onGoogleSignIn = async function(response) {
  setToken(response.credential);
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await loadModule('dashboard');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('auth-gate').classList.remove('hidden');

  document.getElementById('nav-tabs').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-module]');
    if (!btn) return;
    if (currentModule === 'spend-log' && hasUnsavedQueue()) {
      if (!confirm(`You have ${getQueueLength()} unsaved item${getQueueLength() !== 1 ? 's' : ''} in queue. Leave without saving?`)) return;
    }
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentModule = btn.dataset.module;
    await loadModule(currentModule);
  });

  document.getElementById('refresh-btn').addEventListener('click', () => loadModule(currentModule));
});

async function loadModule(name) {
  const main = document.getElementById('main');
  if (!MODULES[name]) {
    main.innerHTML = `<div class="error-state">Unknown module: ${name}</div>`;
    return;
  }
  main.innerHTML = _skeleton(name);
  main.classList.remove('tab-entering');
  void main.offsetWidth;
  main.classList.add('tab-entering');
  try {
    await MODULES[name](main);
    main.classList.remove('tab-entering');
    void main.offsetWidth;
    main.classList.add('tab-entering');
  } catch (err) {
    main.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

function _skeleton(name) {
  const statRow = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--sp4);margin-bottom:var(--sp5)">${[1,2,3,4].map(() => '<div class="skeleton-block" style="height:90px"></div>').join('')}</div>`;
  if (name === 'cards') {
    return statRow + [1,2,3].map(() => '<div class="skeleton-block" style="height:72px;margin-bottom:var(--sp3)"></div>').join('');
  }
  if (name === 'spend-log') {
    return statRow + '<div class="skeleton-block" style="height:180px;margin-bottom:var(--sp5)"></div>' +
      [1,2,3,4,5].map(() => '<div class="skeleton-block" style="height:44px;margin-bottom:4px"></div>').join('');
  }
  return statRow + '<div class="skeleton-block" style="height:200px;margin-bottom:var(--sp4)"></div>' +
    '<div class="skeleton-block" style="height:160px"></div>';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/finance/sw.js').catch(console.error);
}
