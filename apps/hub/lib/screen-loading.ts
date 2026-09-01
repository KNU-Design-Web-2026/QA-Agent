/** Keeps the canvas loading state scoped to deliberate screen changes. */
export function shouldShowScreenLoading(isSwitchingVersion: boolean) {
  return isSwitchingVersion;
}
