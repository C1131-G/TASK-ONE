import { Effect } from "effect";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as RouterThemeProvider,
} from "expo-router";

import { SessionGate } from "@/features/auth/session-gate";
import { OfflineBanner } from "@/features/connectivity/offline-banner";
import { appRuntime } from "@/runtime/runtime";
import { loadAppFonts } from "@/theme/fonts";
import { ThemeProvider, useTheme } from "@/theme/theme-provider";

// Fonts load once alongside the runtime; a failure keeps the system font.
void appRuntime().runPromiseExit(loadAppFonts);

const RoutedStack = () => {
  const { isDark } = useTheme();

  return (
    <RouterThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </RouterThemeProvider>
  );
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionGate>
        <OfflineBanner />
        <RoutedStack />
      </SessionGate>
    </ThemeProvider>
  );
}
