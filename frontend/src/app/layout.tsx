import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { ThemeProvider } from "@/components/providers/theme-provider";

import { DM_Serif_Display, IBM_Plex_Sans, Sora } from "next/font/google";

import {
  DEFAULT_SEO_IMAGE,
  DEFAULT_SEO_IMAGE_ALT,
  PRODUCT_NAME,
} from "@/lib/seo";
import { getSiteOrigin } from "@/lib/site-url";

const siteOrigin = getSiteOrigin();

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/brand/flowgrid-favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/images/brand/flowgrid-favicon.svg",
  },
  title: {
    default: `${PRODUCT_NAME} | AI Agent Operations Platform`,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description:
    "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
  applicationName: PRODUCT_NAME,
  keywords: [
    "ai agent operations platform",
    "flowgrid ai operations",
    "board orchestration",
    "approval workflows",
    "gateway management",
    "flowgrid",
  ],
  openGraph: {
    type: "website",
    url: "/",
    title: `${PRODUCT_NAME} | AI Agent Operations Platform`,
    description:
      "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
    siteName: PRODUCT_NAME,
    images: [{ url: DEFAULT_SEO_IMAGE, alt: DEFAULT_SEO_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} | AI Agent Operations Platform`,
    description:
      "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
    images: [DEFAULT_SEO_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const headingFont = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400"],
});

const DevAgentation =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("agentation").then((mod) => mod.Agentation))
    : null;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://stream.mux.com" crossOrigin="" />
        <link
          rel="preconnect"
          href="https://d8j0ntlcm91z4.cloudfront.net"
          crossOrigin=""
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s||(d?'dark':'light');if(t==='light')document.documentElement.classList.add('light');else document.documentElement.classList.remove('light')}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${bodyFont.variable} ${headingFont.variable} ${displayFont.variable} min-h-screen bg-app text-strong antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        {DevAgentation ? <DevAgentation /> : null}
      </body>
    </html>
  );
}
