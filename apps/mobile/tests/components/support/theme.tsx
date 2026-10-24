import { createElement, type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react-native";

import { ThemeContext, type ThemeContextValue } from "@/theme/theme-provider";

const noop = (): void => undefined;

export interface ThemeRenderOptions {
  readonly isDark?: boolean;
}

/** Renders inside a fixed ThemeContext so primitives read deterministic tokens. */
export const renderWithTheme = async (
  ui: ReactElement,
  options: ThemeRenderOptions = {},
): Promise<void> => {
  const isDark = options.isDark ?? false;
  const value: ThemeContextValue = {
    accent: "default",
    density: "regular",
    isDark,
    mode: isDark ? "dark" : "light",
    setAccent: noop,
    setDensity: noop,
    setMode: noop,
  };
  await render(createElement(ThemeContext.Provider, { value }, ui as ReactNode));
};
