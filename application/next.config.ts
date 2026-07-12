import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/send",
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;
