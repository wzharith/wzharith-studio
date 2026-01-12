# WZHarith Music Platform

A professional website for WZHarith Music - Wedding Saxophone Performance services in Malaysia.

## Features

- **Portfolio Showcase**: Display past wedding performances with statistics
- **Song Catalog**: Searchable repertoire with 46+ songs
- **Package Pricing**: Clear pricing structure with package options
- **Booking System**: WhatsApp-integrated booking form
- **Collaborator Section**: Invite other musicians to collaborate
- **Digital Products**: (Coming Soon) Backing tracks, sheet music, starter kits

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Forms**: React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd platform
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
platform/
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles + Tailwind
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Main page
│   ├── components/
│   │   ├── Navigation.tsx   # Header navigation
│   │   ├── Hero.tsx         # Hero section
│   │   ├── About.tsx        # About section
│   │   ├── SongCatalog.tsx  # Song repertoire
│   │   ├── Packages.tsx     # Pricing packages
│   │   ├── Portfolio.tsx    # Past events
│   │   ├── Collaborators.tsx # Collaboration CTA
│   │   ├── DigitalProducts.tsx # Products (coming soon)
│   │   ├── BookingForm.tsx  # Booking form
│   │   └── Footer.tsx       # Footer
│   └── data/
│       ├── songs.ts         # Song catalog data
│       ├── packages.ts      # Package pricing data
│       └── portfolio.ts     # Past events data
├── tailwind.config.js       # Tailwind configuration
├── next.config.js           # Next.js configuration
└── package.json
```

## Customization

### Update Contact Information

Edit the WhatsApp number and social links in:
- `src/components/BookingForm.tsx`
- `src/components/Footer.tsx`
- `src/components/Collaborators.tsx`

### Update Song Catalog

Edit `src/data/songs.ts` to add, remove, or modify songs.

### Update Packages

Edit `src/data/packages.ts` to modify pricing and package details.

### Update Portfolio

Edit `src/data/portfolio.ts` to add new events and update statistics.

## Deployment to GitHub Pages

### Automatic Deployment (Recommended)

1. Push this repository to GitHub
2. Go to your repository **Settings** > **Pages**
3. Under "Build and deployment", select **GitHub Actions** as the source
4. The site will auto-deploy on every push to `main` branch

### Manual Deployment

```bash
npm run build
# Static files are generated in the 'out' folder
```

### Custom Domain (Optional)

If you have a custom domain (e.g., `wzharith.com`):

1. Add a `CNAME` file in `platform/public/` with your domain:
   ```
   wzharith.com
   ```
2. Configure DNS at your domain registrar to point to GitHub Pages

### Repository URL Configuration

If deploying to `username.github.io/repo-name` (not root), uncomment and update `basePath` in `next.config.js`:

```js
basePath: '/repo-name',
```

## License

Private - WZHarith Music
