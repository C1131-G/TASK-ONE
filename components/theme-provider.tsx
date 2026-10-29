"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

const ThemeProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    storageKey="taskora-system-theme"
    disableTransitionOnChange
    {...props}
  >
    {children}
  </NextThemesProvider>
);

export { ThemeProvider };
