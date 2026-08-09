import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient, QA_ACCESS_COOKIE, readAccessToken } from "@/lib/qa-access";

async function requireSession() {
  return readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "검토 요청 대상은 관리자만 확인할 수 있습니다." }, { status: 403 });
  try {
    const projectSlug = new URL(request.url).searchParams.get("projectSlug");
    if (!projectSlug) throw new Error("프로젝트 정보가 필요합니다.");
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("organization_id")
      .eq("slug", projectSlug)
      .single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", project.organization_id)
      .eq("role", "designer");
    if (membershipsError) throw new Error("디자이너 목록을 불러오지 못했습니다.");
    const userIds = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
      : { data: [] };
    return NextResponse.json({ reviewers: (profiles ?? []).map((profile) => ({ id: profile.id, displayName: profile.display_name || profile.email.split("@")[0] })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "디자이너 목록을 불러오지 못했습니다." }, { status: 400 });
  }
}
