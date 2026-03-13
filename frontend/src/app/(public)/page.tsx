import type { Metadata } from "next";

import LandingPage from "@/components/organisms/landing-page/landing-page";
import {
  DEFAULT_SEO_IMAGE,
  DEFAULT_SEO_IMAGE_ALT,
  PRODUCT_NAME,
  PRODUCT_SHORT_NAME,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

const landingTitle = "AI Agent FlowGrid for Boards, Approvals, and Gateways";
const landingDescription =
  "FlowGrid helps teams run board operations, agent workflows, approvals, and gateways from one secure, real-time workspace.";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: landingTitle,
  description: landingDescription,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "ai orchestration platform",
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
    images: [{ url: DEFAULT_SEO_IMAGE, alt: DEFAULT_SEO_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: landingTitle,
    description: landingDescription,
    images: [DEFAULT_SEO_IMAGE],
  },
};

const landingStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: PRODUCT_NAME,
      url: siteUrl,
      description: landingDescription,
    },
    {
      "@type": "SoftwareApplication",
      applicationCategory: "BusinessApplication",
      name: PRODUCT_NAME,
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
      name: PRODUCT_SHORT_NAME,
      url: siteUrl,
      sameAs: [
        "https://github.com/PhamTy2002z/FlowGrid",
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
