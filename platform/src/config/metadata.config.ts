/**
 * Metadata Configuration for Next.js
 * 
 * This file contains SEO and metadata configuration.
 * It mirrors siteConfig but is usable in server components.
 */

import type { Metadata } from 'next';

// These values should match site.config.ts
const businessName = "WZHarith Studio";
const businessTagline = "Wedding Saxophone Performance";
const businessDescription = "Professional live saxophone performance for weddings and events in Malaysia. Make your special day unforgettable with the soulful sounds of the saxophone.";
const authorName = "Wan Zul Harith";

export const siteMetadata: Metadata = {
  title: `${businessName} | ${businessTagline}`,
  description: businessDescription,
  keywords: [
    'wedding saxophone',
    'live music malaysia',
    'saxophone performance',
    'wedding entertainment',
    'wzharith',
    'wzharith studio',
    'wedding musician',
    'live saxophone',
    'wedding band malaysia',
  ],
  authors: [{ name: authorName }],
  creator: authorName,
  publisher: businessName,
  openGraph: {
    title: `${businessName} | ${businessTagline}`,
    description: businessDescription,
    type: 'website',
    locale: 'en_MY',
    siteName: businessName,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${businessName} | ${businessTagline}`,
    description: businessDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default siteMetadata;
