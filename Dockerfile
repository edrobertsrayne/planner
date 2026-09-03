# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags

# install production-only dependencies, kept separate so devDependencies
# never end up in the final image
FROM oven/bun:alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production


FROM oven/bun:alpine AS build
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
# .git is dockerignored, so CI passes the commit SHA in as a build arg (see the workflows).
ARG BUILD_SHA=unknown
ENV PUBLIC_BUILD_SHA=${BUILD_SHA}
RUN bun --bun run build


# fresh image for the final stage so build-time env vars (including the
# placeholder auth secret above) are not baked into the runtime image
FROM oven/bun:alpine AS release
WORKDIR /app
COPY --from=build /app/build build/
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/package.json .
COPY --from=build /app/drizzle drizzle

EXPOSE 3000
ENV NODE_ENV=production
ENV ORIGIN="http://localhost:3000"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV DATABASE_URL=local.db
# Above the 10 MiB attachment ceiling plus multipart overhead: the adapter's Bun.serve would
# otherwise reject a legal upload at its 512K default before the app's own validation runs.
ENV BODY_SIZE_LIMIT=12M
CMD [ "bun", "--bun", "run", "build/index.js" ]
