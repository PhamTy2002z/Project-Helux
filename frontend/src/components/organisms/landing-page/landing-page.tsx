"use client";

import dynamic from "next/dynamic";

import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "./landing-navbar";
import LandingHeroSection from "./landing-hero-section";
import LandingFooter from "./landing-footer";

/* Below-fold sections: lazy-loaded to reduce initial JS bundle */
const FeatureCards = dynamic(() => import("./feature-cards"));
const ProductTabs = dynamic(() => import("./product-tabs"));
const TestimonialCarousel = dynamic(() => import("./testimonial-carousel"));

export default function LandingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page">
        <LandingNavbar />
        <main>
          <LandingHeroSection />
          <FeatureCards />
          <ProductTabs />
          <TestimonialCarousel />
        </main>
        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
