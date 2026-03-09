"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";
import Logo from "@/components/organisms/landing-slideshow/logo";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
];

const BTN_SIGNIN =
  "rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const BTN_SIGNUP =
  "rounded-full border border-white/30 bg-white/95 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const clerkEnabled = isClerkEnabled();

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
        {/* Logo */}
        <Link href="/" aria-label="OpenClaw home">
          <Logo />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <SignedOut>
            {clerkEnabled ? (
              <>
                <SignInButton mode="modal" forceRedirectUrl="/boards">
                  <button type="button" className={BTN_SIGNIN}>
                    Sign in
                  </button>
                </SignInButton>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl="/onboarding"
                  signUpForceRedirectUrl="/onboarding"
                >
                  <button type="button" className={BTN_SIGNUP}>
                    Get Started
                  </button>
                </SignInButton>
              </>
            ) : (
              <>
                <Link href="/boards" className={BTN_SIGNIN}>
                  Sign in
                </Link>
                <Link href="/onboarding" className={BTN_SIGNUP}>
                  Get Started
                </Link>
              </>
            )}
          </SignedOut>
          <SignedIn>
            <Link href="/boards" className={BTN_SIGNUP}>
              Open Boards
            </Link>
          </SignedIn>
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
              <a
                key={link.href}
                href={link.href}
                className="text-base text-white/90 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-3">
              <SignedOut>
                {clerkEnabled ? (
                  <>
                    <SignInButton mode="modal" forceRedirectUrl="/boards">
                      <button type="button" className={BTN_SIGNIN}>
                        Sign in
                      </button>
                    </SignInButton>
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl="/onboarding"
                      signUpForceRedirectUrl="/onboarding"
                    >
                      <button type="button" className={BTN_SIGNUP}>
                        Get Started
                      </button>
                    </SignInButton>
                  </>
                ) : (
                  <>
                    <Link href="/boards" className={`${BTN_SIGNIN} text-center`}>
                      Sign in
                    </Link>
                    <Link href="/onboarding" className={`${BTN_SIGNUP} text-center`}>
                      Get Started
                    </Link>
                  </>
                )}
              </SignedOut>
              <SignedIn>
                <Link href="/boards" className={`${BTN_SIGNUP} text-center`}>
                  Open Boards
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
