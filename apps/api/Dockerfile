FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace configuration and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/web/prisma ./apps/web/prisma
COPY packages/contracts/package.json ./packages/contracts/

# Fetch dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build the API and its runtime workspace dependencies
RUN pnpm --filter @spenza/api... build

# Production image
FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable pnpm

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

# Only install production dependencies
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
RUN pnpm dlx prisma@5.22.0 generate --schema=apps/web/prisma/schema.prisma

COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "apps/api/dist/server.js"]
