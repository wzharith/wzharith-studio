'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Calendar, MapPin, Music, Star, TrendingUp } from 'lucide-react';
import { events, stats } from '@/data/portfolio';

export default function Portfolio() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="portfolio" className="py-24 px-6" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Portfolio
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Past <span className="gold-text">Performances</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            A glimpse into the magical moments created at weddings and events.
            Every performance is a unique story.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
        >
          {[
            { icon: Calendar, label: 'Weddings Performed', value: stats.totalWeddings },
            { icon: Music, label: 'Songs Played', value: stats.totalSongsPlayed },
            { icon: Star, label: 'Unique Songs', value: stats.uniqueSongs },
            { icon: TrendingUp, label: 'Years Active', value: stats.yearsActive },
          ].map((stat, i) => (
            <div
              key={i}
              className="glass rounded-xl p-6 text-center card-hover"
            >
              <stat.icon className="w-6 h-6 text-gold-400 mx-auto mb-3" />
              <div className="font-display text-3xl font-bold gold-text mb-1">
                {stat.value}
              </div>
              <div className="font-sans text-xs text-midnight-400">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Signature Song Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="mb-16 glass rounded-2xl p-8 max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/10 text-gold-400 text-sm mb-4">
            <Star className="w-4 h-4 fill-gold-400" />
            Signature Song
          </div>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
            &ldquo;{stats.signatureSong}&rdquo;
          </h3>
          <p className="font-body text-midnight-400">
            Played at <span className="text-gold-400 font-semibold">{stats.signatureSongPercentage}%</span> of all weddings
          </p>
        </motion.div>

        {/* Recent Events Timeline */}
        <div className="max-w-3xl mx-auto">
          <h3 className="font-display text-xl font-semibold text-white text-center mb-8">
            Recent Performances
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold-500 via-gold-500/50 to-transparent" />

            {events.slice(0, 6).map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 + i * 0.1 }}
                className={`relative flex items-start gap-6 mb-8 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gold-500 ring-4 ring-midnight-900 z-10" />

                {/* Content */}
                <div
                  className={`ml-16 md:ml-0 flex-1 glass rounded-xl p-5 card-hover ${
                    i % 2 === 0 ? 'md:mr-8' : 'md:ml-8'
                  }`}
                >
                  <div className="flex items-center gap-2 text-gold-400 text-xs font-sans mb-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(event.date).toLocaleDateString('en-MY', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <h4 className="font-display text-lg font-semibold text-white mb-2">
                    {event.title}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {event.songs.slice(0, 3).map((song, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 rounded-full bg-midnight-800 text-xs text-midnight-400"
                      >
                        {song}
                      </span>
                    ))}
                    {event.songs.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-midnight-500">
                        +{event.songs.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Spacer for alternating layout */}
                <div className="hidden md:block flex-1" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* View More CTA */}
        <div className="text-center mt-12">
          <a
            href="#booking"
            className="inline-flex items-center gap-2 px-6 py-3 glass rounded-full text-gold-400 font-sans font-medium hover:bg-gold-500/10 transition-all"
          >
            Be the Next Story
            <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
