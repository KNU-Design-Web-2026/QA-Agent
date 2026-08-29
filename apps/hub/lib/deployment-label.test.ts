import { describe, expect, it } from "vitest";
import { getDeploymentLabel } from "./deployment-label";

describe("getDeploymentLabel", () => {
  it("uses the developer-provided version name before the SHA", () => {
    expect(
      getDeploymentLabel({ version_name: "모바일 메인 화면 수정", git_sha: "32ad492" }),
    ).toBe("모바일 메인 화면 수정");
  });

  it("falls back to a short SHA for older deployment records", () => {
    expect(getDeploymentLabel({ version_name: null, git_sha: "32ad4929af" })).toBe(
      "32ad492",
    );
  });
});
