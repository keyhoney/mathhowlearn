import { ensureAnonymousUid } from './firebase-auth';

const USAGE_KEY = 'howlearn-usage-daily-cache';
const ALERT_KEY = 'howlearn-sync-alert:last-resource-exhausted-at';

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '없음';
  return new Date(ts).toLocaleString('ko-KR', { hour12: false });
}

function render(): void {
  const usage = parse<{ byDate?: Record<string, { readOps?: number; writeOps?: number }> }>(
    localStorage.getItem(USAGE_KEY),
    { byDate: {} },
  );
  const byDate = usage.byDate || {};
  const rows = Object.entries(byDate)
    .map(([dateKey, row]) => ({
      dateKey,
      readOps: Math.max(0, Number(row?.readOps || 0)),
      writeOps: Math.max(0, Number(row?.writeOps || 0)),
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
    .slice(0, 14);

  const todayKey = toDateKey(Date.now());
  const today = byDate[todayKey] || {};
  const todayRead = Math.max(0, Number(today.readOps || 0));
  const todayWrite = Math.max(0, Number(today.writeOps || 0));

  const readEl = document.querySelector<HTMLElement>('[data-usage-today-read]');
  const writeEl = document.querySelector<HTMLElement>('[data-usage-today-write]');
  const alertEl = document.querySelector<HTMLElement>('[data-usage-last-alert]');
  const tbody = document.querySelector<HTMLElement>('[data-usage-table-body]');
  if (readEl) readEl.textContent = String(todayRead);
  if (writeEl) writeEl.textContent = String(todayWrite);
  if (alertEl) {
    const lastAlertTs = Number(localStorage.getItem(ALERT_KEY) || 0);
    alertEl.textContent = formatDateTime(lastAlertTs);
  }

  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td class="px-2 py-3 text-[var(--fg-muted)]" colspan="3">데이터 없음</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr class="border-b border-[var(--card-border)]">
          <td class="px-2 py-2">${row.dateKey}</td>
          <td class="px-2 py-2">${row.readOps}</td>
          <td class="px-2 py-2">${row.writeOps}</td>
        </tr>
      `,
    )
    .join('');
}

function parseAllowlist(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-admin-root]');
  if (!root) return;
  const allowlist = parseAllowlist(root.dataset.adminUidAllowlist || '');
  if (allowlist.length === 0) {
    window.location.replace('/');
    return;
  }
  try {
    const uid = await ensureAnonymousUid();
    const allowed = Boolean(uid) && allowlist.includes(uid);
    if (!allowed) {
      window.location.replace('/');
      return;
    }
    root.classList.remove('hidden');
    render();
    document.querySelector('[data-usage-refresh]')?.addEventListener('click', render);
    window.addEventListener('storage', (event) => {
      if (event.key === USAGE_KEY || event.key === ALERT_KEY) render();
    });
  } catch {
    window.location.replace('/');
  }
}

void boot();
