# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy package files for production install
COPY package*.json ./

# Install only production dependencies as root first
RUN npm ci --omit=dev && npm cache clean --force

# Then switch to node user for security
USER node

# Copy built application
COPY --from=builder --chown=node:node /app/dist ./dist

# Set default port
ENV PORT=3000

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/healthz || exit 1

# Start application
CMD ["node", "dist/index.js"]
