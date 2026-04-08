/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const nextConfig = {
  // Keep development and production artifacts separate to prevent
  // chunk corruption when build and dev are run around the same time.
  // Vercel expects ".next" output in production builds.
  distDir: isVercel ? ".next" : isProd ? ".next-prod" : ".next-dev",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
      },
    ],
  },
};

export default nextConfig;
