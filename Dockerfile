FROM node:25-alpine
WORKDIR /app
# Copy package files first for caching
COPY christmas-present-app/package*.json ./christmas-present-app/
WORKDIR /app/christmas-present-app
RUN npm ci --omit=dev
# Copy source
COPY christmas-present-app/ ./
EXPOSE 8080
CMD ["npm", "start"]
