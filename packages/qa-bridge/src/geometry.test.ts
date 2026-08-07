import { describe, expect, it } from "vitest";
import { normalizeRect } from "./geometry";

describe("normalizeRect", () => {
  it("normalizes CSS pixel geometry to the viewport", () => {
    expect(normalizeRect({ x: 200, y: 100, width: 400, height: 250 }, 1000, 500)).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.5,
    });
  });

  it("clamps geometry outside of the viewport", () => {
    expect(normalizeRect({ x: -10, y: 600, width: 1200, height: 10 }, 1000, 500)).toEqual({
      x: 0,
      y: 1,
      width: 1,
      height: 0.02,
    });
  });
});
