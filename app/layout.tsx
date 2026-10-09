import type { Metadata } from "next";
import { EB_Garamond, Geist_Mono, Noto_Sans } from "next/font/google";

import "./globals.css";
import { PushNotificationsControl } from "@/components/push-notifications-control";
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
  description: "A starter workspace ready for your next project.",
  title: "Project ready!",
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
      <ThemeProvider>
        {children}
        <PushNotificationsControl
          publicKey={process.env["VAPID_PUBLIC_KEY"] ?? ""}
        />
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
