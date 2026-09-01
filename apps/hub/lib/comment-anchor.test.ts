import { describe, expect, it } from "vitest";
import { getCommentAnchorGeometry } from "./comment-anchor";

describe("getCommentAnchorGeometry", () => {
  it("keeps an annotation at its saved document position while the embedded page scrolls", () => {
    expect(
      getCommentAnchorGeometry({
        anchor: { x: 0.1, y: 0.5, width: 0.2, height: 0.1 },
        viewport: { width: 1000, height: 800 },
        savedScroll: { x: 0, y: 600 },
        currentScroll: { x: 0, y: 900 },
      }),
    ).toEqual({ x: 100, y: 100, width: 200, height: 80 });
  });

  it("returns null for malformed or empty area geometry", () => {
    expect(
      getCommentAnchorGeometry({
        anchor: { x: 0.1, y: 0.2, width: 0, height: 0 },
        viewport: { width: 1000, height: 800 },
        savedScroll: { x: 0, y: 0 },
        currentScroll: { x: 0, y: 0 },
      }),
    ).toBeNull();
  });
});
