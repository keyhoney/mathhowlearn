import { STORAGE_KEYS } from '../storage-keys';
import { DASHBOARD_REFRESH_EVENT, parseJson } from './dashboard-stats';

const BACKUP_VERSION = 1;

const EXTRA_KEYS = [
  'howlearn-progress-summary-cache',
  'howlearn-wrong-summary-cache',
  'howlearn-focus-daily-cache',
  'howlearn-focus-monthly-cache',
  'howlearn-wrong-summary-cache',
  'howlearn-cloud-sync-queue-v1',
] as const;

export type LearningBackup = {
  v: typeof BACKUP_VERSION;
  exportedAt: string;
  app: 'math-howlearn';
  data: Record<string, string>;
};

export type ImportMode = 'merge' | 'replace';

export function getBackupStorageKeys(): string[] {
  return Array.from(new Set([...Object.values(STORAGE_KEYS), ...EXTRA_KEYS]));
}

export function createLearningBackup(): LearningBackup {
  const data: Record<string, string> = {};
  for (const key of getBackupStorageKeys()) {
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  }
  return {
    v: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'math-howlearn',
    data,
  };
}

export function downloadLearningBackup(): void {
  const backup = createLearningBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = backup.exportedAt.slice(0, 10);
  anchor.href = url;
  anchor.download = `howlearn-learning-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseLearningBackup(raw: string): LearningBackup {
  const parsed = parseJson<Partial<LearningBackup>>(raw, {});
  if (parsed.v !== BACKUP_VERSION || parsed.app !== 'math-howlearn' || typeof parsed.data !== 'object' || !parsed.data) {
    throw new Error('올바른 HowLearn 학습 백업 파일이 아닙니다.');
  }
  return parsed as LearningBackup;
}

function mergeJsonString(currentRaw: string | null, nextRaw: string): string {
  const current = parseJson<Record<string, unknown>>(currentRaw, {});
  const next = parseJson<Record<string, unknown>>(nextRaw, {});
  if (
    current &&
    next &&
    typeof current === 'object' &&
    typeof next === 'object' &&
    !Array.isArray(current) &&
    !Array.isArray(next)
  ) {
    const merged: Record<string, unknown> = { ...current, ...next };
    for (const key of Object.keys(next)) {
      const currentValue = current[key];
      const nextValue = next[key];
      if (
        currentValue &&
        nextValue &&
        typeof currentValue === 'object' &&
        typeof nextValue === 'object' &&
        !Array.isArray(currentValue) &&
        !Array.isArray(nextValue)
      ) {
        merged[key] = { ...(currentValue as Record<string, unknown>), ...(nextValue as Record<string, unknown>) };
      }
    }
    return JSON.stringify(merged);
  }
  return nextRaw;
}

export function importLearningBackup(backup: LearningBackup, mode: ImportMode): number {
  let imported = 0;
  const allowed = new Set(getBackupStorageKeys());
  for (const [key, value] of Object.entries(backup.data)) {
    if (!allowed.has(key) || typeof value !== 'string') continue;
    if (mode === 'merge') {
      localStorage.setItem(key, mergeJsonString(localStorage.getItem(key), value));
    } else {
      localStorage.setItem(key, value);
    }
    imported += 1;
  }
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
  return imported;
}
