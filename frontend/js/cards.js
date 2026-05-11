import { get } from './api.js';
import { peso, dateStr, daysUntil, dueBadge, pct } from './format.js';
import { openPayCardModal } from './cash-tracker.js';

const CARD_PERKS = {
  RCBC: [
    { icon: '👗', text: '5% cash rebate at ALL clothing/fashion stores worldwide' },
    { icon: '✈️', text: '3x points on overseas online purchases' },
    { icon: '🛒', text: '3x points on local online purchases' },
    { icon: '🍣', text: 'Free Seafood Jambalaya at Burgoo (min ₱1,000 spend)' },
    { icon: '🍕', text: '25% off at California Pizza Kitchen (min ₱3,000)' },
    { icon: '📦', text: '0% EasyTerms + Shop Now Pay Later at Abenson, Electroworld' },
  ],
  Metrobank: [
    { icon: '🌐', text: '2x points on ALL online purchases (Lazada, Shopee, PayPal)' },
    { icon: '🏬', text: '2x points at department stores (SM, Robinsons, Landmark)' },
    { icon: '💰', text: 'Up to ₱9,000 cashback via More With Zero promo (register by Jun 30!)' },
    { icon: '🍽️', text: '50% off buffet at Cafe 1228, New World Makati Hotel' },
    { icon: '📚', text: '0% installment for tuition at partner schools' },
    { icon: '📱', text: '2x points + 0% at gadget stores' },
  ],
  EastWest: [
    { icon: '🛋️', text: '0% installment up to 24 months at Our Home (min ₱70,000)' },
    { icon: '✨', text: '20% off at Opulence Design Concept (Versace Home, Swarovski)' },
    { icon: '👟', text: '20% off at Oxy Originals shoes (use code EWPERKS online)' },
    { icon: '🥩', text: '50% off at Stoned Steaks (min ₱5,000, until Jun 30)' },
    { icon: '🍕', text: '50% off at California Pizza Kitchen (min ₱3,000, max ₱2,500 discount)' },
    { icon: '📦', text: '0% installment up to 24 months at Abenson, Electroworld' },
  ],
  UnionBank: [
    { icon: '🛒', text: '3x points on online shopping (Shopee, Lazada)' },
    { icon: '🛍️', text: '3x points on grocery shopping at supermarkets' },
    { icon: '🍽️', text: '20% off buffet at Mireio, Raffles Makati (until Nov 30)' },
    { icon: '🥂', text: '20% off at Spectrum, Fairmont Makati (until Nov 30)' },
    { icon: '♾️', text: 'Non-expiring rewards points — redeem for cash, GCs, or Cebu Pacific miles' },
  ],
  BPI: [
    { icon: '🍎', text: 'Apple products at lower-than-cash price at authorized resellers' },
    { icon: '🏨', text: '50% off lunch buffet at Shangri-La Manila (Mon–Fri, until Jun 30)' },
    { icon: '🍔', text: "50% off at Burger Beast, Nono's, Cibo (until Jul 31)" },
    { icon: '🎁', text: 'Up to ₱7,000 eGC via Visa Shop Anywhere (register via OMD! app now!)' },
    { icon: '🏠', text: '0% installment at AllHome, Wilcon Depot for home renovation' },
    { icon: '📦', text: '0% FlexipayZero up to 24 months at Abenson, Electroworld, Robinsons Appliances' },
  ],
  BDO: [
    { icon: '🛒', text: 'Transfer BDO points to SMAC for SM Supermarket credits' },
    { icon: '📦', text: 'Buy Now Pay Later — 0% up to 36 months at 25,000+ merchants' },
    { icon: '⏳', text: 'Payment Holiday — first payment up to 4 months later on BNPL' },
    { icon: '🏠', text: 'BNPL at AllHome, True Value, hardware stores (min ₱3,000)' },
    { icon: '🎓', text: '0% tuition installment at partner schools (3–36 months)' },
    { icon: '📱', text: 'BNPL for gadgets — smartphones, laptops, tablets up to 36 months' },
  ],
};

function _matchPerks(cardName) {
  for (const [bank, perks] of Object.entries(CARD_PERKS)) {
    if (cardName.toLowerCase().includes(bank.toLowerCase())) return perks;
  }
  return [];
}

function _unbilledSection(card, spendRows) {
  const cutDay = parseInt(card.StatementCutDay) || 25;
  const now = new Date();
  let cutDate = new Date(now.getFullYear(), now.getMonth(), cutDay);
  if (now.getDate() <= cutDay) {
    cutDate = new Date(now.getFullYear(), now.getMonth() - 1, cutDay);
  }

  const unbilled = spendRows.filter(r => {
    if (r.CardID !== card.ID) return false;
    const d = new Date(r.Date);
    return d > cutDate;
  });

  if (!unbilled.length) return '';

  const total = unbilled.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
  return `
    <div style="margin-top:var(--sp3);padding-top:var(--sp3);border-top:1px solid var(--border)">
      <div class="dl" style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;margin-bottom:var(--sp2)">
        Unbilled Charges (since ${cutDate.toLocaleDateString('en-PH',{month:'short',day:'numeric'})})
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp2)">
        <span class="badge warn">${unbilled.length} transaction${unbilled.length!==1?'s':''}</span>
        <span class="mono" style="font-weight:700;color:var(--warn)">${peso(total)}</span>
      </div>
      ${unbilled.slice(0,5).map(r=>`
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:3px 0;color:var(--text2)">
          <span>${r.Description||'—'}</span>
          <span class="mono">${peso(parseFloat(r.Amount||0))}</span>
        </div>
      `).join('')}
      ${unbilled.length > 5 ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:4px">+${unbilled.length-5} more in Spend Log</div>` : ''}
    </div>`;
}

function _perksSection(perks) {
  if (!perks.length) return '';
  return `
    <div style="margin-top:var(--sp3);padding-top:var(--sp3);border-top:1px solid var(--border)">
      <div class="dl" style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;margin-bottom:var(--sp2)">Active Perks & Deals</div>
      ${perks.map(p=>`
        <div style="display:flex;gap:var(--sp2);align-items:flex-start;padding:4px 0;font-size:0.82rem;color:var(--text2)">
          <span>${p.icon}</span><span>${p.text}</span>
        </div>
      `).join('')}
    </div>`;
}

export async function renderCards(container) {
  container.innerHTML = '<div class="loading-spinner">Loading...</div>';

  const [cards, spendRows] = await Promise.all([get('getCards'), get('getSpendLog')]);

  const totalLimit   = cards.reduce((s,c) => s + Number(c.Limit), 0);
  const totalBalance = cards.reduce((s,c) => s + Number(c.Balance), 0);
  const totalAvail   = totalLimit - totalBalance;

  const allUnbilled = spendRows.filter(r => {
    const card = cards.find(c => c.ID === r.CardID);
    if (!card) return false;
    const cutDay = parseInt(card.StatementCutDay) || 25;
    const now = new Date();
    let cutDate = new Date(now.getFullYear(), now.getMonth(), cutDay);
    if (now.getDate() <= cutDay) cutDate = new Date(now.getFullYear(), now.getMonth()-1, cutDay);
    return new Date(r.Date) > cutDate;
  });
  const unbilledTotal = allUnbilled.reduce((s,r) => s + parseFloat(r.Amount||0), 0);

  container.innerHTML = `
    <div class="page-header"><h1>Credit Cards</h1></div>
    <div class="stat-grid" style="margin-bottom:var(--sp5)">
      <div class="stat-card">
        <div class="stat-label">Total Limit</div>
        <div class="stat-value">${peso(totalLimit)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Balance</div>
        <div class="stat-value warn">${peso(totalBalance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available Credit</div>
        <div class="stat-value ok">${peso(totalAvail)}</div>
      </div>
      ${unbilledTotal > 0 ? `<div class="stat-card">
        <div class="stat-label">Unbilled This Cycle</div>
        <div class="stat-value warn">${peso(unbilledTotal)}</div>
        <div class="stat-sub">${allUnbilled.length} transactions from Spend Log</div>
      </div>` : ''}
    </div>
    ${_priorityQueue(cards)}
    ${cards.map(c => _cardRow(c, spendRows)).join('')}
  `;

  container.querySelectorAll('.card-head').forEach(h => {
    h.addEventListener('click', () => {
      h.closest('.card-row')?.querySelector('.card-detail')?.classList.toggle('open');
    });
  });

  container.querySelectorAll('.pq-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => openPayCardModal(cards, btn.dataset.cardId));
  });
}

function _priorityQueue(cards) {
  const now        = new Date();
  const sevenDays  = new Date(now);
  sevenDays.setDate(now.getDate() + 7);

  const withBalance = cards.filter(c => Number(c.Balance) > 0 || c.PastDue === true || c.PastDue === 'TRUE');
  if (!withBalance.length) return '';

  const sorted = [...withBalance].sort((a, b) => {
    const aPast = a.PastDue === true || a.PastDue === 'TRUE';
    const bPast = b.PastDue === true || b.PastDue === 'TRUE';
    if (aPast && !bPast) return -1;
    if (!aPast && bPast) return 1;
    if (aPast && bPast) return Number(b.Balance) - Number(a.Balance);
    const aDate = a.DueDate ? new Date(a.DueDate) : new Date('2099-12-31');
    const bDate = b.DueDate ? new Date(b.DueDate) : new Date('2099-12-31');
    return aDate - bDate;
  });

  return `
    <div class="section-title">Pay These First</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);margin-bottom:var(--sp5);overflow:hidden">
      ${sorted.map((c, idx) => {
        const isPast  = c.PastDue === true || c.PastDue === 'TRUE';
        const dueDate = c.DueDate ? new Date(c.DueDate) : null;
        const urgent  = dueDate && dueDate <= sevenDays;
        const label   = isPast ? '<span class="badge danger">OVERDUE</span>' :
                        (dueDate ? `due ${dueDate.toLocaleDateString('en-PH',{month:'short',day:'numeric'})}` : '');
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px var(--sp3);border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:var(--sp2)">
            <span style="color:var(--muted);font-size:0.8rem;width:18px">${idx+1}.</span>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.Color}"></span>
            <div>
              <div style="font-size:0.88rem;font-weight:600">${c.Name}${c.Last4 ? ' ••' + c.Last4 : ''}</div>
              <div style="font-size:0.75rem;color:var(--muted)">${label}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp2)">
            <span class="mono ${isPast ? 'danger' : urgent ? 'warn' : ''}" style="font-weight:700">${peso(c.Balance)}</span>
            <button class="pq-pay-btn btn" data-card-id="${c.ID}" style="font-size:0.75rem;padding:4px 10px${isPast?';background:var(--danger);color:#fff;border-color:var(--danger)':''}">Pay Now</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function _cardRow(c, spendRows) {
  const days     = daysUntil(c.DueDate);
  const utilPct  = pct(Number(c.Balance), Number(c.Limit));
  const fillColor = utilPct > 50 ? 'var(--danger)' : utilPct > 20 ? 'var(--warn)' : 'var(--ok)';
  const perks    = _matchPerks(c.Name);

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
      ${_unbilledSection(c, spendRows)}
      ${_perksSection(perks)}
    </div>
  </div>`;
}
