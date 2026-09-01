import { describe, expect, it } from "vitest";
import { getVisibleVersionComments } from "./version-comments";

describe("getVisibleVersionComments", () => {
  it("keeps unresolved comments from every page in the selected version", () => {
    expect(
      getVisibleVersionComments([
        { id: "home", pathname: "/", status: "open" },
        { id: "profile", pathname: "/profile", status: "review_requested" },
        { id: "done", pathname: "/work/1", status: "done" },
      ]),
    ).toEqual([
      { id: "home", pathname: "/", status: "open" },
      { id: "profile", pathname: "/profile", status: "review_requested" },
    ]);
  });
});
