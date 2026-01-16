'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, Sparkles, Clock, Music } from 'lucide-react';
import { siteConfig } from '@/config/site.config';

export default function Packages() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

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

        {/* Packages Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {siteConfig.packages.map((pkg, i) => (
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
                  <span className="font-display text-3xl font-bold gold-text">
                    {pkg.priceDisplay}
                  </span>
                  {pkg.priceNote && (
                    <span className="text-midnight-500 text-sm ml-1">
                      {pkg.priceNote}
                    </span>
                  )}
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

              {/* Features */}
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
        {siteConfig.addons.length > 0 && (
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
              {siteConfig.addons.map((addon, i) => (
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
