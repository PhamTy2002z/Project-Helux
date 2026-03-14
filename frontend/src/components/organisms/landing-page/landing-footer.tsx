import Link from "next/link";

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
    title: "Company",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Testimonials", href: "/testimonials" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Support",
    links: [
      {
        label: "Contact Sales",
        href: "mailto:sales@flowgrid.ai",
        external: true,
      },
      {
        label: "Customer Support",
        href: "mailto:support@flowgrid.ai",
        external: true,
      },
      { label: "Start Free", href: "/sign-in" },
    ],
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
        <div className="hero-glass-card grid items-start gap-10 rounded-3xl border border-white/15 p-6 sm:p-8 md:grid-cols-2 md:gap-8 md:p-10 lg:grid-cols-[minmax(240px,1.1fr)_repeat(3,minmax(0,1fr))] lg:gap-10 fhd:gap-16">
          {/* Logo column */}
          <div className="max-w-[320px] md:max-w-none lg:max-w-[320px]">
            <p className="text-[22px] font-semibold tracking-[-0.02em] text-white">FlowGrid</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
              Cloud SaaS Platform
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55 sm:text-base">
              FlowGrid helps operations teams run boards, approvals, and gateways in one managed
              SaaS workspace.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <h4 className="mb-3 text-sm font-semibold text-white/75">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center rounded-lg px-0 text-sm text-white/55 transition-colors hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="inline-flex min-h-[44px] items-center rounded-lg px-0 text-sm text-white/55 transition-colors hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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

        {/* Bottom: copyright + CTA */}
        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/35">
            &copy; {new Date().getFullYear()} FlowGrid. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="mailto:sales@flowgrid.ai"
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Contact Sales
            </a>
            <Link
              href="/sign-in"
              prefetch={false}
              className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Start Free
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
