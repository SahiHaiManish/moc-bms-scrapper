import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "assets-in.bmscdn.com",
    },
  ],

  deviceSizes: [640, 768, 1024, 1280],

  imageSizes: [280, 400, 600],
},
};

export default nextConfig;
