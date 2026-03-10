import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";

import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import { ScrollReveal } from "@/components/organisms/landing-page/scroll-reveal";
import { getSiteUrl } from "@/lib/site-url";

const TestimonialsPageContent = dynamic(
  () =>
    import(
      "@/components/organisms/landing-page/testimonials-page-content"
    ),
  {
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    ),
  },
);

const pageTitle = "Customer Testimonials — OpenClaw Mission Control";
const pageDescription =
  "Hear from engineering leaders, DevOps teams, and operators who run production workloads on OpenClaw Mission Control every day.";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/testimonials",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/testimonials",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const testimonialsStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: pageTitle,
  description: pageDescription,
  url: `${siteUrl}/testimonials`,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      {
        "@type": "Review",
        reviewBody:
          "OpenClaw unified our board operations. Approvals that took days now take minutes.",
        author: { "@type": "Person", name: "Sarah Chen" },
      },
      {
        "@type": "Review",
        reviewBody:
          "The agent health dashboard gives us real-time visibility we never had before.",
        author: { "@type": "Person", name: "Marcus Rivera" },
      },
      {
        "@type": "Review",
        reviewBody:
          "Finally, one place to track tasks, agents, and decisions across all our teams.",
        author: { "@type": "Person", name: "David Park" },
      },
    ],
  },
};

export default function TestimonialsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(testimonialsStructuredData),
        }}
      />
      <ScrollProvider>
        <div className="landing-page min-h-screen bg-black">
          <LandingNavbar />
          <main className="bg-black">
            <TestimonialsPageContent />

            {/* Bottom CTA */}
            <section className="px-[5%] pb-20">
              <ScrollReveal>
                <div className="hero-glass-card mx-auto max-w-5xl rounded-3xl border border-white/15 px-8 py-12 text-center">
                  <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Join thousands of teams using Mission Control
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65">
                    Start operating boards, routing approvals, and monitoring
                    agent health from one command surface.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/onboarding"
                      className="hero-btn-primary inline-flex items-center justify-center"
                    >
                      Start Free in 2 Minutes
                    </Link>
                    <Link
                      href="/pricing"
                      className="hero-btn-secondary inline-flex items-center justify-center"
                    >
                      View Pricing
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
