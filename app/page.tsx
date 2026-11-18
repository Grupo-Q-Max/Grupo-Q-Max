import { DeferredCinematicScroll } from "@/components/DeferredCinematicScroll";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { Hero } from "@/components/Hero";
import { SegmentsMarquee } from "@/components/SegmentsMarquee";
import { MissionVisionValues } from "@/components/MissionVisionValues";
import { Story } from "@/components/Story";
import { Partners } from "@/components/Partners";
import { Ecosystem } from "@/components/Ecosystem";
import { Products } from "@/components/Products";
import { TaxDiagnosticCalculator } from "@/components/TaxDiagnosticCalculator";
import { ComparisonSection } from "@/components/ComparisonSection";
import { JourneyTimeline } from "@/components/JourneyTimeline";
import { ConversionBand } from "@/components/ConversionBand";
import { FAQ } from "@/components/FAQ";
import { Contact } from "@/components/Contact";



import { ScrollReveal } from "@/components/ScrollReveal";
import { HashScrollFix } from "@/components/HashScrollFix";

export default function Home() {
  return (
    <>
      <ScrollProgressBar />
      <DeferredCinematicScroll />
      <HashScrollFix />

      <main id="main-content">
        <Hero />
        <SegmentsMarquee />
        <ScrollReveal animation="fade-up"><Story /></ScrollReveal>
        <ScrollReveal animation="fade-up"><MissionVisionValues /></ScrollReveal>
        <ScrollReveal animation="fade-up"><Partners /></ScrollReveal>
        <ScrollReveal animation="fade-up"><Ecosystem /></ScrollReveal>
        <ScrollReveal animation="fade-up"><Products /></ScrollReveal>
        <ScrollReveal animation="fade-up"><TaxDiagnosticCalculator /></ScrollReveal>
        <ScrollReveal animation="fade-up"><ComparisonSection /></ScrollReveal>
        <ScrollReveal animation="fade-up"><JourneyTimeline /></ScrollReveal>
        <ScrollReveal animation="fade-up"><ConversionBand /></ScrollReveal>
        <ScrollReveal animation="fade-up"><FAQ /></ScrollReveal>
        <ScrollReveal animation="fade-up"><Contact /></ScrollReveal>
      </main>

      
      
    </>
  );
}
