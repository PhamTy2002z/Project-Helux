import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import PricingCards from "@/components/organisms/landing-page/pricing-cards";
import { ScrollReveal } from "@/components/organisms/landing-page/scroll-reveal";
import {
  DEFAULT_SEO_IMAGE,
  DEFAULT_SEO_IMAGE_ALT,
  PRODUCT_NAME,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

const pricingTitle = `Pricing for ${PRODUCT_NAME}`;
const pricingDescription =
  "Compare FlowGrid plans for teams operating boards, agent workflows, and approvals at different scales.";
const siteUrl = getSiteUrl();

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
    images: [{ url: DEFAULT_SEO_IMAGE, alt: DEFAULT_SEO_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: pricingTitle,
    description: pricingDescription,
    images: [DEFAULT_SEO_IMAGE],
  },
};

const pricingStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: pricingTitle,
  description: pricingDescription,
  url: `${siteUrl}/pricing`,
  mainEntity: {
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "OfferCatalog",
      name: "Pricing Plans",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Basic",
          price: "0",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Professional",
          price: "25",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            unitText: "month",
          },
        },
      ],
    },
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

const TRUSTED_BRANDS: Array<{ name: string; slug: string; icon?: string }> = [
  { name: "OpenAI", slug: "openai", icon: "/icons/brands/openai.svg" },
  { name: "Anthropic", slug: "anthropic" },
  { name: "Google Cloud", slug: "googlecloud" },
  { name: "GitHub", slug: "github" },
  { name: "Vercel", slug: "vercel" },
  { name: "Docker", slug: "docker" },
  { name: "Kubernetes", slug: "kubernetes" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "Redis", slug: "redis" },
  { name: "Clerk", slug: "clerk" },
  { name: "FastAPI", slug: "fastapi" },
  { name: "Next.js", slug: "nextdotjs" },
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pricingStructuredData),
        }}
      />
      <ScrollProvider>
        <div className="landing-page min-h-screen bg-black">
          <LandingNavbar />
          <main className="bg-black pt-24">
          <h1 className="sr-only">FlowGrid pricing plans</h1>
          <PricingCards />

          {/* Enterprise plan */}
          <section className="relative px-[5%] pb-14 pt-10 sm:pb-20 sm:pt-14">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal>
                <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                  <div className="flex flex-col gap-8 p-8 pt-10 md:flex-row md:items-start md:p-10 md:pt-12">
                    {/* Left — plan info */}
                    <div className="md:w-1/3">
                      <span className="mb-1 block h-[2px] w-10 rounded-full bg-white/30" />
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                        Plan
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold text-white">
                        Enterprise
                      </h3>
                      <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                        Custom
                      </p>
                      <p className="mt-1 text-sm text-white/50">
                        Contract and governance controls
                      </p>
                      <Link
                        href="/onboarding"
                        className="hero-btn-primary mt-6 inline-flex items-center justify-center"
                      >
                        Contact Sales
                      </Link>
                    </div>

                    {/* Right — features grid */}
                    <div className="flex-1">
                      <p className="mb-4 text-sm font-medium text-white/55">
                        Everything in Professional, plus:
                      </p>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {ENTERPRISE_FEATURES.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75"
                          >
                            <Check
                              size={15}
                              className="mt-0.5 shrink-0 text-white/50"
                              aria-hidden="true"
                            />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* Trusted brands — with logos */}
          <section className="px-[5%] py-14 sm:py-16">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal className="text-center">
                <h2 className="mx-auto max-w-3xl text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Trusted every day by teams that build world-class software.
                </h2>
              </ScrollReveal>
              <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {TRUSTED_BRANDS.map((brand) => (
                  <div
                    key={brand.slug}
                    className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors duration-200 hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={brand.icon ?? `https://cdn.simpleicons.org/${brand.slug}/white`}
                      alt=""
                      aria-hidden="true"
                      width={18}
                      height={18}
                      className="shrink-0 opacity-60"
                      loading="lazy"
                    />
                    <span className="text-xs font-semibold tracking-wide text-white/70">
                      {brand.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="px-[5%] py-16 sm:py-20">
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-col gap-10 md:flex-row md:gap-16">
                {/* Left — heading */}
                <div className="md:w-1/3 md:pt-1">
                  <ScrollReveal>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                      FAQ
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Questions & Answers
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-white/50">
                      Common questions about plans, billing, and platform limits.
                    </p>
                  </ScrollReveal>
                </div>

                {/* Right — accordion */}
                <div className="flex-1">
                  <ScrollReveal>
                    <div className="divide-y divide-white/10">
                      {FAQ_ITEMS.map((item) => (
                        <details
                          key={item.question}
                          className="group py-5 first:pt-0 last:pb-0"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white transition-colors hover:text-white/80">
                            {item.question}
                            <span className="shrink-0 text-white/30 transition-transform duration-200 group-open:rotate-45">
                              +
                            </span>
                          </summary>
                          <p className="mt-3 pr-8 text-sm leading-relaxed text-white/60">
                            {item.answer}
                          </p>
                        </details>
                      ))}
                    </div>
                  </ScrollReveal>
                </div>
              </div>
            </div>
          </section>
          <section className="px-[5%] pb-20 pt-10">
            <ScrollReveal>
              <div className="hero-glass-card mx-auto max-w-5xl rounded-3xl border border-white/15 px-8 py-12 text-center">
                <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Get started with FlowGrid.
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
    </>
  );
}
