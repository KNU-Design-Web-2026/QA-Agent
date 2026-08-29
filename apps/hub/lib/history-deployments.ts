export type HistoryDeployment = {
  id: string;
  git_sha: string;
  version_name: string | null;
  deployed_at?: string | null;
};

type HistoryCommentDeployment = {
  deployment_id: string;
  deployment?: HistoryDeployment | null;
};

export function getHistoryDeployments(
  registeredDeployments: HistoryDeployment[],
  comments: HistoryCommentDeployment[],
) {
  const deployments = new Map(
    registeredDeployments.map((deployment) => [deployment.id, deployment]),
  );

  for (const comment of comments) {
    if (comment.deployment && !deployments.has(comment.deployment_id)) {
      deployments.set(comment.deployment_id, comment.deployment);
    }
  }

  return [...deployments.values()];
}
