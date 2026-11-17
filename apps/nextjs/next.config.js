import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/auth",
    "@acme/db",
    "@acme/ui",
    "@acme/validators",
  ],

  /** Versions the service worker cache per build. */
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },

  /**
   * Large hero art goes through the image optimizer: resized to what's shown,
   * served as AVIF/WebP and cached server-side, so first paint doesn't wait on
   * Steam's CDN delivering a 200–500 KB full-resolution JPEG.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shared.akamai.steamstatic.com",
        pathname: "/store_item_assets/steam/apps/**",
      },
    ],
  },

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default config;
