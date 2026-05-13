let _token = null;

export function setToken(t) { _token = t; }
export function getToken()  { return _token; }

const _cache = new Map();
const CACHE_TTL = 60000;

const INVALIDATIONS = {
  logSpend:          ['getSpendLog', 'getDashboard'],
  bulkLogSpend:      ['getSpendLog', 'getDashboard'],
  deleteSpend:       ['getSpendLog', 'getDashboard'],
  updateSpend:       ['getSpendLog'],
  updateCard:        ['getCards', 'getDashboard'],
  addCash:           ['getDashboard', 'getCashLog'],
  payCreditCard:     ['getCards', 'getDashboard', 'getCashLog'],
  payLoanDebit:      ['getDashboard', 'getCashLog'],
  logRenovation:     ['getRenovation', 'getDashboard'],
  deleteRenovation:  ['getRenovation', 'getDashboard'],
  logEmergencyFund:  ['getEmergencyFund'],
  updateInstallment: ['getInstallments'],
  updateConfig:      ['getConfig', 'getDashboard'],
};

export async function get(action, params = {}) {
  const cacheKey = action + JSON.stringify(params);
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  const qs   = new URLSearchParams({ action, token: _token, ...params }).toString();
  const res  = await fetch(`${API_URL}?${qs}`);
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
