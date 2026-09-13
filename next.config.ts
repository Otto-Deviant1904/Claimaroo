import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
