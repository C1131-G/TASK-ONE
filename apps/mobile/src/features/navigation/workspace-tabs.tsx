import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Archive,
  Bell,
  Bug,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Clock,
  Files,
  FolderOpen,
  Gauge,
  GearSix,
  House,
  ListChecks,
  Pulse,
  Scales,
  SquaresFour,
  Star,
  Tray,
  UsersThree,
} from "phosphor-react-native";
import type { ComponentType } from "react";

import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";
import { WorkspaceBottomNavigation } from "@/components/workspace/workspace-bottom-navigation";
import { isActiveHref, mobileTabs, moreGroups } from "@/features/navigation/navigation-data";
import { useSessionState } from "@/features/auth/session-gate";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

const ICONS: Record<string, ComponentType<{ color: string; size: number }>> = {
  Archive,
  Bell,
  Bug,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Clock,
  Files,
  FolderOpen,
  Gauge,
  GearSix,
  House,
  ListChecks,
  Pulse,
  Scales,
  SquaresFour,
  Star,
  Tray,
  UsersThree,
};

export const NavIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const { isDark } = useTheme();
  const Icon = ICONS[name];
  if (Icon === undefined) {
    return null;
  }
  return <Icon color={isDark ? theme.dark.text2 : theme.light.text2} size={size} />;
};

/** The workspace bottom tabs wired to the router. */
export const WorkspaceTabs = () => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <WorkspaceBottomNavigation
      activeLabel={mobileTabs.find((tab) => isActiveHref(pathname, tab.href))?.label ?? ""}
      items={mobileTabs.map((tab) => ({
        icon: <NavIcon name={tab.icon} />,
        label: tab.label,
      }))}
      onSelect={(label) => {
        const tab = mobileTabs.find((candidate) => candidate.label === label);
        if (tab !== undefined && !isActiveHref(pathname, tab.href)) {
          router.push(tab.href);
        }
      }}
    />
  );
};

export interface MoreMenuProps {
  readonly onClose: () => void;
  readonly visible: boolean;
}

/** The More sheet: every sidebar entry the role may see. */
export const MoreMenu = ({ onClose, visible }: MoreMenuProps) => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { state } = useSessionState();
  const palette = isDark ? theme.dark : theme.light;
  const role = state.kind === "authenticated" ? state.me.role : "employee";
  const pathname = usePathname();

  const navigate = (href: string): void => {
    onClose();
    if (!isActiveHref(pathname, href)) {
      router.push(href);
    }
  };

  return (
    <WorkspaceSheet onClose={onClose} title="More" visible={visible}>
      {moreGroups.map((group, groupIndex) => (
        <View key={group.label ?? `group-${groupIndex}`} style={styles.group}>
          {group.label === undefined ? null : (
            <Text style={[typeStyle("xs"), styles.groupLabel, { color: palette.text3 }]}>
              {group.label}
            </Text>
          )}
          {group.items
            .filter((item) => item.adminOnly !== true || role === "admin")
            .map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.href}
                onPress={() => navigate(item.href)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? palette.surface2 : "transparent" },
                ]}
              >
                <NavIcon name={item.icon} size={20} />
                <Text style={[typeStyle("md"), { color: palette.text, flex: 1 }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
        </View>
      ))}
    </WorkspaceSheet>
  );
};

/** The tabs plus a More entry point; screens embed this at the bottom. */
export const WorkspaceTabShell = ({ children }: { children: React.ReactNode }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View style={styles.shell}>
      <View style={styles.content}>{children}</View>
      <View style={styles.bar}>
        <WorkspaceTabs />
        <Pressable
          accessibilityLabel="More"
          accessibilityRole="button"
          onPress={() => setMoreOpen(true)}
          style={({ pressed }) => [
            styles.moreButton,
            { backgroundColor: pressed ? palette.surface2 : "transparent" },
          ]}
        >
          <GearSix color={palette.text2} size={22} />
          <Text style={[typeStyle("2xs"), { color: palette.text3 }]}>More</Text>
        </Pressable>
      </View>
      <MoreMenu onClose={() => setMoreOpen(false)} visible={moreOpen} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
  group: {
    gap: 2,
    marginBottom: spacing.s3,
  },
  groupLabel: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
    textTransform: "uppercase",
  },
  moreButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: 72,
  },
  row: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.s3,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  shell: {
    flex: 1,
  },
});
