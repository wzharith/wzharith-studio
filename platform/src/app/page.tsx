'use client';

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
import { useCloudConfigFeatures } from '@/lib/cloud-config';

export default function Home() {
  const features = useCloudConfigFeatures();

  return (
    <main className="relative">
      <Navigation features={features} />
      <Hero />
      <About />
      {features.showSongCatalog && <SongCatalog />}
      <Packages />
      {features.showPortfolio && <Portfolio />}
      {features.showCollaborators && <Collaborators />}
      {features.showDigitalProducts && (
        <DigitalProducts showNotifyBlock={features.showProductLaunchNotify} />
      )}
      <BookingForm />
      <Footer features={features} />
    </main>
  );
}
