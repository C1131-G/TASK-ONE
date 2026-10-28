import { Effect } from "effect";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { createPortalBug, listPortalBugs, listPortalProjects } from "@/features/portal/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

/** The client portal home: their projects and reported bugs. */
export const PortalHomeScreen = () => {
  const api = useApi();
  const projects = useApiQuery({
    enabled: api !== null,
    program:
      api === null
        ? Effect.succeed({ projects: [] })
        : Effect.map(listPortalProjects(api), (page) => ({ projects: [...page.projects] })),
    queryKey: ["portal", "projects"],
  });
  const bugs = useApiQuery({
    enabled: api !== null,
    program:
      api === null
        ? Effect.succeed({ bugs: [] })
        : Effect.map(listPortalBugs(api), (page) => ({ bugs: [...page.bugs] })),
    queryKey: ["portal", "bugs"],
  });

  return (
    <WorkspaceScreen title="Portal">
      <Text style={[typeStyle("md", { weight: 600 }), { color: theme.light.text2 }]}>Projects</Text>
      {(projects.data?.projects ?? []).map((project) => (
        <WorkspaceListRow
          key={project.id}
          subtitle={project.key}
          title={`${project.key} ${project.name}`}
        />
      ))}
      <Text style={[typeStyle("md", { weight: 600 }), { color: theme.light.text2 }]}>Your bugs</Text>
      {(bugs.data?.bugs ?? []).map((bug) => (
        <WorkspaceListRow key={bug.id} subtitle={bug.status} title={bug.title} />
      ))}
      {(bugs.data?.bugs ?? []).length === 0 ? (
        <WorkspaceEmptyState message="Report a problem and it lands here." title="No reports" />
      ) : null}
    </WorkspaceScreen>
  );
};

/** The report-a-bug form: title, project and description. */
export const PortalNewBugScreen = ({ onDone }: { readonly onDone: () => void }) => {
  const api = useApi();
  const keys = useKeys();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    if (api === null || keys === null) {
      return;
    }
    if (title.trim().length < 4) {
      setError("Give the problem a short title");
      return;
    }
    if (description.trim().length < 10) {
      setError("Describe what happened in a sentence or two");
      return;
    }
    setError(null);
    void Effect.runPromiseExit(
      Effect.andThen(
        keys.run("portal-new-bug", (key) =>
          createPortalBug(api, key, {
            description: description.trim(),
            projectId: "proj-1",
            title: title.trim(),
          }),
        ),
        Effect.sync(() => {
          queryClient.invalidateQueries({ queryKey: ["portal", "bugs"] });
          onDone();
        }),
      ),
    );
  };

  return (
    <WorkspaceScreen title="Report a problem">
      <View style={styles.form}>
        <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>Title</Text>
        <InputRow onChange={setTitle} value={title} />
        <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>What happened</Text>
        <InputRow multiline onChange={setDescription} value={description} />
        {error === null ? null : (
          <Text accessible accessibilityRole="alert" style={{ color: palette.red }}>
            {error}
          </Text>
        )}
        <Pressable accessibilityRole="button" onPress={submit} style={styles.submit}>
          <Text style={{ color: palette.onAccent }}>Send report</Text>
        </Pressable>
      </View>
    </WorkspaceScreen>
  );
};

const InputRow = (props: {
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) => (
  <TextInput
    accessibilityLabel={props.multiline === true ? "What happened" : "Title"}
    multiline={props.multiline === true}
    onChangeText={props.onChange}
    style={styles.input}
    value={props.value}
  />
);

const styles = StyleSheet.create({
  form: {
    gap: spacing.s2,
  },
  input: {
    borderColor: "#e9e7e2",
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  submit: {
    alignItems: "center",
    backgroundColor: "#4b5bd6",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
  },
});
