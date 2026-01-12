'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Search, Filter, Star, Music } from 'lucide-react';
import { songs, categories } from '@/data/songs';

export default function SongCatalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === 'all' || song.category === activeCategory;
    const matchesLanguage =
      !activeLanguage || song.language === activeLanguage;
    return matchesSearch && matchesCategory && matchesLanguage;
  });

  return (
    <section id="songs" className="py-24 px-6" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Repertoire
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Song <span className="gold-text">Catalog</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            Browse through my collection of 46+ songs carefully curated for weddings
            and special events. From romantic English ballads to beloved Malay classics.
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mb-8 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
            <input
              type="text"
              placeholder="Search songs or artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full glass text-white placeholder-midnight-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-full font-sans text-sm transition-all ${
                  activeCategory === category.id
                    ? 'bg-gold-500 text-midnight-950'
                    : 'glass text-midnight-300 hover:text-gold-400'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          {/* Language Filters */}
          <div className="flex justify-center gap-2">
            {['english', 'malay', 'other'].map((lang) => (
              <button
                key={lang}
                onClick={() =>
                  setActiveLanguage(activeLanguage === lang ? null : lang)
                }
                className={`px-3 py-1 rounded-full font-sans text-xs transition-all ${
                  activeLanguage === lang
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500'
                    : 'glass text-midnight-400 hover:text-midnight-200'
                }`}
              >
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Song Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSongs.map((song, i) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass rounded-xl p-5 card-hover group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center flex-shrink-0 group-hover:from-gold-500/30 group-hover:to-gold-600/30 transition-all">
                  <Music className="w-5 h-5 text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-semibold text-white truncate group-hover:text-gold-400 transition-colors">
                    {song.title}
                  </h3>
                  <p className="font-body text-sm text-midnight-400 truncate">
                    {song.artist}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-midnight-800 text-xs text-midnight-300 capitalize">
                      {song.category.replace('-', ' ')}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: song.popularity }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-3 h-3 text-gold-400 fill-gold-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {song.mood.slice(0, 3).map((mood) => (
                  <span
                    key={mood}
                    className="px-2 py-0.5 text-xs text-midnight-500 font-sans"
                  >
                    #{mood}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* No Results */}
        {filteredSongs.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-midnight-600 mx-auto mb-4" />
            <p className="font-sans text-midnight-400">
              No songs match your search. Try different keywords or filters.
            </p>
          </div>
        )}

        {/* Custom Song Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center glass rounded-xl p-6 max-w-2xl mx-auto"
        >
          <h4 className="font-sans font-semibold text-white mb-2">
            Don&apos;t see your song?
          </h4>
          <p className="font-body text-midnight-400 text-sm">
            I can learn custom songs for your special day! Contact me at least 2 weeks
            before your event for custom song requests (RM 100/song).
          </p>
        </motion.div>
      </div>
    </section>
  );
}
