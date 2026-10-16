import { describe, expect, it } from "vitest";
import { getInitialDeploymentSelection, getRefreshedDeploymentSelection } from "./initial-deployment-selection";

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

describe("getRefreshedDeploymentSelection", () => {
  it("preserves a manually selected version when polling unchanged deployments", () => {
    expect(getRefreshedDeploymentSelection({
      currentDeploymentId: "selected",
      activeDeploymentId: "active",
      activeDeploymentChanged: false,
      availableDeploymentIds: ["active", "selected", "old-link"],
    })).toBe("selected");
  });

  it("follows a newly activated version for admins", () => {
    expect(getRefreshedDeploymentSelection({
      currentDeploymentId: "selected",
      activeDeploymentId: "new-active",
      activeDeploymentChanged: true,
      availableDeploymentIds: ["new-active", "selected"],
    })).toBe("new-active");
  });

  it("falls back to the active version if the current version was removed", () => {
    expect(getRefreshedDeploymentSelection({
      currentDeploymentId: "removed",
      activeDeploymentId: "active",
      activeDeploymentChanged: false,
      availableDeploymentIds: ["active"],
    })).toBe("active");
  });
});
