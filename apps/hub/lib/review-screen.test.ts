import { describe, expect, it } from "vitest";
import { getReviewScreen } from "./review-screen";

describe("getReviewScreen", () => {
  it("shows the updated screen when the selected deployment is the review target", () => {
    expect(getReviewScreen("original", "updated", "updated")).toBe("updated");
  });

  it("shows the original screen when the selected deployment is where the comment was written", () => {
    expect(getReviewScreen("original", "updated", "original")).toBe("original");
  });

  it("does not create review context for another deployment", () => {
    expect(getReviewScreen("original", "updated", "other")).toBe("none");
  });
});
