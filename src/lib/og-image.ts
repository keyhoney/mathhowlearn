export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type OgContentType = 'problems' | 'essay-problems';

export function getAutoOgImagePath(type: OgContentType, slug: string): string {
  return `/og/auto/${type}/${slug}.png`;
}

export function resolveOgImageUrl(params: {
  type: OgContentType;
  slug: string;
  coverImage?: string | null;
}): string {
  const manual = params.coverImage?.trim();
  if (manual) return manual;
  return getAutoOgImagePath(params.type, params.slug);
}
