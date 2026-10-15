import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components treats a session/data read with no Suspense boundary
  // as a build-time prerender failure. The actual minimum fix (per Next's
  // own "authentication-with-cache-components" guide) is just a Suspense
  // boundary around the session read, plus `connection()` in each data
  // page — `use cache: private` and a promise-context provider are only
  // needed for instant navigation and server-side caching, neither of
  // which matters on an internal, auth-gated admin tool with a handful of
  // screens that one person checks occasionally. Disabled rather than
  // adopting that machinery for a payoff that doesn't apply here.
  // partialPrefetching requires cacheComponents, so it's disabled too.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
});
