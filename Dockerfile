# Built by the Cloud Build trigger on push to main (docker build . -f Dockerfile).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node web ./web
USER node
EXPOSE 8080
# Run node directly (not npm) so SIGTERM from Cloud Run reaches the app.
CMD ["node", "server/index.js"]
