import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, shadows, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceUndoToastProps {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
  readonly onClose: () => void;
  readonly visible: boolean;
}

/** A bottom toast with an optional undo action; screens own the timer. */
export const WorkspaceUndoToast = ({
  actionLabel = "Undo",
  message,
  onAction,
  onClose,
  visible,
}: WorkspaceUndoToastProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: isDark ? theme.dark.surface3 : theme.light.text,
          boxShadow: (isDark ? shadows.dark : shadows.light).pop,
        },
      ]}
    >
      <Text
        style={[typeStyle("sm"), { color: isDark ? theme.dark.text : theme.light.textInv, flex: 1 }]}
      >
        {message}
      </Text>
      {onAction === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            style={[
              typeStyle("sm", { weight: 600 }),
              { color: isDark ? theme.dark.accent : theme.light.accent },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
      <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" hitSlop={8} onPress={onClose}>
        <Text style={{ color: isDark ? theme.dark.text3 : theme.light.textInv }}>✕</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radii.lg,
    bottom: 24,
    flexDirection: "row",
    gap: spacing.s3,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    position: "absolute",
    width: "92%",
  },
});
