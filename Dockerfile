FROM node:18-alpine
WORKDIR /app
# Copy package files first for caching
COPY christmas-present-app/package*.json ./christmas-present-app/
WORKDIR /app/christmas-present-app
RUN npm install --production
# Copy source
COPY christmas-present-app/ ./
EXPOSE 8080
CMD ["npm", "start"]
