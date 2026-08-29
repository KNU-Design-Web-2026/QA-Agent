import { describe, expect, it } from "vitest";
import { getHistoryDeployments } from "./history-deployments";

describe("getHistoryDeployments", () => {
  it("keeps a registered deployment even when it has no comments", () => {
    const deployments = getHistoryDeployments(
      [
        { id: "latest", git_sha: "bbbbbbb", version_name: "모바일 메인 수정" },
        { id: "older", git_sha: "aaaaaaa", version_name: null },
      ],
      [{ deployment_id: "older" }],
    );

    expect(deployments.map((deployment) => deployment.id)).toEqual([
      "latest",
      "older",
    ]);
  });

  it("adds a commented legacy deployment when it is absent from the version response", () => {
    const deployments = getHistoryDeployments(
      [{ id: "latest", git_sha: "bbbbbbb", version_name: "모바일 메인 수정" }],
      [
        {
          deployment_id: "legacy",
          deployment: { id: "legacy", git_sha: "aaaaaaa", version_name: null },
        },
      ],
    );

    expect(deployments.map((deployment) => deployment.id)).toEqual([
      "latest",
      "legacy",
    ]);
  });
});
