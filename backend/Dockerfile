# Build stage — context: backend/ (self-contained, no ../shared dependency)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for layer caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source
COPY . .

# Compile TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./

# Production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

USER node

COPY --from=builder --chown=node:node /app/dist ./dist

ENV PORT=3000
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/index.js"]
