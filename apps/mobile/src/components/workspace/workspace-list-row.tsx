import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceListRowProps {
  readonly accessibilityLabel?: string;
  readonly leading?: ReactNode;
  readonly onPress?: () => void;
  readonly subtitle?: string;
  readonly title: string;
  readonly trailing?: ReactNode;
}

/** A list row with title, optional subtitle and slots; 44pt minimum height. */
export const WorkspaceListRow = ({
  accessibilityLabel,
  leading,
  onPress,
  subtitle,
  title,
  trailing,
}: WorkspaceListRowProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  const body = (
    <>
      {leading === undefined ? null : <View style={styles.leading}>{leading}</View>}
      <View style={styles.titles}>
        <Text style={[typeStyle("md", { weight: 500 }), { color: palette.text }]}>{title}</Text>
        {subtitle === undefined ? null : (
          <Text style={[typeStyle("sm"), { color: palette.text3 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing === undefined ? null : <View style={styles.trailing}>{trailing}</View>}
    </>
  );

  if (onPress === undefined) {
    return (
      <View style={[styles.row, { backgroundColor: palette.surface }]}>{body}</View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? palette.surface2 : palette.surface },
      ]}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  leading: {
    marginRight: spacing.s2,
  },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    marginLeft: spacing.s2,
  },
});
