import { StyleSheet, Text, View } from "react-native";

import { Match } from "effect";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { type AppFailure } from "@/errors";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceErrorStateProps {
  readonly failure: AppFailure;
  readonly onRetry?: () => void;
}

/** Renders a tag-specific message for any AppFailure, with optional retry. */
export const WorkspaceErrorState = ({ failure, onRetry }: WorkspaceErrorStateProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const message = Match.valueTags(failure, {
    Unauthenticated: () => "Your session ended. Sign in again.",
    Forbidden: () => "You do not have permission to do that.",
    NotFound: () => "This item no longer exists.",
    ValidationFailed: (error) =>
      Object.values(error.fieldErrors)[0] ?? "Some details need fixing.",
    Conflict: () => "Someone else changed this item. Reload to continue.",
    RateLimited: () => "Too many attempts. Wait a moment and retry.",
    Unavailable: () => "The service is temporarily unavailable. Try again.",
    Offline: () => "You appear to be offline. Reconnect and retry.",
    StorageFailure: () => "This device could not save the change.",
    DecodeFailure: () => "The server sent data this app cannot read.",
  });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.host, { backgroundColor: palette.surface }]}
    >
      <Text style={[typeStyle("md"), styles.message, { color: palette.text }]}>{message}</Text>
      {onRetry === undefined ? null : (
        <WorkspaceButton onPress={onRetry} size="sm" variant="secondary">
          Try again
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
    padding: spacing.s4,
  },
  message: {
    textAlign: "center",
  },
});
