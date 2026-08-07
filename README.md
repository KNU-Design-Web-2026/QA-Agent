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
