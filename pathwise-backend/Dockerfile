# ─────────────────────────────────────────────────────────────
# Pathwise Multi-Stage Fullstack Dockerfile
# ─────────────────────────────────────────────────────────────

# ---- Stage 1: Build Frontend (Vite) ----
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY pathwise/package*.json ./
RUN npm ci || npm install

COPY pathwise/ ./
ENV VITE_API_URL=/api
RUN npm run build

# ---- Stage 2: Build Backend (NestJS / Express) ----
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend

COPY pathwise-backend/package*.json ./
RUN npm ci || npm install

COPY pathwise-backend/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---- Stage 3: Production Runtime ----
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Backend bağımlılıkları ve derlenmiş JS
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package*.json ./

# Derlenmiş Frontend statik dosyalarını backend'in sunacağı public dizine kopyala
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000

# Backend başlangıç komutu (NestJS ise dist/main.js, Express ise dist/index.js veya dist/server.js)
CMD ["node", "dist/main.js"]