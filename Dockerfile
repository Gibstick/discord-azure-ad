# syntax=docker/dockerfile:1.3

FROM node:16-slim

RUN apt-get update && apt-get update -y && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./

COPY src ./src/
COPY static ./static/
COPY views ./views/
RUN npm run build

EXPOSE 3000
USER node
ENV NODE_ENV=production
CMD ["node", "./dist/main.js"]
