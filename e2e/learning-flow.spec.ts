import { expect, test } from '@playwright/test';

test('problem wrong answer is reflected in wrong note', async ({ page }) => {
  await page.goto('/problems/20250622');
  const shortInput = page.locator('[data-answer-short]');
  await expect(shortInput).toBeVisible();
  await shortInput.fill('0');
  await page.locator('[data-check-answer]').click();
  await expect(page.locator('[data-answer-result]')).toContainText('오답');

  await page.goto('/problems/wrong-note');
  await expect(page.locator('#wrong-note-list')).toContainText('22번');
});

test('hint reveal opens the solution gate', async ({ page }) => {
  await page.goto('/problems/20250622');
  await page.locator('[data-hint-reveal-island]').waitFor();
  for (let i = 0; i < 10; i += 1) {
    const finalButton = page.getByRole('button', { name: '최종 풀이 확인하기' });
    if (await finalButton.isVisible().catch(() => false)) break;
    const nextHint = page.getByRole('button', { name: /힌트 보기/ }).first();
    if (!(await nextHint.isVisible().catch(() => false))) break;
    await nextHint.click();
  }
  await page.getByRole('button', { name: '최종 풀이 확인하기' }).click();
  await expect(page.locator('[data-solution]')).toBeVisible();
});

test('problem list preserves filters when navigating back', async ({ page }) => {
  await page.goto('/problems?year=2026&month=11&status=all');
  const firstCard = page.locator('[data-problem-card][data-year="2026"][data-month="11"]:visible').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await page.locator('[data-list-back-link]').click();
  await expect(page).toHaveURL(/year=2026/);
  await expect(page).toHaveURL(/month=11/);
});

test('search supports direct problem code match', async ({ page }) => {
  await page.goto('/search?q=20250622');
  await expect(page.locator('#search-results')).toContainText('22번');
});

test('mock exam page opens a session when available', async ({ page }) => {
  await page.goto('/problems/mock-exam');
  const firstSession = page.getByRole('link', { name: /시험 시작/ }).first();
  if ((await firstSession.count()) === 0) test.skip(true, 'No complete mock exam session is available.');
  await firstSession.click();
  await expect(page).toHaveURL(/\/problems\/mock-exam\//);
});
