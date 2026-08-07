# MVP 구현 계획

## 성공 기준

디자이너가 Production deployment를 선택해 5개 고정 viewport에서 사이트를 탐색하고, 핀/영역/화살표 코멘트를 남긴 뒤 개발자가 공유 링크 하나로 동일 SHA·경로·viewport·scroll·요소를 복원할 수 있다.

## Phase 0 — 계약과 spike (현재 시작)

- Hub shell, viewport canvas, comment mode, pin/region draft
- versioned Hub↔Bridge protocol과 fail-closed handshake
- Bridge route/scroll/click telemetry
- 실제 KNUD 페이지 3개에서 iframe/CSP, SPA navigation, `data-qa-id`, screenshot spike
- 재현 정확도 측정: route, scroll ±2 CSS px, element rect drift

종료 조건: 일반 방문에서는 Bridge event listener 외 동작이 없고, 유효하지 않은 세션으로 telemetry를 받을 수 없다.

## Phase 1 — 저장 가능한 vertical slice

- Postgres schema/migration, private object storage
- 초대 기반 로그인과 project-scoped RBAC
- Vercel API로 Production deployment 동기화 및 immutable URL/SHA 저장
- 핀·영역·화살표 작성/수정, priority/type/assignee 입력
- authored/replayed screenshot upload
- QA 상세와 재현 링크

종료 조건: 코멘트 생성부터 다른 계정의 재현까지 end-to-end 동작하고, deployment mismatch가 명확히 차단된다.

## Phase 2 — 협업 workflow

- 목록 filter: status, type, priority, assignee, route, deployment
- 상태 transition 및 재오픈 audit
- 새 코멘트/검토 요청 in-app notification
- 중복 방지용 인접 코멘트 표시(자동 병합은 하지 않음)
- screenshot/capture worker retry와 운영 dashboard

## Phase 3 — hardening 및 pilot

- 권한/IDOR, XSS, postMessage origin, token replay, SSRF 테스트
- Chromium/Safari의 iframe 및 third-party 정책 확인
- viewport 5종 visual regression
- 데이터 보존/삭제 정책, backup/restore 점검
- 디자이너 2명·개발자 2명의 실제 전시 QA pilot

## 첫 2주 권장 순서

1. Day 1–2: 실제 KNUD 저장소에 Bridge adapter와 대표 `data-qa-id` 추가, CSP spike
2. Day 3–4: Hub handshake/telemetry와 viewport shell 연결
3. Day 5: 작성 당시 화면 capture spike, 실패 케이스 기록
4. Day 6–7: auth + schema + comment create API
5. Day 8–9: Vercel deployment sync + reproduce flow
6. Day 10: threat test, pilot checklist, staging 배포

## 우선 검증할 위험

1. KNUD 응답의 `frame-ancestors`/`X-Frame-Options`가 Hub embedding을 허용하는가.
2. 페이지가 iframe 여부에 따라 navigation, fullscreen, pointer lock, media autoplay 동작을 바꾸는가.
3. transient interaction 상태를 어느 정도 재현해야 팀이 "같은 화면"이라고 인정하는가.
4. WebGL/video/cross-origin asset이 Bridge-side capture에 포함되는가.
5. Production alias가 바뀐 뒤에도 immutable deployment URL 접근 권한이 유지되는가.

## 테스트 전략

- unit: protocol schema, coordinate normalization, selector extraction, status transition
- integration: forged origin/token, expired session, route/scroll telemetry, SPA navigation patch
- E2E: 5 viewport × pin/rect/arrow × create/reproduce
- security: project scope IDOR, signed URL expiry, capture worker SSRF/redirect
- visual: Hub chrome만 snapshot; iframe 콘텐츠는 deployment별 evidence로 취급

## 원본 PRD 수신 후 확인할 항목

- 화면 IA와 목록/상세/재현 화면의 차이
- 사용자/역할/알림 대상의 정확한 규칙
- KNUD 기술 스택 및 배포 헤더 설정
- Figma URL 저장 단위와 권한
- screenshot의 법적/보존 요구사항
