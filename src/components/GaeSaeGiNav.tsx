import { useEffect, useState } from "react";

import {
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Search,
  UserPlus,
  X,
} from "lucide-react";

import {
  getDefaultOpenGroupIds,
  homeNavItem,
  isNavGroupActive,
  learningColumnNavItem,
  navGroups,
  type NavGroup,
  type NavLinkItem,
} from "../lib/nav-config";

import { isNavActive } from "../lib/nav-utils";

import { ThemeToggle } from "./ThemeToggle";

import { SearchOverlay } from "./SearchOverlay";

const AUTH_UI_CACHE_KEY = "howlearn-auth-ui-logged-in";

function readCachedLoggedIn(): boolean | null {
  try {
    const raw = localStorage.getItem(AUTH_UI_CACHE_KEY);

    if (raw === "1") return true;

    if (raw === "0") return false;
  } catch {
    // no-op
  }

  return null;
}

function writeCachedLoggedIn(value: boolean): void {
  try {
    localStorage.setItem(AUTH_UI_CACHE_KEY, value ? "1" : "0");
  } catch {
    // no-op
  }
}

interface Props {
  pathname: string;
}

function navLinkProps(item: NavLinkItem) {
  return item.external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
}

function DesktopNavGroup({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);

  const groupActive = isNavGroupActive(pathname, group, isNavActive);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`chrome-nav-link flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
          groupActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "chrome-muted hover:text-slate-800 dark:hover:text-slate-100"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="whitespace-nowrap">{group.label}</span>

        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-1.5"
          role="presentation"
        >
          <div
            className="min-w-[11rem] rounded-xl border border-[var(--card-border)] bg-[var(--surface-1)] py-1.5 shadow-lg"
            role="menu"
          >
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href);

              const Icon = item.icon;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  {...navLinkProps(item)}
                  role="menuitem"
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "text-[var(--fg)] hover:bg-[var(--surface-2)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />

                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNavAccordion({
  group,

  pathname,

  open,

  onToggle,

  onNavigate,
}: {
  group: NavGroup;

  pathname: string;

  open: boolean;

  onToggle: () => void;

  onNavigate: () => void;
}) {
  const groupActive = isNavGroupActive(pathname, group, isNavActive);

  const panelId = `nav-accordion-${group.id}`;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--card-border)]">
      <button
        type="button"
        className={`flex min-h-[48px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-base font-semibold transition-colors ${
          groupActive
            ? "bg-indigo-50/80 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
            : "bg-[var(--surface-2)]/60 text-[var(--fg)] hover:bg-[var(--surface-2)]"
        }`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{group.label}</span>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--fg-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={panelId}
          className="border-t border-[var(--card-border)] bg-[var(--surface-1)] py-1"
        >
          {group.items.map((item) => {
            const active = isNavActive(pathname, item.href);

            const Icon = item.icon;

            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex min-h-[44px] items-center gap-3 py-2.5 pl-8 pr-4 text-[0.9375rem] transition-colors ${
                    active
                      ? "font-medium text-indigo-700 dark:text-indigo-300"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="text-[var(--fg-muted)]" aria-hidden>
                    ·
                  </span>

                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />

                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function GaeSaeGiNav({ pathname }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);

  const [navScrolled, setNavScrolled] = useState(false);

  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(
    () => new Set(getDefaultOpenGroupIds(pathname, isNavActive)),
  );

  const [loggedIn, setLoggedIn] = useState<boolean | null>(() =>
    typeof window === "undefined" ? null : readCachedLoggedIn(),
  );

  const homeActive = isNavActive(pathname, homeNavItem.href);

  const HomeIcon = homeNavItem.icon;

  const LearningColumnIcon = learningColumnNavItem.icon;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    setOpenGroupIds(new Set(getDefaultOpenGroupIds(pathname, isNavActive)));
  }, [mobileOpen, pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    function onScroll() {
      setNavScrolled(window.scrollY > 8);
    }

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();

        setSearchOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};

    void import("../lib/client/firebase-auth").then(({ watchAuthState }) => {
      unsubscribe = watchAuthState((user) => {
        const next = Boolean(user) && !user?.isAnonymous;

        setLoggedIn(next);

        writeCachedLoggedIn(next);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { signOutCurrentUser } =
        await import("../lib/client/firebase-auth");

      await signOutCurrentUser();
    } finally {
      window.location.href = "/login";
    }
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);

      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);

      return next;
    });
  };

  const desktopHomeClass = `chrome-nav-link flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
    homeActive
      ? "text-indigo-600 dark:text-indigo-400"
      : "chrome-muted hover:text-slate-800 dark:hover:text-slate-100"
  }`;

  const mobileHomeClass = `flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors ${
    homeActive
      ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
      : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
  }`;

  return (
    <>
      <nav
        id="app-site-nav"
        className={`hub-nav-pill z-50 w-full border transition-[background-color,box-shadow,border-color] duration-200 ${
          navScrolled ? "nav-scrolled" : ""
        }`}
      >
        <div className="book-nav-inner mx-auto flex h-14 min-h-[3.5rem] max-w-[72rem] items-center justify-between gap-2 px-3 sm:h-16 sm:min-h-[4rem] sm:px-5">
          <a
            href="/"
            className="flex min-h-[44px] min-w-0 shrink-0 items-center gap-2 py-1 sm:min-h-0"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11">
              <img
                src="/gsg.png"
                alt="GaeSaeGi Math"
                width={104}
                height={104}
                className="h-full w-full object-contain"
              />
            </span>

            <span className="type-nav-brand hidden truncate lg:inline">
              GaeSaeGi Math
            </span>
          </a>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-1 md:flex">
            <a
              href={homeNavItem.href}
              className={desktopHomeClass}
              aria-current={homeActive ? "page" : undefined}
            >
              <HomeIcon className="h-4 w-4 shrink-0" aria-hidden />

              <span className="whitespace-nowrap">{homeNavItem.label}</span>
            </a>

            {navGroups.map((group) => (
              <DesktopNavGroup
                key={group.id}
                group={group}
                pathname={pathname}
              />
            ))}

            <a
              href={learningColumnNavItem.href}
              {...navLinkProps(learningColumnNavItem)}
              className="chrome-nav-link flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:text-slate-800 dark:hover:text-slate-100"
            >
              <LearningColumnIcon className="h-4 w-4 shrink-0" aria-hidden />

              <span className="whitespace-nowrap">
                {learningColumnNavItem.label}
              </span>
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {loggedIn === false && (
              <>
                <a
                  href="/login"
                  className="hidden h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] sm:inline-flex"
                >
                  <LogIn className="h-4 w-4" aria-hidden />

                  <span className="hidden xl:inline">로그인</span>
                </a>

                <a
                  href="/signup"
                  className="gsg-btn-primary hidden !min-h-0 h-10 items-center gap-1.5 px-2.5 text-sm md:inline-flex xl:px-3"
                  aria-label="회원가입"
                  title="회원가입"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />

                  <span className="hidden xl:inline">회원가입</span>
                </a>
              </>
            )}

            {loggedIn === true && (
              <button
                type="button"
                className="hidden h-10 items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] px-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] sm:inline-flex"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" aria-hidden />

                <span className="hidden xl:inline">로그아웃</span>
              </button>
            )}

            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] px-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
              onClick={() => setSearchOpen(true)}
              aria-label="검색 열기"
            >
              <Search className="h-4 w-4" aria-hidden />

              <span className="hidden xl:inline">검색</span>
            </button>

            <ThemeToggle />

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[100] flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="사이트 메뉴"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
          />

          <div
            id="mobile-nav-panel"
            className="relative ml-auto flex h-full min-h-0 w-[min(100%,20rem)] max-h-[100dvh] flex-col border-l border-dashed border-indigo-500/25 bg-[var(--surface-1)] shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <span className="type-caption font-semibold text-[var(--fg)]">
                메뉴
              </span>

              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <ul className="flex flex-col gap-2">
                <li>
                  <a
                    href={homeNavItem.href}
                    onClick={() => setMobileOpen(false)}
                    className={mobileHomeClass}
                    aria-current={homeActive ? "page" : undefined}
                  >
                    <HomeIcon
                      className="h-5 w-5 shrink-0 opacity-80"
                      aria-hidden
                    />

                    {homeNavItem.label}
                  </a>
                </li>

                {navGroups.map((group) => (
                  <li key={group.id}>
                    <MobileNavAccordion
                      group={group}
                      pathname={pathname}
                      open={openGroupIds.has(group.id)}
                      onToggle={() => toggleGroup(group.id)}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </li>
                ))}

                <li>
                  <a
                    href={learningColumnNavItem.href}
                    {...navLinkProps(learningColumnNavItem)}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
                  >
                    <LearningColumnIcon
                      className="h-5 w-5 shrink-0 opacity-80"
                      aria-hidden
                    />

                    {learningColumnNavItem.label}
                  </a>
                </li>
              </ul>
            </nav>

            <div className="shrink-0 border-t border-[var(--card-border)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {loggedIn === false && (
                <div className="flex flex-col gap-2">
                  <a
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] px-4 text-base font-medium text-[var(--fg)]"
                  >
                    <LogIn className="h-5 w-5" aria-hidden />
                    로그인
                  </a>

                  <a
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="gsg-btn-primary flex min-h-[48px] items-center justify-center gap-2 !min-h-[48px]"
                  >
                    <UserPlus className="h-5 w-5" aria-hidden />
                    회원가입
                  </a>
                </div>
              )}

              {loggedIn === true && (
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] px-4 text-base font-medium text-[var(--fg-muted)]"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
