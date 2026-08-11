# Builder
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json .
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/common/package.json ./packages/common/package.json

RUN npm install

COPY turbo.json .
COPY apps ./apps
COPY packages ./packages

RUN npm run build

# Runner
FROM node:22-alpine AS runner

WORKDIR /app
RUN mkdir -p /app/data

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/web/dist /app/apps/web/dist
# The @koinsight/common workspace is symlinked from node_modules; ship its built
# output so runtime requires (e.g. @koinsight/common/utils/ranges) resolve.
COPY --from=builder /app/packages/common/package.json /app/packages/common/package.json
COPY --from=builder /app/packages/common/dist /app/packages/common/dist
COPY plugins ./plugins

ENV NODE_ENV="production"
ENV DATA_PATH="/app/data"
ENV MAX_FILE_SIZE_MB="100"

CMD ["node", "./apps/server/dist/app.js"]
