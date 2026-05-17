# ── Build Stage ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install ALL dependencies (dev included, needed for nest build)
RUN npm install

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

# ── Production Stage ──
FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Don't run as root
USER node

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
