import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WZHarith Studio | Wedding Saxophone Performance',
  description: 'Professional live saxophone performance for weddings and events in Malaysia. Make your special day unforgettable with the soulful sounds of the saxophone.',
  keywords: ['wedding saxophone', 'live music malaysia', 'saxophone performance', 'wedding entertainment', 'wzharith', 'wzharith studio'],
  authors: [{ name: 'Wan Zul Harith' }],
  openGraph: {
    title: 'WZHarith Studio | Wedding Saxophone Performance',
    description: 'Professional live saxophone performance for weddings and events in Malaysia',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  )
}
