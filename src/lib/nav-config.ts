import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bookmark,
  Calculator,
  ClipboardList,
  LayoutDashboard,
  Map,
  Newspaper,
  Timer,
  TrendingUp,
} from "lucide-react";

import { CONTENT_SITE_URL } from "../consts";

export type NavLinkItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLinkItem[];
};

export const homeNavItem: NavLinkItem = {
  href: "/",
  label: "홈",
  icon: LayoutDashboard,
};

export const learningColumnNavItem: NavLinkItem = {
  href: CONTENT_SITE_URL,
  label: "학습 칼럼",
  icon: Newspaper,
  external: true,
};

export const navGroups: NavGroup[] = [
  {
    id: "practice",
    label: "기출 풀이",
    items: [
      { href: "/problems", label: "수능 기출", icon: Calculator },
      { href: "/problems/mock-exam", label: "모의 시험", icon: Timer },
    ],
  },
  {
    id: "my-learning",
    label: "나의 학습",
    items: [
      { href: "/dashboard", label: "대시보드", icon: BarChart3 },
      { href: "/problems/concept-map", label: "개념 지도", icon: Map },
      { href: "/problems/wrong-note", label: "오답 노트", icon: ClipboardList },
      { href: "/problems/bookmarks", label: "스크랩", icon: Bookmark },
    ],
  },
  {
    id: "analysis",
    label: "출제 분석",
    items: [
      {
        href: "/problems/concept-frequency",
        label: "출제 경향",
        icon: TrendingUp,
      },
    ],
  },
];

export function isNavGroupActive(
  pathname: string,
  group: NavGroup,
  isNavActive: (pathname: string, href: string) => boolean,
): boolean {
  return group.items.some((item) => isNavActive(pathname, item.href));
}

export function getDefaultOpenGroupIds(
  pathname: string,
  isNavActive: (pathname: string, href: string) => boolean,
): string[] {
  const active = navGroups
    .filter((group) => isNavGroupActive(pathname, group, isNavActive))
    .map((group) => group.id);
  if (active.length > 0) return active;
  return ["practice"];
}
