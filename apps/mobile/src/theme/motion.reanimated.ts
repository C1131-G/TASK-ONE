import { Easing } from "react-native-reanimated";

import { appMotion } from "@/theme/motion";

/** Reanimated easings built from the generated web motion tokens. */
export const easings = {
  /** --ease-drawer for sheets and drawers. */
  drawer: Easing.bezier(...appMotion.bezier.drawer),
  /** --ease, the default interaction curve. */
  standard: Easing.bezier(...appMotion.bezier.standard),
  /** --spring for playful entrances. */
  spring: Easing.bezier(...appMotion.bezier.spring),
} as const;
