type DeploymentLabelSource = {
  version_name?: string | null;
  git_sha: string;
};

export function getDeploymentLabel(deployment: DeploymentLabelSource) {
  return deployment.version_name?.trim() || deployment.git_sha.slice(0, 7);
}

export function getViewerDeploymentOptionLabel(
  deployment: DeploymentLabelSource,
  isActive: boolean,
) {
  return `${isActive ? "현재 화면" : "지난 화면"} · ${getDeploymentLabel(deployment)}`;
}
