/**
 * Metadata Configuration for Next.js
 *
 * This file contains SEO and metadata configuration.
 *
 * ⚠️ IMPORTANT: Update these values to match your business!
 * These should match the values in site.config.ts
 */

import type { Metadata } from 'next';

// =============================================================================
// UPDATE THESE VALUES TO MATCH YOUR BUSINESS (must match site.config.ts)
// =============================================================================

const businessName = "WZHarith Studio";  // ← Update this
const businessTagline = "Wedding Saxophone Performance";  // ← Update this
const businessDescription = "Professional live saxophone performance for weddings and events in Malaysia. Make your special day unforgettable with the soulful sounds of the saxophone.";  // ← Update this
const authorName = "Wan Zul Harith";  // ← Update this
const serviceType = "saxophone";  // ← Update this (e.g., "violin", "dj", "photography")

// =============================================================================
// SEO KEYWORDS - Update for your service type
// =============================================================================

const keywords = [
  `wedding ${serviceType}`,
  'live music malaysia',
  `${serviceType} performance`,
  'wedding entertainment',
  'wedding musician',
  `live ${serviceType}`,
  'wedding band malaysia',
  businessName.toLowerCase().replace(/\s+/g, ''),
  businessName.toLowerCase(),
];

// =============================================================================
// METADATA EXPORT (no changes needed below)
// =============================================================================

export const siteMetadata: Metadata = {
  title: `${businessName} | ${businessTagline}`,
  description: businessDescription,
  keywords: keywords,
  authors: [{ name: authorName }],
  creator: authorName,
  publisher: businessName,
  icons: {
    icon: '/icon.svg',
  },
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
