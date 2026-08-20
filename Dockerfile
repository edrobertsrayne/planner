# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:alpine AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=local.db
ENV ORIGIN="http://localhost:3000"
ENV BETTER_AUTH_URL="http://localhost:3000"
# Build-time only placeholder so `vite build` has something to read; never used at runtime.
# The release stage below is a fresh image and does not inherit this.
ENV BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

# install dependencies into temp directory
# this will cache them and speed up future builds
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun --bun run build
# RUN bun prune --production


# fresh image for the final stage so build-time env vars (including the
# placeholder auth secret above) are not baked into the runtime image
FROM oven/bun:alpine AS release
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/drizzle drizzle

EXPOSE 3000
ENV NODE_ENV=production
ENV ORIGIN="http://localhost:3000"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV DATABASE_URL=local.db
CMD [ "bun", "--bun", "run", "build/index.js" ]
