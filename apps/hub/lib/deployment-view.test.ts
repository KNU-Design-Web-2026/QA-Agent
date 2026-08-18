import { describe, expect, it } from "vitest";
import { getDeploymentView } from "./deployment-view";

describe("getDeploymentView", () => {
  it("marks a selected non-active deployment as a past review version", () => {
    expect(getDeploymentView("release-1", "release-2")).toEqual("past");
  });

  it("marks the active deployment as the current review version", () => {
    expect(getDeploymentView("release-2", "release-2")).toEqual("current");
  });

  it("does not show a version state without both deployment ids", () => {
    expect(getDeploymentView(null, "release-2")).toEqual("unknown");
  });
});
