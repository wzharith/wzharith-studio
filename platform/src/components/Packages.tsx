'use client';

import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, Sparkles, Clock, Music, Loader2, Package } from 'lucide-react';
import { useCloudConfig } from '@/lib/cloud-config';

export default function Packages() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const { packages: cloudPackages, addons: cloudAddons, isLoading, error } = useCloudConfig();

  // Filter out hidden packages for public display (backend-only, no hardcoded fallback)
  const packages = useMemo(() => cloudPackages.filter(pkg => !pkg.hidden), [cloudPackages]);
  const addons = cloudAddons;

  // Dynamic grid columns: 1–4 based on package count so layout looks intentional (Tailwind-safe)
  const gridCols = useMemo(() => {
    const n = Math.min(Math.max(packages.length, 1), 4);
    const lgMap: Record<number, string> = {
      1: 'lg:grid-cols-1',
      2: 'lg:grid-cols-2',
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
    };
    return `grid-cols-1 md:grid-cols-2 ${lgMap[n]}`;
  }, [packages.length]);

  return (
    <section id="packages" className="py-24 px-6 relative" ref={ref}>
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-500/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Pricing
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Performance <span className="gold-text">Packages</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            Choose the perfect package for your special day. All packages include
            professional sound equipment and coordination with your event team.
          </p>
        </motion.div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 mb-16">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            <span className="ml-3 text-midnight-400">Loading packages...</span>
          </div>
        )}

        {/* Error state (backend-only: no packages when fetch fails or cloud disabled) */}
        {!isLoading && error && (
          <div className="text-center py-12 mb-16 glass rounded-2xl px-6 max-w-xl mx-auto">
            <Package className="w-12 h-12 text-midnight-500 mx-auto mb-3" />
            <p className="font-sans text-midnight-400 text-sm">{error}</p>
            <p className="font-sans text-midnight-500 text-xs mt-2">Configure backend in Admin or use Import from template.</p>
          </div>
        )}

        {/* Empty state (no packages from backend) */}
        {!isLoading && !error && packages.length === 0 && (
          <div className="text-center py-12 mb-16 glass rounded-2xl px-6 max-w-xl mx-auto">
            <Package className="w-12 h-12 text-midnight-500 mx-auto mb-3" />
            <p className="font-sans text-midnight-400 text-sm">Packages will appear here once configured in Admin.</p>
          </div>
        )}

        {/* Packages Grid */}
        <div className={`grid gap-6 mb-16 ${gridCols} ${isLoading ? 'hidden' : ''}`}>
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
              className={`relative glass rounded-2xl p-6 card-hover ${
                pkg.popular ? 'ring-2 ring-gold-500' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold-500 text-midnight-950 text-xs font-sans font-semibold rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="font-display text-xl font-semibold text-white mb-2">
                  {pkg.name}
                </h3>
                <div className="mb-2">
                  {pkg.priceNote && (
                    <span className="text-midnight-400 text-xs block mb-1">
                      {pkg.priceNote}
                    </span>
                  )}
                  <span className="font-display text-3xl font-bold gold-text">
                    {pkg.priceDisplay}
                  </span>
                </div>
                <p className="font-body text-sm text-midnight-400">
                  {pkg.description}
                </p>
              </div>

              {/* Stats */}
              {(pkg.songs || pkg.duration) && (
              <div className="flex justify-center gap-4 mb-6 pb-6 border-b border-midnight-700">
                  {pkg.songs && (
                <div className="text-center">
                  <Music className="w-4 h-4 text-gold-400 mx-auto mb-1" />
                  <span className="text-xs text-midnight-400">{pkg.songs}</span>
                </div>
                  )}
                  {pkg.duration && (
                <div className="text-center">
                  <Clock className="w-4 h-4 text-gold-400 mx-auto mb-1" />
                  <span className="text-xs text-midnight-400">{pkg.duration}</span>
                </div>
                  )}
              </div>
              )}

              {/* What's included: segments (from backend) or features */}
              {pkg.includedSegments?.length ? (
                <ul className="space-y-3 mb-6">
                  <span className="font-sans text-xs text-midnight-500 block mb-2">What&apos;s included</span>
                  {pkg.includedSegments.map((seg, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-gold-400 mt-0.5 flex-shrink-0" />
                      <span className="font-sans text-sm text-midnight-300">
                        {seg.name}{seg.quantity !== 1 ? ` × ${seg.quantity}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-3 mb-6">
                  {pkg.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-gold-400 mt-0.5 flex-shrink-0" />
                      <span className="font-sans text-sm text-midnight-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA */}
              <a
                href="#booking"
                className={`block w-full py-3 rounded-full text-center font-sans font-medium transition-all ${
                  pkg.popular
                    ? 'bg-gold-500 text-midnight-950 hover:bg-gold-400'
                    : 'glass text-gold-400 hover:bg-gold-500/10'
                }`}
              >
                Select Package
              </a>
            </motion.div>
          ))}
        </div>

        {/* Add-ons */}
        {addons.length > 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-8 max-w-3xl mx-auto"
        >
          <h3 className="font-display text-xl font-semibold text-white text-center mb-6">
            Add-On Services
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
              {addons.map((addon, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-midnight-700 last:border-0"
              >
                  <div>
                <span className="font-sans text-sm text-midnight-300">
                  {addon.name}
                </span>
                    {addon.description && (
                      <p className="text-xs text-midnight-500">{addon.description}</p>
                    )}
                  </div>
                <span className="font-sans text-sm font-medium text-gold-400">
                    {addon.priceDisplay}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        )}

        {/* Note */}
        <p className="text-center font-sans text-xs text-midnight-500 mt-8">
          * Prices are subject to availability and may vary based on event requirements.
          Contact for custom quotes.
        </p>
      </div>
    </section>
  );
}
