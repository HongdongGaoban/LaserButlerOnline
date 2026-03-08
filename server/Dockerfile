FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

# Cloud Run は PORT 環境変数を設定する
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 8080

CMD ["node", "dist/index.js"]
