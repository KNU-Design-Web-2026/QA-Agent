type VersionComment = { status: string };
export type CommentStatusFilter = "unresolved" | "all" | "done";

/** Keep stored records intact and filter only the visible list. */
export function getVisibleVersionComments<T extends VersionComment>(
  comments: T[],
  filter: CommentStatusFilter = "unresolved",
) {
  return comments.filter((comment) =>
    filter === "all" || (filter === "done" ? comment.status === "done" : comment.status !== "done"),
  );
}
