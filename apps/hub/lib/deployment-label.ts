type DeploymentLabelSource = {
  version_name?: string | null;
  git_sha: string;
};

export function getDeploymentLabel(deployment: DeploymentLabelSource) {
  return deployment.version_name?.trim() || deployment.git_sha.slice(0, 7);
}
