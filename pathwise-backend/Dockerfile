# ─────────────────────────────────────────────────────────────
# Pathwise backend — multi-stage Dockerfile
# Targets:  development (hot-reload)  |  production (lean runtime)
# ─────────────────────────────────────────────────────────────

# ---- base: shared deps layer ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- development: full deps + watch mode ----
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- build: compile TypeScript ----
FROM base AS build
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ---- production: minimal runtime ----
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
