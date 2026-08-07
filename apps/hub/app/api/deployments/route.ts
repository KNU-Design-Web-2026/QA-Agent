import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, QA_ACCESS_COOKIE, readAccessToken } from "@/lib/qa-access";

const deploymentSchema = z.object({
  projectSlug: z.string().min(1),
  immutableUrl: z.string().url(),
  providerDeploymentId: z.string().min(3),
  gitSha: z.string().min(7),
  gitRef: z.string().min(1).default("main"),
  deployedAt: z.string().datetime().optional(),
});
const activateSchema = z.object({ projectSlug: z.string().min(1), deploymentId: z.string().uuid() });

async function requireSession() {
  return readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  try {
    const projectSlug = new URL(request.url).searchParams.get("projectSlug");
    if (!projectSlug) throw new Error("프로젝트 정보가 필요합니다.");
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("projects").select("id, qa_active_deployment_id").eq("slug", projectSlug).single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
    const { data, error } = await supabase
      .from("deployments")
      .select("id, immutable_url, production_alias, git_sha, git_ref, provider_deployment_id, deployed_at, created_at")
      .eq("project_id", project.id)
      .eq("state", "ready")
      .order("deployed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error("배포 버전 목록을 불러오지 못했습니다.");
    return NextResponse.json({ activeDeploymentId: project.qa_active_deployment_id, deployments: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "배포 버전 목록을 불러오지 못했습니다." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "배포 버전은 관리자만 등록할 수 있습니다." }, { status: 403 });
  try {
    const input = deploymentSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("projects").select("id, qa_active_deployment_id").eq("slug", input.projectSlug).single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
    const productionAlias = (process.env.NEXT_PUBLIC_KNUD_DEPLOYMENT_URL ?? "").replace(/\/$/, "") || null;
    const { data, error } = await supabase
      .from("deployments")
      .upsert({
        project_id: project.id,
        provider: "vercel",
        provider_deployment_id: input.providerDeploymentId,
        immutable_url: input.immutableUrl.replace(/\/$/, ""),
        production_alias: productionAlias,
        git_sha: input.gitSha,
        git_ref: input.gitRef,
        deployed_at: input.deployedAt ?? new Date().toISOString(),
        state: "ready",
      }, { onConflict: "project_id,immutable_url" })
      .select("id, immutable_url, production_alias, git_sha, git_ref, provider_deployment_id, deployed_at, created_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "배포 버전을 등록하지 못했습니다.");
    if (!project.qa_active_deployment_id) {
      const { error: activateError } = await supabase.from("projects").update({ qa_active_deployment_id: data.id }).eq("id", project.id);
      if (activateError) throw new Error("첫 QA 기준 버전을 설정하지 못했습니다.");
    }
    return NextResponse.json({ deployment: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "배포 버전을 등록하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "접근 세션이 만료되었습니다." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "QA 기준 버전은 관리자만 변경할 수 있습니다." }, { status: 403 });
  try {
    const input = activateSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("slug", input.projectSlug).single();
    if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
    const { data: deployment, error: deploymentError } = await supabase.from("deployments").select("id").eq("id", input.deploymentId).eq("project_id", project.id).eq("state", "ready").single();
    if (deploymentError || !deployment) throw new Error("선택한 배포 버전을 찾을 수 없습니다.");
    const { error } = await supabase.from("projects").update({ qa_active_deployment_id: deployment.id }).eq("id", project.id);
    if (error) throw new Error("QA 기준 버전을 변경하지 못했습니다.");
    return NextResponse.json({ activeDeploymentId: deployment.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QA 기준 버전을 변경하지 못했습니다." }, { status: 400 });
  }
}
