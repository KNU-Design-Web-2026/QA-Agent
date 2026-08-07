FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/hub/package.json apps/hub/package.json
COPY packages/qa-bridge/package.json packages/qa-bridge/package.json
COPY packages/qa-capture-worker/package.json packages/qa-capture-worker/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/qa-capture-worker packages/qa-capture-worker
RUN pnpm --filter @knud/qa-capture-worker build

CMD ["pnpm", "--filter", "@knud/qa-capture-worker", "start"]
