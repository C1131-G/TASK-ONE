import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { listBugs, listProjects } from "@/features/workspace/queries";
import { useApi, useApiQuery, type ApiContextValue } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";
import { Effect } from "effect";

/** The workspace home: greeting, project progress and open bugs. */
export const HomeScreen = ({ name, api }: { readonly api: ApiContextValue; readonly name: string }) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  const projectsProgram = listProjects(api);
  const bugsProgram = listBugs(api);

  const projects = useApiQuery({ program: projectsProgram, queryKey: ["projects"] });
  const bugs = useApiQuery({ program: bugsProgram, queryKey: ["bugs"] });

  return (
    <WorkspaceTabShell>
      <WorkspaceScreen title="Home">
        <Text style={[typeStyle("xl", { weight: 600 }), { color: palette.text }]}>
          Hello, {name.split(" ")[0]}
        </Text>
        <View style={styles.section}>
          <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text2 }]}>Projects</Text>
          {(projects.data?.projects ?? []).map((project) => (
            <WorkspaceListRow
              key={project.id}
              subtitle={`${project.openTasks} open · ${project.progress}%`}
              title={`${project.key} ${project.name}`}
            />
          ))}
        </View>
        <View style={styles.section}>
          <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text2 }]}>Open bugs</Text>
          {(bugs.data?.bugs ?? []).slice(0, 3).map((bug) => (
            <WorkspaceListRow key={bug.id} subtitle={bug.status} title={bug.title} />
          ))}
        </View>
      </WorkspaceScreen>
    </WorkspaceTabShell>
  );
};

/** The bugs list. */
export const BugsScreen = () => {
  const api = useApi();
  const bugs = useApiQuery({
    enabled: api !== null,
    program:
      api === null
        ? Effect.succeed({ bugs: [] })
        : Effect.map(listBugs(api), (page) => ({ bugs: [...page.bugs] })),
    queryKey: ["bugs"],
  });

  return (
    <WorkspaceTabShell>
      <WorkspaceScreen title="Bugs">
        {(bugs.data?.bugs ?? []).map((bug) => (
          <WorkspaceListRow
            key={bug.id}
            subtitle={`${bug.reference} · ${bug.priority}`}
            title={bug.title}
          />
        ))}
      </WorkspaceScreen>
    </WorkspaceTabShell>
  );
};

/** The projects list. */
export const ProjectsScreen = () => {
  const api = useApi();
  const projects = useApiQuery({
    enabled: api !== null,
    program:
      api === null
        ? Effect.succeed({ projects: [] })
        : Effect.map(listProjects(api), (page) => ({ projects: [...page.projects] })),
    queryKey: ["projects"],
  });

  return (
    <WorkspaceTabShell>
      <WorkspaceScreen title="Projects">
        {(projects.data?.projects ?? []).map((project) => (
          <WorkspaceListRow
            key={project.id}
            subtitle={`${project.openTasks} open tasks · ${project.progress}%`}
            title={`${project.key} ${project.name}`}
          />
        ))}
      </WorkspaceScreen>
    </WorkspaceTabShell>
  );
};

const THEME_MODES = ["system", "light", "dark"] as const;

/** The settings screen: live theme controls through ThemePreferences. */
export const SettingsScreen = ({
  onOpenNotifications,
  onSignOut,
}: {
  readonly onOpenNotifications?: () => void;
  readonly onSignOut: () => void;
}) => {
  const { isDark, mode, setMode } = useTheme();
  const [picked, setPicked] = useState(mode);
  const { accent } = useTheme();

  useEffect(() => {
    setPicked(mode);
  }, [mode]);

  return (
    <WorkspaceTabShell>
      <WorkspaceScreen title="Settings">
        <View style={styles.section}>
          <Text style={[typeStyle("sm", { weight: 500 }), { color: theme.light.text2 }]}>
            Appearance
          </Text>
          {THEME_MODES.map((candidate) => (
            <Pressable
              accessibilityLabel={`Theme ${candidate}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked === candidate }}
              key={candidate}
              onPress={() => setMode(candidate)}
              style={styles.radioRow}
            >
              <Text style={[typeStyle("md"), { color: theme.light.text }]}>{candidate}</Text>
              {picked === candidate ? <Text>✓</Text> : null}
            </Pressable>
          ))}
          <Text style={[typeStyle("xs"), { color: theme.light.text3 }]}>
            Effective theme: {isDark ? "dark" : "light"} · accent {accent}
          </Text>
        </View>
        {onOpenNotifications === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenNotifications}
            style={styles.radioRow}
          >
            <Text style={[typeStyle("md"), { color: theme.light.text }]}>Notifications</Text>
            <Text>›</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
          <Text style={{ color: theme.light.red }}>Sign out</Text>
        </Pressable>
      </WorkspaceScreen>
    </WorkspaceTabShell>
  );
};

const styles = StyleSheet.create({
  radioRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.s2,
  },
  section: {
    gap: spacing.s1,
    paddingTop: spacing.s2,
  },
  signOut: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.s4,
    minHeight: 44,
  },
});
