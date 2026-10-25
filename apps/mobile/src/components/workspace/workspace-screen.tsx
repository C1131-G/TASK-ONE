import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceScreenProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly toolbar?: ReactNode;
}

/** The page frame: safe area, optional title header and content padding. */
export const WorkspaceScreen = ({ children, title, toolbar }: WorkspaceScreenProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <SafeAreaView style={[styles.host, { backgroundColor: palette.bg }]} edges={["top"]}>
      {title === undefined ? null : (
        <Text
          accessibilityRole="header"
          style={[typeStyle("xl", { weight: 600 }), styles.title, { color: palette.text }]}
        >
          {title}
        </Text>
      )}
      {toolbar === undefined ? null : <View style={styles.toolbar}>{toolbar}</View>}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.s4,
  },
  host: {
    flex: 1,
  },
  title: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s3,
  },
  toolbar: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s2,
  },
});
