type VersionComment = { status: string };

/** Comments that remain actionable in the currently selected QA version. */
export function getVisibleVersionComments<T extends VersionComment>(
  comments: T[],
) {
  return comments.filter((comment) => comment.status !== "done");
}
