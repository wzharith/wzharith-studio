/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Required for static export
  },
  // Static export for GitHub Pages
  output: 'export',
  // Only use basePath in production (GitHub Pages)
  basePath: isProd ? '/wzharith-studio' : '',
  assetPrefix: isProd ? '/wzharith-studio/' : '',
  trailingSlash: true,
}

module.exports = nextConfig
