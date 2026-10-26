import { Effect } from "effect";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceChip } from "@/components/workspace/workspace-chip";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import type { AppFailure } from "@/errors";
import { listPortalBugs, listPortalProjects, submitPortalBug } from "@/features/portal/queries";
import {
  draftToReport,
  EMPTY_REPORT_DRAFT,
  REPORT_IMPACTS,
  type ReportDraft,
} from "@/features/portal/report-form";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

/** The client portal home: their projects and reported bugs. */
export const PortalHomeScreen = () => {
  const api = useApi();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
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
      api === null ? Effect.succeed([]) : Effect.map(listPortalBugs(api), (rows) => [...rows]),
    queryKey: ["portal", "bugs"],
  });
  const reports = bugs.data ?? [];

  return (
    <WorkspaceScreen title="Portal">
      <Text style={[typeStyle("md", { weight: 600 }), { color: palette.text2 }]}>Projects</Text>
      {(projects.data?.projects ?? []).map((project) => (
        <WorkspaceListRow
          key={project.id}
          subtitle={`${project.openTasks} open · ${project.progress}%`}
          title={`${project.key} ${project.name}`}
        />
      ))}
      <Text style={[typeStyle("md", { weight: 600 }), { color: palette.text2 }]}>Your bugs</Text>
      {reports.map((bug) => (
        <WorkspaceListRow key={bug.id} subtitle={bug.status} title={bug.title} />
      ))}
      {reports.length === 0 ? (
        <WorkspaceEmptyState message="Report a problem and it lands here." title="No reports" />
      ) : null}
    </WorkspaceScreen>
  );
};

/** The report-a-bug form: what the client saw, where, and how bad it is. */
export const PortalNewBugScreen = ({ onDone }: { readonly onDone: () => void }) => {
  const api = useApi();
  const keys = useKeys();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_REPORT_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<AppFailure | null>(null);

  const projects = useApiQuery({
    enabled: api !== null,
    program:
      api === null
        ? Effect.succeed({ projects: [] })
        : Effect.map(listPortalProjects(api), (page) => ({ projects: [...page.projects] })),
    queryKey: ["portal", "projects"],
  });
  const choices = projects.data?.projects ?? [];
  // A client with a single project never has to pick it.
  const onlyProject = choices.length === 1 ? (choices[0]?.id ?? "") : "";
  const projectId = draft.projectId.length > 0 ? draft.projectId : onlyProject;

  const change = (patch: Partial<ReportDraft>): void => setDraft((previous) => ({ ...previous, ...patch }));

  const submit = (): void => {
    if (api === null || keys === null) {
      return;
    }
    const result = draftToReport({ ...draft, projectId });
    setFailure(null);
    if (!result.ok) {
      setProblem(Object.values(result.fieldErrors)[0] ?? "Check the form");
      return;
    }
    setProblem(null);
    void Effect.runPromise(
      Effect.matchEffect(
        keys.run("portal-new-bug", (key) => submitPortalBug(api, key, result.body)),
        {
          onFailure: (error) => Effect.sync(() => setFailure(error)),
          onSuccess: () =>
            Effect.sync(() => {
              void queryClient.invalidateQueries({ queryKey: ["portal", "bugs"] });
              onDone();
            }),
        },
      ),
    );
  };

  return (
    <WorkspaceScreen title="Report a problem">
      <View style={styles.form}>
        <Field
          label="Title"
          onChange={(title) => change({ title })}
          value={draft.title}
        />
        <Field
          label="What you expected"
          multiline
          onChange={(expected) => change({ expected })}
          value={draft.expected}
        />
        <Field
          label="What happened"
          multiline
          onChange={(actual) => change({ actual })}
          value={draft.actual}
        />
        <Field
          label="Steps to reproduce, one per line"
          multiline
          onChange={(steps) => change({ steps })}
          value={draft.steps}
        />
        <Field
          label="Page address"
          onChange={(pageUrl) => change({ pageUrl })}
          value={draft.pageUrl}
        />
        <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>Impact</Text>
        <View style={styles.choices}>
          {REPORT_IMPACTS.map((impact) => (
            <Pressable
              accessibilityLabel={`Impact ${impact}`}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.impact === impact }}
              key={impact}
              onPress={() => change({ impact })}
            >
              <WorkspaceChip color="gray" label={impact} selected={draft.impact === impact} />
            </Pressable>
          ))}
        </View>
        <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>Project</Text>
        <View style={styles.choices}>
          {choices.map((project) => (
            <Pressable
              accessibilityLabel={`Project ${project.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: projectId === project.id }}
              key={project.id}
              onPress={() => change({ projectId: project.id })}
            >
              <WorkspaceChip color="gray" label={project.name} selected={projectId === project.id} />
            </Pressable>
          ))}
        </View>
        {problem === null ? null : (
          <Text accessible accessibilityRole="alert" style={{ color: palette.red }}>
            {problem}
          </Text>
        )}
        {failure === null ? null : <WorkspaceErrorState failure={failure} />}
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={[styles.submit, { backgroundColor: palette.accent }]}
        >
          <Text style={{ color: palette.onAccent }}>Send report</Text>
        </Pressable>
      </View>
    </WorkspaceScreen>
  );
};

const Field = (props: {
  readonly label: string;
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View style={styles.field}>
      <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        multiline={props.multiline === true}
        onChangeText={props.onChange}
        style={[
          styles.input,
          props.multiline === true && styles.multiline,
          { borderColor: palette.border, color: palette.text },
        ]}
        value={props.value}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  field: {
    gap: spacing.s1,
  },
  form: {
    gap: spacing.s3,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  multiline: {
    minHeight: 88,
    paddingTop: spacing.s2,
    textAlignVertical: "top",
  },
  submit: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
  },
});
