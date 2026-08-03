import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // GitHub avatars are remote, so next/image needs them allow-listed or it throws
    // at request time rather than at build time.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
