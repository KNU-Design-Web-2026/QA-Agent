type Point = { x: number; y: number };
type Viewport = { width: number; height: number };
type Anchor = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Converts a saved viewport-relative annotation into its current position in the
 * embedded viewport. Scroll compensation makes the annotation stay attached to
 * the same document content rather than the same visible screen pixels.
 */
export function getCommentAnchorPosition({
  anchor,
  viewport,
  savedScroll,
  currentScroll,
}: {
  anchor: Anchor;
  viewport: Viewport;
  savedScroll: Point;
  currentScroll: Point;
}) {
  return {
    x: numberValue(anchor.x) * viewport.width + savedScroll.x - currentScroll.x,
    y: numberValue(anchor.y) * viewport.height + savedScroll.y - currentScroll.y,
  };
}

export function getCommentAnchorGeometry({
  anchor,
  viewport,
  savedScroll,
  currentScroll,
}: {
  anchor: Anchor;
  viewport: Viewport;
  savedScroll: Point;
  currentScroll: Point;
}) {
  const width = numberValue(anchor.width) * viewport.width;
  const height = numberValue(anchor.height) * viewport.height;
  if (width <= 0 || height <= 0) return null;
  return {
    ...getCommentAnchorPosition({ anchor, viewport, savedScroll, currentScroll }),
    width,
    height,
  };
}
