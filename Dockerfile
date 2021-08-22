# syntax=docker/dockerfile:1.3

FROM node:16-alpine AS build

RUN apk upgrade --no-cache

WORKDIR /build

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./

COPY src ./src/
COPY static ./static/
COPY views ./views/
RUN npm run build

FROM node:16-alpine AS runner

RUN apk upgrade --no-cache
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY --from=build /build/dist ./dist

EXPOSE 3000
USER node
ENV NODE_ENV=production
CMD ["dumb-init", "node", "./dist/main.js"]
