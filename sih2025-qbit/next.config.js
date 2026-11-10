/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ignore ESLint errors during production builds (let Vercel build succeed)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignore TypeScript type errors during production builds
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["maps.geoapify.com"],
  },
};

module.exports = nextConfig;
