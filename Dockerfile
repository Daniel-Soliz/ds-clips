FROM node:22-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip python3-opencv curl ca-certificates espeak \
    fonts-dejavu-core fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir faster-whisper==1.2.0 yt-dlp==2026.9.8

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
