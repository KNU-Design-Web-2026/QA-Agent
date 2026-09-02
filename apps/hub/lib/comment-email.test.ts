import { describe, expect, it, vi } from "vitest";
import { sendCommentCreatedEmail } from "./comment-email";

describe("sendCommentCreatedEmail", () => {
  it("sends a concise Korean notification to the configured admin", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await sendCommentCreatedEmail(
      {
        emails: { send },
      },
      {
        adminEmail: "lee980605@knu.ac.kr",
        from: "KNUD QA Hub <qa@example.com>",
        hubUrl: "https://qa-agent.example.com",
        authorName: "서윤",
        body: "헤더 간격을 확인해주세요.",
        pathname: "/profile",
        viewportWidth: 1020,
        viewportHeight: 1370,
        priority: "high",
        commentId: "comment-1",
      },
    );

    expect(result).toEqual({ ok: true, id: "email-1" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "KNUD QA Hub <qa@example.com>",
        to: ["lee980605@knu.ac.kr"],
        subject: "[KNUD QA] 서윤님이 새 코멘트를 남겼습니다",
      }),
    );
    expect(send.mock.calls[0]?.[0].html).toContain("/profile");
    expect(send.mock.calls[0]?.[0].html).toContain("헤더 간격을 확인해주세요.");
  });

  it("does not throw when the provider fails", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "provider down" } });

    await expect(
      sendCommentCreatedEmail(
        { emails: { send } },
        {
          adminEmail: "lee980605@knu.ac.kr",
          from: "KNUD QA Hub <qa@example.com>",
          hubUrl: "https://qa-agent.example.com",
          authorName: "세직",
          body: "확인 부탁드립니다.",
          pathname: "/",
          viewportWidth: 1920,
          viewportHeight: 1340,
          priority: "medium",
          commentId: "comment-2",
        },
      ),
    ).resolves.toEqual({ ok: false, error: "provider down" });
  });
});
