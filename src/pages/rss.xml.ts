import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  resolveOgImageUrl,
} from '../lib/og-image';

function problemPubDate(data: { year: number; month?: number; examYear?: number }): Date {
  const year = data.examYear ?? data.year;
  const month = data.month ?? 1;
  return new Date(year, Math.max(0, month - 1), 1);
}

function problemDescription(data: {
  source: string;
  subject?: string;
  chapter?: string;
  subChapter?: string;
  concept?: string;
  university?: string;
}): string {
  const parts = [data.source];
  if (data.university) parts.push(data.university);
  if (data.subject) parts.push(data.subject);
  if (data.chapter) parts.push(data.chapter);
  if (data.subChapter) parts.push(data.subChapter);
  if (data.concept) parts.push(data.concept);
  return parts.filter(Boolean).join(' · ');
}

function mediaContentXml(imageUrl: string): string {
  return (
    `<media:content url="${imageUrl}" medium="image" type="image/png"` +
    ` width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" />`
  );
}

/** 수능·모평 기출 문제 — 최근 100건 */
export const GET: APIRoute = async (context) => {
  const site = String(context.site ?? SITE_URL);
  const problems = await getCollection('problems');

  const feedItems = problems
    .filter((entry) => !entry.id.startsWith('_'))
    .map((entry) => {
      const imageUrl = new URL(
        resolveOgImageUrl({ type: 'problems', slug: entry.id }),
        site,
      ).href;
      return {
        title: entry.data.source,
        description: problemDescription(entry.data),
        pubDate: problemPubDate(entry.data),
        link: `/problems/${entry.id}`,
        customData: mediaContentXml(imageUrl),
      };
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf())
    .slice(0, 100);

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site,
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
    },
    items: feedItems,
  });
};
