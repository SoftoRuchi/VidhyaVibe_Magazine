FROM node:20-alpine

WORKDIR /repo

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter services-api build

WORKDIR /repo/services/api

ENV NODE_ENV=production
ENV PORT=2034

EXPOSE 2034

CMD ["pnpm", "start"]
