import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { AddGameProvider } from "~/components/add-game";
import { BacklogProvider } from "~/components/backlog-provider";
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
  title: { default: "Backlog", template: "%s · Backlog" },
  description:
    "Your PC game backlog in one place: track what you own and play, set price targets across stores, and follow patch notes for your games.",
  applicationName: "Backlog",
  appleWebApp: { capable: true, title: "Backlog", statusBarStyle: "default" },
  openGraph: {
    title: "Backlog",
    description:
      "Track what you own and play, watch prices across stores, and follow patch notes for your games.",
    siteName: "Backlog",
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

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
            <BacklogProvider>
              <AddGameProvider>
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
                  <span>Backlog · not affiliated with Valve or any store</span>
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
