# Multi-stage build for Next.js application

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

# Install dependencies for the web app
RUN pnpm install --filter=web... --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace files
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web

WORKDIR /app/apps/web

# Remove prisma.config.ts as it's not needed in Docker builds and causes dotenv dependency issues
RUN rm -f prisma.config.ts

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install ffmpeg for audio merging functionality
RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (this includes all necessary files)
COPY --from=builder /app/apps/web/.next/standalone /app

# Copy static files
COPY --from=builder /app/apps/web/.next/static /app/apps/web/.next/static

# Copy public folder if it exists, otherwise create empty dir
RUN mkdir -p /app/apps/web/public

# Copy prisma files (client is generated to src/generated/prisma)
COPY --from=builder /app/apps/web/prisma /app/apps/web/prisma
COPY --from=builder /app/apps/web/src/generated/prisma /app/apps/web/src/generated/prisma

# Create uploads directory and set proper permissions
RUN mkdir -p /app/apps/web/uploads/audio /app/apps/web/uploads/temp && \
    chown -R nextjs:nodejs /app/apps/web/uploads

USER nextjs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
