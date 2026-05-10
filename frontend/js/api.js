let _token = null;

export function setToken(t) { _token = t; }
export function getToken()  { return _token; }

export async function get(action, params = {}) {
  const qs = new URLSearchParams({ action, token: _token, ...params }).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

export async function post(action, body = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token: _token, ...body })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}
