FROM node:18-alpine

WORKDIR /usr/src/app

# When building from git, files are in backend/ subdirectory
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm install

COPY backend/ .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
