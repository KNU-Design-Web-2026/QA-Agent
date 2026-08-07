import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const QA_ACCESS_COOKIE = "knud_qa_access";

export type QaAccessSession = { userId: string; email: string; displayName: string };

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "QA_SHARED_ACCESS_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  return value;
}

function signature(value: string) {
  return createHmac("sha256", required("QA_SHARED_ACCESS_PASSWORD")).update(value).digest("base64url");
}

export function createAccessToken(session: QaAccessSession) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readAccessToken(token: string | undefined): QaAccessSession | null {
  if (!token) return null;
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) return null;
  const expectedSignature = signature(payload);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as QaAccessSession & { exp: number };
    if (!value.userId || !value.email || !value.displayName || value.exp < Date.now()) return null;
    return { userId: value.userId, email: value.email, displayName: value.displayName };
  } catch { return null; }
}

export function verifySharedPassword(password: string) {
  const expected = Buffer.from(signature("shared-password-check"));
  const actual = Buffer.from(createHmac("sha256", password).update("shared-password-check").digest("base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAdminClient() {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function establishQaAccess(emailInput: string): Promise<QaAccessSession> {
  const email = emailInput.trim().toLowerCase();
  const supabase = createAdminClient();
  const { data: allowlist, error: allowlistError } = await supabase
    .from("access_allowlist").select("email, display_name").eq("email", email).is("revoked_at", null).maybeSingle();
  if (allowlistError || !allowlist) throw new Error("초대되지 않은 이메일입니다.");

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error("사용자 계정을 확인하지 못했습니다.");
  let user = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: allowlist.display_name } });
    if (error || !data.user) throw new Error("사용자 계정을 준비하지 못했습니다.");
    user = data.user;
  }
  return { userId: user.id, email, displayName: allowlist.display_name || email.split("@")[0] };
}
