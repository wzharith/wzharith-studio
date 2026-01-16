'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Users, Mic2, Guitar, Piano, Users2 } from 'lucide-react';
import { siteConfig, getWhatsAppUrl, getSocialUrl } from '@/config/site.config';

const collaborationTypes = [
  {
    icon: Mic2,
    title: 'Vocalists',
    description: 'Duo performances with talented singers for a fuller sound experience.',
    available: true,
  },
  {
    icon: Guitar,
    title: 'Guitarists',
    description: 'Acoustic guitar accompaniment for intimate and warm performances.',
    available: true,
  },
  {
    icon: Piano,
    title: 'Pianists',
    description: 'Classic piano and saxophone combination for elegant events.',
    available: false,
  },
  {
    icon: Users,
    title: 'Full Band',
    description: 'Complete acoustic band setup for premium events.',
    available: false,
  },
];

export default function Collaborators() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  // Get first name for personalized message
  const firstName = siteConfig.business.name.split(' ')[0];

  return (
    <section id="collaborators" className="py-24 px-6" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Collaborations
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Better <span className="gold-text">Together</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            Elevate your event with collaborative performances. I work with talented
            musicians to create unforgettable musical experiences.
          </p>
        </motion.div>

        {/* Collaboration Types */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {collaborationTypes.map((type, i) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
              className={`glass rounded-xl p-6 text-center card-hover relative overflow-hidden ${
                !type.available ? 'opacity-60' : ''
              }`}
            >
              {!type.available && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-midnight-800 rounded-full text-xs text-midnight-400">
                  Coming Soon
                </div>
              )}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center mx-auto mb-4">
                <type.icon className="w-6 h-6 text-gold-400" />
              </div>
              <h3 className="font-sans font-semibold text-white mb-2">
                {type.title}
              </h3>
              <p className="font-body text-sm text-midnight-400">
                {type.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Join CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto"
        >
          <Users2 className="w-12 h-12 text-gold-400 mx-auto mb-6" />
          <h3 className="font-display text-2xl font-bold text-white mb-4">
            Are You a Musician?
          </h3>
          <p className="font-body text-midnight-300 mb-8 max-w-xl mx-auto">
            I&apos;m always looking to collaborate with talented musicians. If you&apos;re a
            vocalist, guitarist, or any instrumentalist interested in performing at
            weddings and events together, let&apos;s connect!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={getWhatsAppUrl(`Hi ${firstName}, I'm interested in collaborating with you!`)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-midnight-950 font-sans font-semibold rounded-full hover:from-gold-400 hover:to-gold-500 transition-all"
            >
              Let&apos;s Collaborate
            </a>
            {siteConfig.social.instagram && (
              <a
                href={getSocialUrl('instagram')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 glass text-gold-400 font-sans font-medium rounded-full hover:bg-gold-500/10 transition-all"
              >
                Follow @{siteConfig.social.instagram}
              </a>
            )}
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-16 grid md:grid-cols-3 gap-6 text-center"
        >
          {[
            { title: 'Shared Bookings', desc: 'Get referred to events needing your skills' },
            { title: 'Fair Split', desc: 'Transparent payment splitting for all gigs' },
            { title: 'Grow Together', desc: 'Build your portfolio and network' },
          ].map((benefit, i) => (
            <div key={i} className="p-4">
              <h4 className="font-sans font-semibold text-gold-400 mb-1">
                {benefit.title}
              </h4>
              <p className="font-body text-sm text-midnight-400">{benefit.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
