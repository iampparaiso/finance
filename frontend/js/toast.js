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
  const colors = { success: 'var(--ok)', error: 'var(--danger)', info: 'var(--acc)' };
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
