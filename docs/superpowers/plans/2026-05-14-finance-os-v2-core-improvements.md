# Finance OS v2 — Core Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs, add installments-per-card and accurate available credit to the Cards tab, build a bulk spend logging queue, add a toast system, API caching, skeleton screens, tab transitions, micro-interactions, a dashboard greeting, and responsiveness polish.

**Architecture:** Backend-first — API.gs gets new actions (`updateSpend`, `bulkLogSpend`) and a bug fix (`payCreditCard` always clears PastDue), deployed via deploy.ps1 before any frontend work. Frontend changes are additive: new `toast.js` module, cache layer in `api.js`, and feature additions to existing render functions. SW cache bumped from v5 → v6 at the end.

**Tech Stack:** Google Apps Script (backend), Vanilla JS ES modules (frontend), GitHub Pages (hosting), Google Sheets (database), PWA service worker.

**Spec:** `docs/superpowers/specs/2026-05-14-finance-os-v2-core-improvements-design.md`

---

## File Map

| File | Change Type | What changes |
|------|-------------|--------------|
| `appsscript/API.gs` | Modify | Fix payCreditCard; add updateSpend, bulkLogSpend |
| `frontend/js/api.js` | Modify | Add 60s cache with post-invalidation |
| `frontend/js/app.js` | Modify | Tab transition animation; queue navigation guard |
| `frontend/js/cards.js` | Modify | Installments section; AvailableCredit display; SOA modal 3rd field; PastDue auto-uncheck; card expand animation |
| `frontend/js/dashboard.js` | Modify | Contextual greeting line; stat counter animations |
| `frontend/js/format.js` | Modify | Add `animateValue` utility |
| `frontend/js/spend-log.js` | Modify | Add Groceries; inline notes editing; queue UI; bulk submit; delete fade |
| `frontend/js/toast.js` | Create | New toast notification module |
| `frontend/css/app.css` | Modify | Skeleton shimmer; tab/card transitions; micro-interactions; hover states; pulse; responsiveness |
| `frontend/sw.js` | Modify | Bump CACHE to finance-os-v6; add toast.js to PRECACHE |
| `frontend/config.js` | Modify | Updated API_URL after backend deploy |

---

## Task 1: Fix API.gs — payCreditCard + add updateSpend + add bulkLogSpend

**Files:**
- Modify: `appsscript/API.gs`

No test runner exists for Apps Script. Verification is done after Task 2 deploy via live API calls.

- [ ] **Step 1: Fix payCreditCard to always clear PastDue**

In `API.gs`, find the `payCreditCard` case (around line 208). Replace these two lines:
```javascript
        var cardUpdates = { Balance: newCardBal };
        if (newCardBal <= 0) cardUpdates.PastDue = false;
```
With:
```javascript
        var cardUpdates = { Balance: newCardBal, PastDue: false };
```

- [ ] **Step 2: Add `updateSpend` action to doPost**

In `API.gs`, inside the `doPost` switch, add this case **before** the `default:` case:
```javascript
      case 'updateSpend':
        var uspSheet = getSheet('SpendLog');
        var uspData  = uspSheet.getDataRange().getValues();
        var uspHdrs  = uspData[0];
        var uspTsCol = uspHdrs.indexOf('Timestamp');
        var uspNCol  = uspHdrs.indexOf('Notes');
        if (uspTsCol === -1 || uspNCol === -1) return _error('SpendLog schema error');
        var uspFound = false;
        for (var ui = 1; ui < uspData.length; ui++) {
          if (String(uspData[ui][uspTsCol]) === String(body.id)) {
            uspSheet.getRange(ui + 1, uspNCol + 1).setValue(body.notes || '');
            uspFound = true;
            break;
          }
        }
        return uspFound ? _ok({ success: true }) : _error('Row not found');
```

- [ ] **Step 3: Add `bulkLogSpend` action to doPost**

In `API.gs`, add this case immediately after `updateSpend`:
```javascript
      case 'bulkLogSpend':
        var blsEntries = body.entries || [];
        if (!blsEntries.length) return _error('No entries provided');
        for (var vi = 0; vi < blsEntries.length; vi++) {
          var ve = blsEntries[vi];
          if (!ve.date || !ve.description || isNaN(Number(ve.amount)) || Number(ve.amount) <= 0) {
            return _error('Invalid entry at index ' + vi + ': missing date, description, or valid amount');
          }
        }
        var blsCashNow = Number(_getConfigValue('cash_on_hand') || 0);
        var blsRunning = blsCashNow;
        var blsIds     = [];
        for (var bi = 0; bi < blsEntries.length; bi++) {
          var be = blsEntries[bi];
          Utilities.sleep(5);
          var blsTs = new Date().toISOString();
          appendRow('SpendLog', {
            Timestamp:   blsTs,
            Date:        be.date,
            Description: be.description,
            Amount:      be.amount,
            Category:    be.category || 'Other',
            CardID:      be.cardId || '',
            Month:       (be.date || '').slice(0, 7),
            Notes:       be.notes || '',
            AddedBy:     email
          });
          if (!be.cardId) {
            blsRunning -= Number(be.amount);
            appendRow('CashLog', {
              Timestamp:     blsTs,
              Date:          be.date,
              Type:          'spend_cash',
              Amount:        Number(be.amount),
              RunningBalance:blsRunning,
              Notes:         be.description || '',
              LinkedID:      '',
              AddedBy:       email
            });
          }
          blsIds.push(blsTs);
        }
        if (blsRunning !== blsCashNow) _setConfigValue('cash_on_hand', blsRunning);
        return _ok({ success: true, count: blsIds.length, ids: blsIds });
```

- [ ] **Step 4: Commit API.gs changes**

```bash
cd C:\Users\ppara\Desktop\finance
git add appsscript/API.gs
git commit -m "feat(backend): fix payCreditCard PastDue; add updateSpend + bulkLogSpend"
```

---

## Task 2: Deploy Backend + Update config.js

**Files:**
- Modify: `frontend/config.js`

- [ ] **Step 1: Run deploy.ps1**

```powershell
cd C:\Users\ppara\Desktop\finance\appsscript
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "v2 core improvements"
```

Expected output ends with:
```
ACTION REQUIRED: update frontend/config.js with new URL:
  const API_URL = 'https://script.google.com/macros/s/<NEW_ID>/exec';
```

- [ ] **Step 2: Update config.js with the new URL**

Open `frontend/config.js` and replace the `API_URL` line with the URL printed by deploy.ps1.

- [ ] **Step 3: Verify new endpoints are live**

Open the new URL in browser with `?action=getCards&token=test` — should get `{"ok":false,"error":"Unauthorized"}` (not a 404 or "Unknown action"). This confirms the deployment is live.

- [ ] **Step 4: Commit and push config.js**

```bash
git add frontend/config.js
git commit -m "config: update API_URL after v2 backend deploy"
git -c credential.helper="" push https://iampparaiso:ghp_REDACTED@github.com/iampparaiso/finance.git main
```

---

## Task 3: Add AvailableCredit Column to Google Sheet

**No code files** — manual sheet change.

- [ ] **Step 1: Open the Finance Google Sheet**

Go to: https://script.google.com → open the Finance OS project → open the linked spreadsheet (or navigate directly from Drive as iampparaiso@gmail.com).

- [ ] **Step 2: Add column to CreditCards tab**

In the `CreditCards` tab, add a new column header `AvailableCredit` in the next empty column after the existing headers. Leave all data rows blank (null = "not yet set from SOA" — the frontend handles this gracefully).

- [ ] **Step 3: Verify**

Call `?action=getCards&token=<valid_token>` — each card object should now include `"AvailableCredit": ""` (or whatever the blank cell returns).

---

## Task 4: Bug Fixes — Groceries Category + PastDue Modal Auto-uncheck

**Files:**
- Modify: `frontend/js/spend-log.js` (line 6)
- Modify: `frontend/js/cards.js` (openUpdateSOAModal function)

- [ ] **Step 1: Add Groceries to CATEGORIES in spend-log.js**

Find line 6 in `spend-log.js`:
```javascript
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];
```
Replace with:
```javascript
const CATEGORIES = ['Food', 'Groceries', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];
```

- [ ] **Step 2: Auto-uncheck PastDue when Balance is set to 0 in SOA modal**

In `cards.js`, inside `openUpdateSOAModal`, find the line that creates the balance input (around line 122):
```javascript
        <input type="number" id="soa-balance" value="${Number(card.Balance)}" style="...">
```

After the overlay is appended to the body (after `document.body.appendChild(overlay)`), add this event listener:
```javascript
  document.getElementById('soa-balance').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('soa-balance').value);
    if (val === 0) document.getElementById('soa-pastdue').checked = false;
  });
```

The full block after `document.body.appendChild(overlay)` becomes:
```javascript
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('soa-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('soa-balance').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('soa-balance').value);
    if (val === 0) document.getElementById('soa-pastdue').checked = false;
  });
  document.getElementById('soa-submit').addEventListener('click', async () => {
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/spend-log.js frontend/js/cards.js
git commit -m "fix: add Groceries category; auto-uncheck PastDue when balance set to 0"
```

---

## Task 5: Create Toast Notification Module

**Files:**
- Create: `frontend/js/toast.js`
- Modify: `frontend/css/app.css` (add keyframes)

- [ ] **Step 1: Create toast.js**

Create `frontend/js/toast.js` with this full content:
```javascript
let _container = null;

function _ensureContainer() {
  if (_container) return _container;
  _container = document.createElement('div');
  _container.style.cssText = [
    'position:fixed', 'bottom:var(--sp4)', 'right:var(--sp4)', 'z-index:9999',
    'display:flex', 'flex-direction:column-reverse', 'gap:var(--sp2)', 'pointer-events:none',
    'max-width:320px'
  ].join(';');
  document.body.appendChild(_container);
  return _container;
}

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const colors = {
    success: 'var(--ok)',
    error:   'var(--danger)',
    info:    'var(--acc)',
  };
  toast.style.cssText = [
    `background:${colors[type] || colors.info}`,
    'color:#fff',
    'padding:10px var(--sp4)',
    'border-radius:var(--r2)',
    'font-size:0.85rem',
    'font-weight:500',
    'pointer-events:auto',
    'cursor:pointer',
    'animation:toastIn 200ms ease-out forwards',
    'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
    'line-height:1.4',
  ].join(';');
  toast.textContent = message;

  const container = _ensureContainer();
  container.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = 'toastOut 180ms ease-in forwards';
    setTimeout(() => toast.remove(), 180);
  };

  toast.addEventListener('click', dismiss);
  if (type !== 'error') setTimeout(dismiss, 3000);
}
```

- [ ] **Step 2: Add toast keyframes to app.css**

Append to the end of `frontend/css/app.css`:
```css
/* === TOAST === */
@keyframes toastIn {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(16px); }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/toast.js frontend/css/app.css
git commit -m "feat: add toast notification module"
```

---

## Task 6: API Caching Layer

**Files:**
- Modify: `frontend/js/api.js`

- [ ] **Step 1: Replace api.js with cached version**

Replace the full contents of `frontend/js/api.js` with:
```javascript
let _token = null;

export function setToken(t) { _token = t; }
export function getToken()  { return _token; }

const _cache = new Map();
const CACHE_TTL = 60000;

const INVALIDATIONS = {
  logSpend:         ['getSpendLog', 'getDashboard'],
  bulkLogSpend:     ['getSpendLog', 'getDashboard'],
  deleteSpend:      ['getSpendLog', 'getDashboard'],
  updateSpend:      ['getSpendLog'],
  updateCard:       ['getCards', 'getDashboard'],
  addCash:          ['getDashboard', 'getCashLog'],
  payCreditCard:    ['getCards', 'getDashboard', 'getCashLog'],
  payLoanDebit:     ['getDashboard', 'getCashLog'],
  logRenovation:    ['getRenovation', 'getDashboard'],
  deleteRenovation: ['getRenovation', 'getDashboard'],
  logEmergencyFund: ['getEmergencyFund'],
  updateInstallment:['getInstallments'],
  updateConfig:     ['getConfig', 'getDashboard'],
};

export async function get(action, params = {}) {
  const cacheKey = action + JSON.stringify(params);
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  const qs  = new URLSearchParams({ action, token: _token, ...params }).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');

  _cache.set(cacheKey, { data: json.data, fetchedAt: Date.now() });
  return json.data;
}

export async function post(action, body = {}) {
  const res  = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token: _token, ...body })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');

  (INVALIDATIONS[action] || []).forEach(key => {
    for (const k of _cache.keys()) {
      if (k.startsWith(key)) _cache.delete(k);
    }
  });

  return json.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/api.js
git commit -m "perf: add 60s API cache with post-based invalidation"
```

---

## Task 7: Inline Notes Editing on Spend Log

**Files:**
- Modify: `frontend/js/spend-log.js`

- [ ] **Step 1: Add CSS for the inline edit button to app.css**

Append to `frontend/css/app.css`:
```css
/* === INLINE EDIT === */
.notes-edit-btn { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 0.75rem; padding: 0 4px; opacity: 0; transition: opacity var(--t1); vertical-align: middle; }
.data-table tr:hover .notes-edit-btn { opacity: 1; }
.notes-edit-input { background: var(--bg); border: 1px solid var(--acc); border-radius: var(--r1); color: var(--text); font-size: 0.8rem; padding: 2px 6px; width: 160px; }
```

- [ ] **Step 2: Update the table row template in spend-log.js**

Find the row template in `renderSpendLog` (around line 172–180). Replace the Notes `<td>` from:
```javascript
              <td class="muted" style="font-size:0.8rem">${r.Notes || (dueStr ? `Due ~${dueStr}` : '—')}</td>
```
With:
```javascript
              <td class="muted" style="font-size:0.8rem" data-row-ts="${r.Timestamp || i}">
                <span class="notes-text">${r.Notes || (dueStr ? `Due ~${dueStr}` : '—')}</span>
                <button class="notes-edit-btn" title="Edit note">✏</button>
              </td>
```

- [ ] **Step 3: Add the inline edit event handler**

In `renderSpendLog`, after the delete button event handler block (after the `.sl-del-btn` forEach), add:
```javascript
  content.querySelectorAll('.notes-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const td      = btn.closest('td');
      const span    = td.querySelector('.notes-text');
      const rowTs   = td.dataset.rowTs;
      const current = span.textContent === '—' ? '' : span.textContent;

      const input = document.createElement('input');
      input.className = 'notes-edit-input';
      input.value = current.startsWith('Due ~') ? '' : current;
      input.placeholder = 'Add note…';

      span.replaceWith(input);
      btn.style.opacity = '0';
      input.focus();

      const save = async () => {
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
          showToast('Failed to save note.', 'error');
          input.focus();
        }
      };

      input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { input.replaceWith(span); btn.style.opacity = ''; } });
      input.addEventListener('blur', save);
    });
  });
```

- [ ] **Step 4: Import showToast at the top of spend-log.js**

Add this import at line 1 of `spend-log.js` (after existing imports):
```javascript
import { showToast } from './toast.js';
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/spend-log.js frontend/css/app.css
git commit -m "feat: inline notes editing on spend log rows"
```

---

## Task 8: Bulk Spend Logging Queue

**Files:**
- Modify: `frontend/js/spend-log.js`
- Modify: `frontend/js/app.js`

- [ ] **Step 1: Add module-level queue state and export to spend-log.js**

At the top of `spend-log.js`, after the `const CATEGORIES` line, add:
```javascript
let _queue = [];
export function hasUnsavedQueue() { return _queue.length > 0; }
export function getQueueLength()  { return _queue.length; }
```

- [ ] **Step 2: Replace the form button HTML in renderSpendLog**

Find the single submit button line:
```javascript
      <button class="btn btn-primary" id="sl-submit">Log Expense</button>
```
Replace with:
```javascript
      <div style="display:flex;gap:var(--sp2);flex-wrap:wrap">
        <button class="btn btn-primary" id="sl-add-queue">Add to Queue</button>
        <button class="btn" id="sl-submit">Save Now</button>
      </div>
      <div id="sl-queue-panel"></div>
```

- [ ] **Step 3: Add the queue rendering helper function**

Add this function at the module level in `spend-log.js` (outside `renderSpendLog`, near the top with other helpers):
```javascript
function _renderQueue(cards) {
  const panel = document.getElementById('sl-queue-panel');
  if (!panel) return;
  if (!_queue.length) { panel.innerHTML = ''; return; }

  const total = _queue.reduce((s, e) => s + e.amount, 0);
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
      // single refresh after all saved
      renderSpendLog(document.getElementById('main') || document.querySelector('[data-module="spend-log"]')?.closest('div') || submitBtn.closest('[id="main"]') || document.getElementById('main'));
    } catch (err) {
      showToast('Failed to save queue: ' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = `Submit All (${_queue.length})`;
    }
  });
}
```

Wait — `renderSpendLog` needs the container. Store it as a module-level variable. Replace the helper with this corrected version and add the container variable.

Add after `let _queue = [];`:
```javascript
let _container = null;
```

At the top of `renderSpendLog`, after `export async function renderSpendLog(container) {`, add:
```javascript
  _container = container;
```

And in the queue submit handler replace the renderSpendLog call with:
```javascript
      renderSpendLog(_container);
```

- [ ] **Step 4: Wire up "Add to Queue" and "Save Now" buttons**

After the existing `sl-submit` click handler in `renderSpendLog`, add the Add-to-Queue handler. Find the block starting with `document.getElementById('sl-submit').addEventListener(...)` and replace the entire block with:
```javascript
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
```

- [ ] **Step 5: Add queue navigation guard to app.js**

In `app.js`, add this import at the top:
```javascript
import { hasUnsavedQueue, getQueueLength } from './spend-log.js';
```

In the nav click handler (around line 42), replace:
```javascript
    const btn = e.target.closest('[data-module]');
    if (!btn) return;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentModule = btn.dataset.module;
    await loadModule(currentModule);
```
With:
```javascript
    const btn = e.target.closest('[data-module]');
    if (!btn) return;
    if (currentModule === 'spend-log' && hasUnsavedQueue()) {
      if (!confirm(`You have ${getQueueLength()} unsaved item${getQueueLength() !== 1 ? 's' : ''} in queue. Leave without saving?`)) return;
    }
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentModule = btn.dataset.module;
    await loadModule(currentModule);
```

- [ ] **Step 6: Commit**

```bash
git add frontend/js/spend-log.js frontend/js/app.js
git commit -m "feat: bulk spend logging queue with Add to Queue / Submit All"
```

---

## Task 9: Cards — Active Installments Per Card

**Files:**
- Modify: `frontend/js/cards.js`

- [ ] **Step 1: Add installments fetch to renderCards**

In `renderCards`, replace:
```javascript
  const [cards, spendRows] = await Promise.all([get('getCards'), get('getSpendLog')]);
```
With:
```javascript
  const [cards, spendRows, allInstalls] = await Promise.all([
    get('getCards'), get('getSpendLog'), get('getInstallments')
  ]);
```

- [ ] **Step 2: Pass installments to _cardRow**

Find:
```javascript
    ${cards.map(c => _cardRow(c, spendRows)).join('')}
```
Replace with:
```javascript
    ${cards.map(c => _cardRow(c, spendRows, allInstalls)).join('')}
```

- [ ] **Step 3: Update _cardRow signature and add installments section**

Change the function signature:
```javascript
function _cardRow(c, spendRows) {
```
To:
```javascript
function _cardRow(c, spendRows, allInstalls) {
```

Add a new helper function for the installments section (place it near `_unbilledSection`):
```javascript
function _installmentsSection(card, allInstalls) {
  const active = (allInstalls || []).filter(i =>
    i.Status === 'active' &&
    i.CardID.toLowerCase() === card.ID.toLowerCase()
  );
  if (!active.length) return '';

  const totalMonthly = active.reduce((s, i) => s + Number(i.MonthlyAmount), 0);
  return `
    <div style="margin-top:var(--sp3);padding-top:var(--sp3);border-top:1px solid var(--border)">
      <div class="dl" style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;margin-bottom:var(--sp2)">Active Installments</div>
      ${active.map(i => `
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:4px 0">
          <div>
            <span style="color:var(--text2)">${i.Description || '—'}</span>
            ${i.Note ? `<span style="color:var(--muted);font-size:0.75rem"> · ${i.Note}</span>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:var(--sp3)">
            <span class="mono warn" style="font-weight:600">${peso(Number(i.MonthlyAmount))}/mo</span>
            ${Number(i.MonthsRemaining) > 0 ? `<span style="color:var(--muted);font-size:0.72rem"> · ${i.MonthsRemaining} left</span>` : ''}
          </div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:700;padding-top:var(--sp2);margin-top:var(--sp1);border-top:1px solid var(--border)">
        <span style="color:var(--muted)">Monthly installment load</span>
        <span class="mono warn">${peso(totalMonthly)}/mo</span>
      </div>
    </div>`;
}
```

In `_cardRow`, add `${_installmentsSection(c, allInstalls)}` to the card detail section, right after `${_unbilledSection(c, spendRows)}`:
```javascript
      ${_unbilledSection(c, spendRows)}
      ${_installmentsSection(c, allInstalls)}
      ${_perksSection(perks)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/cards.js
git commit -m "feat(cards): show active installments per card in detail panel"
```

---

## Task 10: Cards — Available Credit from SOA

**Files:**
- Modify: `frontend/js/cards.js`

- [ ] **Step 1: Add AvailableCredit field to openUpdateSOAModal**

In `openUpdateSOAModal`, the modal HTML has a Balance input and a Due Date input. Add the AvailableCredit input between them. Find:
```javascript
      <div style="margin-bottom:var(--sp3)">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:4px">New Due Date</label>
        <input type="date" id="soa-due" value="${dueDateVal}" ...>
      </div>
```
Replace with:
```javascript
      <div style="margin-bottom:var(--sp3)">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:4px">Available Credit (₱) — from SOA</label>
        <input type="number" id="soa-avail" value="${Number(card.AvailableCredit) || ''}" placeholder="e.g. 450000" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r1);background:var(--surface);color:var(--text);font-size:1rem;box-sizing:border-box">
      </div>
      <div style="margin-bottom:var(--sp3)">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:4px">New Due Date</label>
        <input type="date" id="soa-due" value="${dueDateVal}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r1);background:var(--surface);color:var(--text);font-size:1rem;box-sizing:border-box">
      </div>
```

- [ ] **Step 2: Include AvailableCredit in the updateCard POST**

In the soa-submit click handler, find where the `updates` object is built:
```javascript
      await post('updateCard', { cardId: card.ID, updates: { Balance: balance, DueDate: dueDate, PastDue: pastDue } });
```
Replace with:
```javascript
      const availCredit = parseFloat(document.getElementById('soa-avail').value);
      const updates = { Balance: balance, DueDate: dueDate, PastDue: pastDue };
      if (!isNaN(availCredit) && availCredit >= 0) updates.AvailableCredit = availCredit;
      await post('updateCard', { cardId: card.ID, updates });
```

- [ ] **Step 3: Update utilization bar label in _cardRow**

In `_cardRow`, find:
```javascript
        <span>${peso(Number(c.Limit)-Number(c.Balance))} available</span>
```
Replace with:
```javascript
        ${Number(c.AvailableCredit) > 0
          ? `<span>${peso(Number(c.AvailableCredit))} available <span style="font-size:0.65rem;color:var(--muted)">(SOA)</span></span>`
          : `<span style="color:var(--muted)">${peso(Number(c.Limit)-Number(c.Balance))} available <span style="font-size:0.65rem">(est.)</span></span>`
        }
```

- [ ] **Step 4: Add AvailableCredit row to detail grid**

In `_cardRow`, inside the `.detail-grid`, find the Credit Limit and Balance items. After them, add an AvailableCredit row:
```javascript
        <div class="detail-item"><div class="dl">Credit Limit</div><div class="dv">${peso(c.Limit)}</div></div>
        <div class="detail-item"><div class="dl">Balance</div><div class="dv ${c.PastDue?'danger':'warn'}">${peso(c.Balance)}</div></div>
        ${Number(c.AvailableCredit) > 0
          ? `<div class="detail-item"><div class="dl">Available Credit</div><div class="dv ok">${peso(c.AvailableCredit)}</div></div>`
          : `<div class="detail-item"><div class="dl">Available Credit</div><div class="dv muted" style="font-size:0.8rem">${peso(Number(c.Limit)-Number(c.Balance))} (est.)</div></div>`
        }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/cards.js
git commit -m "feat(cards): available credit from SOA; add AvailableCredit field to Update SOA modal"
```

---

## Task 11: animateValue Utility + Dashboard Greeting

**Files:**
- Modify: `frontend/js/format.js`
- Modify: `frontend/js/dashboard.js`
- Modify: `frontend/js/cards.js`

- [ ] **Step 1: Add animateValue to format.js**

Read `frontend/js/format.js` current contents, then append this export at the end:
```javascript
export function animateValue(el, target, fmt, duration = 400) {
  const start = performance.now();
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

- [ ] **Step 2: Add data-animate attributes to dashboard.js stat values**

In `renderDashboard`, add `data-animate` attributes to the four numeric stat-value divs. Replace these four stat-value lines:
```javascript
        <div class="stat-value ok">${peso(d.totalMonthlyIncome)}</div>
```
```javascript
        <div class="stat-value warn">${peso(d.totalObligations)}</div>
```
```javascript
        <div class="stat-value ${d.netAfterObligations >= 0 ? 'ok' : 'danger'}">${peso(d.netAfterObligations)}</div>
```
```javascript
        <div class="stat-value ${cashColor}">${peso(cashOnHand)}</div>
```
With (add `data-animate` and an `id` for targeting):
```javascript
        <div class="stat-value ok" data-animate="${d.totalMonthlyIncome}">${peso(d.totalMonthlyIncome)}</div>
```
```javascript
        <div class="stat-value warn" data-animate="${d.totalObligations}">${peso(d.totalObligations)}</div>
```
```javascript
        <div class="stat-value ${d.netAfterObligations >= 0 ? 'ok' : 'danger'}" data-animate="${d.netAfterObligations}">${peso(d.netAfterObligations)}</div>
```
```javascript
        <div class="stat-value ${cashColor}" data-animate="${cashOnHand}">${peso(cashOnHand)}</div>
```

- [ ] **Step 3: Add greeting line to dashboard page-header**

In `renderDashboard`, find the page-header HTML:
```javascript
    <div class="page-header">
      <h1>Dashboard</h1>
      <span class="page-date">...</span>
    </div>
```
Replace with:
```javascript
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <div style="font-size:0.85rem;color:var(--muted);margin-top:2px">${_greeting(d)}</div>
      </div>
      <span class="page-date">${new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
    </div>
```

- [ ] **Step 4: Add _greeting function to dashboard.js**

Add this function at the bottom of `dashboard.js` (with the other private helpers):
```javascript
function _greeting(d) {
  const h    = new Date().getHours();
  const past = d.pastDueCards && d.pastDueCards.length > 0;
  const oblPct = d.totalMonthlyIncome > 0 ? d.totalObligations / d.totalMonthlyIncome : 0;
  if (past)        return 'Heads up — a couple of cards need attention.';
  if (h >= 23 || h < 5) return 'Late night budgeting? Respect.';
  if (oblPct > 0.6) return 'Heavy month. Making it work.';
  if (h < 12)      return 'Good morning. You\'re on top of it.';
  if (h < 18)      return 'Afternoon check-in. Looking solid.';
  return 'Evening. Numbers are in check.';
}
```

- [ ] **Step 5: Import animateValue in dashboard.js and trigger animations**

Add `animateValue` to the import from `./format.js`:
```javascript
import { peso, pct, animateValue } from './format.js';
```

After `container.innerHTML = \`...\`;` (end of the template string assignment), add:
```javascript
  container.querySelectorAll('[data-animate]').forEach(el => {
    animateValue(el, parseFloat(el.dataset.animate), peso);
  });
```

- [ ] **Step 6: Commit**

```bash
git add frontend/js/format.js frontend/js/dashboard.js
git commit -m "feat(dashboard): greeting line + stat counter animations"
```

---

## Task 12: Skeleton Screens + Tab Transitions + Card Expand Animation

**Files:**
- Modify: `frontend/css/app.css`
- Modify: `frontend/js/app.js`
- Modify: `frontend/js/cards.js`
- Modify: `frontend/js/spend-log.js`
- Modify: `frontend/js/dashboard.js`

- [ ] **Step 1: Add skeleton + tab transition CSS to app.css**

Append to `frontend/css/app.css`:
```css
/* === SKELETON SCREENS === */
.skeleton-block {
  background: var(--surface);
  border-radius: var(--r2);
  position: relative;
  overflow: hidden;
}
.skeleton-block::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

/* === TAB TRANSITIONS === */
.tab-entering { animation: tabEnter 150ms ease-out forwards; }
@keyframes tabEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* === CARD EXPAND === */
.card-detail {
  overflow: hidden;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  transition: max-height 280ms ease-in-out, padding 200ms ease-in-out;
}
.card-detail.open {
  padding-top: var(--sp4);
  padding-bottom: var(--sp4);
}
```

- [ ] **Step 2: Fix card-detail CSS conflict**

In `app.css`, find and remove the old card-detail rules (around lines 93–94):
```css
.card-detail { padding: var(--sp4); border-top: 1px solid var(--border); display: none; }
.card-detail.open { display: block; }
```
Replace with (keep `border-top`, new rules handle the rest):
```css
.card-detail { padding: var(--sp4); border-top: 1px solid var(--border); }
```
The new rules appended in Step 1 handle `display`, `max-height`, and `padding` transitions.

- [ ] **Step 3: Update card-head click handler in cards.js to animate expand/collapse**

Replace the card-head event listener block in `renderCards`:
```javascript
  container.querySelectorAll('.card-head').forEach(h => {
    h.addEventListener('click', () => {
      h.closest('.card-row')?.querySelector('.card-detail')?.classList.toggle('open');
    });
  });
```
With:
```javascript
  container.querySelectorAll('.card-head').forEach(h => {
    h.addEventListener('click', () => {
      const detail = h.closest('.card-row')?.querySelector('.card-detail');
      if (!detail) return;
      if (detail.classList.contains('open')) {
        detail.style.maxHeight = detail.scrollHeight + 'px';
        requestAnimationFrame(() => { detail.style.maxHeight = '0'; });
        detail.addEventListener('transitionend', () => { detail.style.maxHeight = ''; }, { once: true });
        detail.classList.remove('open');
      } else {
        detail.classList.add('open');
        detail.style.maxHeight = detail.scrollHeight + 'px';
        detail.addEventListener('transitionend', () => { detail.style.maxHeight = ''; }, { once: true });
      }
    });
  });
```

- [ ] **Step 4: Add tab transition to app.js loadModule**

In `app.js`, update `loadModule` to apply the entering animation and use skeleton screens:
```javascript
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
```

- [ ] **Step 5: Remove old loading-spinner from module renderers**

In `renderCards` (`cards.js`), remove:
```javascript
  container.innerHTML = '<div class="loading-spinner">Loading...</div>';
```
(The skeleton is now set by `loadModule` before calling the renderer.)

In `renderSpendLog` (`spend-log.js`), the loading spinner for `sl-content` is still valid (it's a partial re-render inside the already-loaded container). Leave it.

In `renderDashboard` (`dashboard.js`), if there's a loading spinner set at the top, remove it. (Dashboard currently doesn't set one — the module-level skeleton handles it.)

- [ ] **Step 6: Commit**

```bash
git add frontend/js/app.js frontend/js/cards.js frontend/js/spend-log.js frontend/js/dashboard.js frontend/css/app.css
git commit -m "feat: skeleton screens, tab transitions, smooth card expand/collapse"
```

---

## Task 13: Micro-interactions + Dashboard Stat Hover

**Files:**
- Modify: `frontend/css/app.css`
- Modify: `frontend/js/spend-log.js`
- Modify: `frontend/js/cards.js`

- [ ] **Step 1: Add hover + pulse + delete-fade CSS to app.css**

Append to `frontend/css/app.css`:
```css
/* === MICRO-INTERACTIONS === */
.stat-card {
  transition: transform var(--t1), box-shadow var(--t1);
  cursor: default;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow3);
}

.badge.danger.pulse {
  animation: badgePulse 600ms ease-out 1;
}
@keyframes badgePulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.sl-row-removing {
  transition: opacity 200ms ease-out;
  opacity: 0;
}
```

- [ ] **Step 2: Update delete handler in spend-log.js to fade row**

In `renderSpendLog`, find the delete button event handler:
```javascript
  content.querySelectorAll('.sl-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.dataset.rowId;
      if (!confirm('Delete this transaction?')) return;
      btn.disabled = true; btn.textContent = '…';
      const res = await post('deleteSpend', { id: rowId });
      if (res) renderSpendLog(container);
      else { btn.disabled = false; btn.textContent = '✕'; }
    });
  });
```
Replace with:
```javascript
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
```

- [ ] **Step 3: Pulse Past Due badges on load in cards.js**

In `renderCards`, after the `container.innerHTML = \`...\`` block and before the event listener registrations, add:
```javascript
  setTimeout(() => {
    container.querySelectorAll('.badge.danger').forEach(b => {
      b.classList.add('pulse');
      b.addEventListener('animationend', () => b.classList.remove('pulse'), { once: true });
    });
  }, 100);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/css/app.css frontend/js/spend-log.js frontend/js/cards.js
git commit -m "feat: micro-interactions — stat hover lift, row fade delete, past due badge pulse"
```

---

## Task 14: Responsiveness Polish

**Files:**
- Modify: `frontend/css/app.css`

- [ ] **Step 1: Add targeted responsiveness fixes**

Append to `frontend/css/app.css`:
```css
/* === RESPONSIVENESS POLISH === */
@media (max-width: 480px) {
  .stat-grid { grid-template-columns: 1fr 1fr !important; }
}

@media (max-width: 400px) {
  .detail-grid { grid-template-columns: 1fr !important; }
}

/* Queue panel mobile — fixed submit at bottom */
@media (max-width: 600px) {
  #sl-queue-panel .data-table { min-width: 420px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/css/app.css
git commit -m "fix: responsiveness — stat grid, detail grid, queue panel mobile"
```

---

## Task 15: SW Cache Bump + Final Frontend Push

**Files:**
- Modify: `frontend/sw.js`

- [ ] **Step 1: Bump cache version and add toast.js to precache list**

In `frontend/sw.js`, replace:
```javascript
const CACHE = 'finance-os-v5';
```
With:
```javascript
const CACHE = 'finance-os-v6';
```

Add `'/finance/js/toast.js'` to the `PRECACHE` array:
```javascript
  '/finance/js/toast.js',
```
(Add it after `/finance/js/api.js`.)

- [ ] **Step 2: Commit and push all frontend changes**

```bash
git add frontend/sw.js
git commit -m "chore: bump SW cache to finance-os-v6; add toast.js to precache"
git -c credential.helper="" push https://iampparaiso:ghp_REDACTED@github.com/iampparaiso/finance.git main
```

- [ ] **Step 3: Wait for GitHub Actions to deploy (~60 seconds)**

Check: https://github.com/iampparaiso/finance/actions — wait for the deploy workflow to show green.

- [ ] **Step 4: Bust the service worker**

In Chrome DevTools on https://iampparaiso.github.io/finance/:
- Application tab → Service Workers → click **Update**
- Then Ctrl+Shift+R (hard refresh)

The app should now load with all v2 features active.

- [ ] **Step 5: Verify key features**

1. **Past Due fix:** Open Cards tab. If any card was past due, use Pay Card → pay it → verify OVERDUE badge clears.
2. **Groceries:** Open Spend Log → Category dropdown → confirm "Groceries" appears between Food and Transport.
3. **Inline notes:** Find the Makati Med Anesth row → click ✏ → type the correct due note → Enter → confirm it saves without page reload.
4. **Queue:** Add 2–3 items to the queue using "Add to Queue" → confirm queue panel appears → "Submit All" → confirm single refresh and all entries appear.
5. **Installments per card:** Open a card with active installments → expand → confirm installments section appears at bottom of detail.
6. **Available Credit:** Open a card → Update SOA → fill in Available Credit → save → confirm card shows "(SOA)" label next to available figure.
7. **Toast:** Any save action should show a slide-in toast instead of inline message.
8. **Skeleton + transitions:** Navigate between tabs — should see shimmer skeleton on first load, instant on return (cached), with subtle fade-in animation.
9. **Dashboard greeting:** Reload Dashboard — should show a contextual single-line greeting under the h1.
