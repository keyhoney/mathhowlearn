/**
 * math_howlearn MDXRenderer와 동일한 rehype-katex 옵션.
 * 잘못된 수식이 있어도 빌드가 중단되지 않도록 한다.
 */
export const rehypeKatexSafeOptions = {
  throwOnError: false,
  strict: 'warn' as const,
  errorColor: '#cc0000',
};
