'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Music, FileMusic, Headphones, BookOpen, Download, ArrowRight, CheckCircle, Phone } from 'lucide-react';
import { saveNotificationSubscriber, isGoogleSyncEnabled } from '@/lib/google-sync';

const products = [
  {
    icon: FileMusic,
    title: 'Backing Tracks',
    description: 'Professional backing tracks in various keys for practice and performance.',
    price: 'From RM 15',
    available: false,
  },
  {
    icon: BookOpen,
    title: 'Sheet Music',
    description: 'Saxophone arrangements of popular wedding songs with fingering guides.',
    price: 'From RM 20',
    available: false,
  },
  {
    icon: Headphones,
    title: 'Performance Recordings',
    description: 'High-quality recordings of live performances for reference and inspiration.',
    price: 'Free',
    available: false,
  },
  {
    icon: Download,
    title: 'Starter Kit',
    description: 'Complete beginner package with backing tracks, tips, and song recommendations.',
    price: 'RM 99',
    available: false,
  },
];

export default function DigitalProducts() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setIsSubmitting(true);
    try {
      if (isGoogleSyncEnabled()) {
        await saveNotificationSubscriber(phone.trim());
      }
      setIsSubmitted(true);
      setPhone('');
    } catch (error) {
      console.error('Failed to save subscriber:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="products" className="py-24 px-6" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Coming Soon
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Digital <span className="gold-text">Products</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            Resources for aspiring saxophonists and event musicians. Learn, practice,
            and perform with professional-grade materials.
          </p>
        </motion.div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {products.map((product, i) => (
            <motion.div
              key={product.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-6 card-hover relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />

              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center mb-4">
                  <product.icon className="w-5 h-5 text-gold-400" />
                </div>

                <h3 className="font-sans font-semibold text-white mb-2">
                  {product.title}
                </h3>
                <p className="font-body text-sm text-midnight-400 mb-4">
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="font-sans font-medium text-gold-400">
                    {product.price}
                  </span>
                  {!product.available && (
                    <span className="text-xs text-midnight-500">Coming Soon</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Newsletter / Interest Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-8 max-w-2xl mx-auto text-center"
        >
          <Music className="w-10 h-10 text-gold-400 mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-white mb-2">
            Get Notified When Products Launch
          </h3>
          <p className="font-body text-sm text-midnight-400 mb-6">
            Be the first to know when new backing tracks, sheet music, and educational
            content becomes available.
          </p>

          {isSubmitted ? (
            <div className="flex items-center justify-center gap-2 text-gold-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-sans">Thank you! We&apos;ll notify you when products launch.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="flex-1 relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+60 12-345 6789"
                  className="w-full pl-10 pr-4 py-3 rounded-full bg-midnight-800/50 border border-midnight-700 text-white placeholder-midnight-400 focus:outline-none focus:border-gold-500 transition-colors"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-gold-500 text-midnight-950 font-sans font-medium rounded-full hover:bg-gold-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Notify Me'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
