import { describe, expect, it } from "vitest";
import { shouldActivateRegisteredDeployment } from "./deployment-activation";

describe("shouldActivateRegisteredDeployment", () => {
  it("activates a newly registered deployment", () => {
    expect(shouldActivateRegisteredDeployment(false)).toBe(true);
  });

  it("activates a deployment even when the same URL was registered before", () => {
    expect(shouldActivateRegisteredDeployment(true)).toBe(true);
  });
});
