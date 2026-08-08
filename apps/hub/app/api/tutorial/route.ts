import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminClient,
  QA_ACCESS_COOKIE,
  readAccessToken,
} from "@/lib/qa-access";

const tutorialKey = "qa-hub-onboarding";
const tutorialVersion = 1;
const actionSchema = z.object({
  action: z.enum(["dismiss", "complete"]),
});

async function requireSession() {
  return readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
}

export async function GET() {
  const session = await requireSession();
  if (!session)
    return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const { data, error } = await createAdminClient()
      .from("qa_user_tutorials")
      .select("seen_version, dismissed_at, completed_at")
      .eq("user_id", session.userId)
      .eq("tutorial_key", tutorialKey)
      .maybeSingle();
    if (error) throw new Error("튜토리얼 상태를 불러오지 못했습니다.");
    const shouldShow =
      !data ||
      data.seen_version < tutorialVersion ||
      (!data.dismissed_at && !data.completed_at);
    return NextResponse.json({ shouldShow, tutorialVersion });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "튜토리얼 상태를 불러오지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session)
    return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const { action } = actionSchema.parse(await request.json());
    const now = new Date().toISOString();
    const { error } = await createAdminClient()
      .from("qa_user_tutorials")
      .upsert(
        {
          user_id: session.userId,
          tutorial_key: tutorialKey,
          seen_version: tutorialVersion,
          dismissed_at: action === "dismiss" ? now : null,
          completed_at: action === "complete" ? now : null,
          updated_at: now,
        },
        { onConflict: "user_id,tutorial_key" },
      );
    if (error) throw new Error("튜토리얼 상태를 저장하지 못했습니다.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "튜토리얼 상태를 저장하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
