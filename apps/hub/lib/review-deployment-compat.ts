type DatabaseError = { code?: string | null; message?: string | null } | null;

export function shouldRetryWithoutReviewDeployment(error: DatabaseError) {
  return (
    error?.code === "42703" &&
    error.message?.includes("review_deployment_id") === true
  );
}
