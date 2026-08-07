import type { ElementTarget, Rect } from "./protocol";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function normalizeRect(rect: Rect, viewportWidth: number, viewportHeight: number): Rect {
  return {
    x: clamp(rect.x / viewportWidth),
    y: clamp(rect.y / viewportHeight),
    width: clamp(rect.width / viewportWidth),
    height: clamp(rect.height / viewportHeight),
  };
}

function escapeAttribute(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

export function describeTarget(element: Element, clientX: number, clientY: number): ElementTarget {
  const qaElement = element.closest<HTMLElement>("[data-qa-id]");
  const target = qaElement ?? (element as HTMLElement);
  const domRect = target.getBoundingClientRect();
  const rect = { x: domRect.x, y: domRect.y, width: domRect.width, height: domRect.height };
  const qaId = qaElement?.dataset.qaId ?? null;
  const entityKey = qaElement?.dataset.qaKey ?? null;

  const selectorHint = qaId
    ? `[data-qa-id="${escapeAttribute(qaId)}"]${
        entityKey ? `[data-qa-key="${escapeAttribute(entityKey)}"]` : ""
      }`
    : target.tagName.toLowerCase();

  return {
    qaId,
    entityKey,
    selectorHint,
    rect,
    documentRect: {
      ...rect,
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
    },
    normalizedRect: normalizeRect(rect, window.innerWidth, window.innerHeight),
    relativePoint: {
      x: clamp((clientX - rect.x) / Math.max(rect.width, 1)),
      y: clamp((clientY - rect.y) / Math.max(rect.height, 1)),
    },
  };
}
