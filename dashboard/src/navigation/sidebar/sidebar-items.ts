import {
  BookOpen,
  ChartNoAxesCombined,
  Globe,
  Home,
  ListOrdered,
  SlidersHorizontal,
  type LucideIcon,
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
 * Dashboard nav. Routes land additively as their tickets close (#17-#19):
 * existing entries keep their order; ticket #18 appends the Diagnosis group.
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
      {
        id: "method",
        title: "Method & sources",
        url: "/method",
        icon: BookOpen,
      },
      {
        id: "simulator",
        title: "Simulator",
        url: "/simulator",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: 2,
    label: "Diagnosis",
    items: [
      {
        id: "diagnosis-decomposition",
        title: "Decomposition",
        url: "/diagnosis/decomposition",
        icon: ChartNoAxesCombined,
      },
      {
        id: "diagnosis-regional",
        title: "Regional",
        url: "/diagnosis/regional",
        icon: ListOrdered,
      },
      {
        id: "diagnosis-source-markets",
        title: "Source markets",
        url: "/diagnosis/source-markets",
        icon: Globe,
      },
    ],
  },
];
