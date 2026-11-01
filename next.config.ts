import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a one-off production build (e.g. for screenshots) use its own folder instead of `.next`,
  // so it doesn't pull the files out from under a running `npm run dev`. Unset → `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
