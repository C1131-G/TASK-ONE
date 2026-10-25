import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, shadows, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceModalProps {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly title: string;
  readonly visible: boolean;
}

/** A centered dialog; closes on overlay press. */
export const WorkspaceModal = ({ children, onClose, title, visible }: WorkspaceModalProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  if (!visible) {
    return null;
  }

  return (
    <View accessibilityViewIsModal style={styles.host}>
      <Pressable
        accessibilityLabel="Close dialog"
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: palette.overlay }]}
        testID="modal-overlay"
      />
      <View
        accessible
        accessibilityLabel={title}
        accessibilityRole="dialog"
        style={[
          styles.panel,
          {
            backgroundColor: palette.surface,
            boxShadow: (isDark ? shadows.dark : shadows.light).pop,
          },
        ]}
      >
        <Text style={[typeStyle("lg", { weight: 600 }), styles.title, { color: palette.text }]}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
};

export interface WorkspaceConfirmDialogProps {
  readonly cancelLabel?: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly visible: boolean;
}

export const WorkspaceConfirmDialog = ({
  cancelLabel = "Cancel",
  confirmLabel,
  destructive = false,
  message,
  onCancel,
  onConfirm,
  title,
  visible,
}: WorkspaceConfirmDialogProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <WorkspaceModal onClose={onCancel} title={title} visible={visible}>
      <Text style={[typeStyle("md"), styles.message, { color: palette.text2 }]}>{message}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
          <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>
            {cancelLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onConfirm}
          style={[
            styles.button,
            { backgroundColor: destructive ? palette.red : palette.accent },
          ]}
        >
          <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.onAccent }]}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </WorkspaceModal>
  );
};

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.s2,
    justifyContent: "flex-end",
    marginTop: spacing.s4,
  },
  button: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.s4,
  },
  host: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  message: {
    marginTop: spacing.s2,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  panel: {
    alignSelf: "center",
    borderRadius: radii.xl,
    marginTop: "30%",
    maxWidth: 420,
    padding: spacing.s4,
    width: "88%",
  },
  title: {
    marginBottom: 0,
  },
});
