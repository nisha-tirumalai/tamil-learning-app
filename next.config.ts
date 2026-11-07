import type { NextConfig } from "next";

// In Codespaces the browser reaches the app at https://<codespace>-3000.app.github.dev,
// which Next.js otherwise treats as a different site. Without these, the dev
// server blocks some requests from the phone and server actions (like saving a
// flag) are rejected.
const CODESPACES = "*.app.github.dev";

const nextConfig: NextConfig = {
  allowedDevOrigins: [CODESPACES],
  experimental: {
    serverActions: { allowedOrigins: [CODESPACES, "localhost:3000"] },
  },
};

export default nextConfig;
