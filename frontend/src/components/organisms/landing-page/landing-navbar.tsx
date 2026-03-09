"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

import Logo from "@/components/organisms/landing-slideshow/logo";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Product", href: "/#product" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

const RESOURCE_LINKS = [
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Documentation", href: "https://github.com/abhi1693/openclaw-mission-control/tree/master/docs", external: true },
  { label: "Changelog", href: "https://github.com/abhi1693/openclaw-mission-control/releases", external: true },
];

const BTN_SIGNIN =
  "relative inline-flex items-center px-1 pb-1 text-base font-semibold text-white transition-colors hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-white/80";
const BTN_SIGNUP =
  "rounded-full border border-white/30 bg-white/95 px-6 py-2.5 text-base font-semibold text-black transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md" : "bg-transparent"
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-[5%] py-4">
        {/* Logo column keeps width parity with auth column to center desktop nav */}
        <div className="flex min-h-[44px] items-center md:min-w-[220px]">
          {pathname === "/" ? (
            <button
              type="button"
              aria-label="Scroll to hero"
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              onClick={() => {
                document.getElementById("hero")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <Logo />
            </button>
          ) : (
            <Link href="/" aria-label="OpenClaw home">
              <Logo />
            </Link>
          )}
        </div>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={!link.href.startsWith("/#") ? false : undefined}
              className="text-[15px] font-medium text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {link.label}
            </Link>
          ))}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex cursor-default items-center gap-1 text-[15px] font-medium text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              aria-haspopup="menu"
              aria-label="Resources"
            >
              Resources
              <ChevronDown
                size={15}
                className="transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
                aria-hidden="true"
              />
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-2xl border border-white/15 bg-black/95 p-2 shadow-[0_18px_35px_rgba(0,0,0,0.45)] backdrop-blur-md">
                {RESOURCE_LINKS.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      prefetch={!link.href.startsWith("/#") ? false : undefined}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden min-h-[44px] min-w-[220px] items-center justify-end gap-3 md:flex">
          <Link href="/sign-in" prefetch={false} className={BTN_SIGNIN}>
            Sign in
          </Link>
          <Link href="/sign-up" prefetch={false} className={BTN_SIGNUP}>
            Sign up
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="cursor-pointer text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-black/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4 px-[5%] py-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={!link.href.startsWith("/#") ? false : undefined}
                className="text-base text-white/90 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                Resources
              </p>
              <div className="flex flex-col gap-2">
                {RESOURCE_LINKS.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-white/85 transition-colors hover:text-white"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      prefetch={!link.href.startsWith("/#") ? false : undefined}
                      className="text-sm text-white/85 transition-colors hover:text-white"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              <Link href="/sign-in" prefetch={false} className={`${BTN_SIGNIN} justify-center`}>
                Sign in
              </Link>
              <Link href="/sign-up" prefetch={false} className={`${BTN_SIGNUP} text-center`}>
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
