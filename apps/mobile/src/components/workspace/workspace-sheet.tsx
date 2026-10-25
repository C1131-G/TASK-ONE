import { useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceIconButton } from "@/components/workspace/workspace-button";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceSheetProps {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly title: string;
  readonly visible: boolean;
}

/** A slide-up sheet used by pickers and dialogs; closes on overlay press or Android back. */
export const WorkspaceSheet = ({ children, onClose, title, visible }: WorkspaceSheetProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <View accessibilityViewIsModal style={styles.host}>
      <Pressable
        accessibilityLabel="Close sheet"
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: palette.overlay }]}
        testID="sheet-overlay"
      />
      <View style={[styles.panel, { backgroundColor: palette.surface }]}>
        <View style={styles.header}>
          <Text style={[typeStyle("lg", { weight: 600 }), { color: palette.text, flex: 1 }]}>
            {title}
          </Text>
          <WorkspaceIconButton accessibilityLabel="Close" onPress={onClose}>
            <Text style={{ color: palette.text }}>✕</Text>
          </WorkspaceIconButton>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  body: {
    maxHeight: 420,
    paddingBottom: spacing.s6,
    paddingHorizontal: spacing.s4,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.s2,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  host: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 10,
  },
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    minHeight: 160,
  },
});
