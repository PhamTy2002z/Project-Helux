import type { Metadata } from "next";

import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import PricingCards from "@/components/organisms/landing-page/pricing-cards";

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

export default function PricingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page min-h-screen bg-black">
        <LandingNavbar />
        <main className="pt-24">
          <h1 className="sr-only">OpenClaw Mission Control pricing plans</h1>
          <PricingCards />
        </main>
        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
