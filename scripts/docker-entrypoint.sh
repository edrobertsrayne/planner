#!/bin/sh
# Optionally seeds Term/Blocked Day/Teaching Week before the app starts,
# gated by SEED_ON_START. Seeding never blocks startup: the bundled
# scripts/seed.ts refuses to touch a database that already has a Session, so
# a failure here (bad file, already seeded, ...) is only ever logged.
set -eu

if [ "${SEED_ON_START:-false}" = "true" ]; then
	if [ -z "${SEED_FILE:-}" ]; then
		echo "WARNING: SEED_ON_START=true but SEED_FILE is not set; skipping seed" >&2
	elif [ ! -f "$SEED_FILE" ]; then
		echo "WARNING: SEED_ON_START=true but SEED_FILE '$SEED_FILE' was not found; skipping seed" >&2
	else
		bun run seed.js "$SEED_FILE" \
			|| echo "WARNING: seeding from '$SEED_FILE' failed (see above); continuing startup" >&2
	fi
fi

exec "$@"
