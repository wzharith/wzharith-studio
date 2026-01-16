import './globals.css'
import { siteMetadata } from '@/config/metadata.config'

const basePath = process.env.NODE_ENV === 'production' ? '/wzharith-studio' : '';

export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`${basePath}/icon.svg`} type="image/svg+xml" />
      </head>
      <body className="font-sans antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  )
}
