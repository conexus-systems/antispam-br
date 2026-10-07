# AntiSpam BR — Community API (M8)
# Build:  docker build -t antispam-api services/api
# Run:    docker run -p 8787:8787 antispam-api
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S antispam && adduser -S app -G antispam
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Portal atado (../apps/web deve ser montado ou copiado no compose)
ENV NODE_ENV=production PORT=8787
USER app
EXPOSE 8787
CMD ["npx", "tsx", "src/server-entry.ts"]
