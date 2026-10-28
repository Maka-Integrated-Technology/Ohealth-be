# Dedicated outbox worker image; no HTTP application process.
# The pinned lockfile controls the toolchain used by the TypeScript CLI.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api-client/package.json ./packages/api-client/package.json
RUN npm ci --ignore-scripts
COPY . .
USER node
CMD ["npm", "run", "auth-challenge-delivery:dispatch", "--", "--continuous", "--batch-size=10", "--interval-seconds=5"]
