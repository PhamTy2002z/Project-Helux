"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "flowgrid_sidebar_collapsed";

interface SidebarCollapseCtx {
  collapsed: boolean;
  toggle: () => void;
}

const Ctx = createContext<SidebarCollapseCtx>({
  collapsed: false,
  toggle: () => {},
});

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  /* Hydrate from localStorage after mount */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      /* noop */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return <Ctx value={{ collapsed, toggle }}>{children}</Ctx>;
}

export function useSidebarCollapse() {
  return useContext(Ctx);
}
