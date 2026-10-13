import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components requires every session-reading page to adopt a
  // Suspense + `use cache: private` streaming-auth pattern (see Next's own
  // "authentication-with-cache-components" guide) to avoid build-time
  // prerender failures. That's a real architectural commitment this project
  // hasn't made — the dashboard is an internal, auth-gated admin tool with
  // a handful of screens, not a consumer app where instant navigation is a
  // stated goal. Disabled rather than worked around per-page.
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

export default nextConfig;
