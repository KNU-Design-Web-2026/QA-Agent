import { describe, expect, it } from "vitest";
import {
  getDeploymentLabel,
  getViewerDeploymentOptionLabel,
} from "./deployment-label";

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

  it("labels the active screen clearly for designers without exposing a SHA", () => {
    expect(
      getViewerDeploymentOptionLabel(
        { version_name: "작품 상세 화면 보완", git_sha: "32ad4929af" },
        true,
      ),
    ).toBe("현재 화면 · 작품 상세 화면 보완");
  });

  it("uses a friendly past-screen label even for older records without a name", () => {
    expect(
      getViewerDeploymentOptionLabel(
        { version_name: null, git_sha: "32ad4929af" },
        false,
      ),
    ).toBe("지난 화면 · 32ad492");
  });
});
