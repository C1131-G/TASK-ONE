import { useRouter } from "expo-router";

import { PortalNewBugScreen } from "@/features/portal/portal-screens";

export default function PortalNewBugRoute() {
  const router = useRouter();

  return <PortalNewBugScreen onDone={() => router.push("/portal")} />;
}
