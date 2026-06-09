/** LCP·FCP 이후 idle 시점에 비필수 클라이언트 작업을 실행한다. */
export function deferNonCritical(task: () => void, timeoutMs = 2500): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: timeoutMs });
    return;
  }
  window.setTimeout(task, Math.min(timeoutMs, 2000));
}
