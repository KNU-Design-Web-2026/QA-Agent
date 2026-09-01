import { describe, expect, it } from "vitest";
import { getCommentNavigation } from "./comment-navigation";

describe("getCommentNavigation", () => {
  it("returns the saved page and matching review viewport for a comment", () => {
    expect(
      getCommentNavigation(
        { pathname: "/work/ignite", viewport_width: 1020 },
        [1920, 1350, 1020, 600, 400],
      ),
    ).toEqual({ pathname: "/work/ignite", viewportIndex: 2 });
  });
});
