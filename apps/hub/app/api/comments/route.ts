import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, QA_ACCESS_COOKIE, readAccessToken } from "@/lib/qa-access";

const inputSchema = z.object({ projectSlug: z.string(), deploymentUrl: z.string().url(), body: z.string().min(1), pathname: z.string(), viewportWidth: z.number().int().positive(), viewportHeight: z.number().int().positive(), zoom: z.number().positive(), deviceScaleFactor: z.number().positive(), kind: z.enum(["pin", "area"]), anchor: z.record(z.string(), z.unknown()) });

export async function POST(request: Request) {
  const session = readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("slug", input.projectSlug).single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
    const { data: deployment, error: deploymentError } = await supabase.from("deployments").select("id").eq("project_id", project.id).eq("immutable_url", input.deploymentUrl).single();
    if (deploymentError || !deployment) throw new Error("현재 배포본이 아직 QA 프로젝트에 등록되지 않았습니다.");
    const { data: comment, error: commentError } = await supabase.from("qa_comments").insert({ project_id: project.id, deployment_id: deployment.id, author_id: session.userId, body: input.body, type: "interaction", priority: "high", pathname: input.pathname, query_string: "", viewport_width: input.viewportWidth, viewport_height: input.viewportHeight, device_scale_factor: input.deviceScaleFactor, zoom: input.zoom, scroll_x: 0, scroll_y: 0, element_qa_id: "navigation-toggle", selector_hint_json: {}, normalized_anchor_json: input.anchor }).select("id").single();
    if (commentError || !comment) throw new Error("코멘트를 저장하지 못했습니다.");
    const { error: annotationError } = await supabase.from("annotations").insert({ qa_comment_id: comment.id, kind: input.kind === "area" ? "rect" : "pin", geometry_json: input.anchor, style_json: { color: "yellow" } });
    if (annotationError) throw new Error("코멘트 위치를 저장하지 못했습니다.");
    return NextResponse.json({ id: comment.id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "코멘트를 저장하지 못했습니다." }, { status: 400 }); }
}
