import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API requests to the Express backend in development.
  // In production the frontend calls the backend URL directly via NEXT_PUBLIC_API_URL.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
