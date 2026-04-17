import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.217", "192.168.1.*", "10.*", "172.16.*"],
};

export default nextConfig;
