FROM node:18-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# When building from git, files are in backend/ subdirectory
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm install

# Copy backend files but explicitly exclude .env
COPY backend/*.json ./
COPY backend/*.ts ./
COPY backend/src ./src/

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
