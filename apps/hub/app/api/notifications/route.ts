import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, QA_ACCESS_COOKIE, readAccessToken } from "@/lib/qa-access";

const updateSchema = z.object({ action: z.enum(["read", "read_all"]), notificationId: z.string().uuid().optional() });

async function requireSession() {
  return readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, qa_comment_id, kind, read_at, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("알림을 불러오지 못했습니다.");
    const commentIds = [...new Set((notifications ?? []).map((notification) => notification.qa_comment_id))];
    const { data: comments } = commentIds.length
      ? await supabase
          .from("qa_comments")
          .select("id, body, pathname, viewport_width, viewport_height, deployment_id, author_id")
          .in("id", commentIds)
      : { data: [] };
    const authorIds = [...new Set((comments ?? []).map((comment) => comment.author_id))];
    const { data: authors } = authorIds.length
      ? await supabase.from("profiles").select("id, display_name, email").in("id", authorIds)
      : { data: [] };
    const commentById = new Map((comments ?? []).map((comment) => [comment.id, comment]));
    const authorById = new Map((authors ?? []).map((author) => [author.id, author]));
    const items = (notifications ?? [])
      .map((notification) => {
        const comment = commentById.get(notification.qa_comment_id);
        return comment ? { ...notification, comment: { ...comment, author: authorById.get(comment.author_id) ?? null } } : null;
      })
      .filter(Boolean);
    return NextResponse.json({ notifications: items, unreadCount: (notifications ?? []).filter((notification) => !notification.read_at).length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "알림을 불러오지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const input = updateSchema.parse(await request.json());
    if (input.action === "read" && !input.notificationId) throw new Error("읽을 알림 정보가 필요합니다.");
    const supabase = createAdminClient();
    let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
    if (input.action === "read") query = query.eq("id", input.notificationId!);
    const { error } = await query;
    if (error) throw new Error("알림 읽음 처리를 저장하지 못했습니다.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "알림을 읽음 처리하지 못했습니다." }, { status: 400 });
  }
}
