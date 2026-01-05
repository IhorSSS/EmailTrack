# --- Stage 1: Build ---
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# Copy dependency files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm install

# Copy source and config
COPY backend/tsconfig.json ./
COPY backend/src ./src/

# Generate Prisma client and build JS
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Production ---
FROM node:18-alpine

RUN apk add --no-cache openssl
WORKDIR /usr/src/app

# Install ONLY production dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Install prisma CLI specifically for 'npx prisma migrate deploy' in production
RUN npm install prisma

# Copy prisma schema and generated client
COPY backend/prisma ./prisma/
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/dist ./dist

# Production environment defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations and start server
CMD ["node", "dist/server.js"]


