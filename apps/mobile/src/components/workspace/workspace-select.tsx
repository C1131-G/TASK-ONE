import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";
import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

export interface WorkspaceSelectProps {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value: string | null;
}

export const WorkspaceSelect = ({
  label,
  onChange,
  options,
  placeholder = "Select",
  value,
}: WorkspaceSelectProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <View>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: palette.sunken, borderColor: palette.border },
        ]}
      >
        <Text style={[typeStyle("md"), { color: selected === null ? palette.text3 : palette.text }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={{ color: palette.text3 }}>▾</Text>
      </Pressable>
      <WorkspaceSheet onClose={() => setOpen(false)} title={label} visible={open}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value }}
            key={option.value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: pressed ? palette.surface2 : "transparent" },
            ]}
          >
            <Text style={[typeStyle("md"), { color: palette.text, flex: 1 }]}>{option.label}</Text>
            {option.value === value ? (
              <Text style={{ color: palette.accent }}>✓</Text>
            ) : null}
          </Pressable>
        ))}
      </WorkspaceSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  trigger: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.s2,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
});
