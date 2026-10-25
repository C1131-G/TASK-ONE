import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, shadows, spacing, theme } from "@/theme/tokens.generated";

export interface CreateAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface WorkspaceCreateMenuProps {
  readonly actions: readonly CreateAction[];
}

/** The floating create button; opens a sheet of actions. */
export const WorkspaceCreateMenu = ({ actions }: WorkspaceCreateMenuProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel="Create"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[typeStyle("2xl", { weight: 500 }), { color: palette.onAccent }]}>+</Text>
      </Pressable>
      <WorkspaceSheet onClose={() => setOpen(false)} title="Create" visible={open}>
        {actions.map((action) => (
          <Pressable
            accessibilityRole="button"
            key={action.label}
            onPress={() => {
              setOpen(false);
              action.onPress();
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: pressed ? palette.surface2 : "transparent" },
            ]}
          >
            <Text style={[typeStyle("md"), { color: palette.text }]}>{action.label}</Text>
          </Pressable>
        ))}
      </WorkspaceSheet>
    </>
  );
};

export interface WorkspaceAccountMenuProps {
  readonly email: string;
  readonly name: string;
  readonly onClose: () => void;
  readonly onSignOut: () => void;
  readonly visible: boolean;
}

/** The account sheet: identity header plus a sign-out action. */
export const WorkspaceAccountMenu = ({
  email,
  name,
  onClose,
  onSignOut,
  visible,
}: WorkspaceAccountMenuProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <WorkspaceSheet onClose={onClose} title="Account" visible={visible}>
      <View style={styles.identity}>
        <Text style={[typeStyle("md", { weight: 600 }), { color: palette.text }]}>{name}</Text>
        <Text style={[typeStyle("sm"), { color: palette.text3 }]}>{email}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onClose();
          onSignOut();
        }}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: pressed ? palette.surface2 : "transparent" },
        ]}
      >
        <Text style={[typeStyle("md", { weight: 500 }), { color: palette.red }]}>Sign out</Text>
      </Pressable>
    </WorkspaceSheet>
  );
};

export interface WorkspaceSearchPaletteProps {
  readonly children: ReactNode;
  readonly input: ReactNode;
  readonly onClose: () => void;
  readonly visible: boolean;
}

/** The full-height search overlay; the screen supplies the input and results. */
export const WorkspaceSearchPalette = ({
  children,
  input,
  onClose,
  visible,
}: WorkspaceSearchPaletteProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  if (!visible) {
    return null;
  }

  return (
    <View accessibilityViewIsModal style={styles.paletteHost}>
      <Pressable
        accessibilityLabel="Close search"
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: palette.overlay }]}
        testID="search-overlay"
      />
      <View style={[styles.palettePanel, { backgroundColor: palette.surface }]}>
        <View style={styles.searchRow}>
          {input}
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={{ color: palette.text3 }}>Cancel</Text>
          </Pressable>
        </View>
        <View style={styles.results}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  action: {
    borderRadius: radii.md,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.s3,
  },
  fab: {
    alignItems: "center",
    borderRadius: radii.full,
    bottom: 84,
    boxShadow: shadows.light.pop,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    width: 56,
  },
  identity: {
    gap: 2,
    paddingBottom: spacing.s2,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  paletteHost: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 30,
  },
  palettePanel: {
    flex: 1,
    paddingTop: spacing.s4,
    paddingHorizontal: spacing.s4,
  },
  results: {
    flex: 1,
    marginTop: spacing.s3,
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.s3,
  },
});
