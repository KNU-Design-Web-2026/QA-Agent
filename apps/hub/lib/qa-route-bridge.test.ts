import { describe, expect, it } from "vitest";
import { readQaRouteState } from "./qa-route-bridge";

describe("readQaRouteState", () => {
  it("accepts a route event only when it belongs to the embedded site origin", () => {
    expect(
      readQaRouteState(
        {
          type: "knud.qa/route-state",
          version: 1,
          pathname: "/profile",
        },
        "https://knud-2026-exhibition.vercel.app",
        "https://knud-2026-exhibition.vercel.app",
      ),
    ).toEqual({ pathname: "/profile", scrollX: 0, scrollY: 0 });
  });

  it("preserves the embedded page scroll position when it is supplied", () => {
    expect(
      readQaRouteState(
        {
          type: "knud.qa/route-state",
          version: 1,
          pathname: "/profile",
          scrollX: 24,
          scrollY: 860,
        },
        "https://knud-2026-exhibition.vercel.app",
        "https://knud-2026-exhibition.vercel.app",
      ),
    ).toEqual({ pathname: "/profile", scrollX: 24, scrollY: 860 });
  });

  it("rejects a route event from another origin or an unsafe path", () => {
    expect(
      readQaRouteState(
        { type: "knud.qa/route-state", version: 1, pathname: "//evil.example" },
        "https://evil.example",
        "https://knud-2026-exhibition.vercel.app",
      ),
    ).toBeNull();
  });
});
