import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  output: "standalone",
};

const sentryConfig = {
  org: process.env.SENTRY_ORG || "krishna-ai-links-pvt-ltd",
  project: process.env.SENTRY_PROJECT || "kai-os",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
};

export default withSentryConfig(withPWA(nextConfig), sentryConfig);
