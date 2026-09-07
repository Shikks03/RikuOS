import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

/**
 * Three faces, three CSS variables named exactly --display / --body / --mono,
 * so every recipe ported out of docs/design/p8-mockup.html works unchanged.
 *
 * Archivo and JetBrains Mono are variable families on Google Fonts and must
 * OMIT `weight`; IBM Plex Sans is served as static weights and requires it.
 * next/font/google throws a clear build error either way — let the build say
 * so rather than guessing.
 *
 * display: "swap", not "optional" — "optional" can silently drop the webfont
 * on a first load, and the mono is the part that must stay. adjustFontFallback
 * is left on (the default) so the swap does not shift the layout.
 */
const display = Archivo({ subsets: ["latin"], display: "swap", variable: "--display" });
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--body",
});
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--mono" });

export const metadata: Metadata = {
  title: APP_NAME,
  // "black", not "black-translucent": translucent slides content under the
  // status bar and needs the safe-area layout work this phase defers.
  appleWebApp: { capable: true, statusBarStyle: "black", title: APP_NAME },
};

// Next reads themeColor from `viewport`, not from `metadata`; putting it in
// metadata silently does nothing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#08090B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
