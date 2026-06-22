# NestJS backend + Puppeteer (invoice PDF). Single stage on purpose: we keep the
# Prisma CLI around at runtime so `prisma migrate deploy` works on boot without
# pulling anything from the network.
FROM node:20-bookworm-slim

# Chromium + the fonts/libs Puppeteer needs to render the PDF. We install the
# system Chromium instead of letting Puppeteer download its own copy.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set BEFORE npm ci so puppeteer's postinstall skips the ~150MB browser download
# and uses /usr/bin/chromium at launch (pdf.service calls launch() with no
# executablePath, so it reads PUPPETEER_EXECUTABLE_PATH from the env).
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3001

# Apply committed migrations, then boot the API. dumb-init reaps the zombie
# processes Chromium leaves behind so the container doesn't pile them up.
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
