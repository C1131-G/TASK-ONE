import { createContext, useContext, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const MIN_TOUCH_TARGET = 44;

export interface WorkspaceButtonProps {
  readonly children: string;
  readonly disabled?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly onPress?: () => void;
  readonly size?: ButtonSize;
  readonly trailingIcon?: ReactNode;
  readonly variant?: ButtonVariant;
}

const colorsFor = (variant: ButtonVariant, isDark: boolean) => {
  const palette = isDark ? theme.dark : theme.light;
  switch (variant) {
    case "danger":
      return { background: palette.red, text: palette.onAccent };
    case "ghost":
      return { background: "transparent", text: palette.text };
    case "secondary":
      return { background: palette.surface3, text: palette.text };
    case "primary":
    default:
      return { background: palette.accent, text: palette.onAccent };
  }
};

export const WorkspaceButton = ({
  children,
  disabled = false,
  leadingIcon,
  onPress,
  size = "md",
  trailingIcon,
  variant = "primary",
}: WorkspaceButtonProps) => {
  const { isDark } = useTheme();
  const colors = colorsFor(variant, isDark);
  const label = typeStyle(size === "lg" ? "md" : "sm", { weight: 500 });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || undefined }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.large : size === "sm" ? styles.small : styles.medium,
        { backgroundColor: colors.background, opacity: pressed && !disabled ? 0.8 : 1 },
      ]}
    >
      {leadingIcon === undefined ? null : <View style={styles.icon}>{leadingIcon}</View>}
      <Text style={[label, { color: colors.text }]}>{children}</Text>
      {trailingIcon === undefined ? null : <View style={styles.icon}>{trailingIcon}</View>}
    </Pressable>
  );
};

export interface WorkspaceIconButtonProps {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}

export const WorkspaceIconButton = ({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: WorkspaceIconButtonProps) => {
  const { isDark } = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || undefined }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: "transparent", opacity: pressed && !disabled ? 0.7 : 1 },
        { borderColor: isDark ? theme.dark.border : theme.light.border },
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.s4,
  },
  icon: {
    marginHorizontal: spacing.s1,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
    width: MIN_TOUCH_TARGET,
  },
  large: {
    minHeight: 48,
    paddingHorizontal: spacing.s6,
  },
  medium: {
    minHeight: MIN_TOUCH_TARGET,
  },
  small: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.s3,
  },
});
