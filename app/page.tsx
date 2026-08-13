import { Navbar } from "@/components/Navbar";
import { CinematicScroll } from "@/components/CinematicScroll";
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
      <CinematicScroll />
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