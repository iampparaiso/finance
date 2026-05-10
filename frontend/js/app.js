import { setToken } from './api.js';
import { renderDashboard }     from './dashboard.js';
import { renderCards }         from './cards.js';
import { renderInstallments }  from './installments.js';
import { renderLoans }         from './loans.js';
import { renderBills }         from './bills.js';
import { renderRenovation }    from './renovation.js';
import { renderEmergencyFund } from './emergency-fund.js';
import { renderSpendLog }      from './spend-log.js';

const MODULES = {
  dashboard:        renderDashboard,
  cards:            renderCards,
  installments:     renderInstallments,
  loans:            renderLoans,
  bills:            renderBills,
  renovation:       renderRenovation,
  'emergency-fund': renderEmergencyFund,
  'spend-log':      renderSpendLog
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
  main.innerHTML = '<div class="loading-spinner">Loading...</div>';
  try {
    await MODULES[name](main);
  } catch (err) {
    main.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/finance/sw.js').catch(console.error);
}
