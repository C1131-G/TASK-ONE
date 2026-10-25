import { Effect } from "effect";

export type AppWeight = 400 | 500 | 600 | 700;

/** The loaded Geist faces, keyed by weight; each face is its own RN font family. */
export const FONT_FAMILIES = {
  mono: {
    400: "GeistMono_400Regular",
    500: "GeistMono_500Medium",
    600: "GeistMono_600SemiBold",
    700: "GeistMono_700Bold",
  },
  sans: {
    400: "Geist_400Regular",
    500: "Geist_500Medium",
    600: "Geist_600SemiBold",
    700: "Geist_700Bold",
  },
} as const;

/**
 * Loads the Geist faces once at startup. A failure (unsupported device,
 * bundled-out module) degrades to the system font instead of failing.
 */
export const loadAppFonts: Effect.Effect<void> = Effect.catchEager(
  Effect.tryPromise({
    catch: (cause) => new Error(`Font load failed: ${String(cause)}`),
    try: async () => {
      const [{ loadAsync }, geist, geistMono] = await Promise.all([
        import("expo-font"),
        import("@expo-google-fonts/geist"),
        import("@expo-google-fonts/geist-mono"),
      ]);
      await loadAsync({
        GeistMono_400Regular: geistMono.GeistMono_400Regular,
        GeistMono_500Medium: geistMono.GeistMono_500Medium,
        GeistMono_600SemiBold: geistMono.GeistMono_600SemiBold,
        GeistMono_700Bold: geistMono.GeistMono_700Bold,
        Geist_400Regular: geist.Geist_400Regular,
        Geist_500Medium: geist.Geist_500Medium,
        Geist_600SemiBold: geist.Geist_600SemiBold,
        Geist_700Bold: geist.Geist_700Bold,
      });
    },
  }),
  () => Effect.void,
);
