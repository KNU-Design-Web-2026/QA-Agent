import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken } from "@/lib/qa-access";
import { POST } from "./route";

const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));

const commentId = "00000000-0000-4000-8000-000000000003";
const payload = {
  projectSlug: "qa-test",
  deploymentUrl: "https://exhibition.example.test",
  body: "줄바꿈을 확인해주세요.",
  pathname: "/about",
  viewportWidth: 1020,
  viewportHeight: 1370,
  zoom: 0.67,
  deviceScaleFactor: 2,
  kind: "area",
  anchor: { space: "viewport-normalized", x: 0.125, y: 0.25, width: 0.3, height: 0.1 },
  type: "visual",
  priority: "high",
};

describe("POST /api/comments scroll persistence", () => {
  let writes: Array<{ table: string; data: Record<string, unknown> }>;
  let databaseError: null | Record<string, unknown>;

  beforeEach(() => {
    writes = [];
    databaseError = null;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("QA_SHARED_ACCESS_PASSWORD", "test-only-password");
    vi.stubEnv("RESEND_API_KEY", "");
    getCookie.mockReturnValue({ value: createAccessToken({
      userId: "00000000-0000-4000-8000-000000000001",
      email: "designer@example.test", displayName: "테스터", role: "designer",
    }) });
    // Keep the route, validation, and Supabase serialization real; replace only HTTP.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== "https://db.example.test") throw new Error("Unexpected external request");
      const table = url.pathname.split("/").at(-1)!;
      if (init?.method === "POST") {
        writes.push({ table, data: JSON.parse(String(init.body)) });
        if (table === "qa_comments" && databaseError)
          return Response.json(databaseError, { status: 400 });
        return Response.json(table === "qa_comments" ? { id: commentId } : null, { status: 201 });
      }
      const results: Record<string, unknown> = {
        projects: { id: "project-1", organization_id: "org-1" },
        deployments: { id: "deployment-1", git_sha: "abcdef0" },
        memberships: [],
        profiles: { display_name: "테스터", email: "designer@example.test" },
      };
      if (!(table in results)) throw new Error(`Unexpected table: ${table}`);
      return Response.json(results[table]);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const request = (scroll: Record<string, unknown> = {}) => new Request("https://hub.example.test/api/comments", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, ...scroll }),
  });

  it.each([
    [12.25, 3644.5, 12, 3645],
    [0, 4361.33349609375, 0, 4361],
    [0.5, 4361.5, 1, 4362],
    [24, 860, 24, 860],
    [0, 0, 0, 0],
  ])("persists scroll (%s, %s) as integer (%s, %s) without changing annotation geometry", async (x, y, expectedX, expectedY) => {
    const response = await POST(request({ scrollX: x, scrollY: y }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: commentId });
    expect(writes.find(w => w.table === "qa_comments")?.data).toMatchObject({
      scroll_x: expectedX, scroll_y: expectedY, pathname: "/about",
      zoom: 0.67, device_scale_factor: 2, normalized_anchor_json: payload.anchor,
    });
    expect(writes.find(w => w.table === "annotations")?.data).toMatchObject({
      qa_comment_id: commentId, kind: "rect", geometry_json: payload.anchor,
    });
  });

  it("defaults missing scroll values to zero for older clients", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(writes[0]?.data).toMatchObject({ scroll_x: 0, scroll_y: 0 });
  });

  it.each([-1, "3644.5"])("rejects invalid scroll input %s before writing", async (scrollY) => {
    expect((await POST(request({ scrollY }))).status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("rejects expired sessions before writing", async () => {
    getCookie.mockReturnValue(undefined);
    expect((await POST(request())).status).toBe(401);
    expect(writes).toEqual([]);
  });

  it("logs the database failure code without exposing comment text or DB details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseError = { code: "22P02", message: "private database message", details: "private row", hint: null };
    const response = await POST(request({ scrollX: 0, scrollY: 3644.5 }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: "22P02" }));
    const diagnostics = JSON.stringify({ body, logs: log.mock.calls });
    for (const sensitive of [payload.body, "designer@example.test", "private database message", "private row"])
      expect(diagnostics).not.toContain(sensitive);
    expect(writes.map(w => w.table)).toEqual(["qa_comments"]);
  });
});
