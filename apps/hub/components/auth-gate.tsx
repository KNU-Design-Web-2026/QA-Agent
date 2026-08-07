"use client";

import { useEffect, useState } from "react";
import { Check, EnvelopeSimple, Eye, EyeSlash, LockSimple, WarningCircle } from "@phosphor-icons/react";

type AccessSession = { email: string; displayName: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccessSession | null>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/access").then((response) => response.json()).then((data) => setUser(data.session ?? null)).catch(() => setUser(null));
  }, []);

  async function verifyAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "접근을 확인하지 못했습니다.");
      else setUser(data.session);
    } finally { setIsSubmitting(false); }
  }

  if (user === undefined) return <main className="auth-loading">KNUD Design QA Hub 연결 중…</main>;
  if (user) return <>{children}</>;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 4 && !isSubmitting;

  return (
    <main className="login">
      <aside className="login__brand">
        <div>
          <img className="login__logo" src="/assets/ignite-mark-white.png" alt="IGNITE" width={260} height={145} />
          <h2 className="login__title">2026 제42회 경북대학교<br />디자인학과 졸업전시회</h2>
          <p className="login__subtitle">42th KNUD Graduation Exhibition Archive</p>
          <div className="login__rule" />
          <p className="login__lede">디자이너와 개발자가 같은 화면을 보고 검수합니다.</p>
        </div>
      </aside>
      <section className="login__panel">
        <div className="login__help"><span>계정 문의</span><a href="mailto:lee980605@knu.ac.kr">관리자에게 요청</a></div>
        <form className={`login__form ${error ? "has-error" : ""}`} onSubmit={verifyAccess} noValidate>
          <h1 className="form__heading">로그인</h1>
          <p className="form__lede">등록된 이메일과 공통 비밀번호를 입력하세요.</p>
          {error && <div className="alert" role="alert"><WarningCircle size={18} weight="fill" /><div><div className="alert__title">로그인할 수 없습니다</div><div className="alert__body">등록되지 않은 이메일이거나 비밀번호가 올바르지 않습니다.</div></div></div>}
          <div className="field">
            <label className="field__label" htmlFor="auth-email">이메일</label>
            <div className={`field__control ${emailValid ? "is-filled is-valid" : ""}`}>
              <EnvelopeSimple className="field__icon" size={16} />
              <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@knud.ac.kr" autoComplete="email" required autoFocus />
              <Check className="field__valid" size={16} weight="bold" />
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="auth-password">공통 비밀번호</label>
            <div className={`field__control ${password.length >= 4 ? "is-filled" : ""}`}>
              <LockSimple className="field__icon" size={16} />
              <input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="팀에 공유된 비밀번호" autoComplete="current-password" required />
              <button className="pw-toggle" type="button" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}</button>
            </div>
          </div>
          <label className="remember"><input type="checkbox" defaultChecked /><span className="remember__box"><Check size={12} weight="bold" /></span><span className="remember__label">이 브라우저에서 로그인 유지</span></label>
          <button className="submit" type="submit" disabled={!canSubmit}>{isSubmitting ? "확인 중…" : "로그인"}<span aria-hidden>→</span></button>
          <p className="note">등록된 팀원 계정만 로그인할 수 있습니다. 비밀번호는 프로젝트 전체가 공유하며 관리자가 변경합니다.</p>
          <div className="admin"><span className="admin__avatar">JS</span><div><div className="admin__name">이준섭 <span>프로젝트 관리자</span></div><div className="admin__mail">lee980605@knu.ac.kr</div></div></div>
        </form>
      </section>
    </main>
  );
}
