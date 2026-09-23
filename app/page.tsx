import { Navbar } from "@/components/Navbar";
import { DeferredCinematicScroll } from "@/components/DeferredCinematicScroll";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { Hero } from "@/components/Hero";
import { SegmentsMarquee } from "@/components/SegmentsMarquee";
import { Story } from "@/components/Story";
import { Team } from "@/components/Team";
import { Ecosystem } from "@/components/Ecosystem";
import { Products } from "@/components/Products";
import { TaxDiagnosticCalculator } from "@/components/TaxDiagnosticCalculator";
import { ComparisonSection } from "@/components/ComparisonSection";
import { JourneyTimeline } from "@/components/JourneyTimeline";
import { ConversionBand } from "@/components/ConversionBand";
import { FAQ } from "@/components/FAQ";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { QuickLeadModal } from "@/components/QuickLeadModal";
import { BackToTop } from "@/components/BackToTop";

export default function Home() {
  return (
    <>
      <ScrollProgressBar />
      <DeferredCinematicScroll />
      <Navbar />

      <main>
        <Hero />
        <SegmentsMarquee />
        <Story />
        <Team />
        <Ecosystem />
        <Products />
        <TaxDiagnosticCalculator />
        <ComparisonSection />
        <JourneyTimeline />
        <ConversionBand />
        <FAQ />
        <Contact />
      </main>

      <Footer />
      <FloatingWhatsApp />
      <BackToTop />
      <QuickLeadModal />
    </>
  );
}