# WZHarith Studio Platform - Setup Guide

This guide will help you set up the WZHarith Studio platform for your own business.

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/wzharith-studio.git
cd wzharith-studio
```

### 2. Install Dependencies

```bash
cd platform
npm install
```

### 3. Configure Your Business

Edit `src/config/site.config.ts` with your business details:

```typescript
export const siteConfig: SiteConfig = {
  business: {
    name: "Your Business Name",
    tagline: "Your Tagline Here",
    description: "Your business description...",
    ssm: "Your SSM Number (optional)",
    serviceType: "saxophone", // or violin, dj, etc.
  },

  contact: {
    phone: "+60123456789",
    email: "your@email.com",
    whatsapp: "60123456789",
  },

  social: {
    instagram: "yourusername",
    tiktok: "yourusername",
    youtube: "yourchannel",
  },

  banking: {
    bank: "Your Bank",
    accountName: "YOUR ACCOUNT NAME",
    accountNumber: "1234 5678 9012",
  },

  // ... rest of configuration
};
```

### 4. Set Environment Variables

Create `.env.local` in the `platform` folder:

```env
# Invoice Password (for invoice generator access)
NEXT_PUBLIC_INVOICE_PASSWORD=your-secret-password

# Google Apps Script URL (optional - for Google Sheets sync)
NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 5. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

### 6. Deploy to GitHub Pages

1. Push to GitHub
2. Enable GitHub Pages in repository settings
3. Set source to "GitHub Actions"
4. Add secrets in Settings > Secrets:
   - `INVOICE_PASSWORD`: Your invoice password

The site will automatically deploy on push to `main`.

## Google Integration (Optional)

For full functionality including:
- Invoice backup to Google Sheets
- Calendar events with reminders
- Availability checker

See [Google Apps Script Setup](../google-apps-script/README.md)

## Updating Content

### Packages & Pricing

Edit packages in `src/config/site.config.ts`:

```typescript
packages: [
  {
    id: "basic",
    name: "Basic Package",
    price: 500,
    priceDisplay: "RM 500",
    description: "Your package description",
    features: ["Feature 1", "Feature 2"],
  },
  // Add more packages...
],
```

### Song Catalog

Edit `src/data/songs.ts`:

```typescript
export const songs = [
  {
    title: "Song Title",
    artist: "Artist Name",
    category: "romantic",
    popular: true,
  },
  // Add more songs...
];
```

### Portfolio

Edit `src/data/portfolio.ts`:

```typescript
export const portfolio = [
  {
    id: "event-1",
    title: "Event Title",
    date: "2024-01-01",
    venue: "Venue Name",
    description: "Event description",
  },
  // Add more events...
];
```

## Customization

### Theme Colors

Edit theme colors in `src/config/site.config.ts`:

```typescript
theme: {
  primaryColor: "#f59e0b", // Gold/amber
  accentColor: "#1e293b",  // Dark slate
},
```

And update `src/app/globals.css` if needed.

### Feature Toggles

Enable/disable sections:

```typescript
features: {
  showAvailabilityCalendar: true,
  showPortfolio: true,
  showCollaborators: false, // Hide this section
  showDigitalProducts: true,
  showSongCatalog: true,
},
```

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Local Development Issues

If `basePath` issues occur:

```javascript
// next.config.js
basePath: process.env.NODE_ENV === 'production' ? '/your-repo' : '',
```

### Invoice Generator Not Accessible

1. Check `.env.local` has `NEXT_PUBLIC_INVOICE_PASSWORD`
2. For GitHub Pages, add `INVOICE_PASSWORD` to repository secrets
3. Rebuild after changing secrets

## Support

For issues or questions:
- Open a GitHub issue
- Contact: wzharith.studio@gmail.com
