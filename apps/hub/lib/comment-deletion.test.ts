import { describe, expect, it } from "vitest";
import { canDeleteComment } from "./comment-deletion";

describe("canDeleteComment", () => {
  it("allows only the original author to remove a comment", () => {
    expect(canDeleteComment("author-id", "author-id")).toBe(true);
    expect(canDeleteComment("author-id", "another-user-id")).toBe(false);
  });
});
