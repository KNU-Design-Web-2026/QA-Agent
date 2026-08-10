# KNUD Design QA Hub

배포된 KNUD 전시 사이트를 iframe에서 직접 탐색하고, 재현 가능한 시각 QA 코멘트를 남기기 위한 독립 서비스입니다.

## 왜 만들었나요

전시 사이트를 Figma 기준으로 구현해도, 실제 브라우저에서 움직이고 반응형으로 변하는 화면은 디자인 시안과 다르게 느껴질 수 있습니다. 디자이너는 실제 배포 화면을 보며 그 차이를 빠르게 발견하지만, “여기가 어색해요”라는 피드백만으로는 개발자가 같은 위치·화면 크기·스크롤 상태를 다시 만들기 어렵습니다.

KNUD Design QA Hub는 이 온라인 협업의 빈틈을 줄이기 위해 만들었습니다. 디자이너가 실제 전시 사이트를 직접 탐색하다가 문제 위치에 의견을 남기면, 개발자는 같은 배포본과 화면 조건에서 그 의견을 확인합니다. 별도의 미팅이나 긴 설명에 의존하지 않고도, 시각적 판단을 실행 가능한 수정 요청으로 전달하는 것이 목표입니다.

## 협업 방식

- 실제 배포된 전시 사이트를 검수 화면 안에서 그대로 확인합니다.
- 컴퓨터·태블릿·휴대폰 크기를 선택해 반응형 화면을 검수합니다.
- 핀 또는 영역을 남기고, 우선순위와 함께 의견을 작성합니다.
- 의견에는 배포본, 페이지 경로, 뷰포트, 좌표가 함께 저장됩니다.
- 작성자·개발자 모두 의견 목록과 처리 상태를 확인하고, 작성자는 자신의 의견을 수정할 수 있습니다.
- 완료된 의견과 수정 이력도 남겨 다음 협업에서 참고할 수 있습니다.

이 도구는 “디자인 시안과 다르다”는 모호한 피드백을, 같은 화면에서 재현 가능한 협업 기록으로 바꾸는 데 초점을 둡니다.

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
