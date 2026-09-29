# ADR-0024: The planner backs itself up on demand

**Status:** Accepted (2026-09-29)

**Issue:** [#269](https://github.com/edrobertsrayne/planner/issues/269)

**Amends:** [ADR-0008](0008-sqlite-over-postgres.md)

## Context

ADR-0008 put durability with the deployer: "the application ships no backup feature". On a machine
you control, that is enough. All planner data is in one folder, the database file with the
`attachments/` folder beside it, and copying the folder moves the planner.

On a VPS, copying the folder means SSH, `scp` and stopping a container. The teacher needs a way to
move the planner to another instance, and to keep a portable copy, from the browser.

## Decision

The planner makes a **Backup** on demand and can **Restore** one into an empty instance.

- **A Backup is the database plus the files.** It is a consistent copy of the SQLite database
  (`VACUUM INTO`, taken while the server runs) and each Attachment file that the copy names, in one
  archive. It is not a per-table JSON dump. The migrations table inside the copy records its schema
  version, so no serializer has to follow each schema change.
- **The whole database goes in.** The user account and the API key go with it, and nothing is
  filtered. After a Restore, the teacher signs in with the old password and agents keep the same
  key. So the Backup file is a secret, and the screen says so.
- **Back up is one button in Settings.** It needs a signed-in session. There is no API door and no
  schedule. The API key stays scoped to the Planning half (ADR-0019).
- **Restore is offered only in the `/setup` wizard, on an empty instance.** It cannot overwrite
  data. It is all-or-nothing: a Restore that fails leaves the instance empty and the wizard open.
- **Restore refuses what it cannot read before it writes anything.** This includes a file that is
  not a Backup, a damaged or truncated Backup, and a Backup from a newer version (its migrations
  table names a migration this app does not have). An older Backup is accepted, and the usual
  startup migrations upgrade it.
- **Both directions stream.** Back up reads one Attachment at a time into the response, and stores
  Attachments without compression. Restore writes the upload to a temporary file in the data folder
  before it checks and unpacks it. Memory use does not grow with the number of Attachments. Only the
  Restore route takes a body larger than the app-wide `BODY_SIZE_LIMIT`.

## Considered options

For a large Backup (Attachments can reach GBs), the upload into the new instance is the weak point.
Cloudflare's Free and Pro plans refuse request bodies over 100 MB, and nginx refuses bodies over
1 MB by default. The options were:

1. **Browser upload** into `/setup` (chosen). This is the simplest. It fails behind a proxy that
   limits body size, and the code can only report the refusal clearly.
2. **Pull from the old instance**: the new instance downloads the Backup itself. This needs the old
   instance to still be running, and it needs an API door for Back up.
3. **Drop the file on the server** and restore it from the data folder. This brings back the SSH
   step that this decision exists to remove.
4. **Leave Attachments out of the Backup.** Then the Backup does not move the whole planner.

We chose option 1. We will come back to this decision if a real Backup cannot get through the path
to the server.

## Consequences

- **ADR-0008's durability rule stays.** Scheduled copies and a persistent disk are still the
  deployer's job. A Backup is a way to move the planner and a copy the teacher keeps. It is not a
  backup schedule.
- A Restore needs free disk space of about twice the Backup size, for the temporary archive and the
  unpacked files together.
- A Restore that is larger than a proxy's body limit fails. The fix is a path to the server with no
  limit, for example direct access, Tailscale, or a proxy you control.
