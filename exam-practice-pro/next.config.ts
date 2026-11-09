import { resolveApiOrigin } from './lib/api-origin';
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Proxy API requests to the Express backend in development.
  // In production the frontend calls the backend URL directly via NEXT_PUBLIC_API_URL.
  async rewrites() {
    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV, process.env.NEXT_PUBLIC_APP_ENV);
    if (!apiUrl) return [];
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true, telemetry: false, sourcemaps: { disable: true } })
  : nextConfig;
