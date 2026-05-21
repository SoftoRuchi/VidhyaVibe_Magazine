FROM node:20-alpine

WORKDIR /repo

# Pin pnpm 9 — corepack otherwise installs pnpm 11 which needs Node 22+ (node:sqlite).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages

ARG NEXT_PUBLIC_API_BASE_URL=https://readerapi.vidhyavibe.in
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter apps-web build

WORKDIR /repo/apps/web

ENV NODE_ENV=production
ENV PORT=1034

EXPOSE 1034

CMD ["pnpm", "start", "--", "-p", "1034"]
