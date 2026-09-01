type CommentNavigationSource = {
  pathname: string;
  viewport_width: number;
};

export function getCommentNavigation(
  comment: CommentNavigationSource,
  viewportWidths: readonly number[],
) {
  return {
    pathname: comment.pathname,
    viewportIndex: viewportWidths.indexOf(comment.viewport_width),
  };
}
