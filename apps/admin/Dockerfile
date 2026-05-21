FROM node:20-alpine

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY scripts ./scripts
COPY apps ./apps
COPY services ./services
COPY packages ./packages

ARG NEXT_PUBLIC_API_BASE_URL=https://readerapi.vidhyavibe.in
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter apps-admin build

WORKDIR /repo/apps/admin

ENV NODE_ENV=production
ENV PORT=3034

EXPOSE 3034

CMD ["pnpm", "start", "--", "-p", "3034"]
