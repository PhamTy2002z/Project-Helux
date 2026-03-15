# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . ./

# All NEXT_PUBLIC_* vars must be available at build time to be baked into
# the Next.js client bundle. Pass them as build args from compose.
ARG NEXT_PUBLIC_API_URL=auto
ARG NEXT_PUBLIC_AUTH_MODE
ARG NEXT_PUBLIC_AUTH_PROFILE
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1
ARG NEXT_PUBLIC_BOARD_QUERY_V2

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE}
ENV NEXT_PUBLIC_AUTH_PROFILE=${NEXT_PUBLIC_AUTH_PROFILE}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1=${NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1}
ENV NEXT_PUBLIC_BOARD_QUERY_V2=${NEXT_PUBLIC_BOARD_QUERY_V2}

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# curl is needed for Docker healthcheck probes
RUN apk add --no-cache curl

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
