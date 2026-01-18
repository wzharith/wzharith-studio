/**
 * Site Configuration
 *
 * This file contains all configurable options for the platform.
 * Edit this file to customize the platform for your business.
 *
 * For resellers: This is the ONLY file customers need to edit.
 */

export interface SiteConfig {
  business: BusinessConfig;
  contact: ContactConfig;
  social: SocialConfig;
  banking: BankingConfig;
  packages: PackageConfig[];
  addons: AddonConfig[];
  transport: TransportConfig;
  terms: TermsConfig;
  invoice: InvoiceConfig;
  reminders: ReminderConfig;
  theme: ThemeConfig;
  stats: StatsConfig;
  features: FeaturesConfig;
}

interface BusinessConfig {
  name: string;
  tagline: string;
  description: string;
  logo?: string;
  ssm?: string;
  serviceType: string; // e.g., "saxophone", "violin", "dj", "photography"
}

interface ContactConfig {
  phone: string;
  email: string;
  whatsapp: string;
}

interface SocialConfig {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
  twitter?: string;
  website?: string;
}

interface BankingConfig {
  bank: string;
  accountName: string;
  accountNumber: string;
}

interface PackageConfig {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  priceNote?: string;
  description: string;
  features: string[];
  popular?: boolean;
  songs?: string;
  duration?: string;
  hidden?: boolean;
}

interface AddonConfig {
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
}

interface TransportConfig {
  baseLocation: string;
  zones: {
    name: string;
    price: number;
    description: string;
    isCustom?: boolean;
  }[];
}

interface TermsConfig {
  depositPercent: number;
  balanceDueDays: number;
  quotationValidDays: number;
  paymentMethods: string;
  cancellationPolicy: string;
  reschedulingPolicy: string;
  latePaymentPolicy: string;
}

interface InvoiceConfig {
  prefix: {
    quotation: string;
    invoice: string;
  };
  startingNumber: number;
}

interface ReminderConfig {
  songConfirmation: number; // days before event
  balanceReminder: number;  // days before event
  followUp: number;         // days after event
}

interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
}

interface StatsConfig {
  eventsCount: string;
  songsCount: string;
  yearsExperience: string;
}

interface FeaturesConfig {
  showAvailabilityCalendar: boolean;
  showPortfolio: boolean;
  showCollaborators: boolean;
  showDigitalProducts: boolean;
  showSongCatalog: boolean;
}

// =============================================================================
// ⚠️ EDIT BELOW THIS LINE TO CUSTOMIZE YOUR PLATFORM
// =============================================================================
// Replace ALL values below with your own business details.
// The values shown are DEMO/EXAMPLE values only.
// =============================================================================

export const siteConfig: SiteConfig = {
  // Business Identity - ⚠️ RESELLERS: Update with your business details
  business: {
    name: "WZHarith Studio",
    tagline: "Live Saxophone Performance Services",
    description: "Professional live saxophone performance for weddings and events in Malaysia. Creating magical musical moments since 2024.",
    logo: undefined, // Optional: "/logo.png"
    ssm: "202603015121 (KT0606402-U)",
    serviceType: "saxophone",
  },

  // Contact Information - ⚠️ RESELLERS: Update with your details
  contact: {
    phone: "+60174047441",
    email: "wzharith.studio@gmail.com",
    whatsapp: "60174047441", // Without + for WhatsApp URL
  },

  // Social Media (set to undefined if not used)
  social: {
    instagram: "wzharith",
    tiktok: "wzharithh",
    youtube: "wzharith",
    facebook: undefined,
    twitter: undefined,
    website: undefined,
  },

  // Banking Details - ⚠️ RESELLERS: Update with your bank account
  banking: {
    bank: "Maybank",
    accountName: "WZHARITH STUDIO",
    accountNumber: "5686 0312 0447",
  },

  // Service Packages
  packages: [
    {
      id: "entrance",
      name: "Entrance Only",
      price: 499,
      priceDisplay: "RM 499",
      priceNote: "starting from",
      description: "Perfect for couples who want a grand entrance with live saxophone.",
      features: [
        "1-2 songs during entrance",
        "Sound check 30 mins before",
        "Professional attire",
        "Song customization",
      ],
      songs: "1-2 songs",
      duration: "15-20 minutes",
    },
    {
      id: "classic",
      name: "Entrance + Cake",
      price: 696,
      priceDisplay: "RM 696",
      priceNote: "starting from",
      description: "The most popular package for intimate weddings.",
      features: [
        "Everything in Entrance",
        "1-2 songs for cake cutting",
        "Emcee coordination",
        "Professional photos welcome",
      ],
      popular: true,
      songs: "3-4 songs",
      duration: "30-45 minutes",
    },
    {
      id: "full",
      name: "Full Package",
      price: 1096,
      priceDisplay: "RM 1,096",
      priceNote: "starting from",
      description: "Complete saxophone experience for your special day.",
      features: [
        "Everything in Classic",
        "Meal accompaniment (30-45 min)",
        "5-8 additional songs",
        "Walkabout performance",
      ],
      songs: "8-10 songs",
      duration: "1.5-2 hours",
    },
    {
      id: "premium",
      name: "Premium Experience",
      price: 1899,
      priceDisplay: "RM 1,899",
      priceNote: "starting from",
      description: "The ultimate live music experience with collaboration options.",
      features: [
        "Everything in Full Package",
        "Pre-event consultation",
        "Unlimited song requests",
        "Duo performance option",
        "Extended performance (2+ hours)",
      ],
      songs: "Unlimited",
      duration: "2+ hours",
    },
  ],

  // Add-ons
  addons: [
    {
      name: "Custom Song",
      price: 100,
      priceDisplay: "RM 100",
      description: "Learning a new song request",
    },
    {
      name: "Additional Song",
      price: 80,
      priceDisplay: "RM 80",
      description: "Extra song beyond package",
    },
    {
      name: "Extended Performance",
      price: 200,
      priceDisplay: "RM 200",
      description: "Additional 30 minutes",
    },
  ],

  // Transport Zones
  transport: {
    baseLocation: "Cyberjaya",
    zones: [
      {
        name: "Klang Valley",
        price: 50,
        description: "Outside Cyberjaya, within KL/Selangor",
      },
      {
        name: "Selangor Border",
        price: 100,
        description: "Rawang, Klang, Kajang, etc.",
      },
      {
        name: "Other States",
        price: 0,
        description: "Price varies - to be quoted",
        isCustom: true,
      },
      {
        name: "Toll Charges",
        price: 0,
        description: "Actual toll cost (to be filled)",
        isCustom: true,
      },
    ],
  },

  // Terms & Conditions
  terms: {
    depositPercent: 30,
    balanceDueDays: 3,
    quotationValidDays: 7,
    paymentMethods: "Cash or bank transfer only (immediate payment)",
    cancellationPolicy: "Deposit is non-refundable",
    reschedulingPolicy: "Free reschedule subject to availability",
    latePaymentPolicy: "Failure to pay by due date may result in booking cancellation",
  },

  // Invoice Settings
  invoice: {
    prefix: {
      quotation: "QUO",
      invoice: "INV",
    },
    startingNumber: 1,
  },

  // Calendar Reminders (days)
  reminders: {
    songConfirmation: 14, // 2 weeks before
    balanceReminder: 3,   // 3 days before
    followUp: 1,          // 1 day after
  },

  // Theme Colors
  theme: {
    primaryColor: "#f59e0b", // amber-500
    accentColor: "#1e293b",  // slate-800
  },

  // Stats displayed on homepage
  stats: {
    eventsCount: "30+",
    songsCount: "46",
    yearsExperience: "2",
  },

  // Feature toggles
  features: {
    showAvailabilityCalendar: true,
    showPortfolio: true,
    showCollaborators: true,
    showDigitalProducts: true,
    showSongCatalog: true,
  },
};

// =============================================================================
// HELPER FUNCTIONS (DO NOT EDIT)
// =============================================================================

/**
 * Get formatted WhatsApp URL
 */
export const getWhatsAppUrl = (message?: string): string => {
  const base = `https://wa.me/${siteConfig.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

/**
 * Get formatted phone display
 */
export const getPhoneDisplay = (): string => {
  const phone = siteConfig.contact.phone;
  // Format: +60 17-404 7441
  if (phone.startsWith('+60')) {
    const num = phone.slice(3);
    return `+60 ${num.slice(0, 2)}-${num.slice(2, 5)} ${num.slice(5)}`;
  }
  return phone;
};

/**
 * Get social media URL
 */
export const getSocialUrl = (platform: keyof SocialConfig): string | undefined => {
  const handle = siteConfig.social[platform];
  if (!handle) return undefined;

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'website':
      return handle;
    default:
      return undefined;
  }
};

/**
 * Get SSM display (short version)
 */
export const getSsmShort = (): string | undefined => {
  const ssm = siteConfig.business.ssm;
  if (!ssm) return undefined;
  // Extract just the KT number if present
  const match = ssm.match(/\((.*?)\)/);
  return match ? match[1] : ssm;
};

export default siteConfig;
