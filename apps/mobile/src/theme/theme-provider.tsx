import { Effect } from "effect";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useStore, createStore } from "@tanstack/react-store";

import {
  ThemePreferences,
  type DensityName,
  type ThemeMode,
  type ThemeValues,
} from "@/services/theme-preferences";
import type { AccentName } from "@/theme/tokens.generated";
import { appRuntime } from "@/runtime/runtime";

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly accent: AccentName;
  readonly density: DensityName;
  readonly isDark: boolean;
  readonly setMode: (mode: ThemeMode) => void;
  readonly setAccent: (accent: AccentName) => void;
  readonly setDensity: (density: DensityName) => void;
}

/** Resolves the effective dark flag from the preference and the system scheme. */
export const resolveIsDark = (mode: ThemeMode, systemScheme: string | null): boolean =>
  mode === "system" ? systemScheme === "dark" : mode === "dark";

const preferencesStore = createStore<ThemeValues>({
  accent: "default",
  density: "regular",
  mode: "system",
});

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === null) {
    return {
      accent: "default",
      density: "regular",
      isDark: false,
      mode: "system",
      setAccent: () => undefined,
      setDensity: () => undefined,
      setMode: () => undefined,
    };
  }
  return context;
};

/**
 * Mirrors the persisted preferences in a TanStack Store for rendering and
 * persists every change through the ThemePreferences service.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const values = useStore(preferencesStore);

  useEffect(() => {
    const load = Effect.map(
      Effect.flatMap(Effect.service(ThemePreferences), (preferences) => preferences.load),
      (loaded) => preferencesStore.setState(() => loaded),
    );
    void appRuntime().runPromiseExit(Effect.ignore(load));
  }, []);

  const contextValue = useMemo<ThemeContextValue>(() => {
    const save = (patch: Partial<ThemeValues>): void => {
      preferencesStore.setState((current) => ({ ...current, ...patch }));
      const persist = Effect.flatMap(
        Effect.service(ThemePreferences),
        (preferences) => preferences.save(patch),
      ).pipe(
        Effect.tapError((error) => Effect.log(`Theme preference save failed: ${error._tag}`)),
        Effect.ignore,
      );
      void appRuntime().runPromiseExit(persist);
    };
    return {
      accent: values.accent,
      density: values.density,
      isDark: resolveIsDark(values.mode, systemScheme),
      mode: values.mode,
      setAccent: (accent) => save({ accent }),
      setDensity: (density) => save({ density }),
      setMode: (mode) => save({ mode }),
    };
  }, [values, systemScheme]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
