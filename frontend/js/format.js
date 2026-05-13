export function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function pesoFull(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateStr(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthStr(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export function dueBadge(days) {
  if (days === null) return '';
  if (days < 0)  return `<span class="badge danger">PAST DUE ${Math.abs(days)}d</span>`;
  if (days === 0) return `<span class="badge danger">DUE TODAY</span>`;
  if (days <= 3)  return `<span class="badge warn">Due in ${days}d</span>`;
  if (days <= 7)  return `<span class="badge info">Due in ${days}d</span>`;
  return `<span class="badge ok">Due ${dateStr(new Date(Date.now() + days * 86400000))}</span>`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function animateValue(el, target, fmt, duration = 400) {
  const start = performance.now();
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
