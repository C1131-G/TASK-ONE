import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceFieldProps {
  readonly children: ReactNode;
  readonly hint?: string;
  readonly label: string;
}

const cloneChildWithLabel = (child: ReactNode, label: string): ReactNode => {
  if (!isValidElement(child)) {
    return child;
  }
  const props = child.props as { readonly accessibilityLabel?: string };
  return cloneElement(child as ReactElement<{ accessibilityLabel?: string }>, {
    accessibilityLabel: props.accessibilityLabel ?? label,
  });
};

/** Labels the wrapped input through its accessibility label. */
export const WorkspaceField = ({ children, hint, label }: WorkspaceFieldProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View style={styles.stack}>
      <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>{label}</Text>
      {cloneChildWithLabel(children, label)}
      {hint === undefined ? null : (
        <Text style={[typeStyle("xs"), { color: palette.text3 }]}>{hint}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: spacing.s1,
  },
});
