import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DM_Serif_Display, IBM_Plex_Sans, Sora } from "next/font/google";

import { Agentation } from "agentation";
import { getSiteOrigin } from "@/lib/site-url";

const siteOrigin = getSiteOrigin();

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title: {
    default: "OpenClaw Mission Control | AI Agent Operations Platform",
    template: "%s | OpenClaw Mission Control",
  },
  description:
    "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
  applicationName: "OpenClaw Mission Control",
  keywords: [
    "ai agent operations platform",
    "mission control",
    "board orchestration",
    "approval workflows",
    "gateway management",
    "openclaw",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "OpenClaw Mission Control | AI Agent Operations Platform",
    description:
      "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
    siteName: "OpenClaw Mission Control",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenClaw Mission Control | AI Agent Operations Platform",
    description:
      "Operate boards, agents, approvals, and gateways from one control plane with real-time visibility, governance workflows, and API-first automation.",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://stream.mux.com" crossOrigin="" />
      </head>
      <body
        className={`${bodyFont.variable} ${headingFont.variable} ${displayFont.variable} min-h-screen bg-app text-strong antialiased`}
      >
        {children}
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
