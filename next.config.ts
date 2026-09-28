import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "assets-in.bmscdn.com",
    }, {
        protocol: "https",
        hostname: "d10y46cwh6y6x1.cloudfront.net",
        port: "",
        pathname: "/images/**",
   }
  ],

  deviceSizes: [640, 768, 1024, 1280],

  imageSizes: [280, 400, 600],
},
};

export default nextConfig;

async rewrites() {
  return [
    { source: "/mics", destination: "https://mics-omega.vercel.app/mics" },
    { source: "/mics/:path*", destination: "https://mics-omega.vercel.app/mics/:path*" },
  ];
}
