import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  downloadLearningBackup,
  importLearningBackup,
  parseLearningBackup,
  type ImportMode,
} from '../../lib/client/learning-backup';

export function LearningBackupApp() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [message, setMessage] = useState<string | null>(null);

  const handleImportFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const backup = parseLearningBackup(raw);
      const label = mode === 'merge' ? '병합' : '덮어쓰기';
      const ok = window.confirm(`백업 파일을 ${label} 방식으로 복원할까요?`);
      if (!ok) return;
      const count = importLearningBackup(backup, mode);
      setMessage(`학습 데이터 ${count}개 항목을 복원했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '백업 복원에 실패했습니다.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="hub-feature-card mt-8">
      <span className="hub-badge hub-badge--neutral">Local first</span>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="type-subhead">학습 데이터 백업</h2>
          <p className="type-caption chrome-muted mt-2 max-w-2xl">
            진행률, 오답노트, 스크랩, 집중 기록을 JSON 파일로 저장하거나 다른 브라우저에서 복원할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="app-btn-secondary" onClick={() => downloadLearningBackup()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            백업 다운로드
          </button>
          <button type="button" className="app-btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            백업 복원
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="app-filter-check">
          <input
            type="radio"
            name="backup-import-mode"
            value="merge"
            checked={mode === 'merge'}
            onChange={() => setMode('merge')}
            className="h-4 w-4 accent-indigo-600"
          />
          기존 데이터와 병합
        </label>
        <label className="app-filter-check">
          <input
            type="radio"
            name="backup-import-mode"
            value="replace"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
            className="h-4 w-4 accent-indigo-600"
          />
          백업 데이터로 덮어쓰기
        </label>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleImportFile(event.currentTarget.files?.[0])}
      />
      {message ? (
        <p className="learn-callout learn-callout--info not-prose mt-4" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
