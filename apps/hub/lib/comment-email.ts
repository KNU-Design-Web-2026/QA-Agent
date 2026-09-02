import { Resend } from "resend";

type EmailClient = {
  emails: {
    send: (input: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    }) => Promise<{ data: { id?: string } | null; error: { message?: string } | null }>;
  };
};

export type CommentCreatedEmailInput = {
  adminEmail: string;
  from: string;
  hubUrl: string;
  authorName: string;
  body: string;
  pathname: string;
  viewportWidth: number;
  viewportHeight: number;
  priority: string;
  commentId: string;
};

export type CommentEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildCommentEmailHtml(input: CommentCreatedEmailInput) {
  const reviewUrl = `${input.hubUrl.replace(/\/$/, "")}/?commentId=${encodeURIComponent(input.commentId)}`;
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717;max-width:620px">
      <p style="font-size:12px;letter-spacing:.14em;color:#777;margin:0 0 16px">KNUD DESIGN QA HUB</p>
      <h1 style="font-size:24px;margin:0 0 20px">새 코멘트가 등록되었습니다</h1>
      <p><strong>${escapeHtml(input.authorName)}</strong>님이 코멘트를 남겼습니다.</p>
      <div style="background:#f5f5f2;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 10px;white-space:pre-wrap">${escapeHtml(input.body)}</p>
        <p style="margin:0;color:#666;font-size:13px">우선순위 ${escapeHtml(input.priority)} · ${escapeHtml(input.pathname)} · ${input.viewportWidth} × ${input.viewportHeight}px</p>
      </div>
      <a href="${reviewUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px">코멘트 확인하기</a>
    </div>
  `;
}

export async function sendCommentCreatedEmail(
  client: EmailClient,
  input: CommentCreatedEmailInput,
): Promise<CommentEmailResult> {
  const { data, error } = await client.emails.send({
    from: input.from,
    to: [input.adminEmail],
    subject: `[KNUD QA] ${input.authorName}님이 새 코멘트를 남겼습니다`,
    html: buildCommentEmailHtml(input),
  });
  if (error) return { ok: false, error: error.message ?? "메일 발송에 실패했습니다." };
  return { ok: true, id: data?.id ?? null };
}

export async function sendConfiguredCommentCreatedEmail(
  input: Omit<CommentCreatedEmailInput, "adminEmail" | "from">,
): Promise<CommentEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.QA_ADMIN_EMAIL;
  const from = process.env.QA_NOTIFICATION_FROM;
  if (!apiKey || !adminEmail || !from) {
    return { ok: false, error: "메일 환경 변수가 설정되지 않았습니다." };
  }
  return sendCommentCreatedEmail(new Resend(apiKey), { ...input, adminEmail, from });
}
