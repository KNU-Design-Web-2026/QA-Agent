export type ReviewScreen = "updated" | "original" | "none";

export function getReviewScreen(
  originalDeploymentId: string | null,
  reviewDeploymentId: string | null,
  selectedDeploymentId: string | null,
): ReviewScreen {
  if (!originalDeploymentId || !reviewDeploymentId || !selectedDeploymentId)
    return "none";
  if (selectedDeploymentId === reviewDeploymentId) return "updated";
  if (selectedDeploymentId === originalDeploymentId) return "original";
  return "none";
}
