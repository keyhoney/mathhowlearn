import { Moon, Sun } from 'lucide-react';
import { toggleThemeWithTransition } from '../lib/client/theme-transition';

export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={(e) => toggleThemeWithTransition(e)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600 sm:h-9 sm:w-9 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
      aria-label="라이트·다크 테마 전환"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
