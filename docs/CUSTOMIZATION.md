# Customization Guide

This guide explains how to customize the WZHarith Studio platform for your brand.

## Configuration Structure

All business configuration is centralized in:

```
platform/src/config/site.config.ts
```

This single file controls:
- Business identity (name, logo, SSM)
- Contact information
- Social media links
- Banking details
- Service packages and add-ons
- Transport zones and pricing
- Terms & conditions
- Invoice settings
- Theme colors
- Feature toggles

## Business Identity

```typescript
business: {
  name: "Your Studio Name",
  tagline: "Your Service Description",
  description: "Longer description for SEO and about sections...",
  logo: "/logo.png", // Optional: place in public/ folder
  ssm: "Your SSM Registration Number",
  serviceType: "saxophone", // Used for context
},
```

## Contact & Social

```typescript
contact: {
  phone: "+60123456789",
  email: "your@email.com",
  whatsapp: "60123456789", // No + sign
},

social: {
  instagram: "yourusername",    // Just username, not URL
  tiktok: "yourusername",
  youtube: "yourchannel",
  facebook: "yourpage",         // Optional
  twitter: "yourhandle",        // Optional
  website: "https://yoursite.com", // Optional
},
```

## Banking Details

```typescript
banking: {
  bank: "Maybank",
  accountName: "YOUR BUSINESS NAME",
  accountNumber: "1234 5678 9012",
},
```

## Service Packages

```typescript
packages: [
  {
    id: "package-1",           // Unique ID
    name: "Package Name",
    price: 500,                // Numeric for calculations
    priceDisplay: "RM 500",    // Display format
    priceNote: "starting from", // Optional note
    description: "Package description",
    features: [
      "Feature 1",
      "Feature 2",
      "Feature 3",
    ],
    popular: true,             // Show "Most Popular" badge
    songs: "3-5 songs",        // For music services
    duration: "1-2 hours",
  },
  // Add more packages...
],
```

## Add-On Services

```typescript
addons: [
  {
    name: "Additional Service",
    price: 100,
    priceDisplay: "RM 100",
    description: "Service description",
  },
  // Add more add-ons...
],
```

## Transport Zones

```typescript
transport: {
  baseLocation: "Your Base City",
  zones: [
    {
      name: "Nearby Areas",
      price: 50,
      description: "Within 30km radius",
    },
    {
      name: "Outstation",
      price: 0,
      description: "Price varies",
      isCustom: true, // Show as "to be quoted"
    },
  ],
},
```

## Terms & Conditions

```typescript
terms: {
  depositPercent: 30,           // 30% deposit
  balanceDueDays: 3,            // Due 3 days before
  quotationValidDays: 7,        // Quotation expires
  paymentMethods: "Cash or bank transfer only",
  cancellationPolicy: "Deposit is non-refundable",
  reschedulingPolicy: "Free reschedule subject to availability",
  latePaymentPolicy: "Late payment may result in cancellation",
},
```

## Invoice Settings

```typescript
invoice: {
  prefix: {
    quotation: "QUO",
    invoice: "INV",
  },
  startingNumber: 1,
},
```

## Calendar Reminders

```typescript
reminders: {
  songConfirmation: 14, // Days before event
  balanceReminder: 3,   // Days before event
  followUp: 1,          // Days after event
},
```

## Theme Colors

```typescript
theme: {
  primaryColor: "#f59e0b", // Main accent (gold)
  accentColor: "#1e293b",  // Secondary (dark)
},
```

For deeper customization, edit `src/app/globals.css`.

## Feature Toggles

Enable/disable entire sections:

```typescript
features: {
  showAvailabilityCalendar: true,
  showPortfolio: true,
  showCollaborators: true,
  showDigitalProducts: true,
  showSongCatalog: true,
},
```

## Statistics

```typescript
stats: {
  eventsCount: "50+",
  songsCount: "100",
  yearsExperience: "5",
},
```

## Content Files

### Songs Catalog

Edit `src/data/songs.ts`:

```typescript
export const songs: Song[] = [
  {
    title: "Can't Help Falling in Love",
    artist: "Elvis Presley",
    category: "romantic",
    popular: true,
    playCount: 25,
  },
];
```

### Portfolio

Edit `src/data/portfolio.ts`:

```typescript
export const portfolio: PortfolioItem[] = [
  {
    id: "wedding-1",
    title: "Beautiful Wedding",
    date: "2024-06-15",
    venue: "Grand Ballroom",
    description: "Description...",
    images: ["/images/event1.jpg"],
  },
];
```

## Images & Assets

Place images in `platform/public/`:

```
public/
├── logo.png          # Business logo
├── images/
│   ├── hero.jpg      # Hero background
│   └── portfolio/    # Portfolio images
└── favicon.ico
```

## SEO & Metadata

Edit `src/config/metadata.config.ts`:

```typescript
const businessName = "Your Business";
const businessTagline = "Your Tagline";
const businessDescription = "Your SEO description...";
```

## Advanced Customization

### CSS Variables

In `globals.css`, customize:

```css
:root {
  --gold-400: #fbbf24;
  --gold-500: #f59e0b;
  --midnight-900: #0f172a;
  /* ... more variables */
}
```

### Component Styling

Components use Tailwind CSS. Modify classes directly in:
- `src/components/Hero.tsx`
- `src/components/Packages.tsx`
- etc.

### Layout Changes

Main layout in `src/app/page.tsx`:

```typescript
export default function Home() {
  return (
    <main>
      <Navigation />
      <Hero />
      {/* Reorder or remove sections */}
      <Packages />
      <BookingForm />
      <Footer />
    </main>
  );
}
```
