import { describe, expect, it } from "vitest";
import { shouldShowScreenLoading } from "./screen-loading";

describe("shouldShowScreenLoading", () => {
  it("keeps the loading overlay visible while a version switch is in progress", () => {
    expect(shouldShowScreenLoading(true)).toBe(true);
  });

  it("does not cover the workspace while there is no deliberate screen change", () => {
    expect(shouldShowScreenLoading(false)).toBe(false);
  });
});
