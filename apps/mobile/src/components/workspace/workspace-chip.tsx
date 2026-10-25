import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export type ChipColor = "amber" | "accent" | "gray" | "green" | "red";

export interface WorkspaceChipProps {
  readonly color?: ChipColor;
  readonly label: string;
  readonly onRemove?: () => void;
  readonly selected?: boolean;
}

export const WorkspaceChip = ({ color = "gray", label, onRemove, selected = false }: WorkspaceChipProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const strong = { accent: palette.accent, amber: palette.amber, gray: palette.gray, green: palette.green, red: palette.red }[color];

  return (
    <View
      accessibilityState={{ selected: selected || undefined }}
      accessibilityRole={onRemove === undefined ? "text" : undefined}
      style={[
        styles.chip,
        selected ? { backgroundColor: strong } : { backgroundColor: palette.surface3 },
      ]}
    >
      <Text
        style={[
          typeStyle("xs", { weight: 500 }),
          { color: selected ? palette.onAccent : palette.text2 },
        ]}
      >
        {label}
      </Text>
      {onRemove === undefined ? null : (
        <Pressable
          accessibilityLabel={`Remove ${label}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
        >
          <Text style={{ color: selected ? palette.onAccent : palette.text3 }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.full,
    flexDirection: "row",
    gap: spacing.s1,
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s1,
  },
});
