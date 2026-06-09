/**
 * MDX에서 전달되는 props가 배열/객체로 올바르지 않을 수 있어
 * 안전하게 배열·문자열로 정규화합니다.
 */

export function toStringArray(
  value: string[] | string | null | undefined | unknown
): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string');
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    if (!normalized) return [];
    if (normalized.startsWith('[')) {
      try {
        const parsed = JSON.parse(normalized) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((s): s is string => typeof s === 'string');
        }
      } catch {
        // fall through
      }
    }
    const parts = normalized.includes('\n')
      ? normalized.split(/\n+/)
      : normalized.split(',');
    return parts.map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export type SourceItem = {
  author: string;
  year?: string;
  title: string;
  source?: string;
  note?: string;
  href?: string;
  doi?: string;
};

export function toSourceItemsArray(
  value: SourceItem[] | SourceItem | string | null | undefined
): SourceItem[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    try {
      const parsed = JSON.parse(normalized) as SourceItem[] | SourceItem;
      return toSourceItemsArray(Array.isArray(parsed) ? parsed : parsed);
    } catch {
      const lines = normalized
        .split(/\n|;;/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length > 0 && lines[0].includes('|')) {
        return lines
          .map((line) => {
            const parts = line.split('|').map((p) => p.trim());
            if (parts.length >= 3 && parts[0] && parts[2]) {
              return {
                author: parts[0],
                ...(parts[1] && { year: parts[1] }),
                title: parts[2],
                ...(parts[3] && { source: parts[3] }),
                ...(parts[4] && { note: parts[4] }),
                ...(parts[5] && { href: parts[5] }),
                ...(parts[6] && { doi: parts[6] }),
              } as SourceItem;
            }
            return null;
          })
          .filter((x): x is SourceItem => x != null);
      }
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .filter(
        (x): x is SourceItem =>
          x != null && typeof x === 'object' && 'author' in x && 'title' in x
      )
      .map((x) => ({
        author: String(x.author ?? ''),
        ...(x.year != null && x.year !== '' && { year: String(x.year) }),
        title: String(x.title ?? ''),
        ...(x.source != null && { source: String(x.source) }),
        ...(x.note != null && { note: String(x.note) }),
        ...(x.href != null && { href: String(x.href) }),
        ...(x.doi != null && x.doi !== '' && { doi: String(x.doi) }),
      }));
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'author' in value &&
    'title' in value
  ) {
    const x = value as SourceItem;
    return [
      {
        author: String(x.author ?? ''),
        ...(x.year != null && x.year !== '' && { year: String(x.year) }),
        title: String(x.title ?? ''),
        ...(x.source != null && { source: String(x.source) }),
        ...(x.note != null && { note: String(x.note) }),
        ...(x.href != null && { href: String(x.href) }),
        ...(x.doi != null && x.doi !== '' && { doi: String(x.doi) }),
      },
    ];
  }
  return [];
}

export type TroubleshootingItem = { problem: string; solution: string };

export function toTroubleshootingItemsArray(
  value: TroubleshootingItem[] | TroubleshootingItem | string | null | undefined
): TroubleshootingItem[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    try {
      const parsed = JSON.parse(normalized) as TroubleshootingItem[] | TroubleshootingItem;
      return toTroubleshootingItemsArray(Array.isArray(parsed) ? parsed : parsed);
    } catch {
      const lines = normalized
        .split(/\n|;;/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length > 0 && lines[0].includes('|')) {
        return lines
          .map((line) => {
            const idx = line.indexOf('|');
            if (idx > 0 && idx < line.length - 1) {
              return {
                problem: line.slice(0, idx).trim(),
                solution: line.slice(idx + 1).trim(),
              };
            }
            return null;
          })
          .filter(
            (x): x is TroubleshootingItem =>
              x != null && x.problem !== '' && x.solution !== ''
          );
      }
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .filter(
        (x): x is TroubleshootingItem =>
          x != null && typeof x === 'object' && 'problem' in x && 'solution' in x
      )
      .map((x) => ({ problem: String(x.problem), solution: String(x.solution) }));
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'problem' in value &&
    'solution' in value
  ) {
    const v = value as TroubleshootingItem;
    return [{ problem: String(v.problem), solution: String(v.solution) }];
  }
  return [];
}
