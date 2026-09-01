import { describe, expect, it } from "vitest";
import { shouldRetryWithoutReviewDeployment } from "./review-deployment-compat";

describe("shouldRetryWithoutReviewDeployment", () => {
  it("retries a comment query when only the new review column is missing", () => {
    expect(
      shouldRetryWithoutReviewDeployment({
        code: "42703",
        message: "column qa_comments.review_deployment_id does not exist",
      }),
    ).toBe(true);
  });

  it("does not hide unrelated database errors", () => {
    expect(
      shouldRetryWithoutReviewDeployment({
        code: "42501",
        message: "permission denied for table qa_comments",
      }),
    ).toBe(false);
  });
});
