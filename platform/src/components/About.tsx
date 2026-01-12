'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Heart, Music2, Star, Users } from 'lucide-react';

const features = [
  {
    icon: Music2,
    title: 'Professional Sound',
    description: 'High-quality wireless saxophone system with portable speaker for crystal clear audio.',
  },
  {
    icon: Heart,
    title: 'Romantic Repertoire',
    description: '46+ carefully curated songs spanning classic ballads to modern hits.',
  },
  {
    icon: Star,
    title: 'Signature Style',
    description: 'Smooth, emotive saxophone interpretations that move hearts.',
  },
  {
    icon: Users,
    title: 'Collaboration Ready',
    description: 'Available for duo performances with vocalists and other musicians.',
  },
];

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Image/Visual */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-2xl overflow-hidden glass p-1">
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-midnight-800 to-midnight-900 flex items-center justify-center relative overflow-hidden">
                {/* Decorative saxophone silhouette */}
                <svg
                  className="absolute inset-0 w-full h-full opacity-10"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <text
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    className="fill-gold-400"
                    style={{ fontSize: '60px' }}
                  >
                    🎷
                  </text>
                </svg>

                {/* Profile placeholder with gradient */}
                <div className="relative z-10 text-center p-8">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mb-6 shadow-2xl">
                    <span className="text-5xl">🎷</span>
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-white mb-2">
                    Wan Zul Harith
                  </h3>
                  <p className="font-body text-gold-400 italic">
                    Saxophonist
                  </p>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 glass rounded-xl px-6 py-4">
              <div className="text-center">
                <div className="font-display text-2xl font-bold gold-text">71%</div>
                <div className="font-sans text-xs text-midnight-400">
                  play Elvis at every wedding
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
              About Me
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
              Bringing Romance <br />
              <span className="gold-text">to Your Special Day</span>
            </h2>
            <div className="font-body text-lg text-midnight-300 space-y-4 mb-10">
              <p>
                Hi, I&apos;m <strong className="text-white">Wan Zul Harith</strong>, a passionate
                saxophonist based in Malaysia. What started as a hobby two years ago has
                blossomed into a beautiful journey of creating magical moments at weddings
                and special events.
              </p>
              <p>
                With over 30 weddings performed, I specialize in entrance performances,
                cake cutting ceremonies, and meal accompaniment. My repertoire spans from
                timeless classics like Elvis&apos;s &ldquo;Can&apos;t Help Falling in Love&rdquo; to modern
                hits and beloved Malay romantic songs.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="glass rounded-xl p-4 hover:bg-gold-500/5 transition-colors"
                >
                  <feature.icon className="w-6 h-6 text-gold-400 mb-2" />
                  <h4 className="font-sans font-semibold text-white text-sm mb-1">
                    {feature.title}
                  </h4>
                  <p className="font-sans text-xs text-midnight-400">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
