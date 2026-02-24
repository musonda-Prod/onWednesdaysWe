/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serverless / Vercel: default
  experimental: {
    serverComponentsExternalPackages: ['snowflake-sdk'],
  },
};

module.exports = nextConfig;
