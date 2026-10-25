import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { theme } from "@/theme/tokens.generated";

export interface BottomTab {
  readonly badge?: number;
  readonly icon: ReactNode;
  readonly label: string;
}

export interface WorkspaceBottomNavigationProps {
  readonly activeLabel: string;
  readonly items: readonly BottomTab[];
  readonly onSelect: (label: string) => void;
}

const MIN_TOUCH_TARGET = 48;

/** The bottom tab bar; each tab carries an icon, a label and an optional badge. */
export const WorkspaceBottomNavigation = ({
  activeLabel,
  items,
  onSelect,
}: WorkspaceBottomNavigationProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.host,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
      ]}
    >
      {items.map((item) => {
        const active = item.label === activeLabel;
        return (
          <Pressable
            accessible
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.label}
            onPress={() => onSelect(item.label)}
            style={({ pressed }) => [
              styles.tab,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.iconStack}>
              {item.icon}
              {item.badge === undefined || item.badge === 0 ? null : (
                <View
                  accessibilityLabel={`${item.badge} unread`}
                  style={[styles.badge, { backgroundColor: palette.red }]}
                >
                  <Text style={[typeStyle("2xs"), { color: palette.onAccent }]}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                typeStyle("2xs" as never, { weight: active ? 600 : 400 }),
                { color: active ? palette.accent : palette.text3 },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 3,
    position: "absolute",
    right: -6,
    top: -4,
  },
  host: {
    borderTopWidth: 1,
    flexDirection: "row",
  },
  iconStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 6,
  },
});
