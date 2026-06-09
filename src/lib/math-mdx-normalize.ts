/**
 * math_howlearn components/MDXRenderer.tsx 와 동일한 소스 전처리.
 * - MDX 문자열용: \frac → \dfrac, ①~⑤ 한 줄 → McqChoices/McqChoiceItem
 * - 마크다운 문자열(문제 지문 HTML 렌더)용: \frac 치환만 적용 (JSX 불가)
 */

/** MDX 안의 `<Question>` 등 JSX 속 `$...$`는 remark에서 inlineMath로 안 잡힐 수 있어 소스 전체에서 치환 */
export function fracToDfracInSource(source: string): string {
  return source.replace(/\\frac/g, '\\dfrac');
}

const MCQ_LABEL_BODY = /^([①②③④⑤])\s*([\s\S]*)$/;
const MCQ_LABEL_RE = /[①②③④⑤]/;

/** 문제 지문 끝의 연속 선지 줄 범위(빈 줄 포함)를 찾는다. */
export function findMcqChoiceBlockRange(lines: string[]): { start: number; end: number } | null {
  let endIdx = -1;
  let startIdx = -1;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (endIdx >= 0) startIdx = i;
      continue;
    }
    if (MCQ_LABEL_RE.test(trimmed)) {
      if (endIdx < 0) endIdx = i;
      startIdx = i;
      continue;
    }
    if (endIdx >= 0) break;
  }

  if (startIdx < 0 || endIdx < 0) return null;
  return { start: startIdx, end: endIdx };
}

/** `① … ② …` 형태 텍스트에서 선지 본문만 추출한다. */
export function parseMcqChoiceBodies(choiceBlockText: string): string[] {
  return choiceBlockText
    .split(/\s*(?=①|②|③|④|⑤)\s*/)
    .map((part) => part.replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean)
    .map((part) => part.replace(/^[①②③④⑤]\s*/, '').trim());
}

function buildMcqChoicesMdx(indent: string, parts: string[]): string | null {
  if (parts.length !== 5 || !parts[0]) return null;
  const items = parts
    .map((body, idx) => {
      const labels = ['①', '②', '③', '④', '⑤'] as const;
      const lab = labels[idx];
      return `${indent}<McqChoiceItem label="${lab}">${body}</McqChoiceItem>`;
    })
    .join('\n\n');
  return `${indent}<McqChoices>\n\n${items}\n\n${indent}</McqChoices>`;
}

function wrapSingleChoiceLineInMdx(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('①')) return line;
  const parts = trimmed.split(/(?=[②③④⑤]\s)/);
  if (parts.length !== 5 || !parts[0].startsWith('①')) return line;
  const bodies = parts
    .map((p) => {
      const m = MCQ_LABEL_BODY.exec(p.trim());
      if (!m) return null;
      return m[2].trim();
    })
    .filter((p): p is string => Boolean(p));
  const indent = line.match(/^\s*/)?.[0] ?? '';
  return buildMcqChoicesMdx(indent, bodies) ?? line;
}

/**
 * `① … ② … ⑤ …` 형태의 5지선다(한 줄 또는 여러 줄)를 `<McqChoices>` + `<McqChoiceItem>`으로 바꾼다.
 * (math_howlearn MDXRenderer.wrapFiveChoiceLineInMdx 와 동일)
 */
export function wrapFiveChoiceLineInMdx(source: string): string {
  const lines = source.split('\n');
  const range = findMcqChoiceBlockRange(lines);
  if (range) {
    const choiceBlockText = lines
      .slice(range.start, range.end + 1)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ');
    if (choiceBlockText.trim().startsWith('①')) {
      const bodies = parseMcqChoiceBodies(choiceBlockText);
      const indent = lines[range.start].match(/^\s*/)?.[0] ?? '';
      const replacement = buildMcqChoicesMdx(indent, bodies);
      if (replacement) {
        return [...lines.slice(0, range.start), replacement, ...lines.slice(range.end + 1)].join('\n');
      }
    }
  }

  return lines.map((line) => wrapSingleChoiceLineInMdx(line)).join('\n');
}

/**
 * MDX는 `\begin{cases}`·`\end{cases}` 등에서 `{…}`를 JSX 표현식으로 파싱한다.
 * LaTeX 환경 괄호만 이스케이프해 빌드 후 KaTeX에는 `\begin{cases}` 형태로 전달된다.
 */
export function escapeLatexBracesForMdx(source: string): string {
  return source
    .replace(/\\begin\{([^{}]+)\}/g, '\\begin\\{$1\\}')
    .replace(/\\end\{([^{}]+)\}/g, '\\end\\{$1\\}');
}

/**
 * cases 등 내부 줄바꿈 `\\[1.5ex]`의 `\[`가 MDX display math 시작으로 오인되지 않게 한다.
 */
export function escapeLatexLineBreakSpacingForMdx(source: string): string {
  return source.replace(/\\\\\[([\d.]+(?:ex|em|pt))\]/g, '\\\\\\[$1\\]');
}

/**
 * `\[ … \]` display math는 MDX가 내부 `{cases}` 등을 JSX로 파싱할 수 있어 `$$`로 통일한다.
 */
export function convertBracketDisplayMathToDollars(source: string): string {
  return source.replace(/^\\\[\s*$/gm, '$$').replace(/^\\\]\s*$/gm, '$$');
}

/** MDX 파일 본문용 (import 없이 치환만; import는 Vite 플러그인에서 추가) */
export function normalizeMathMdxFileBody(source: string): string {
  return wrapFiveChoiceLineInMdx(
    escapeLatexLineBreakSpacingForMdx(
      escapeLatexBracesForMdx(
        convertBracketDisplayMathToDollars(fracToDfracInSource(source)),
      ),
    ),
  );
}

/** 순수 마크다운(문제 지문·힌트 HTML)용 — JSX 래핑 없음 */
export function normalizeMathMarkdownSource(source: string): string {
  return fracToDfracInSource(source);
}
