import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "./landing-navbar";
import LandingHeroSection from "./landing-hero-section";
import LogoMarquee from "./logo-marquee";
import FeatureCards from "./feature-cards";
import ProductTabs from "./product-tabs";
import TestimonialCarousel from "./testimonial-carousel";
import PricingCards from "./pricing-cards";
import LandingFooter from "./landing-footer";

export default function LandingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page">
      <LandingNavbar />
      <main>
        <LandingHeroSection />
        <LogoMarquee />
        <FeatureCards />
        <ProductTabs />
        <TestimonialCarousel />
        <PricingCards />
      </main>
      <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
