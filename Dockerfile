# ─────────────────────────────────────────────────────────────
# Pathwise — PRODUCTION image (single origin)
#
# One container serves both halves: the API under /api, and the built
# SPA at everything else. Single-origin is a requirement, not a
# convenience — the refresh token is an httpOnly SameSite=Lax cookie,
# which Safari, Firefox and Brave all block on cross-site requests.
#
# Build context is the REPO ROOT (both halves are needed):
#   docker build -f Dockerfile -t pathwise .
#
# `pathwise-backend/Dockerfile` is left alone and still owns local dev —
# docker-compose, hot reload and the E2E topology are untouched by this file.
# ─────────────────────────────────────────────────────────────

# ---- 1. build the SPA ----
FROM node:22-alpine AS client-build
WORKDIR /client
COPY pathwise/package*.json ./
# Playwright is a devDependency and its postinstall pulls ~150 MB of browsers.
# The image only needs to *build* the SPA, never to test it — and that download
# is what made `npm ci` die here with npm's "Exit handler never called".
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --no-audit --no-fund
COPY pathwise/ ./
# Same-origin, so the API is a relative path. Vite inlines this at BUILD time —
# it cannot be changed later by a runtime env var, which is exactly why it is
# set here and not in render.yaml's envVars.
ENV VITE_API_URL=/api
RUN npm run build

# ---- 2. build the API ----
FROM node:22-alpine AS server-build
WORKDIR /app
COPY pathwise-backend/package*.json ./
RUN npm ci
COPY pathwise-backend/ ./
RUN npm run build
# Drop dev dependencies from the tree we are about to copy forward.
RUN npm prune --omit=dev

# ---- 3. runtime ----
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/package.json ./package.json
# AppModule looks for the SPA at ../client relative to dist/, and only mounts
# the static handler when this directory exists.
COPY --from=client-build /client/dist ./client
EXPOSE 3000
# Migrations run before the server accepts traffic. Production sets
# DB_SYNCHRONIZE=false, so this is the only thing that shapes the schema.
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main.js"]
