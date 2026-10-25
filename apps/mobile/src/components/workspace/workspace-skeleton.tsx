import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { radii, theme } from "@/theme/tokens.generated";

export interface WorkspaceSkeletonProps {
  readonly height?: number;
  readonly rounded?: boolean;
  readonly variant?: "line" | "panel";
  readonly width?: number | `${number}%`;
}

/** A shimmering placeholder shape; the panel variant stacks several rows. */
export const WorkspaceSkeleton = ({
  height,
  rounded = false,
  variant = "line",
  width,
}: WorkspaceSkeletonProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const shape = {
    backgroundColor: palette.surface3,
    borderRadius: rounded ? radii.full : radii.md,
    height: height ?? (variant === "panel" ? 56 : 14),
    width: width ?? (variant === "panel" ? "100%" : "60%"),
  } as const;

  if (variant === "line") {
    return (
      <View style={[styles.shape, shape]} testID="skeleton-shape" />
    );
  }

  return (
    <View style={styles.panel}>
      <View style={[styles.shape, shape]} testID="skeleton-shape" />
      <View style={[styles.shape, { ...shape, width: "80%" }]} testID="skeleton-shape" />
      <View style={[styles.shape, { ...shape, width: "45%", height: 14 }]} testID="skeleton-shape" />
      <View style={[styles.shape, { ...shape, width: "45%", height: 14 }]} testID="skeleton-shape" />
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    gap: 10,
  },
  shape: {
    opacity: 0.7,
  },
});
