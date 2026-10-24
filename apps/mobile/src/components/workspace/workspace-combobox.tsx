import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface ComboboxOption {
  readonly label: string;
  readonly value: string;
}

export interface WorkspaceComboboxProps {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly ComboboxOption[];
  readonly placeholder?: string;
  readonly value: string | null;
}

export const WorkspaceCombobox = ({
  label,
  onChange,
  options,
  placeholder = "Search",
  value,
}: WorkspaceComboboxProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const visible = options.filter((option) =>
    option.label.toLowerCase().includes(filter.toLowerCase()),
  );

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
        <WorkspaceTextInput
          accessibilityLabel={`Filter ${label}`}
          onChangeText={setFilter}
          placeholder={placeholder}
          value={filter}
        />
        {visible.map((option) => (
          <Pressable
            accessibilityRole="option"
            key={option.value}
            onPress={() => {
              onChange(option.value);
              setFilter("");
              setOpen(false);
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: pressed ? palette.surface2 : "transparent" },
            ]}
          >
            <Text style={[typeStyle("md"), { color: palette.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </WorkspaceSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  option: {
    borderRadius: radii.md,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
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
