type InitialDeploymentSelectionInput = {
  requestedDeploymentId: string | null;
  activeDeploymentId: string | null;
  availableDeploymentIds: string[];
};

export function getInitialDeploymentSelection({
  requestedDeploymentId,
  activeDeploymentId,
  availableDeploymentIds,
}: InitialDeploymentSelectionInput): string | null {
  if (
    requestedDeploymentId &&
    availableDeploymentIds.includes(requestedDeploymentId)
  ) {
    return requestedDeploymentId;
  }

  if (activeDeploymentId && availableDeploymentIds.includes(activeDeploymentId)) {
    return activeDeploymentId;
  }

  return availableDeploymentIds[0] ?? null;
}
