import './globals.css'
import { siteMetadata } from '@/config/metadata.config'
import { Analytics } from '@vercel/analytics/next'

export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="font-sans antialiased">
        <div className="noise-overlay" />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
