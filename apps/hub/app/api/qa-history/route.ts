import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAdminClient,
  QA_ACCESS_COOKIE,
  readAccessToken,
} from "@/lib/qa-access";

async function requireSession() {
  return readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session)
    return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });

  try {
    const projectSlug = new URL(request.url).searchParams.get("projectSlug");
    if (!projectSlug) throw new Error("프로젝트 정보가 필요합니다.");

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", projectSlug)
      .single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");

    const { data: comments, error: commentsError } = await supabase
      .from("qa_comments")
      .select(
        "id, body, priority, status, pathname, viewport_width, viewport_height, scroll_x, scroll_y, element_qa_id, normalized_anchor_json, created_at, deployment_id, author_id",
      )
      .eq("project_id", project.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (commentsError) throw new Error("QA 기록을 불러오지 못했습니다.");

    const deploymentIds = [...new Set((comments ?? []).map((comment) => comment.deployment_id))];
    const authorIds = [...new Set((comments ?? []).map((comment) => comment.author_id))];
    const [{ data: deployments }, { data: authors }] = await Promise.all([
      deploymentIds.length
        ? supabase
            .from("deployments")
            .select("id, immutable_url, git_sha, deployed_at")
            .in("id", deploymentIds)
        : Promise.resolve({ data: [] }),
      authorIds.length
        ? supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", authorIds)
        : Promise.resolve({ data: [] }),
    ]);
    const deploymentById = new Map(
      (deployments ?? []).map((deployment) => [deployment.id, deployment]),
    );
    const authorById = new Map(
      (authors ?? []).map((author) => [author.id, author]),
    );

    return NextResponse.json({
      comments: (comments ?? []).map((comment) => ({
        ...comment,
        deployment: deploymentById.get(comment.deployment_id) ?? null,
        author: authorById.get(comment.author_id) ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "QA 기록을 불러오지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
