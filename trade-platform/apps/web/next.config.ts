import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@trade-platform/api",
    "@trade-platform/core",
    "@trade-platform/db",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "cdn.auth0.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
