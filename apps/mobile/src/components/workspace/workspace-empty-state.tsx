import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceEmptyStateProps {
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly children?: ReactNode;
  readonly message?: string;
  readonly title: string;
}

/** A centered empty panel with an optional call to action. */
export const WorkspaceEmptyState = ({ action, message, title }: WorkspaceEmptyStateProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View style={[styles.host, { backgroundColor: palette.surface }]}>
      <Text style={[typeStyle("lg", { weight: 600 }), { color: palette.text }]}>{title}</Text>
      {message === undefined ? null : (
        <Text style={[typeStyle("sm"), styles.message, { color: palette.text3 }]}>{message}</Text>
      )}
      {action === undefined ? null : (
        <WorkspaceButton onPress={action.onPress} size="sm" variant="secondary">
          {action.label}
        </WorkspaceButton>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    alignItems: "center",
    borderRadius: radii.lg,
    gap: spacing.s2,
    justifyContent: "center",
    minHeight: 160,
    padding: spacing.s6,
  },
  message: {
    textAlign: "center",
  },
});
