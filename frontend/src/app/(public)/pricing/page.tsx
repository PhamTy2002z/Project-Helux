import type { Metadata } from "next";
import Link from "next/link";
import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import PricingCards from "@/components/organisms/landing-page/pricing-cards";
import { ScrollReveal } from "@/components/organisms/landing-page/scroll-reveal";

const pricingTitle = "Pricing for OpenClaw Mission Control";
const pricingDescription =
  "Compare OpenClaw Mission Control plans for teams operating boards, agent workflows, and approvals at different scales.";

export const metadata: Metadata = {
  title: pricingTitle,
  description: pricingDescription,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: pricingTitle,
    description: pricingDescription,
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pricingTitle,
    description: pricingDescription,
  },
};

const ENTERPRISE_FEATURES = [
  "Pooled usage across boards and teams",
  "Invoice and procurement billing workflows (planned)",
  "SCIM / SSO seat management (planned)",
  "Activity API access and audit exports",
  "Granular admin + model controls",
  "Priority support and account management",
];

const TRUSTED_LOGOS = [
  "OpenAI",
  "Anthropic",
  "Google Cloud",
  "GitHub",
  "Vercel",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "Redis",
  "Clerk",
  "FastAPI",
  "Next.js",
];

const FAQ_ITEMS = [
  {
    question: "Do I need a credit card for Basic?",
    answer:
      "No. Basic starts free so teams can validate workflows before committing to paid usage.",
  },
  {
    question: "When will I see the upgrade prompt?",
    answer:
      "Upgrade is requested when trial/runtime limits are reached, or when trial access has expired.",
  },
  {
    question: "Is billing production-ready today?",
    answer:
      "Current billing flow is simulated in v1. Plan controls and quota behavior are already active.",
  },
  {
    question: "Can enterprise teams request custom controls?",
    answer:
      "Yes. Enterprise supports custom governance, deployment, and support requirements.",
  },
];
export default function PricingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page min-h-screen bg-black">
        <LandingNavbar />
        <main className="bg-black pt-24">
          <h1 className="sr-only">OpenClaw Mission Control pricing plans</h1>
          <PricingCards />
          <section className="relative px-[5%] pb-14 sm:pb-20">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal className="mb-8 text-center">
                <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/40">
                  Business Plans
                </p>
              </ScrollReveal>
              <ScrollReveal>
                <div className="hero-glass-card mx-auto max-w-4xl rounded-3xl border border-white/15 p-8 md:p-10">
                  <p className="text-sm uppercase tracking-[0.18em] text-white/50">
                    Enterprise
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-white">
                    Custom
                  </p>
                  <p className="mt-4 text-sm font-medium text-white/65">
                    Everything in Teams, plus:
                  </p>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {ENTERPRISE_FEATURES.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75"
                      >
                        ✓ {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/onboarding"
                    className="hero-btn-primary mt-7 inline-flex items-center justify-center"
                  >
                    Contact Sales
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </section>
          <section className="px-[5%] py-14 sm:py-16">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal className="text-center">
                <h2 className="mx-auto max-w-3xl text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Trusted every day by teams that build world-class software.
                </h2>
              </ScrollReveal>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {TRUSTED_LOGOS.map((logo) => (
                  <span
                    key={logo}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70"
                  >
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </section>
          <section className="px-[5%] py-14 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <ScrollReveal className="mb-8 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white">
                  Questions & Answers
                </h2>
              </ScrollReveal>
              <div className="space-y-3">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.question}
                    className="hero-glass-card rounded-2xl border border-white/10 px-5 py-4 text-white/75"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                      {item.question}
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-white/65">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>
          <section className="px-[5%] pb-20 pt-10">
            <ScrollReveal>
              <div className="hero-glass-card mx-auto max-w-5xl rounded-3xl border border-white/15 px-8 py-12 text-center">
                <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Get started with OpenClaw Mission Control.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65">
                  Launch your first board, route approvals, and monitor agent
                  health from one command surface.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/onboarding"
                    className="hero-btn-primary inline-flex items-center justify-center"
                  >
                    Start Free in 2 Minutes
                  </Link>
                  <Link
                    href="/boards"
                    className="hero-btn-secondary inline-flex items-center justify-center"
                  >
                    Open Boards
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </section>
        </main>
        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
