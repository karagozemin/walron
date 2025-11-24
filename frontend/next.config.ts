import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Static export for Walrus Sites
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
