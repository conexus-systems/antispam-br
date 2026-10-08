# AntiSpam BR — Community API. Contexto = raiz do monorepo (usa packages/* compartilhados).
# docker build -f services/api/Dockerfile -t antispam-api .
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services/api ./services/api
RUN npm ci --omit=dev --no-audit --no-fund --workspace @antispam-br/api \
 && rm -rf packages/*/test services/api/test
COPY apps/web ./apps/web
RUN addgroup -S antispam && adduser -S app -G antispam
ENV NODE_ENV=production PORT=8787 WEB_DIR=/app/apps/web
USER app
EXPOSE 8787
CMD ["node", "services/api/src/main.ts"]
