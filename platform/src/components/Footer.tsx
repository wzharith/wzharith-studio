'use client';

import { Music, Instagram, MessageCircle, Mail, Heart } from 'lucide-react';

const quickLinks = [
  { href: '#about', label: 'About' },
  { href: '#songs', label: 'Repertoire' },
  { href: '#packages', label: 'Packages' },
  { href: '#portfolio', label: 'Portfolio' },
  { href: '#booking', label: 'Book Now' },
];

const socialLinks = [
  { icon: Instagram, href: 'https://instagram.com/wzharith', label: 'Instagram' },
  { icon: MessageCircle, href: 'https://wa.me/60174047441', label: 'WhatsApp' },
  { icon: Mail, href: 'mailto:hello@wzharith.com', label: 'Email' },
];

export default function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-midnight-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <a href="#home" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <Music className="w-5 h-5 text-midnight-950" />
              </div>
              <span className="font-display text-xl font-semibold gold-text">
                WZHarith Music
              </span>
            </a>
            <p className="font-body text-midnight-400 max-w-sm mb-6">
              Professional live saxophone performance for weddings and events
              in Malaysia. Creating magical musical moments since 2024.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full glass flex items-center justify-center text-midnight-400 hover:text-gold-400 hover:bg-gold-500/10 transition-all"
                  aria-label={link.label}
                >
                  <link.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-sans font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-sans text-sm text-midnight-400 hover:text-gold-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-sans font-semibold text-white mb-4">Get In Touch</h4>
            <div className="space-y-3">
              <a
                href="https://wa.me/60174047441"
                className="flex items-center gap-2 text-sm text-midnight-400 hover:text-gold-400 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                +60 17-404 7441
              </a>
              <a
                href="mailto:hello@wzharith.com"
                className="flex items-center gap-2 text-sm text-midnight-400 hover:text-gold-400 transition-colors"
              >
                <Mail className="w-4 h-4" />
                hello@wzharith.com
              </a>
              <a
                href="https://instagram.com/wzharith"
                className="flex items-center gap-2 text-sm text-midnight-400 hover:text-gold-400 transition-colors"
              >
                <Instagram className="w-4 h-4" />
                @wzharith
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-midnight-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-sans text-xs text-midnight-500">
            © {new Date().getFullYear()} WZHarith Music. All rights reserved.
          </p>
          <p className="font-sans text-xs text-midnight-500 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-gold-500" /> in Malaysia
          </p>
        </div>
      </div>
    </footer>
  );
}
