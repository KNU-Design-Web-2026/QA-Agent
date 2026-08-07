# KNUD Design QA Hub

배포된 KNUD 전시 사이트를 iframe에서 직접 탐색하고, 재현 가능한 시각 QA 코멘트를 남기기 위한 독립 서비스입니다.

## 시작하기

```bash
pnpm install
cp apps/hub/.env.example apps/hub/.env.local
pnpm dev
```

- Hub: `http://localhost:3000`
- QA 대상 URL: `NEXT_PUBLIC_KNUD_DEPLOYMENT_URL`
- Bridge 패키지: `packages/qa-bridge`

현재 첫 구현 단위에는 반응형 캔버스, 코멘트 모드, 핀/영역 좌표 수집, Hub↔Bridge 보안 핸드셰이크 및 telemetry가 포함됩니다. 영속 저장, 인증, Vercel 연동은 문서의 Phase 순서로 연결합니다.

## 문서

- [기술 설계](docs/technical-design.md)
- [데이터 모델](docs/data-model.md)
- [MVP 구현 계획](docs/mvp-implementation-plan.md)
- [MVP 사용 검증 계획](docs/mvp-validation-plan.md)

## 배포 구성

- **Vercel**: `apps/hub`의 Next.js QA Hub. Render에 중복 배포하지 않는다.
- **Supabase**: 인증, PostgreSQL, private `qa-assets` Storage bucket.
- **Render Background Worker**: `packages/qa-capture-worker`의 Playwright 캡처 프로세스. 외부 포트를 열지 않는다.

Render는 저장소 루트의 [`render.yaml`](./render.yaml)을 Blueprint로 연결해 배포한다. 기존에 만든 Render **Web Service**는 삭제하고, `knud-qa-capture-worker`라는 새 **Background Worker**를 생성한다. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Render의 Environment에만 등록한다. service role key는 브라우저/Vercel의 public 환경변수에 넣지 않는다.

Vercel에는 `apps/hub/.env.example`의 `NEXT_PUBLIC_*` 값만 넣는다. Render에는 `packages/qa-capture-worker/.env.example`의 server-only 값만 넣는다. 값이 누락된 Worker는 의도적으로 즉시 종료해 잘못된 배포를 방지한다.

Supabase에는 다음 순서로 SQL을 적용한다.

1. `supabase/migrations/20260807000100_init_qa_hub.sql`
2. `supabase/migrations/20260807000200_capture_jobs_and_storage.sql`
3. `supabase/seed.example.sql`을 실제 조직·프로젝트·허용 이메일로 바꾼 뒤 적용

Worker는 `capture_jobs`에서 작업 하나를 원자적으로 가져오고, 지정된 immutable deployment URL을 Playwright로 다시 열어 PNG를 private bucket에 저장한다. Hub API가 QA 코멘트를 생성할 때 해당 job을 함께 넣는다.
