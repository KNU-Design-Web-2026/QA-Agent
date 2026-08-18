export type DeploymentView = "current" | "past" | "unknown";

export function getDeploymentView(
  selectedDeploymentId: string | null,
  activeDeploymentId: string | null,
): DeploymentView {
  if (!selectedDeploymentId || !activeDeploymentId) return "unknown";
  return selectedDeploymentId === activeDeploymentId ? "current" : "past";
}
