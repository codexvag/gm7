# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Vinext"

WORKDIR /app

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="3000"

ARG PNPM_VERSION=12.3.4
RUN npm install -g pnpm@$PNPM_VERSION

# Install system dependencies needed for native modules (sharp, workerd, etc.)
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
RUN pnpm install

# Copy application source code
COPY . .

# Build application with vinext (generates dist/server and dist/client)
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start server using resilient launcher
CMD [ "node", "./scripts/start-server.mjs" ]
