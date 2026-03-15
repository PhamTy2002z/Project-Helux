"use client";

import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

export function BrandMark() {
  const { collapsed, toggle } = useSidebarCollapse();

  /* Collapsed: logo is the open button */
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Open sidebar"
        className="group relative flex h-10 w-10 cursor-pointer items-center justify-center"
      >
        <Image
          src="/images/brand/flowgrid-favicon.svg"
          alt="FlowGrid logo"
          width={40}
          height={40}
          className="h-10 w-10 transition-opacity duration-150 group-hover:opacity-0"
          priority
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <PanelLeftOpen className="h-5 w-5" />
        </span>
      </button>
    );
  }

  /* Expanded: logo + wordmark + toggle button */
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3.5">
        <Image
          src="/images/brand/flowgrid-favicon.svg"
          alt="FlowGrid logo"
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0"
          priority
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[15px] font-bold tracking-tight text-slate-800">
            FlowGrid
          </span>
          <span className="font-heading text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Openclaw
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label="Close sidebar"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-95"
      >
        <PanelLeftClose className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
