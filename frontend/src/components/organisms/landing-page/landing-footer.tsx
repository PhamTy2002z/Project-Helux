import Link from "next/link";
import { Github, MessageCircle } from "lucide-react";
import Logo from "@/components/organisms/landing-slideshow/logo";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Boards", href: "/boards" },
      { label: "Agents", href: "/agents" },
      { label: "Gateways", href: "/gateways" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      {
        label: "Documentation",
        href: "https://github.com/PhamTy2002z/Project-Helux/tree/master/docs",
        external: true,
      },
      {
        label: "Deployment Guide",
        href: "https://github.com/PhamTy2002z/Project-Helux/blob/master/docs/deployment-guide.md",
        external: true,
      },
      {
        label: "API Reference",
        href: "https://github.com/PhamTy2002z/Project-Helux/blob/master/docs/reference/api.md",
        external: true,
      },
    ],
  },
  {
    title: "Help",
    links: [
      {
        label: "GitHub Issues",
        href: "https://github.com/PhamTy2002z/Project-Helux/issues",
        external: true,
      },
      {
        label: "Discussions",
        href: "https://github.com/PhamTy2002z/Project-Helux/discussions",
        external: true,
      },
      {
        label: "Slack Community",
        href: "https://join.slack.com/t/oc-mission-control/shared_invite/zt-3qpcm57xh-AI9C~smc3MDBVzEhvwf7gg",
        external: true,
      },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    icon: Github,
    href: "https://github.com/PhamTy2002z/Project-Helux",
    label: "GitHub",
  },
  {
    icon: MessageCircle,
    href: "https://join.slack.com/t/oc-mission-control/shared_invite/zt-3qpcm57xh-AI9C~smc3MDBVzEhvwf7gg",
    label: "Slack",
  },
];

export default function LandingFooter() {
  return (
    <footer className="landing-deferred-section relative overflow-hidden border-t border-white/10 bg-black px-4 pb-8 pt-16 sm:px-6 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1280px] fhd:max-w-[1440px] qhd:max-w-[1600px] uhd:max-w-[1760px]">
        {/* Top: Logo + link columns */}
        <div className="hero-glass-card grid gap-10 rounded-3xl border border-white/15 p-6 sm:grid-cols-2 sm:p-8 md:p-10 xl:grid-cols-4 fhd:gap-12">
          {/* Logo column */}
          <div className="max-w-[280px]">
            <Logo />
            <p className="mt-4 text-[15px] leading-relaxed text-white/55 sm:text-base">
              The mission control platform for boards, agents, and operations.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-white/70">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-full px-3 py-1 text-sm text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="inline-flex rounded-full px-3 py-1 text-sm text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom: copyright + social */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-xs text-white/35">
            &copy; {new Date().getFullYear()} Helux. All rights reserved.
          </p>
          <div className="flex gap-4">
            {SOCIAL_LINKS.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="hero-glass-card inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/55 transition-all hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
