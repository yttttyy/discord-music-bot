# Multi-arch: работает и на ARM (Oracle Ampere), и на x86 (GCP e2-micro).
FROM node:22-slim

# ffmpeg — аудио; python3 — рантайм yt-dlp (на Linux это python-zipapp);
# curl/ca-certificates — для postinstall-скачивания yt-dlp и установки Deno.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 curl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*

# Deno — yt-dlp решает им JS-челлендж подписи YouTube.
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

WORKDIR /app

COPY package*.json ./
# postinstall youtube-dl-exec скачивает бинарь yt-dlp
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
