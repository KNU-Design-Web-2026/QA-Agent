import { describe, expect, it } from "vitest";
import { deploymentUpdateSchema } from "./deployment-update";

describe("deploymentUpdateSchema", () => {
  it("accepts an admin version-name update without changing deployment identity", () => {
    expect(
      deploymentUpdateSchema.parse({
        action: "rename",
        projectSlug: "knud-exhibition",
        deploymentId: "b8b4ee2f-75cf-456e-b3c5-8668ba77db52",
        versionName: "QA Bridge 위치 동기화",
        changeSummary: "현재 페이지와 스크롤 위치를 기록합니다.",
      }),
    ).toMatchObject({ action: "rename", versionName: "QA Bridge 위치 동기화" });
  });

  it("rejects a blank version name", () => {
    expect(() =>
      deploymentUpdateSchema.parse({
        action: "rename",
        projectSlug: "knud-exhibition",
        deploymentId: "b8b4ee2f-75cf-456e-b3c5-8668ba77db52",
        versionName: "   ",
      }),
    ).toThrow();
  });
});
