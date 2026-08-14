import { Navbar } from "@/components/Navbar";
import { DeferredCinematicScroll } from "@/components/DeferredCinematicScroll";
import { Hero } from "@/components/Hero";
import { Story } from "@/components/Story";
import { Ecosystem } from "@/components/Ecosystem";
import { Products } from "@/components/Products";
import { ConversionBand } from "@/components/ConversionBand";
import { FAQ } from "@/components/FAQ";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <DeferredCinematicScroll />
      <Navbar />

      <main>
        <Hero />
        <Story />
        <Ecosystem />
        <Products />
        <ConversionBand />
        <FAQ />
        <Contact />
      </main>

      <Footer />
    </>
  );
}