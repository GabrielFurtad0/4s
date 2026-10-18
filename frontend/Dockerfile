# ===========================================
# TotalTrigo Frontend ERP - Multi-stage Build
# ===========================================

# Stage 1: Build stage with Node.js 22 Alpine
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Clean installation of dependencies
RUN npm ci

# Copy source code and build assets
COPY . .
RUN npm run build

# Stage 2: Production runner stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy application files and built output
COPY --from=builder /app /app

# Ensure correct permissions for built-in non-root node user
RUN chown -R node:node /app

USER node

EXPOSE 8080

# Serve application bound to 0.0.0.0 on configurable PORT (default: 8080)
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-8080}"]
