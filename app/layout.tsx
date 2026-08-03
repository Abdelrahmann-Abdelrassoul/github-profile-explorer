import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fonts are self-hosted from app/fonts rather than fetched via next/font/google.
 *
 * next/font/google downloads typefaces at BUILD time, which made every build depend on
 * reaching fonts.gstatic.com. That fetch failed intermittently — several times in one
 * session, once breaking the dev server badly enough that it served 500s until restarted.
 * Committing the files makes builds deterministic and lets them run offline or behind a
 * restricted CI network.
 *
 * Runtime behaviour is unchanged: next/font/google already self-hosted after downloading,
 * so the browser was never talking to Google either way. These are the latin subsets of
 * the variable fonts, 73 KB for all three.
 */

const geistSans = localFont({
  src: "./fonts/geist-variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const geistMono = localFont({
  src: "./fonts/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

// Headings only. Body stays Geist Sans, numbers and metadata use Geist Mono.
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-variable.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "GitHub Profile Explorer",
  description:
    "Search GitHub profiles, compare users, and chat with AI about their repos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
