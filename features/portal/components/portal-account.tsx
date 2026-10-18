/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { SkeletonRows } from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalChangePassword } from "@/features/portal/components/portal-change-password";
import { PortalPushControl } from "@/features/portal/components/portal-push-control";
import { PortalSignOut } from "@/features/portal/components/portal-sign-out";
import { getPortalCompany } from "@/features/portal/portal-company";

const PortalAccount = async () => {
  const company = await getPortalCompany();
  return (
    <>
      <div className="ph">
        <div>
          <h1>Account</h1>
          <p>Your details, password and notification settings.</p>
        </div>
      </div>
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
            Password, push notification and sign-out controls are not available
            while previewing a client. Use Exit preview above to return.
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
    </>
  );
};

const PortalAccountSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Account</h1>
        <p>Your details, password and notification settings.</p>
      </div>
    </div>
    <SkelterSurface label="Loading account">
      <div className="portal-account">
        {["Profile", "Change password", "Push notifications", "Sign out"].map(
          (title) => (
            <div className="panel portal-panel" key={title}>
              <h2 className="sec">{title}</h2>
              <SkeletonRows rows={title === "Change password" ? 3 : 1} />
            </div>
          )
        )}
      </div>
    </SkelterSurface>
  </>
);

export { PortalAccount, PortalAccountSkeleton };
