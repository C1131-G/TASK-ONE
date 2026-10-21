// Import this before any module that formats dates: it puts the test runtime
// in a viewer zone ahead of UTC, so "today" differs between the two at 07:30.
const VIEWER_ZONE = "Asia/Kuala_Lumpur";

const originalZone = process.env.TZ;
process.env.TZ = VIEWER_ZONE;

const restoreRuntimeZone = (): void => {
  if (originalZone === undefined) {
    Reflect.deleteProperty(process.env, "TZ");
  } else {
    process.env.TZ = originalZone;
  }
};

export { VIEWER_ZONE, restoreRuntimeZone };
