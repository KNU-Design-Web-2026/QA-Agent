"use client";

import { useEffect, useState } from "react";

type AccessSession = { email: string; displayName: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccessSession | null>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/access").then((response) => response.json()).then((data) => setUser(data.session ?? null)).catch(() => setUser(null));
  }, []);

  async function verifyAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "접근을 확인하지 못했습니다.");
    else setUser(data.session);
  }

  if (user === undefined) return <main className="auth-loading">KNUD Design QA Hub 연결 중…</main>;
  if (user) return <>{children}</>;

  return <main className="auth-page">
    <section className="auth-card">
      <form onSubmit={verifyAccess}><label className="sr-only" htmlFor="auth-email">이메일 주소</label><input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" required autoComplete="email" autoFocus /><label className="sr-only" htmlFor="auth-password">공용 비밀번호</label><input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" required autoComplete="current-password" />{error && <small>{error}</small>}<button type="submit" aria-label="입장"><span aria-hidden="true">↗</span></button></form>
    </section>
  </main>;
}
