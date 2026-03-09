import Link from "next/link";
import { Github, Twitter, MessageCircle } from "lucide-react";
import Logo from "@/components/organisms/landing-slideshow/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Boards", href: "/boards" },
      { label: "Agents", href: "/agents" },
      { label: "Gateways", href: "/gateways" },
      { label: "Skills", href: "/skills" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Blog", href: "/blog" },
      { label: "Changelog", href: "/changelog" },
      { label: "API Reference", href: "/api" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Support", href: "/support" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

const SOCIAL_LINKS = [
  { icon: Github, href: "https://github.com", label: "GitHub" },
  { icon: Twitter, href: "https://x.com", label: "X (Twitter)" },
  { icon: MessageCircle, href: "https://discord.gg", label: "Discord" },
];

export default function LandingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black px-[5%] pt-16 pb-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-16 left-1/4 h-64 w-64 rounded-full bg-white/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        {/* Top: Logo + link columns */}
        <div className="hero-glass-card grid gap-10 rounded-3xl border border-white/15 p-8 md:p-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Logo column */}
          <div>
            <Logo />
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-white/55">
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
                    <Link
                      href={link.href}
                      className="inline-flex rounded-full px-3 py-1 text-sm text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom: copyright + social */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-xs text-white/35">
            &copy; {new Date().getFullYear()} OpenClaw. All rights reserved.
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
                  className="hero-glass-card inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/55 transition-all hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
