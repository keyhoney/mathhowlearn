import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FONT_REGULAR = path.join(
  ROOT,
  'node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff',
);
const FONT_BOLD = path.join(
  ROOT,
  'node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-700-normal.woff',
);

let fontsPromise: Promise<Array<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }>> | null =
  null;

async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([readFile(FONT_REGULAR), readFile(FONT_BOLD)]).then(
      ([regular, bold]) => [
        { name: 'Noto Sans KR', data: regular, weight: 400 as const, style: 'normal' as const },
        { name: 'Noto Sans KR', data: bold, weight: 700 as const, style: 'normal' as const },
      ],
    );
  }
  return fontsPromise;
}

export type OgVisualTheme = {
  label: string;
  siteName: string;
  gradient: [string, string];
  accent: string;
  footer?: string;
};

export function normalizeOgTitle(title: string): string {
  return title
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*\|\s*GaeSaeGi Math.*$/i, '')
    .replace(/\s*\|\s*HowLearn.*$/i, '')
    .trim();
}

export async function renderOgPng(title: string, theme: OgVisualTheme): Promise<Buffer> {
  const fonts = await loadFonts();
  const displayTitle = normalizeOgTitle(title);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: `linear-gradient(135deg, ${theme.gradient[0]} 0%, ${theme.gradient[1]} 100%)`,
          color: '#ffffff',
          fontFamily: 'Noto Sans KR',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      backgroundColor: theme.accent,
                      color: '#0f172a',
                      fontSize: 28,
                      fontWeight: 700,
                      padding: '10px 22px',
                      borderRadius: 999,
                    },
                    children: theme.label,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      fontWeight: 400,
                      opacity: 0.9,
                    },
                    children: theme.siteName,
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: displayTitle.length > 42 ? 52 : displayTitle.length > 28 ? 60 : 68,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                maxWidth: '1040px',
                wordBreak: 'keep-all',
              },
              children: displayTitle,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 24,
                fontWeight: 400,
                opacity: 0.82,
              },
              children: theme.footer ?? 'math.howlearn.kr',
            },
          },
        ],
      },
    },
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
    },
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
