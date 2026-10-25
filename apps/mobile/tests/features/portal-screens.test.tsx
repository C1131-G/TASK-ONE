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
    defaultOptions: { queries: { retry: false } },
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

const apiServing = (data: {
  readonly bugs?: readonly { readonly id: string; readonly status: string; readonly title: string }[];
  readonly projects?: readonly { readonly id: string }[];
}): ApiContextValue =>
  ({
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            listPortalBugs: () => Promise.resolve({ bugs: data.bugs ?? [] }),
            listPortalProjects: () => Promise.resolve({ projects: data.projects ?? [] }),
          }),
      }),
  }) as unknown as ApiContextValue;

it("lists the portal projects and bugs", async () => {
  await renderPortal(
    <PortalHomeScreen />,
    apiServing({
      bugs: [{ id: "bug-1", status: "open", title: "Login rejects valid passwords" }],
      projects: [{ id: "proj-1" }],
    }),
  );

  await waitFor(() => expect(screen.getByText("Login rejects valid passwords")).toBeTruthy());
  expect(screen.getByText("Your bugs")).toBeTruthy();
});

it("validates the report form before submitting", async () => {
  const submitted: string[] = [];
  const api = {
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            createPortalBug: (input: { readonly body: { readonly title: string } }) => {
              submitted.push(input.body.title);
              return Promise.resolve({ id: "bug-new" });
            },
          }),
      }),
  } as unknown as ApiContextValue;

  const user = userEvent.setup();
  await renderPortal(<PortalNewBugScreen onDone={() => submitted.push("done")} />, api);

  await user.type(screen.getByLabelText("Title"), "No");
  await user.press(screen.getByRole("button", { name: "Send report" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(submitted).toEqual([]);
});
