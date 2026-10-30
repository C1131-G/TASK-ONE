/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { SkeletonRows } from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalChangePassword } from "@/features/portal/components/portal-change-password";
import { PortalEmailControl } from "@/features/portal/components/portal-email-control";
import { PortalPushControl } from "@/features/portal/components/portal-push-control";
import { PortalSessions } from "@/features/portal/components/portal-sessions";
import { PortalSignOut } from "@/features/portal/components/portal-sign-out";
import { getPortalCompany } from "@/features/portal/portal-company";
import { getPortalEmailUpdates } from "@/features/portal/portal-queries";
import { listMySessions } from "@/features/user/user-queries";
import { readOrThrow } from "@/lib/read-result";

const PortalAccount = async () => {
  const company = await getPortalCompany();
  const [emailUpdates, sessions] = company?.preview
    ? [false, []]
    : [
        readOrThrow(await getPortalEmailUpdates({}), "Email updates"),
        readOrThrow(await listMySessions({}), "Sessions"),
      ];
  return (
    <div
      className={`portal-account${company?.preview ? " portal-account-preview-mode" : ""}`}
    >
      <section
        aria-labelledby="portal-profile-h"
        className="panel portal-panel portal-account-profile"
      >
        <h2 className="sec" id="portal-profile-h">
          Profile
        </h2>
        <dl className="portal-facts">
          <div>
            <dt>Name</dt>
            <dd>{company?.userName ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{company?.companyName ?? "Unavailable"}</dd>
          </div>
        </dl>
      </section>
      {company?.preview ? (
        <p className="portal-banner portal-account-preview" role="note">
          Password, push notification, device and sign-out controls are not
          available while previewing a client. Use Exit preview above to return.
        </p>
      ) : (
        <>
          <section
            aria-labelledby="portal-password-h"
            className="panel portal-panel portal-account-password"
          >
            <h2 className="sec" id="portal-password-h">
              Change password
            </h2>
            <PortalChangePassword />
          </section>
          <section
            aria-labelledby="portal-push-h"
            className="panel portal-panel portal-account-push"
          >
            <h2 className="sec" id="portal-push-h">
              Push notifications
            </h2>
            <PortalPushControl
              publicKey={process.env["VAPID_PUBLIC_KEY"] ?? ""}
            />
          </section>
          <section
            aria-labelledby="portal-email-h"
            className="panel portal-panel portal-account-email"
          >
            <h2 className="sec" id="portal-email-h">
              Email updates
            </h2>
            <PortalEmailControl enabled={emailUpdates} />
          </section>
          <section
            aria-labelledby="portal-sessions-h"
            className="panel portal-panel portal-account-sessions"
          >
            <h2 className="sec" id="portal-sessions-h">
              Signed-in devices
            </h2>
            <PortalSessions sessions={sessions} />
          </section>
          <section
            aria-labelledby="portal-out-h"
            className="panel portal-panel portal-account-signout"
          >
            <h2 className="sec" id="portal-out-h">
              Sign out
            </h2>
            <PortalSignOut />
          </section>
        </>
      )}
    </div>
  );
};

const PortalAccountSkeleton = () => (
  <SkelterSurface label="Loading account">
    <div className="portal-account">
      {[
        ["Profile", "portal-account-profile"],
        ["Change password", "portal-account-password"],
        ["Push notifications", "portal-account-push"],
        ["Email updates", "portal-account-email"],
        ["Signed-in devices", "portal-account-sessions"],
        ["Sign out", "portal-account-signout"],
      ].map((title) => (
        <div className={`panel portal-panel ${title[1]}`} key={title[1]}>
          <h2 className="sec">{title[0]}</h2>
          <SkeletonRows rows={title[0] === "Change password" ? 3 : 1} />
        </div>
      ))}
    </div>
  </SkelterSurface>
);

export { PortalAccount, PortalAccountSkeleton };
