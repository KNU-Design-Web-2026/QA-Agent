# KNUD Design QA Hub

> “여기 조금 어색해요”를, 같은 화면에서 다시 확인할 수 있는 수정 요청으로.

경북대학교 디자인학과 졸업전시 사이트를 개발하며 만든 **디자이너·개발자 협업용 시각 QA 서비스**입니다. 실제 사이트에서 핀을 찍거나 영역을 드래그하면, 의견과 함께 페이지·화면 크기·스크롤·좌표·검수 버전을 기록합니다.

[QA Hub 열기](https://qa-agent-hub-rust.vercel.app/) · [전시 사이트](https://www.2026-knud-graduation.com/) · [개발 블로그](https://velog.io/@subjeelee/series/KNUD-QA) · [설계 의사결정](https://github.com/KNU-Design-Web-2026/QA-Agent/discussions)

<img src="https://velog.velcdn.com/images/subjeelee/post/a0cab6a2-c86c-4f5a-8bef-1dc0035bcb06/image.gif" width="100%" alt="실제 전시 사이트를 탐색하며 화면 크기와 주석 도구를 사용하는 QA Hub 시연" />

*아래 자료는 개발 블로그에 공개한 실제 사용 화면입니다. 촬영 시점에 따라 현재 UI와 일부 차이가 있습니다. QA Hub는 초대된 협업자만 로그인할 수 있습니다.*

## 목차

- [왜 만들었나요](#왜-만들었나요)
- [핵심 기능](#핵심-기능)
- [기술적 고민과 구현](#기술적-고민과-구현)
- [기술 스택과 구성](#기술-스택과-구성)
- [로컬 실행](#로컬-실행)
- [설계 문서와 개발 기록](#설계-문서와-개발-기록)

## 왜 만들었나요

전시 사이트를 Figma 기준으로 구현해도, 실제 브라우저에서 움직이고 반응형으로 변하는 화면은 디자인 시안과 다르게 느껴질 수 있습니다. 디자이너는 실제 화면에서 그 차이를 발견하지만, 개발자가 같은 문제를 확인하려면 어느 페이지인지, 어떤 화면 크기인지, 어디까지 스크롤했는지를 다시 물어야 했습니다.

개별 대화는 짧아도 의견이 쌓일수록 같은 설명을 반복하게 됐습니다. 수정 후에도 무엇이 반영됐고 무엇이 남았는지 대화방의 기록만으로 파악하기 어려웠습니다. 특히 직접 만나지 않고 온라인으로 협업할 때는 서로 다른 화면을 보고 이야기하는 일이 생겼습니다.

디자이너가 문제를 발견할 때마다 주소와 화면 조건을 직접 적게 하는 방식은 부담이 큽니다. 그래서 **설명하지 않아도 필요한 맥락이 함께 남는 환경**을 만들고자 했습니다.

QA Hub에서는 디자이너가 사이트를 보다가 문제 위치를 표시하고 의견을 작성합니다. 개발자는 저장된 조건으로 화면을 다시 열어 수정하고, 디자이너는 수정된 화면을 확인해 최종 완료 여부를 판단합니다. 시각적 판단을 실행 가능한 수정 요청으로 전달하고, 그 과정을 기록으로 남기는 것이 목적입니다.

| 협업에서 겪은 문제 | QA Hub의 접근 |
| --- | --- |
| “여기”가 어느 위치인지 다시 설명해야 함 | 핀·영역과 페이지·화면 조건을 함께 저장 |
| 서로 다른 크기와 버전의 화면을 보고 대화함 | 검수 뷰포트와 배포 버전을 선택하고 기록 |
| 개발자의 수정 완료가 디자인 확인 완료로 처리됨 | 수정 완료·검토 요청과 최종 확인을 분리 |
| 과거 의견과 처리 결과가 대화 사이에 흩어짐 | 전체 QA 목록과 상태 변경 이력으로 보관 |

자동으로 디자인의 정답을 판정하는 서비스는 아닙니다. 사람이 발견한 문제를 같은 맥락에서 확인하고 합의하도록 돕습니다. 협업 시간의 감소율은 별도로 측정하지 않았습니다.

## 핵심 기능

### 1. 실제 사이트에서 핀·영역으로 의견 남기기

전시 사이트를 탐색하다가 수정이 필요한 곳에 핀을 찍거나 영역을 드래그합니다. 의견과 우선순위를 입력하면 작성 당시의 페이지, 뷰포트, 스크롤, 좌표, 배포 정보가 함께 저장됩니다. 자신의 의견은 수정하거나 삭제할 수 있습니다.

<img src="https://velog.velcdn.com/images/subjeelee/post/7f9741b9-60f4-48e7-a52f-1eba534fc21c/image.gif" width="100%" alt="수정이 필요한 위치에 의견을 남기고 재현 정보를 함께 전달하는 실제 사용 흐름" />

*의견 본문과 화면 조건을 함께 남겨, 개발자가 위치를 다시 묻는 상황을 줄이고자 했습니다.*

### 2. 검수할 화면 크기와 표시 배율을 따로 선택하기

1920 × 1340, 1350 × 900, 1020 × 1370, 600 × 980, 400 × 880 규격에서 반응형 화면을 확인합니다. 큰 화면도 작은 작업 공간에 들어오도록 표시 배율을 조절하고, 좌우 패널을 접어 검수 공간을 넓힐 수 있습니다.

<img src="https://velog.velcdn.com/images/subjeelee/post/da300e53-2a9d-4dc5-9681-8946f2c61a22/image.gif" width="100%" alt="검수 화면의 표시 배율을 바꾸며 전시 사이트를 확인하는 시연" />

*1920px 화면을 50%로 표시해도 사이트가 레이아웃을 계산하는 너비는 1920px로 유지됩니다. ‘실제 크기로 열기’에서는 별도 브라우저 창으로 사이트를 확인합니다.*

### 3. 코멘트를 누르면 작성한 페이지와 위치로 이동하기

현재 페이지의 코멘트와 해당 버전 전체의 코멘트를 구분해 확인합니다. 목록에서 의견을 선택하면 저장된 페이지·뷰포트·스크롤을 복원하고, 핀과 영역은 해당 페이지에서만 표시합니다.

<img src="https://velog.velcdn.com/images/subjeelee/post/521297f5-249c-41cb-a8b1-302e13f4e69c/image.gif" width="100%" alt="QA Bridge 적용 후 페이지와 스크롤에 맞춰 코멘트 위치를 복원하는 실제 서비스 시연" />

*QA Bridge 적용 후 동작입니다. 전시 사이트 내부의 경로와 스크롤을 Hub에 전달해 다른 페이지에 마커가 남거나 콘텐츠와 별개로 움직이는 문제를 해결했습니다.*

### 4. 수정 완료와 디자이너 최종 확인을 분리하기

개발자가 작업을 시작하고 수정한 뒤에는 디자이너에게 보여 줄 수정 화면을 선택해 검토를 요청합니다. 디자이너는 연결된 화면을 확인하고 ‘확인 완료’ 또는 ‘다시 수정 요청’을 선택합니다.

| 작업 시작 | 수정 완료 · 검토 요청 | 디자이너 최종 확인 |
| :---: | :---: | :---: |
| <img src="https://velog.velcdn.com/images/subjeelee/post/31298b03-f32d-477f-b3ce-df2fc89117b1/image.png" width="270" alt="열림 상태의 코멘트에 작업 시작 버튼이 표시된 화면" /> | <img src="https://velog.velcdn.com/images/subjeelee/post/c5850cb9-747d-4b0d-91e1-b303bc951902/image.png" width="270" alt="진행 중 코멘트에서 수정 화면을 선택하고 검토를 요청하는 화면" /> | <img src="https://velog.velcdn.com/images/subjeelee/post/d3579f44-ba97-439d-8893-11739aa4912a/image.png" width="270" alt="디자이너가 수정 화면을 확인하고 완료 또는 재수정을 선택하는 화면" /> |
| 수정에 들어갔음을 공유 | 확인할 수정 버전을 연결 | 디자인 의도에 맞는지 확인 |

*상태별 실제 UI를 비교한 자료입니다. 세 스크린샷의 의견은 서로 다르며, 하나의 의견이 연속으로 처리된 기록은 아닙니다.*

<details>
<summary>검토 흐름을 GIF로 보기</summary>

<img src="https://velog.velcdn.com/images/subjeelee/post/10d3662f-876e-4750-a401-15060ce20ae6/image.gif" width="100%" alt="QA 의견의 작업과 검토 상태를 확인하는 실제 사용 시연" />

</details>

### 5. 버전별 기록과 다음 할 일 확인하기

- 검수 버전에 이름과 설명을 붙이고, 과거 버전의 의견도 전체 QA 목록에서 확인합니다.
- 의견을 처음 남긴 버전과 수정 결과를 확인할 버전을 별도로 연결합니다.
- 새 의견은 관리자에게, 검토 요청은 작성자 또는 지정된 검토 대상에게 앱 내 알림으로 안내합니다.
- 완료된 의견은 검수 화면에서 숨기고 전체 QA 목록에는 기록으로 남깁니다.
- 관리자 메일 알림은 Resend 설정 시 사용하며, 메일 발송 실패가 코멘트 저장을 실패시키지 않도록 분리했습니다.

### 6. 수정 작업에 필요한 맥락 내보내기

전체 QA 목록에서 최대 5개 의견을 선택해 Markdown 또는 JSON으로 복사·다운로드할 수 있습니다. 본문뿐 아니라 버전, 화면 크기, 좌표, 재현 링크와 SVG 위치 안내를 함께 전달합니다.

개발자나 수정 Agent가 요청을 이해하도록 돕는 기능으로, 내보내기만으로 전시 사이트 코드가 자동 수정되거나 QA가 자동 완료되지는 않습니다.

## 기술적 고민과 구현

### 드래그 좌표: 화면에 보이는 픽셀과 저장 좌표 분리

축소 화면의 포인터 위치를 원본 CSS 뷰포트 좌표로 환산한 뒤, 시작점과 너비·높이를 뷰포트 대비 비율로 저장합니다. Pointer Capture로 드래그 입력을 처리하고 작성 중인 영역과 저장된 의견의 상태를 구분합니다.

다시 그릴 때는 정규화 좌표에 뷰포트 크기를 곱하고, 저장 당시와 현재 스크롤의 차이를 반영합니다.

```ts
// iframe 내부 CSS 좌표 기준. 표시 배율은 화면을 그리는 단계에서 적용합니다.
const y = anchor.y * viewport.height + savedScroll.y - currentScroll.y;
```

[드래그·저장 구현](apps/hub/components/qa-workspace.tsx) · [좌표 복원](apps/hub/lib/comment-anchor.ts) · [좌표 테스트](apps/hub/lib/comment-anchor.test.ts)

### iframe 경계: 경로·스크롤을 명시적인 메시지로 동기화

Hub와 전시 사이트의 출처가 달라 Hub가 iframe 내부 상태를 직접 읽을 수 없습니다. 전시 사이트 측 Bridge가 `postMessage`로 경로와 스크롤을 전달하고, Hub는 메시지를 보낸 window, origin, type·version과 데이터 형식을 검사합니다.

Bridge의 `route-ready`에 Hub가 `subscribe-route`로 응답하고, iframe `load`에서도 구독을 다시 요청합니다. 코멘트 이동 시에는 목표 경로가 확인된 다음 스크롤 복원을 요청합니다.

[메시지 검증](apps/hub/lib/qa-route-bridge.ts) · [메시지 테스트](apps/hub/lib/qa-route-bridge.test.ts) · [코멘트 이동](apps/hub/lib/comment-navigation.ts)

**복원 범위:** 저장된 화면 조건과 스크롤을 이용한 위치 복원입니다. 새 배포에서 콘텐츠 배치가 달라진 경우 같은 DOM 요소를 자동 추적한다고 보장하지 않습니다. 기존 배포에 Bridge가 포함되지 않았다면 새 Hub만 배포해도 해당 화면의 경로·스크롤을 수신할 수 없습니다.

### 검토 상태: 작성 버전과 검토 버전, 행동 권한 분리

`deployment_id`는 의견이 작성된 버전, `review_deployment_id`는 수정 결과를 확인할 버전을 가리킵니다. DB 함수에서 역할과 현재 상태를 확인하고 상태 변경과 이력을 함께 기록합니다. 관리자가 직접 작성한 의견도 별도의 디자이너에게 검토를 요청할 수 있습니다.

[코멘트 API](apps/hub/app/api/comments/route.ts) · [검토 버전 연결](supabase/migrations/20260829000100_review_target_deployment.sql) · [최종 확인 권한](supabase/migrations/20260810000400_review_recipient_final_confirmation.sql)

## 기술 스택과 구성

| 영역 | 기술 · 역할 |
| --- | --- |
| QA 화면 · API | Next.js 16, React 19, TypeScript — 검수 도구와 서버 Route Handler |
| 데이터 · 파일 | Supabase PostgreSQL, Storage — 의견·버전·이력과 캡처 자산 |
| 접근 제어 | 허용 이메일·공유 비밀번호, 서명된 접근 쿠키, 서버 권한 검사 |
| 화면 상태 전달 | iframe, postMessage — 전시 사이트의 경로·스크롤 수신 |
| 입력 검증 · 테스트 | Zod, Vitest |
| 메일 | Resend — 새 의견의 관리자 메일 알림 |
| 배포 | Vercel — QA Hub / Render Background Worker — 별도 캡처 처리 구성 |
| 워크스페이스 | pnpm workspaces |

```text
apps/hub/                   검수 화면, 전체 QA 목록, Next.js API
packages/qa-bridge/          Bridge 프로토콜·좌표 유틸리티
packages/qa-capture-worker/  Playwright 기반 비동기 캡처 Worker
supabase/migrations/        테이블·권한·상태 전환 함수
docs/                       기획·설계·검증 계획
```

브라우저는 화면과 작성 중 상태를 관리하고, Hub API는 접근과 입력을 확인해 Supabase에 저장합니다. 전시 사이트는 별도 저장소에서 배포하며, 그 안에 포함된 Bridge가 화면 상태를 Hub로 전달합니다.

캡처 Worker는 큐의 작업을 가져와 Playwright로 배포 화면을 열고 private Storage에 PNG를 저장하는 별도 프로세스입니다. [배포 구성](render.yaml)이 저장소에 포함되어 있지만, 이 README의 시연 자료는 실제 사용을 직접 촬영한 것으로 Worker의 운영 가동 여부나 캡처 성공을 증명하는 자료는 아닙니다.

## 로컬 실행

### 1. 의존성과 환경 변수

Node.js와 pnpm 9.15.3을 준비합니다.

```bash
git clone https://github.com/KNU-Design-Web-2026/QA-Agent.git
cd QA-Agent
pnpm install
cp apps/hub/.env.example apps/hub/.env.local
```

[환경 변수 예시](apps/hub/.env.example)를 참고해 Supabase 연결, 프로젝트 slug, QA 대상 배포 URL, 공유 접근 비밀번호를 설정합니다. `SUPABASE_SERVICE_ROLE_KEY`, `QA_SHARED_ACCESS_PASSWORD`, `RESEND_API_KEY`는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

### 2. 데이터베이스 준비

새 Supabase 프로젝트에는 [migrations](supabase/migrations)의 SQL을 파일명 순서대로 모두 적용한 뒤, [seed 예시](supabase/seed.example.sql)의 조직·프로젝트·허용 이메일을 자신의 환경에 맞게 설정합니다. 기존 DB에는 아직 적용하지 않은 마이그레이션만 적용합니다.

초기 마이그레이션만 적용하면 이후 추가된 튜토리얼·검토 요청 함수 등을 찾지 못할 수 있습니다. API 코드와 DB 스키마를 함께 갱신해야 합니다.

### 3. 실행과 검증

```bash
pnpm dev        # http://localhost:3000
pnpm typecheck # 타입 검사
pnpm test      # 워크스페이스 테스트
pnpm build     # 프로덕션 빌드
```

전시 사이트 경로·스크롤 연동을 검증하려면 QA 대상 배포에도 Bridge가 있어야 하며, 허용 Hub origin 설정에 로컬 주소를 포함해야 합니다. 특정 검수 버전을 보존하려면 최신 배포를 가리키는 production alias 대신 고유 배포 URL을 등록합니다.

<details>
<summary>선택 설정: 메일 알림과 캡처 Worker</summary>

**메일 알림:** Resend에서 발신 도메인을 인증하고 Vercel 서버 환경 변수에 `RESEND_API_KEY`, `QA_NOTIFICATION_FROM`, `QA_ADMIN_EMAIL`을 등록합니다. 메일의 Hub 링크는 `NEXT_PUBLIC_APP_URL`로 설정합니다. API 요청 성공과 실제 수신함 도착은 다르므로 Resend 전달 상태도 확인합니다.

**캡처 Worker:** [render.yaml](render.yaml)을 Background Worker로 연결하고 [Worker 환경 변수 예시](packages/qa-capture-worker/.env.example)를 설정합니다. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하며 일반 Web Service처럼 외부 포트를 열지 않습니다.

</details>

## 설계 문서와 개발 기록

| 문서 | 내용 |
| --- | --- |
| [제품 요구사항](docs/knud-design-qa-hub-prd.md) | 제작 배경과 사용자 문제 |
| [기술 설계](docs/technical-design.md) · [데이터 모델](docs/data-model.md) | 초기 구조와 데이터 설계 |
| [MVP 구현 계획](docs/mvp-implementation-plan.md) · [사용 검증 계획](docs/mvp-validation-plan.md) | 초기 범위와 확인할 가설 |
| [Discussion](https://github.com/KNU-Design-Web-2026/QA-Agent/discussions) | 내보내기·최종 검토·알림 등 의사결정 |
| [KNUD-QA 블로그 시리즈](https://velog.io/@subjeelee/series/KNUD-QA) | 제작 배경 → MVP → 데이터 → 좌표 → Bridge → 검토 흐름 |
| [전시 사이트 저장소](https://github.com/KNU-Design-Web-2026/knud2026) | QA 대상 사이트와 사이트 측 Bridge 구현 |

초기 설계 문서에는 계획 단계의 기능이 포함될 수 있습니다. 현재 동작은 코드와 마이그레이션을 기준으로 확인해 주세요.

**기획·개발:** [이준섭](https://github.com/SubJeeLee) — 전시 사이트를 제작하며 발견한 협업 문제를 바탕으로 QA Hub를 기획하고 구현했습니다. 실제 검수 과정에서 받은 디자이너의 피드백을 통해 개선하고 있습니다.

*README 구성 참고: [TADAK](https://github.com/boostcampwm2025/web30-TADAK). 서비스 소개·기능 시연·기술 설명·실행 안내의 흐름을 참고했으며, 사용 화면은 KNUD-QA 블로그의 실제 자료입니다.*
