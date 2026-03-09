import type { Metadata } from "next";

import LandingPage from "@/components/organisms/landing-page/landing-page";
import { getSiteUrl } from "@/lib/site-url";

const landingTitle = "AI Agent Mission Control for Boards, Approvals, and Gateways";
const landingDescription =
  "OpenClaw Mission Control helps teams run board operations, agent workflows, approvals, and gateways from one secure, real-time workspace.";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: landingTitle,
  description: landingDescription,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "ai mission control",
    "agent workflow management",
    "board operations platform",
    "approval orchestration",
    "gateway routing",
  ],
  openGraph: {
    title: landingTitle,
    description: landingDescription,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: landingTitle,
    description: landingDescription,
  },
};

const landingStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "OpenClaw Mission Control",
      url: siteUrl,
      description: landingDescription,
    },
    {
      "@type": "SoftwareApplication",
      applicationCategory: "BusinessApplication",
      name: "OpenClaw Mission Control",
      operatingSystem: "Web",
      description: landingDescription,
      url: siteUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Organization",
      name: "OpenClaw",
      url: siteUrl,
      sameAs: [
        "https://github.com/abhi1693/openclaw-mission-control",
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingStructuredData),
        }}
      />
      <LandingPage />
    </>
  );
}
