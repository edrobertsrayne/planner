# Docker over Nix

The deployable artifact is the OCI image built from this repository's Dockerfile. The flake, the
bun2nix-generated `bun.nix`, and the NixOS module are removed.

## Why

ADR-0008 left the artifact undecided — "a flake or a container" — because deployment was out of
scope there. Only one half ever became real. The container artifacts exist and are exercised: the
Dockerfile, the compose file, and the CI image build. The flake from commit `f47f318` sat beside
them unused.

The strongest Nix argument came from the thor-hosting research: a systemd unit can reach Postgres
over a unix socket with peer authentication, and a container cannot. Choosing SQLite in ADR-0008
removed the argument along with Postgres — the application owns its database file, so no artifact
shape needs anything from the host beyond a mounted directory.

The container also costs less to keep:

- There is no second lockfile. `bun2nix` regenerated `bun.nix` on every dependency change.
- Local runs, CI, and any self-hosted target all start from the same compose definition.
- Version pinning lives in the image tag and digest, not in an upstream repo running
  `nix flake update planner`.

## Consequences

The runtime still pins its own Bun inside the image, so ADR-0008's runtime reasoning — migrations
at startup, foreign keys set by the application, durability owned by whoever deploys — transfers
unchanged. The deployer persists the database directory through a volume rather than filesystem
impermanence declarations.

`docs/research/thor-hosting.md` recommended a plain NixOS systemd unit over a container. This ADR
reverses that verdict. The document itself is left as written; it remains the record of why the
NixOS path was preferred at the time.

In ADR-0008, only the deployable-artifact phrase is resolved by this ADR. Every other claim in it
stands, so it carries an amendment note rather than being rewritten.
