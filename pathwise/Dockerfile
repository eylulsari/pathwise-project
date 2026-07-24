# ─────────────────────────────────────────────────────────────
# Pathwise frontend — Vite dev server in a container
# (Dev-focused: serves with HMR. A prod build would use nginx to
#  serve the static `dist/` output.)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
