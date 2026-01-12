/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Required for static export
  },
  // Static export for GitHub Pages
  output: 'export',
  // If deploying to username.github.io, leave basePath empty
  // If deploying to username.github.io/repo-name, set basePath to '/repo-name'
  basePath: '/wzharith-studio',
  assetPrefix: '/wzharith-studio/',
  trailingSlash: true,
}

module.exports = nextConfig
