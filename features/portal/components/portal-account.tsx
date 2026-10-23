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
    <div className="portal-account">
      <section
        aria-labelledby="portal-profile-h"
        className="panel portal-panel"
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
        <p className="portal-banner" role="note">
          Password, push notification, device and sign-out controls are not
          available while previewing a client. Use Exit preview above to return.
        </p>
      ) : (
        <>
          <section
            aria-labelledby="portal-password-h"
            className="panel portal-panel"
          >
            <h2 className="sec" id="portal-password-h">
              Change password
            </h2>
            <PortalChangePassword />
          </section>
          <section
            aria-labelledby="portal-push-h"
            className="panel portal-panel"
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
            className="panel portal-panel"
          >
            <h2 className="sec" id="portal-email-h">
              Email updates
            </h2>
            <PortalEmailControl enabled={emailUpdates} />
          </section>
          <section
            aria-labelledby="portal-sessions-h"
            className="panel portal-panel"
          >
            <h2 className="sec" id="portal-sessions-h">
              Signed-in devices
            </h2>
            <PortalSessions sessions={sessions} />
          </section>
          <section
            aria-labelledby="portal-out-h"
            className="panel portal-panel"
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
        "Profile",
        "Change password",
        "Push notifications",
        "Email updates",
        "Signed-in devices",
        "Sign out",
      ].map((title) => (
        <div className="panel portal-panel" key={title}>
          <h2 className="sec">{title}</h2>
          <SkeletonRows rows={title === "Change password" ? 3 : 1} />
        </div>
      ))}
    </div>
  </SkelterSurface>
);

export { PortalAccount, PortalAccountSkeleton };
