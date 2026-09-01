import { describe, expect, it } from "vitest";
import { getUnreadVisibleNotificationCount } from "./notification-count";

describe("getUnreadVisibleNotificationCount", () => {
  it("does not count an unread notification whose comment can no longer be shown", () => {
    expect(
      getUnreadVisibleNotificationCount([
        null,
        { id: "visible-unread", read_at: null },
        { id: "visible-read", read_at: "2026-09-01T00:00:00.000Z" },
      ]),
    ).toBe(1);
  });
});
