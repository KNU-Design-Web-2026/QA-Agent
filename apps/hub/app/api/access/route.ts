import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccessToken, establishQaAccess, QA_ACCESS_COOKIE, readAccessToken, verifySharedPassword } from "@/lib/qa-access";

const inputSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function GET() {
  const session = readAccessToken((await cookies()).get(QA_ACCESS_COOKIE)?.value);
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    if (!verifySharedPassword(input.password)) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    const session = await establishQaAccess(input.email);
    const response = NextResponse.json({ session });
    response.cookies.set(QA_ACCESS_COOKIE, createAccessToken(session), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "접근을 확인하지 못했습니다." }, { status: 400 });
  }
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(QA_ACCESS_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
