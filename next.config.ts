import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /** Явный корень трассировки при нескольких lockfile на машине */
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
