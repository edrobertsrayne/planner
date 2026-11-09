# Deployment

The planner is one Node process and one SQLite file. The reference deployment is
[Dokploy](https://dokploy.com) building with Railpack straight from the repository
([ADR-0027](adr/0027-railpack-over-docker.md)); the repository has no Dockerfile or compose file.
Anything that can run `npm ci`, `npm run build` and `npm start` on Node 26 works the same way.

## Requirements

- Node 26 (`engines.node` in `package.json`; `mise.toml` and CI use the same major version).
- npm. `better-sqlite3` is a native module; npm installs a prebuilt binary on common platforms. A
  platform without one compiles it and needs Python and a C++ toolchain.
- A writable folder that survives restarts, for the database and the Attachment files.
- A `.git` directory at build time if you want the build SHA shown in the UI. Without it the UI
  shows `unknown`.

## Environment variables

Set these in the platform, or in a `.env` file beside the build. `npm start` loads `.env` if it
exists (`node --env-file-if-exists=.env`); a variable exported in the environment wins over the
file. Start from [`.env.example`](../.env.example).

| Variable                | Required | Purpose                                                                                                                                                       |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes      | Path to the SQLite file, e.g. `/app/data/planner.db`. Its folder must already exist and be writable.                                                          |
| `ORIGIN`                | yes      | The public URL users reach the app at, e.g. `https://planner.example.com`. No trailing slash.                                                                 |
| `BETTER_AUTH_URL`       | yes      | **Must equal `ORIGIN` exactly.** The server refuses to start if they differ.                                                                                  |
| `BETTER_AUTH_SECRET`    | yes      | Signs sessions. At least 32 characters of high entropy, e.g. `openssl rand -base64 32`.                                                                       |
| `PORT`                  | no       | Listen port. Default `3000`.                                                                                                                                  |
| `HOST`                  | no       | Listen address. Default `0.0.0.0`.                                                                                                                            |
| `GITHUB_FEEDBACK_TOKEN` | no       | Fine-grained GitHub token (Issues: read and write on the repository). When set, the in-app feedback button appears and files an issue.                        |
| `OPENROUTER_API_KEY`    | no       | Titles feedback issues from the note. Without it the title is the note's first line. The note is sent to OpenRouter, so leave it unset if that is not wanted. |
| `OPENROUTER_MODEL`      | no       | Overrides the default feedback-title model.                                                                                                                   |

`ORIGIN` must be set because adapter-node builds request URLs from it. With `ORIGIN` set, the
`PROTOCOL_HEADER` and `HOST_HEADER` variables are ignored, so do not set them.

`PLANNER_NOW` pins the server's idea of today. It exists for the end-to-end tests. Never set it in
production.

## Build and run

```sh
npm ci
npm run build
npm start
```

`npm start` runs `BODY_SIZE_LIMIT=100G node --env-file-if-exists=.env build`. The raised body limit
is for Restore (below); every other route is capped at 12 MiB by the app itself
(`src/lib/server/body-limit.ts`), so the large limit does not open the API to big uploads.

On startup the server:

1. Checks `ORIGIN` against `BETTER_AUTH_URL`.
2. Opens the database with foreign keys on, WAL journalling and a 5 s busy timeout.
3. Deletes `.restore-*` folders and `.backup-*.db` files left beside the database by an interrupted
   Restore or Backup. They would otherwise sit there holding a copy of the database.
4. Applies any pending migrations from `drizzle/`. A failed migration stops startup rather than
   serving a half-built schema. There is no separate migrate step.

The `drizzle/` folder and `node_modules` must therefore be present at runtime, so run the app from
the repository root rather than copying `build/` alone.

### Dokploy with Railpack

1. Create an application from the repository. Railpack selects npm from `package-lock.json` and the
   Node version from `engines.node`.
2. Set the environment variables above. Use a mounted volume for the data folder and point
   `DATABASE_URL` at a file inside it (e.g. `/app/data/planner.db`).
3. Set the domain's container port to `3000`. Publish no host port; reach the app only through the
   domain.
4. Deploy. Open the domain: the first request lands on the setup wizard.

CI runs the suite on every push and pull request, but Dokploy builds whatever it is told to deploy.
If it deploys on every push to `main`, a failing commit can reach the deployment.

## What lives where

Everything the planner owns is in `DATABASE_URL`'s folder:

```text
data/
├── planner.db            the database (WAL mode, so also planner.db-wal and planner.db-shm)
└── attachments/          one file per Attachment, named by its row id, no extension
```

Back up the whole folder, or use the in-app Backup. Moving the folder moves the planner.

## First run

While the `user` table is empty, every page redirects to `/setup`. The wizard either creates the
one account (email and a password of at least 12 characters) or restores a Backup.

Until the wizard is finished, `/setup` and `/setup/restore` are open to anyone who can reach the
server, and the redirect reveals that the instance is empty. Finish the wizard straight after the
first deploy, and the same applies after a credentials reset
([ADR-0011](adr/0011-password-reset-is-a-cli-operation.md)).

## Backup and Restore

**Back up** (Settings → Backup) downloads `planner-backup-<date>.tar`: a consistent copy of the
database (`VACUUM INTO`, taken while the server runs) plus every Attachment file the copy names. It
needs a signed-in session. The file contains the account's password hash and the API key, so treat
it as a secret.

**Restore** is offered only in the setup wizard of an empty instance, so it cannot overwrite data.
It is all-or-nothing: a failed Restore leaves the instance empty and the wizard open. It refuses a
file that is not a Backup, a damaged one, and one from a newer version of the app; an older one is
accepted and migrated on startup. After a Restore, the old password and the same API key work.

Things to plan for:

- Restore needs free disk of roughly twice the Backup's size while it runs.
- The upload is a single request. A reverse proxy or CDN that limits request bodies (nginx
  defaults to 1 MiB; Cloudflare's Free and Pro plans refuse over 100 MB) will block a large Backup.
  Restore through a path with no limit, such as direct access or Tailscale.
- A Backup is a way to move the planner and keep a copy. It is not a schedule. Scheduled copies and
  a persistent volume are the deployer's job
  ([ADR-0024](adr/0024-the-planner-backs-itself-up-on-demand.md)).

## Locked out

There is no "forgot password" route. From a shell in the running container (or a checkout pointed
at the database):

```sh
DATABASE_URL=/app/data/planner.db npm run reset:credentials
```

This deletes the single user, which also signs out every device. Courses, Classes, Sessions and the
calendar are untouched. Open the app and complete the wizard to set new credentials. Run it only
when you are ready to finish the wizard immediately: whoever completes it first owns the planner.

Related protections:

- `/login` is throttled in memory: five failures in 15 minutes lock the form for one minute, for
  everyone (the proxy sets no client address header). A restart clears the count.
- Better Auth's own sign-up and email sign-in endpoints are disabled; the login form is the only
  way in.
- Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and
  `Content-Security-Policy: frame-ancestors 'none'`.

## Logs

The server writes to standard output and standard error. Each successful API write leaves one line,
`METHOD /path STATUS`, with no body (for example `PATCH /api/lessons/b204… 200`). A Backup or an
Attachment read that fails logs the cause server-side and gives the page nothing but a generic
message.

## Upgrading

Deploy the new commit. Migrations apply on startup. Take a Backup first if the release adds a
migration (`drizzle/` gains a folder): migrations are forward-only, and a Backup from a newer
version cannot be restored into an older one.

## Known gaps

From [docs/backlog.md](backlog.md): the image does not run as a non-root user and reports no
healthcheck, and there is no `Content-Security-Policy` beyond `frame-ancestors`.
