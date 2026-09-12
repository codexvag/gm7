# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim AS base

LABEL app="GM7 RPG - Render Free Tier Edition"

WORKDIR /app

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="10000"
ENV NODE_OPTIONS="--max-old-space-size=384"

ARG PNPM_VERSION=12.3.4
RUN npm install -g pnpm@$PNPM_VERSION

# Install system dependencies needed for native modules and workerd
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    ca-certificates \
    curl \
    build-essential \
    python-is-python3 \
    pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Install node dependencies
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build application with vinext (generates dist/server and dist/client)
RUN pnpm run build

# Ensure state directory exists
RUN mkdir -p .wrangler/state

# Expose Render default port
EXPOSE 10000

# Start unified server (frontend + backend + D1 + SSE)
CMD [ "node", "./scripts/start-server.mjs" ]
