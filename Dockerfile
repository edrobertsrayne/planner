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
RUN bun --bun run build
# bundle scripts/seed.ts into a single file so the release stage can run it
# without devDependencies (drizzle-orm) or src/ present
RUN bun build scripts/seed.ts --outfile seed.js --target bun


# fresh image for the final stage so build-time env vars (including the
# placeholder auth secret above) are not baked into the runtime image
FROM oven/bun:alpine AS release
WORKDIR /app
COPY --from=build /app/build build/
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/package.json .
COPY --from=build /app/drizzle drizzle
COPY --from=build /app/seed.js seed.js
COPY --from=build /app/seed seed
COPY scripts/docker-entrypoint.sh docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production
ENV ORIGIN="http://localhost:3000"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV DATABASE_URL=local.db
# Set SEED_ON_START=true and SEED_FILE=seed/<file>.json to populate
# Term/Blocked Day/Teaching Week on startup. Safe to leave on indefinitely -
# see scripts/docker-entrypoint.sh.
ENV SEED_ON_START=false
ENTRYPOINT [ "./docker-entrypoint.sh" ]
CMD [ "bun", "--bun", "run", "build/index.js" ]
