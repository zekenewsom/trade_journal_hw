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
};

export default nextConfig;
