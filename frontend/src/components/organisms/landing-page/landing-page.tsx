import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "./landing-navbar";
import LandingHeroSection from "./landing-hero-section";

import FeatureCards from "./feature-cards";
import ProductTabs from "./product-tabs";
import TestimonialCarousel from "./testimonial-carousel";
import LandingFooter from "./landing-footer";

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
