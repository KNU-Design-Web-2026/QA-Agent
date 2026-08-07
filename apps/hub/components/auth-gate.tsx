"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setUser(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase 환경 변수가 아직 설정되지 않았습니다.");
      return;
    }
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) setError("로그인 링크를 보낼 수 없습니다. 허용된 이메일인지 확인해 주세요.");
    else setSent(true);
  }

  if (user === undefined) return <main className="auth-loading">KNUD Design QA Hub 연결 중…</main>;
  if (user) return <>{children}</>;

  return <main className="auth-page">
    <header className="auth-header"><strong>KNUD 2026</strong><span>DESIGN QA HUB</span></header>
    <section className="auth-card">
      <p>COLLABORATION ACCESS</p>
      <h1>검수의 기준을<br />같은 화면에 남깁니다.</h1>
      <span>초대된 전시 팀 구성원만 실제 배포본을 검수하고, 코멘트를 기록할 수 있습니다.</span>
      {sent ? <div className="auth-success"><b>로그인 링크를 보냈습니다.</b><span>{email}의 메일함에서 링크를 열어 주세요.</span></div> : <form onSubmit={sendMagicLink}><label>이메일 주소<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required autoComplete="email" /></label>{error && <small>{error}</small>}<button type="submit">로그인 링크 받기 <span aria-hidden="true">↗</span></button></form>}
      <footer>INVITE ONLY · KNU DESIGN WEB 2026</footer>
    </section>
    <div className="auth-corner" aria-hidden="true">QA<br />01</div>
  </main>;
}
