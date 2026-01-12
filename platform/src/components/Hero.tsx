'use client';

import { motion } from 'framer-motion';
import { ChevronDown, Play, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

        {/* Decorative lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#d4a017" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-gold-400 text-sm mb-8"
        >
          <Sparkles className="w-4 h-4" />
          <span>30+ Weddings Performed</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
        >
          <span className="text-white">Make Your Day</span>
          <br />
          <span className="gold-text">Unforgettable</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="font-body text-xl md:text-2xl text-midnight-300 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          Professional live saxophone performance for weddings and events.
          Let the soulful melodies of the saxophone create magical moments
          on your special day.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#booking"
            className="px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-midnight-950 font-sans font-semibold rounded-full hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg hover:shadow-gold-500/25 transform hover:scale-105"
          >
            Book Your Date
          </a>
          <a
            href="#songs"
            className="px-8 py-4 glass text-gold-400 font-sans font-medium rounded-full hover:bg-gold-500/10 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            View Repertoire
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          {[
            { value: '30+', label: 'Weddings' },
            { value: '46', label: 'Songs' },
            { value: '2', label: 'Years' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="font-display text-3xl md:text-4xl font-bold gold-text">
                {stat.value}
              </div>
              <div className="font-sans text-sm text-midnight-400 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <a href="#about" className="flex flex-col items-center text-midnight-400 hover:text-gold-400 transition-colors">
          <span className="text-xs mb-2">Scroll</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </a>
      </motion.div>
    </section>
  );
}
