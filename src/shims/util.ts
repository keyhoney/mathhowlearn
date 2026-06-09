function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function inspect(value: unknown): string {
  return stringifyValue(value);
}

export function formatWithOptions(_opts: unknown, ...args: unknown[]): string {
  return args.map((arg) => stringifyValue(arg)).join(' ');
}

export function deprecate<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export default {
  inspect,
  formatWithOptions,
  deprecate,
};
