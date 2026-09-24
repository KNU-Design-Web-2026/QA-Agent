import { describe, expect, it } from "vitest";
import { getInitialDeploymentSelection } from "./initial-deployment-selection";

describe("getInitialDeploymentSelection", () => {
  it("keeps the deployment requested by a history-link for an admin", () => {
    expect(
      getInitialDeploymentSelection({
        requestedDeploymentId: "historical-version",
        activeDeploymentId: "latest-version",
        availableDeploymentIds: ["latest-version", "historical-version"],
      }),
    ).toBe("historical-version");
  });

  it("uses the active deployment when the requested history version no longer exists", () => {
    expect(
      getInitialDeploymentSelection({
        requestedDeploymentId: "deleted-version",
        activeDeploymentId: "latest-version",
        availableDeploymentIds: ["latest-version"],
      }),
    ).toBe("latest-version");
  });
});
