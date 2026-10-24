import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

const MIN_TOUCH_TARGET = 44;

export interface WorkspaceSwitchProps {
  readonly label: string;
  readonly onValueChange: (value: boolean) => void;
  readonly value: boolean;
}

export const WorkspaceSwitch = ({ label, onValueChange, value }: WorkspaceSwitchProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View style={[styles.row, { backgroundColor: palette.surface }]}>
      <Text style={[typeStyle("md"), { color: palette.text, flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        onValueChange={onValueChange}
        trackColor={{ false: palette.surface3, true: palette.accent }}
        value={value}
      />
    </View>
  );
};

export interface WorkspaceCheckboxProps {
  readonly checked: boolean;
  readonly label: string;
  readonly onToggle: (next: boolean) => void;
}

export const WorkspaceCheckbox = ({ checked, label, onToggle }: WorkspaceCheckboxProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: palette.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? palette.accent : palette.borderStrong },
          checked ? { backgroundColor: palette.accent } : null,
        ]}
      >
        {checked ? <Text style={{ color: palette.onAccent }}>✓</Text> : null}
      </View>
      <Text style={[typeStyle("md"), { color: palette.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.s3,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
});
