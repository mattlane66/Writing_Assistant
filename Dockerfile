FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pil fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN python3 scripts/generate-review-video.py && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/server ./server
COPY --from=build /app/knowledge ./knowledge
COPY --from=build /app/dist ./dist

EXPOSE 8787
CMD ["node", "server/index.mjs"]
