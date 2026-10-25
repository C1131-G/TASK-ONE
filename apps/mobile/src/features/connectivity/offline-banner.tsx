import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";
import { appRuntime } from "@/runtime/runtime";
import { Connectivity } from "@/services/connectivity";
import { onlineManager } from "@tanstack/react-query";
import { Effect, Fiber, Stream } from "effect";

/**
 * Shows a banner while the device is offline and mirrors the connectivity
 * stream into TanStack's online manager. Reduced-motion friendly: no
 * animation, just the live-region announcement.
 */
export const OfflineBanner = () => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const runtime = appRuntime();
    const wiring = Effect.flatMap(Effect.service(Connectivity), (connectivity) =>
      Stream.runDrain(
        Stream.tap(connectivity.changes, (value) =>
          Effect.sync(() => {
            setOnline(value);
            onlineManager.setOnline(value);
          }),
        ),
      ),
    );
    const fiber = runtime.runFork(wiring);
    return () => {
      void runtime.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: palette.amber }]}
    >
      <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>
        You are offline. Changes wait until the connection returns.
      </Text>
    </View>
  );
};

void AccessibilityInfo;

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: radii.md,
    marginHorizontal: spacing.s4,
    marginTop: spacing.s2,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
});
