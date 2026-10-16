import { describe, expect, it } from "vitest";
import { getVisibleVersionComments } from "./version-comments";

describe("getVisibleVersionComments", () => {
  const records = [
    { id: "open", status: "open" },
    { id: "review", status: "review_requested" },
    { id: "complete", status: "done" },
  ];

  it("includes completed records when viewing all feedback", () => {
    expect(getVisibleVersionComments(records, "all")).toEqual(records);
  });

  it("shows only completed feedback without removing its reproduction data", () => {
    const completed = { status: "done", pathname: "/profile", scroll_y: 803 };
    expect(getVisibleVersionComments([...records.slice(0, 2), completed], "done"))
      .toEqual([completed]);
  });

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
