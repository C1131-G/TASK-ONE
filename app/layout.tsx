import type { Metadata, Viewport } from "next";
import { EB_Garamond, Geist_Mono, Noto_Sans } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const ebGaramondHeading = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  description: "The Metsys team workspace.",
  title: "Metsys",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: [
    { color: "#f4f7f9", media: "(prefers-color-scheme: light)" },
    { color: "#0d1a21", media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
  width: "device-width",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html
    lang="en"
    suppressHydrationWarning
    className={cn(
      "antialiased",
      fontMono.variable,
      "font-sans",
      notoSans.variable,
      ebGaramondHeading.variable
    )}
  >
    <body>
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
