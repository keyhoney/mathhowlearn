import type { ShareCardViewModel } from '../share-card-stats';

const CARD_SIZE = 1080;
const FONT_FAMILY = 'Hahmlet, "Malgun Gothic", sans-serif';

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined') return;
  await Promise.all([
    document.fonts.load(`800 72px ${FONT_FAMILY}`),
    document.fonts.load(`700 42px ${FONT_FAMILY}`),
    document.fonts.load(`600 32px ${FONT_FAMILY}`),
    document.fonts.load(`500 28px ${FONT_FAMILY}`),
    document.fonts.load(`400 24px ${FONT_FAMILY}`),
  ]);
  await document.fonts.ready;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    let trimmed = last;
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[maxLines - 1] = `${trimmed}…`;
  }
  return lines.length > 0 ? lines : [text];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareCardImage(vm: ShareCardViewModel): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const bg = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(0.45, '#312e81');
  bg.addColorStop(1, '#4338ca');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  ctx.globalAlpha = 0.08;
  for (let x = 0; x < CARD_SIZE; x += 48) {
    for (let y = 0; y < CARD_SIZE; y += 48) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  const pad = 72;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  drawRoundedRect(ctx, pad, pad, CARD_SIZE - pad * 2, CARD_SIZE - pad * 2, 36);
  ctx.fill();

  ctx.fillStyle = '#c7d2fe';
  ctx.font = `600 28px ${FONT_FAMILY}`;
  ctx.fillText(vm.siteTitle, pad + 40, pad + 56);

  ctx.fillStyle = '#e0e7ff';
  ctx.font = `500 30px ${FONT_FAMILY}`;
  ctx.fillText(vm.monthLabel, pad + 40, pad + 108);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 72px ${FONT_FAMILY}`;
  ctx.fillText('이번 달', pad + 40, pad + 210);

  ctx.font = `800 88px ${FONT_FAMILY}`;
  ctx.fillText(`${vm.monthDoneCount}문제 완료`, pad + 40, pad + 310);

  ctx.fillStyle = '#ddd6fe';
  ctx.font = `500 30px ${FONT_FAMILY}`;
  const meta = `🔥 ${vm.currentStreak}일 연속  ·  집중 ${vm.monthFocusLabel}`;
  ctx.fillText(meta, pad + 40, pad + 380);

  const boxY = pad + 430;
  const boxW = (CARD_SIZE - pad * 2 - 80 - 24) / 2;
  const boxH = 220;

  const drawInsightBox = (
    x: number,
    title: string,
    value: string,
    accent: string,
  ) => {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    drawRoundedRect(ctx, x, boxY, boxW, boxH, 24);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, x, boxY, boxW, boxH, 24);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = `700 30px ${FONT_FAMILY}`;
    ctx.fillText(title, x + 28, boxY + 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 34px ${FONT_FAMILY}`;
    const lines = wrapText(ctx, value, boxW - 56, 3);
    lines.forEach((line, idx) => {
      ctx.fillText(line, x + 28, boxY + 108 + idx * 44);
    });
  };

  drawInsightBox(pad + 40, '강점', vm.strengthLabel, '#34d399');
  drawInsightBox(pad + 40 + boxW + 24, '약점', vm.weaknessLabel, '#fb923c');

  const footerY = CARD_SIZE - pad - 90;
  ctx.fillStyle = '#e0e7ff';
  ctx.font = `600 30px ${FONT_FAMILY}`;
  ctx.fillText('나도 수능 수학 기출 풀기', pad + 40, footerY);

  ctx.fillStyle = '#a5b4fc';
  ctx.font = `500 26px ${FONT_FAMILY}`;
  const host = vm.siteUrl.replace(/^https?:\/\//, '');
  ctx.fillText(host, pad + 40, footerY + 42);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('이미지 생성에 실패했습니다.'));
      else resolve(blob);
    }, 'image/png');
  });
}

export function buildShareText(vm: ShareCardViewModel): string {
  return [
    vm.headline,
    `강점: ${vm.strengthLabel}`,
    `약점: ${vm.weaknessLabel}`,
    `🔥 ${vm.currentStreak}일 연속 · 집중 ${vm.monthFocusLabel}`,
    `${vm.siteTitle}에서 함께 풀어요 👉 ${vm.siteUrl}`,
  ].join('\n');
}

export async function downloadShareCard(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function shareShareCard(blob: Blob, vm: ShareCardViewModel): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], `howlearn-share-${Date.now()}.png`, { type: 'image/png' });
  const text = buildShareText(vm);

  if (typeof navigator.share === 'function') {
    const payload: ShareData = { title: vm.siteTitle, text, files: [file] };
    if (navigator.canShare?.(payload)) {
      await navigator.share(payload);
      return 'shared';
    }
    const textOnly: ShareData = { title: vm.siteTitle, text, url: vm.siteUrl };
    if (navigator.canShare?.(textOnly)) {
      await navigator.share(textOnly);
      await downloadShareCard(blob, file.name);
      return 'downloaded';
    }
  }

  await downloadShareCard(blob, file.name);
  return 'downloaded';
}

export async function copyShareCardToClipboard(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
