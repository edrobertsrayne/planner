# Railpack over Docker

Dokploy builds and deploys the planner with Railpack, straight from the repository. The Dockerfile,
the compose file, `.dockerignore`, and the GHCR image workflows are removed. This supersedes
[ADR-0018](0018-docker-over-nix.md).

## Why

The teacher deploys their other apps on Dokploy with Railpack and wants one way to deploy. Railpack
detects the app from the repository: `bun.lock` selects Bun, `mise.toml` supplies the Bun version,
and the `start` script supplies the start command. A Dockerfile beside it would be a second build
definition for the same app.

## Consequences

- `package.json` holds the start command: `BODY_SIZE_LIMIT=100G bun ./build/index.js`. The raised
  body limit used to be an `ENV` line in the Dockerfile. Restore needs it (ADR-0024), so it lives in
  the one command that every deployment runs.
- No image goes to GHCR. CI runs the suite, and Dokploy builds whatever it deploys. A failing
  commit on `main` can therefore reach the deployment if Dokploy deploys on push.
- The build SHA in the UI comes from `git rev-parse` at build time. Railpack builds from Dokploy's
  full clone, `.git` included, so CI no longer passes the SHA in as a build argument.
- The deployer sets the runtime configuration in Dokploy rather than in a compose file:
  `DATABASE_URL` (on a mounted volume, for example `/app/data/planner.db`), `BETTER_AUTH_SECRET`,
  `ORIGIN` and `BETTER_AUTH_URL` (identical), `PROTOCOL_HEADER=x-forwarded-proto`,
  `HOST_HEADER=x-forwarded-host`, and the domain's container port, `3000`.
- Migrations still run at startup, so the deployment needs no separate migrate step (ADR-0003).
