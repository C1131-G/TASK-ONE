import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/e2e-push-flow";
const ENABLE_BUTTON = "Enable notifications";

// Headless Chromium cannot reach a real push service, so the browser side of
// the subscription is replaced. The server action, its endpoint validation and
// the control's messages still run for real.
const stubBrowserPush = async (
  page: Page,
  permission: "denied" | "granted"
): Promise<void> => {
  await page.addInitScript(
    ({ endpoint, result }) => {
      Object.defineProperty(Notification, "permission", {
        configurable: true,
        get: () => "default",
      });
      Notification.requestPermission = () => Promise.resolve(result);
      Object.defineProperty(PushManager.prototype, "subscribe", {
        configurable: true,
        value: () =>
          Promise.resolve({
            endpoint,
            toJSON: () => ({
              endpoint,
              keys: {
                auth: "ZTJlLWF1dGgtc2VjcmV0",
                p256dh: "ZTJlLXAyNTYtZGgta2V5",
              },
            }),
          }),
      });
    },
    { endpoint: PUSH_ENDPOINT, result: permission }
  );
};

const enableButton = (page: Page) =>
  page.getByRole("button", { name: ENABLE_BUTTON });

// The control only mounts when VAPID_PUBLIC_KEY is configured for the server.
const skipWithoutPushControl = async (page: Page): Promise<void> => {
  await page.goto("/");
  const mounted = await enableButton(page)
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(
      () => true,
      () => false
    );
  test.skip(!mounted, "VAPID_PUBLIC_KEY is not configured for this server");
};

const registerWorker = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
};

// Chromium's DevTools protocol can deliver a push event to a registration, so
// the worker's own handler runs exactly as it would for a real push.
const deliverPush = async (
  context: BrowserContext,
  page: Page,
  payload: Record<string, unknown>
): Promise<void> => {
  const cdp = await context.newCDPSession(page);
  const { origin } = new URL(page.url());
  const { promise: registrationId, resolve } = Promise.withResolvers<string>();
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    const match = registrations.find(({ scopeURL }) =>
      scopeURL.startsWith(origin)
    );
    if (match) {
      resolve(match.registrationId);
    }
  });
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.deliverPushMessage", {
    data: JSON.stringify(payload),
    origin,
    registrationId: await registrationId,
  });
};

test.describe("Push notifications (flow)", () => {
  test("the service worker file is served as JavaScript and passes the collapse tag on", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");
    const source = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(source).toContain("showNotification");
    expect(source).toMatch(/tag:\s*typeof message\.tag === "string"/u);
  });

  test("a push shows one notification per tag and a resend replaces it", async ({
    context,
    page,
  }) => {
    // Reading delivered notifications back needs a full Chrome; the headless
    // shell Playwright installs by default cannot list them.
    test.skip(
      !process.env["E2E_CHROMIUM_PATH"],
      "Needs a full Chrome: set E2E_CHROMIUM_PATH to run this check."
    );
    await context.grantPermissions(["notifications"]);
    await page.goto("/");
    await registerWorker(page);
    const tag = `e2e-collapse-${Date.now()}`;

    await deliverPush(context, page, {
      body: "First delivery",
      tag,
      title: "Workspace update",
      url: "/tasks",
    });
    await expect
      .poll(() =>
        page.evaluate(async (wanted) => {
          const registration = await navigator.serviceWorker.ready;
          const shown = await registration.getNotifications({ tag: wanted });
          return shown.length;
        }, tag)
      )
      .toBe(1);

    await deliverPush(context, page, {
      body: "Second delivery",
      tag,
      title: "Workspace update",
      url: "/tasks",
    });
    await expect
      .poll(() =>
        page.evaluate(async (wanted) => {
          const registration = await navigator.serviceWorker.ready;
          const shown = await registration.getNotifications({ tag: wanted });
          return shown.map(({ body }) => body);
        }, tag)
      )
      .toEqual(["Second delivery"]);
  });

  test("allowing notifications registers the browser subscription", async ({
    page,
  }) => {
    await stubBrowserPush(page, "granted");
    await skipWithoutPushControl(page);

    await enableButton(page).click();

    await expect(page.getByText("Notifications are enabled.")).toBeVisible();
  });

  test("enabling twice keeps working because the same endpoint is reused", async ({
    page,
  }) => {
    await stubBrowserPush(page, "granted");
    await skipWithoutPushControl(page);

    await enableButton(page).click();
    await expect(page.getByText("Notifications are enabled.")).toBeVisible();
    await enableButton(page).click();
    await expect(page.getByText("Notifications are enabled.")).toBeVisible();
  });

  test("declining the browser prompt explains how to enable them", async ({
    page,
  }) => {
    await stubBrowserPush(page, "denied");
    await skipWithoutPushControl(page);

    await enableButton(page).click();

    await expect(
      page.getByText("Allow notifications in your browser to enable them here.")
    ).toBeVisible();
    await expect(enableButton(page)).toBeVisible();
  });
});
