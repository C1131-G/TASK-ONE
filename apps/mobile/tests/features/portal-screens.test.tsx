import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect } from "effect";
import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";

import { ValidationFailed } from "@/errors";
import { PortalHomeScreen, PortalNewBugScreen } from "@/features/portal/portal-screens";
import type { ApiContextValue } from "@/runtime/api-hooks";
import { ThemeContext } from "@/theme/theme-provider";

const noop = (): void => undefined;

const renderPortal = async (ui: ReactElement, api: ApiContextValue): Promise<void> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  await render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        ThemeContext.Provider,
        {
          value: {
            accent: "default",
            density: "regular",
            isDark: false,
            mode: "light",
            setAccent: noop,
            setDensity: noop,
            setMode: noop,
          },
        },
        createElement(ApiProviderShim, { api, children: ui }),
      ),
    ),
  );
};

import { ApiContext, KeysContext, type KeysContextValue } from "@/runtime/api-hooks";

const keysStub: KeysContextValue = {
  forget: () => Effect.void,
  run: (_intent, program) => program("key-1234567890"),
};

const ApiProviderShim = ({
  api,
  children,
}: {
  readonly api: ApiContextValue;
  readonly children: ReactNode;
}) =>
  createElement(
    KeysContext.Provider,
    { value: keysStub },
    createElement(ApiContext.Provider, { value: api, children }),
  );

const PROJECT = "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c05";

interface ServedProject {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly openTasks: number;
  readonly progress: number;
}

const apiServing = (
  data: {
    readonly bugs?: readonly { readonly id: string; readonly status: string; readonly title: string }[];
    readonly projects?: readonly ServedProject[];
  },
  submitted: unknown[] = [],
): ApiContextValue =>
  ({
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            listPortalBugs: () => Promise.resolve(data.bugs ?? []),
            listPortalProjects: () => Promise.resolve({ projects: data.projects ?? [] }),
            submitPortalBug: (input: unknown) => {
              submitted.push(input);
              return Promise.resolve({ bugId: "bug-new", version: 1 });
            },
          }),
      }),
  }) as unknown as ApiContextValue;

const WEBSITE: ServedProject = {
  id: PROJECT,
  key: "WEB",
  name: "Website relaunch",
  openTasks: 4,
  progress: 62,
};

it("lists the portal projects and bugs", async () => {
  await renderPortal(
    <PortalHomeScreen />,
    apiServing({
      bugs: [{ id: "bug-1", status: "acknowledged", title: "Login rejects valid passwords" }],
      projects: [WEBSITE],
    }),
  );

  await waitFor(() => expect(screen.getByText("Login rejects valid passwords")).toBeTruthy());
  expect(screen.getByText("Your bugs")).toBeTruthy();
});

it("asks for the missing report fields before submitting", async () => {
  const submitted: unknown[] = [];
  const user = userEvent.setup();
  await renderPortal(
    <PortalNewBugScreen onDone={() => submitted.push("done")} />,
    apiServing({ projects: [WEBSITE] }, submitted),
  );

  await user.type(screen.getByLabelText("Title"), "No");
  await user.press(screen.getByRole("button", { name: "Send report" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(submitted).toEqual([]);
});

it("sends a complete report for the only project", async () => {
  const submitted: unknown[] = [];
  const user = userEvent.setup();
  await renderPortal(
    <PortalNewBugScreen onDone={() => submitted.push("done")} />,
    apiServing({ projects: [WEBSITE] }, submitted),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Project Website relaunch" })).toBeTruthy());

  await user.type(screen.getByLabelText("Title"), "Dashboard never loads");
  await user.type(screen.getByLabelText("What you expected"), "The dashboard opens");
  await user.type(screen.getByLabelText("What happened"), "A spinner forever");
  await user.type(screen.getByLabelText("Steps to reproduce, one per line"), "Sign in");
  await user.type(screen.getByLabelText("Page address"), "https://app.example.com/dashboard");
  await user.press(screen.getByRole("button", { name: "Impact urgent" }));
  await user.press(screen.getByRole("button", { name: "Send report" }));

  await waitFor(() => expect(submitted.length).toBe(2));
  expect(submitted[0]).toMatchObject({
    body: {
      actualBehavior: "A spinner forever",
      expectedBehavior: "The dashboard opens",
      impact: "urgent",
      pageUrl: "https://app.example.com/dashboard",
      projectId: PROJECT,
      reproductionSteps: ["Sign in"],
      title: "Dashboard never loads",
    },
    idempotencyKey: "key-1234567890",
  });
  expect(submitted[1]).toBe("done");
});

it("makes the client choose when there are several projects", async () => {
  const submitted: unknown[] = [];
  const user = userEvent.setup();
  await renderPortal(
    <PortalNewBugScreen onDone={() => submitted.push("done")} />,
    apiServing(
      { projects: [WEBSITE, { ...WEBSITE, id: "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c06", name: "Mobile app" }] },
      submitted,
    ),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Project Mobile app" })).toBeTruthy());

  await user.type(screen.getByLabelText("Title"), "Dashboard never loads");
  await user.type(screen.getByLabelText("What you expected"), "The dashboard opens");
  await user.type(screen.getByLabelText("What happened"), "A spinner forever");
  await user.type(screen.getByLabelText("Steps to reproduce, one per line"), "Sign in");
  await user.type(screen.getByLabelText("Page address"), "https://app.example.com/dashboard");
  await user.press(screen.getByRole("button", { name: "Send report" }));

  await waitFor(() => expect(screen.getByText("Choose a project")).toBeTruthy());
  expect(submitted).toEqual([]);
});