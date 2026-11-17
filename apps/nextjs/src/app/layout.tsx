import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { AddGameProvider } from "~/components/add-game";
import { AmbientBackground } from "~/components/ambient";
import {
  BacklogProvider,
  guestStateCookie,
} from "~/components/backlog-provider";
import { BootIntro, bootScript } from "~/components/boot-intro";
import { MotionRoot } from "~/components/motion";
import { Navbar } from "~/components/navbar";
import { InstallButton, PwaSupport } from "~/components/pwa";
import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: { default: "Gemuzu", template: "%s · Gemuzu" },
  description:
    "Your PC game backlog in one place: track what you own and play, set price targets across stores, and follow patch notes for your games.",
  applicationName: "Gemuzu",
  appleWebApp: { capable: true, title: "Gemuzu", statusBarStyle: "default" },
  openGraph: {
    title: "Gemuzu",
    description:
      "Track what you own and play, watch prices across stores, and follow patch notes for your games.",
    siteName: "Gemuzu",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#121411" },
  ],
};

// Barlow for reading, its condensed cut for labels and big numerals, and a
// mono for prices so figures line up.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
});

export default async function RootLayout(props: { children: React.ReactNode }) {
  // Better Auth's session cookie ("…session_token", "__Secure-" on HTTPS).
  // Without it the visitor is a guest, so pages can render their collection
  // on the server instead of waiting for the session check.
  const jar = await cookies();
  const signedOut = !jar
    .getAll()
    .some((cookie) => cookie.name.endsWith("session_token"));
  const pristineGuest = jar.get(guestStateCookie)?.value !== "saved";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Decides before first paint whether the boot animation plays. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
          barlow.variable,
          barlowCondensed.variable,
          plexMono.variable,
        )}
      >
        <ThemeProvider>
          <TRPCReactProvider>
            <BacklogProvider
              signedOut={signedOut}
              pristineGuest={pristineGuest}
            >
              <AddGameProvider>
                <BootIntro />
                <AmbientBackground />
                <a className="skip-link" href="#main">
                  Skip to content
                </a>
                <Navbar />
                <MotionRoot />
                <PwaSupport />
                <div id="main" tabIndex={-1} className="outline-none">
                  {props.children}
                </div>
                <footer className="site-footer">
                  <span>Gemuzu · not affiliated with Valve or any store</span>
                  <InstallButton />
                  <span>
                    Prices in USD from CheapShark and Steam · News from Steam
                  </span>
                </footer>
              </AddGameProvider>
            </BacklogProvider>
          </TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
