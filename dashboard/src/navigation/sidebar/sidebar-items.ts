import {
  type LucideIcon,
  Home,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

/**
 * Dashboard nav. The data routes land in later tickets (#17-#19); only the
 * pages that exist are listed here.
 */
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Missing Billions",
    items: [
      {
        id: "home",
        title: "Home",
        url: "/",
        icon: Home,
      },
    ],
  },
];
