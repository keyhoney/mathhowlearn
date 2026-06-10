import { useCallback, useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { ShareCardViewModel } from '../../lib/share-card-stats';
import {
  computeShareCardViewModel,
  defaultShareFilename,
  DASHBOARD_REFRESH_EVENT,
  type ShareCardPageConfig,
} from '../../lib/client/share-card-page';
import {
  copyShareCardToClipboard,
  downloadShareCard,
  renderShareCardImage,
  shareShareCard,
} from '../../lib/client/share-card-image';

type Props = ShareCardPageConfig;

export function ShareCardApp({ conceptIndex, siteTitle, siteUrl }: Props) {
  const [vm, setVm] = useState<ShareCardViewModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    setVm(
      computeShareCardViewModel({
        conceptIndex,
        siteTitle,
        siteUrl,
      }),
    );
  }, [conceptIndex, siteTitle, siteUrl]);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('howlearn')) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [refresh]);

  const generateImage = useCallback(async () => {
    if (!vm) return null;
    setBusy(true);
    setMessage(null);
    try {
      return await renderShareCardImage(vm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이미지 생성에 실패했습니다.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [vm]);

  const handleDownload = async () => {
    if (!vm) return;
    const blob = await generateImage();
    if (!blob) return;
    await downloadShareCard(blob, defaultShareFilename(vm));
    setMessage('이미지를 저장했습니다.');
  };

  const handleShare = async () => {
    if (!vm) return;
    const blob = await generateImage();
    if (!blob) return;
    setBusy(true);
    try {
      const result = await shareShareCard(blob, vm);
      setMessage(result === 'shared' ? '공유 메뉴를 열었습니다.' : '이미지를 저장했습니다.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage('공유에 실패했습니다. 이미지 저장을 이용해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!vm) return;
    const blob = await generateImage();
    if (!blob) return;
    const ok = await copyShareCardToClipboard(blob);
    setMessage(
      ok ? '이미지를 클립보드에 복사했습니다.' : '이 브라우저에서는 클립보드 복사를 지원하지 않습니다.',
    );
  };

  if (!vm) return null;

  return (
    <article className="hub-feature-card mt-8" data-dashboard-card="share">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="type-subhead m-0">학습 현황 카드 공유</h2>
          <p className="type-caption chrome-muted mt-1">
            이번 달 학습 통계를 이미지 카드로 만들어 친구에게 자랑하거나 SNS에 올려 보세요.
          </p>
        </div>
      </div>

      {vm.hasEnoughData ? (
        <div className="share-card-preview mt-5" aria-live="polite">
          <div className="share-card-preview__inner">
            <span className="share-card-preview__brand">{vm.siteTitle}</span>
            <span className="share-card-preview__month">{vm.monthLabel}</span>
            <p className="share-card-preview__headline">
              이번 달 <strong>{vm.monthDoneCount}문제 완료</strong>
            </p>
            <p className="share-card-preview__meta">
              🔥 {vm.currentStreak}일 연속 · 집중 {vm.monthFocusLabel}
            </p>
            <div className="share-card-preview__insights">
              <div className="share-card-preview__insight share-card-preview__insight--strength">
                <span className="share-card-preview__insight-label">강점</span>
                <strong>{vm.strengthLabel}</strong>
              </div>
              <div className="share-card-preview__insight share-card-preview__insight--weakness">
                <span className="share-card-preview__insight-label">약점</span>
                <strong>{vm.weaknessLabel}</strong>
              </div>
            </div>
            <p className="share-card-preview__cta">나도 수능 수학 기출 풀기</p>
            <p className="share-card-preview__url">{vm.siteUrl.replace(/^https?:\/\//, '')}</p>
          </div>
        </div>
      ) : (
        <p className="share-card-empty mt-4" role="status">
          문제를 풀거나 집중 학습을 시작하면 공유 카드를 만들 수 있어요.
        </p>
      )}

      <div className="share-card-actions mt-4">
        <button
          type="button"
          className="app-btn-primary"
          onClick={() => void handleDownload()}
          disabled={busy || !vm.hasEnoughData}
        >
          <Download size={18} aria-hidden="true" />
          저장
        </button>
        <button
          type="button"
          className="app-btn-secondary"
          onClick={() => void handleShare()}
          disabled={busy || !vm.hasEnoughData}
        >
          <Share2 size={18} aria-hidden="true" />
          공유
        </button>
        <button
          type="button"
          className="app-btn-ghost"
          onClick={() => void handleCopy()}
          disabled={busy || !vm.hasEnoughData}
        >
          클립보드 복사
        </button>
      </div>

      {message ? (
        <p className="type-caption chrome-muted mt-3" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
