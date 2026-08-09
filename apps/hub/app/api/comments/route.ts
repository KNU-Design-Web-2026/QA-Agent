import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, QA_ACCESS_COOKIE, readAccessToken } from "@/lib/qa-access";

const inputSchema = z.object({ projectSlug: z.string(), deploymentUrl: z.string().url(), body: z.string().min(1), pathname: z.string(), viewportWidth: z.number().int().positive(), viewportHeight: z.number().int().positive(), zoom: z.number().positive(), deviceScaleFactor: z.number().positive(), kind: z.enum(["pin", "area"]), anchor: z.record(z.string(), z.unknown()), type: z.enum(["visual", "interaction", "content", "design_reference"]), priority: z.enum(["low", "medium", "high", "blocker"]) });
const transitionSchema = z.object({ commentId: z.string().uuid(), nextStatus: z.enum(["open", "in_progress", "review_requested", "done"]), note: z.string().max(500).optional() });
const editSchema = z.object({ action: z.literal("edit"), commentId: z.string().uuid(), body: z.string().trim().min(1).max(5000), priority: z.enum(["low", "medium", "high", "blocker"]) });

async function requireSession() {
  const session = readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
  if (!session) return null;
  return session;
}

async function findProjectAndDeployment(projectSlug: string, deploymentUrl: string) {
  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase.from("projects").select("id, organization_id").eq("slug", projectSlug).single();
  if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
  const { data: deployment, error: deploymentError } = await supabase.from("deployments").select("id, git_sha, deployed_at").eq("project_id", project.id).eq("immutable_url", deploymentUrl).single();
  if (deploymentError || !deployment) throw new Error("현재 배포본이 아직 QA 프로젝트에 등록되지 않았습니다.");
  return { supabase, project, deployment };
}

async function notifyAdmins(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  commentId: string,
  kind: "comment_created" | "reopened" | "confirmed",
  excludeUserId?: string,
) {
  const { data: admins } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "admin");
  const recipients = (admins ?? []).map((admin) => admin.user_id).filter((userId) => userId !== excludeUserId);
  if (recipients.length)
    await supabase.from("notifications").insert(
      recipients.map((userId) => ({ user_id: userId, qa_comment_id: commentId, kind })),
    );
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get("projectSlug");
    const deploymentUrl = searchParams.get("deploymentUrl");
    const pathname = searchParams.get("pathname") ?? "/";
    const scope = searchParams.get("scope") ?? "route";
    if (!projectSlug || !deploymentUrl) throw new Error("프로젝트와 배포본 정보가 필요합니다.");
    const { supabase, project, deployment } = await findProjectAndDeployment(projectSlug, deploymentUrl);
    let query = supabase
      .from("qa_comments")
      .select("id, body, type, priority, status, pathname, query_string, viewport_width, viewport_height, device_scale_factor, zoom, scroll_x, scroll_y, element_qa_id, element_rect_json, normalized_anchor_json, created_at, updated_at, author_id")
      .eq("project_id", project.id)
      .eq("deployment_id", deployment.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (scope === "authored") query = query.eq("author_id", session.userId);
    else if (scope !== "all") query = query.eq("pathname", pathname);
    const { data: rows, error } = await query;
    if (error) throw new Error("코멘트 목록을 불러오지 못했습니다.");
    const commentIds = (rows ?? []).map((row) => row.id);
    const [{ data: annotations }, { data: events }] = await Promise.all([
      commentIds.length ? supabase.from("annotations").select("id, qa_comment_id, kind, geometry_json, style_json, z_index").in("qa_comment_id", commentIds).order("z_index") : Promise.resolve({ data: [] }),
      commentIds.length ? supabase.from("qa_events").select("id, qa_comment_id, actor_id, kind, from_status, to_status, payload_json, created_at").in("qa_comment_id", commentIds).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    const profileIds = [...new Set([...(rows ?? []).map((row) => row.author_id), ...(events ?? []).map((event) => event.actor_id).filter(Boolean)])];
    const { data: authors } = profileIds.length
      ? await supabase.from("profiles").select("id, display_name, email").in("id", profileIds)
      : { data: [] };
    const authorById = new Map((authors ?? []).map((author) => [author.id, author]));
    const annotationsByComment = new Map<string, unknown[]>();
    for (const annotation of annotations ?? []) annotationsByComment.set(annotation.qa_comment_id, [...(annotationsByComment.get(annotation.qa_comment_id) ?? []), annotation]);
    const eventsByComment = new Map<string, unknown[]>();
    for (const event of events ?? []) eventsByComment.set(event.qa_comment_id, [...(eventsByComment.get(event.qa_comment_id) ?? []), { ...event, actor: event.actor_id ? authorById.get(event.actor_id) ?? null : null }]);
    return NextResponse.json({ deployment: { id: deployment.id, gitSha: deployment.git_sha, deployedAt: deployment.deployed_at }, comments: (rows ?? []).map((row) => ({ ...row, author: authorById.get(row.author_id) ?? null, annotations: annotationsByComment.get(row.id) ?? [], events: eventsByComment.get(row.id) ?? [] })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "코멘트 목록을 불러오지 못했습니다." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    const { supabase, project, deployment } = await findProjectAndDeployment(input.projectSlug, input.deploymentUrl);
    const { data: comment, error: commentError } = await supabase.from("qa_comments").insert({ project_id: project.id, deployment_id: deployment.id, author_id: session.userId, body: input.body, type: input.type, priority: input.priority, pathname: input.pathname, query_string: "", viewport_width: input.viewportWidth, viewport_height: input.viewportHeight, device_scale_factor: input.deviceScaleFactor, zoom: input.zoom, scroll_x: 0, scroll_y: 0, element_qa_id: null, selector_hint_json: {}, normalized_anchor_json: input.anchor }).select("id").single();
    if (commentError || !comment) throw new Error("코멘트를 저장하지 못했습니다.");
    const { error: annotationError } = await supabase.from("annotations").insert({ qa_comment_id: comment.id, kind: input.kind === "area" ? "rect" : "pin", geometry_json: input.anchor, style_json: { color: "yellow" } });
    if (annotationError) throw new Error("코멘트 위치를 저장하지 못했습니다.");
    await notifyAdmins(supabase, project.organization_id, comment.id, "comment_created", session.userId);
    return NextResponse.json({ id: comment.id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "코멘트를 저장하지 못했습니다." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const payload = await request.json();
    const editInput = editSchema.safeParse(payload);
    const supabase = createAdminClient();
    if (editInput.success) {
      const input = editInput.data;
      const { data: current, error: currentError } = await supabase
        .from("qa_comments")
        .select("id, author_id, body, priority")
        .eq("id", input.commentId)
        .single();
      if (currentError || !current) throw new Error("코멘트를 찾을 수 없습니다.");
      if (current.author_id !== session.userId)
        return NextResponse.json({ error: "작성한 코멘트만 수정할 수 있습니다." }, { status: 403 });
      const { data: comment, error: updateError } = await supabase
        .from("qa_comments")
        .update({ body: input.body, priority: input.priority })
        .eq("id", input.commentId)
        .select("id, body, priority, updated_at")
        .single();
      if (updateError || !comment) throw new Error("코멘트를 수정하지 못했습니다.");
      await supabase.from("qa_events").insert({
        qa_comment_id: input.commentId,
        actor_id: session.userId,
        kind: "edited",
        payload_json: {
          previous: { body: current.body, priority: current.priority },
          changes: { body: input.body, priority: input.priority },
        },
      });
      return NextResponse.json({ comment });
    }
    const input = transitionSchema.parse(payload);
    const { data: currentComment, error: currentCommentError } = await supabase
      .from("qa_comments")
      .select("author_id, project_id, status")
      .eq("id", input.commentId)
      .single();
    if (currentCommentError || !currentComment) throw new Error("코멘트를 찾을 수 없습니다.");
    const { data, error } = await supabase.rpc("transition_qa_comment_as_actor", { comment_id: input.commentId, next_status: input.nextStatus, actor_id: session.userId, note: input.note ?? null });
    if (error || !data) throw new Error(error?.message ?? "상태를 변경하지 못했습니다.");
    if (input.nextStatus === "review_requested" && currentComment.author_id !== session.userId)
      await supabase.from("notifications").insert({ user_id: currentComment.author_id, qa_comment_id: input.commentId, kind: "review_requested" });
    const isReopened =
      (currentComment.status === "review_requested" && input.nextStatus === "in_progress") ||
      (currentComment.status === "done" && input.nextStatus === "open");
    if (input.nextStatus === "done" || isReopened) {
        const { data: project } = await supabase.from("projects").select("organization_id").eq("id", currentComment.project_id).single();
        if (project)
          await notifyAdmins(
            supabase,
            project.organization_id,
            input.commentId,
            input.nextStatus === "done" ? "confirmed" : "reopened",
            session.userId,
          );
    }
    return NextResponse.json({ comment: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." }, { status: 400 });
  }
}
