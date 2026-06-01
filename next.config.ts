import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set the Turbopack root to prevent it from traversing up to
  // C:\Users\Jalil\package-lock.json and generating paths with Cyrillic chars
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
