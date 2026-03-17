"use client";

import dynamic from "next/dynamic";

import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "./landing-navbar";
import LandingHeroSection from "./landing-hero-section";

/* Below-fold sections: lazy-loaded to reduce initial JS bundle */
const FeatureCards = dynamic(() => import("./feature-cards"), {
  loading: () => <LandingSectionSkeleton />,
});
const FeatureStoryShowcase = dynamic(() => import("./feature-story-showcase"), {
  loading: () => <LandingSectionSkeleton />,
});
const ProductTabs = dynamic(() => import("./product-tabs"), {
  loading: () => <LandingSectionSkeleton />,
});
const TestimonialCarousel = dynamic(() => import("./testimonial-carousel"), {
  loading: () => <LandingSectionSkeleton compact />,
});
const LandingFooter = dynamic(() => import("./landing-footer"), {
  loading: () => <LandingFooterSkeleton />,
});

function LandingSectionSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <section className="overflow-hidden bg-black px-4 py-20 sm:px-6 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20">
      <div className="mx-auto w-full max-w-[1280px] animate-pulse space-y-6 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:p-10 fhd:max-w-[1440px] qhd:max-w-[1600px] uhd:max-w-[1760px]">
        <LandingSkeletonBlock className="h-10 w-60 rounded-full bg-white/10 sm:w-72" />
        <LandingSkeletonBlock className="h-4 w-full max-w-2xl rounded-full bg-white/10" />
        <LandingSkeletonBlock
          className={`w-full rounded-[28px] bg-white/[0.06] ${
            compact ? "h-[220px]" : "h-[360px] sm:h-[420px]"
          }`}
        />
      </div>
    </section>
  );
}

function LandingSkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={className} />;
}

function LandingFooterSkeleton() {
  return (
    <footer
      aria-hidden="true"
      className="landing-deferred-section bg-black px-4 py-24 sm:px-6 lg:px-10"
    />
  );
}

export default function LandingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page">
        <LandingNavbar />
        <main>
          <LandingHeroSection />
          <FeatureCards />
          <FeatureStoryShowcase />
          <ProductTabs />
          <TestimonialCarousel />
        </main>
        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
