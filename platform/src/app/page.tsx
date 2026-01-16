import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import About from '@/components/About';
import SongCatalog from '@/components/SongCatalog';
import Packages from '@/components/Packages';
import Portfolio from '@/components/Portfolio';
import Collaborators from '@/components/Collaborators';
import DigitalProducts from '@/components/DigitalProducts';
import BookingForm from '@/components/BookingForm';
import Footer from '@/components/Footer';
import { siteConfig } from '@/config/site.config';

export default function Home() {
  return (
    <main className="relative">
      <Navigation />
      <Hero />
      <About />
      {siteConfig.features.showSongCatalog && <SongCatalog />}
      <Packages />
      {siteConfig.features.showPortfolio && <Portfolio />}
      {siteConfig.features.showCollaborators && <Collaborators />}
      {siteConfig.features.showDigitalProducts && <DigitalProducts />}
      <BookingForm />
      <Footer />
    </main>
  );
}
