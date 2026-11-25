# Built by cloudbuild.yaml from the Deploy workflow on push to main.

# Build the Vite frontend (app/ -> dist/).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY app/package.json ./app/
# Only the app workspace's packages (Vite and the Firebase SDK), still pinned by the lockfile.
RUN npm ci --ignore-scripts --workspace app --include-workspace-root=false
COPY vite.config.js ./
COPY app ./app
# The Help page is built from the guide.
COPY docs/guide.md ./docs/guide.md
# The round page shares the cloaked-name shapes with the server.
COPY server/game/shapes.js ./server/game/shapes.js
RUN npm run build

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY app/package.json ./app/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8080
# Run node directly (not npm) so SIGTERM from Cloud Run reaches the app.
CMD ["node", "server/index.js"]
