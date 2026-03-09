import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import PricingCards from "@/components/organisms/landing-page/pricing-cards";

export default function PricingPage() {
  return (
    <ScrollProvider>
      <div className="landing-page min-h-screen bg-black">
        <LandingNavbar />
        <main className="pt-24">
          <PricingCards />
        </main>
        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
