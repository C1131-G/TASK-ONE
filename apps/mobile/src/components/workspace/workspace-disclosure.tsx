import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceDisclosureProps {
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly header: string;
}

/** An expandable section; the header carries the expanded accessibility state. */
export const WorkspaceDisclosure = ({
  children,
  defaultOpen = false,
  header,
}: WorkspaceDisclosureProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View>
      <Pressable
        accessibilityLabel={header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.header,
          { backgroundColor: pressed ? palette.surface2 : palette.surface },
        ]}
      >
        <Text style={[typeStyle("md", { weight: 500 }), { color: palette.text, flex: 1 }]}>
          {header}
        </Text>
        <Text style={{ color: palette.text3 }}>{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  header: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.s2,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
});
