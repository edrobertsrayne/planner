# How thor hosts a new service

Research for [#7](https://github.com/edrobertsrayne/planner/issues/7). Every
claim below is cited against
[`edrobertsrayne/nix-config`](https://github.com/edrobertsrayne/nix-config) at
commit
[`3056498`](https://github.com/edrobertsrayne/nix-config/tree/30564983db7acbce0608d029b3ab41ffc80f0c4a)
(`docs: document the dendritic architecture (#206)`, 2026-08-13), or against the
nixpkgs revision that config pins,
[`e4bae1b`](https://github.com/NixOS/nixpkgs/tree/e4bae1bd10c9c57b2cf517953ab70060a828ee6f).

Two of the ticket's guessed paths are wrong: there is no `modules/persistence`
directory-of-services (persistence is declared per-aspect, with only core system
state in [`modules/persistence.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/persistence.nix)),
and the Cloudflare Tunnel is not its own module — it is eight lines inside
[`modules/hosts/thor/thor.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/thor.nix#L84-L94).
Everything else the ticket names exists as described.

---

## Verdict

**Write a NixOS module with a plain `systemd.services.planner` unit. Do not use
an OCI container.**

The config uses containers only where nixpkgs offers no service module —
Portainer, Joplin, the Bar Assistant trio, Soularr. Everything with a nixpkgs
module uses the module. The five declared containers are listed in
[`modules/hosts/thor/README.md#L79-L85`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/README.md#L79-L85);
compare against the ~35-service inventory in
[`README.md#L44-L116`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/README.md#L44-L116).

Three concrete reasons it matters for this app:

1. **Postgres access is by unix socket with peer authentication.** Every DB
   consumer on thor connects as `postgres://<role>@/<db>?host=/run/postgresql`
   with no password
   ([`modules/blocky.nix#L46`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L46)).
   A container would have to reach Postgres over TCP with a password — a pattern
   that exists nowhere in this repo and would need a new secret, a new `pg_hba`
   entry, and a listener change.
2. **`adapter-node` output is just `node build/index.js`.** There is no
   packaging problem a container solves here that a Nix derivation does not.
3. **Containers on thor run `:latest` with `--pull=always`** as a deliberate
   policy for third-party images
   ([`modules/portainer.nix#L53-L59`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/portainer.nix#L53-L59),
   [`modules/joplin.nix#L36-L40`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/joplin.nix#L36-L40)).
   That policy is about not hand-bumping someone else's version; it buys nothing
   for an app whose source we control.

**The one real gap:** nix-config has never packaged a first-party application.
`grep` for `mkDerivation`/`buildNpmPackage` across `modules/` returns nothing;
the only `perSystem` blocks are the formatter
([`modules/flake/formatter.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/flake/formatter.nix))
and the nixpkgs instantiation
([`modules/flake/nixpkgs.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/flake/nixpkgs.nix)).
So there is no established pattern to copy for "build my own app" — see
[Packaging the app](#1-packaging-the-app-the-only-genuinely-new-thing) below.

---

## 0. The mechanism you are plugging into

nix-config is [dendritic](https://github.com/mightyiam/dendritic): `flake.nix`
hands `modules/` to `import-tree`, which collects every **git-tracked** `.nix`
file and gives them to flake-parts
([`flake.nix#L27-L33`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/flake.nix#L27-L33),
explained in
[`docs/dendritic.md#L17-L45`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/dendritic.md#L17-L45)).

Consequences for us:

- One new file, `modules/planner.nix`, declaring `flake.modules.nixos.planner`.
- **It does nothing until `git add`-ed.** This is the documented number-one
  "why is nothing happening" trap
  ([`docs/deploying.md#L168-L173`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/deploying.md#L168-L173)).
- The aspect must then be named in thor's import list
  ([`modules/hosts/thor/thor.nix#L15-L42`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/thor.nix#L15-L42)).
  (`docs/deploying.md` says "no import list to update" — that is true of the
  flake-parts side, not of thor: `thor.nix` still lists aspects by name.)
- Shared values are read off `inputs.self.settings.*`
  ([`docs/dendritic.md#L129-L146`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/dendritic.md#L129-L146)):
  `settings.server.domain` = `greensroad.uk`
  ([`modules/settings/server.nix#L3-L6`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/settings/server.nix#L3-L6)),
  `settings.ports.*`, `settings.user.*`.
- Cross-aspect wiring goes through options declared in
  [`modules/interfaces.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/interfaces.nix#L6-L27):
  `homepage.services`, `monitoring.probeTargets`, `monitoring.dashboards`.
- Deploy: `nix flake check`, then
  `sudo nixos-rebuild test --flake .#thor`, then commit — **merging to `main` is
  deploying**, because thor auto-upgrades from GitHub nightly at 04:00 with
  `operation = "boot"`
  ([`modules/nix.nix#L68-L75`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/nix.nix#L68-L75)).

---

## 1. Packaging the app (the only genuinely new thing)

No precedent exists. The two workable shapes:

**(a) Flake input — recommended.** The planner repo grows a
`packages.<system>.default` (a `buildNpmPackage` producing `build/index.js` plus
a wrapper), and nix-config adds it to `flake.nix` inputs alongside the existing
eight
([`flake.nix#L4-L25`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/flake.nix#L4-L25)):

```nix
planner = {
  url = "github:edrobertsrayne/planner";
  inputs.nixpkgs.follows = "nixpkgs";
};
```

Inside the module the package is `inputs.planner.packages.${pkgs.stdenv.hostPlatform.system}.default`.

**The operational consequence to accept up front:** `flake.lock` pins the
planner revision, so the nightly auto-upgrade will *not* pick up new planner
releases. Shipping a planner change becomes `nix flake update planner` +
commit + push in nix-config — a two-repo dance. That is the price of the
non-container route, and it is the opposite of how the container services
behave (`--pull=always` gets them new versions for free).

**(b) In-tree derivation.** Put the `buildNpmPackage` in `modules/planner.nix`
itself with a `fetchFromGitHub` pinned by hash. Avoids a flake input, but hides
a version bump inside a service module and needs a manual hash update. Not
recommended.

Either way the app must not need a writable working directory: `/` is wiped on
every boot ([§7](#7-impermanence--zfs-persistence)).

---

## 2. Port allocation

There **is** a central registry:
[`modules/settings/ports.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/settings/ports.nix).
It is a flat set of `mkOption`s under `options.flake.settings.ports`, grouped by
comment into Infrastructure / Monitoring / Exporters / Media / Applications, with
`types.submodule` used where a service owns several ports
(`exporters`, `media`, `barAssistant`).

House rule, stated explicitly: *"Ports go in `modules/settings/ports.nix`, which
is the single source of truth — never hard-code a port in a service module"*
([`docs/deploying.md#L185-L187`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/deploying.md#L185-L187)).
`modules/hosts/thor/README.md#L48-L70` carries a convenience table that is
explicitly subordinate to the Nix.

Applications cluster in the 8080–8090 band
([`ports.nix#L147-L215`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/settings/ports.nix#L147-L215)):
8080 sabnzbd, 8081 karakeep, 8082 stirlingPdf, 8083 searxng, 8085 bentopdf,
8086 homepage, 8087/8088/8089 barAssistant. **8084 and 8090 are free.** Take
`planner = 8090`.

```nix
planner = mkOption {
  type = types.port;
  default = 8090;
};
```

---

## 3. Postgres: provisioning and the connection string

`modules/postgresql.nix` is a shared *aspect*, not a host service — nine lines
that enable the server and persist its data directory
([`modules/postgresql.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/postgresql.nix)):

```nix
flake.modules.nixos.postgresql = {
  key = "postgresql-aspect";
  services.postgresql.enable = true;
  environment.persistence."/persist".directories = ["/var/lib/postgresql"];
};
```

The explicit `key` exists because the aspect is imported from more than one
place and also sets a list-typed option; without it impermanence's
`duplicateDirs` assertion trips
([`postgresql.nix#L4-L6`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/postgresql.nix#L4-L6),
rationale in
[`docs/dendritic.md#L148-L167`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/dendritic.md#L148-L167)).
You just import it; you do not touch it.

**Worked exemplar — `blocky.nix`.** It is the only module that provisions its own
database (Immich's nixpkgs module does its own DB setup internally). Three
pieces:

1. Import the aspect:
   [`blocky.nix#L10`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L10)
   — `imports = [inputs.self.modules.nixos.postgresql];`
2. Declare the DB and role:
   [`blocky.nix#L146-L160`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L146-L160)
   ```nix
   services.postgresql = {
     ensureDatabases = ["blocky"];
     ensureUsers = [{ name = "blocky"; ensureDBOwnership = true; }];
   };
   ```
3. Order the unit after Postgres:
   [`blocky.nix#L203-L209`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L203-L209)

**The connection string carries no secret.** Blocky's is
`postgres://blocky@/blocky?host=/run/postgresql&sslmode=disable`
([`blocky.nix#L46`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L46)).
No password, because nixpkgs' default `pg_hba` line is `local all all peer`
([nixpkgs `postgresql.nix#L684-L693`](https://github.com/NixOS/nixpkgs/blob/e4bae1bd10c9c57b2cf517953ab70060a828ee6f/nixos/modules/services/databases/postgresql.nix#L684-L693)),
and nix-config never overrides `services.postgresql.authentication`. The same
reasoning is spelled out for the Grafana datasource:
*"Grafana's postgres driver treats a leading `/` as a unix socket and
authenticates by peer, so no secret is needed"*
([`blocky.nix#L182-L184`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L182-L184)).

**Therefore: `DATABASE_URL` is a plain `environment` entry, not a secret.**
Peer auth matches the *OS* user name to the *role* name, so the unit must run as
a user literally called `planner`. Set

```
DATABASE_URL = "postgres://planner@/planner?host=/run/postgresql&sslmode=disable"
```

(postgres.js and node-postgres both accept `host=` as a socket directory in the
query string; verify against whichever driver Drizzle is configured with — this
is the one line in the skeleton I could not test.)

**One improvement on the exemplar:** `ensureDatabases`/`ensureUsers` are executed
by `postgresql-setup.service`, a separate oneshot ordered after
`postgresql.service`
([nixpkgs `postgresql.nix#L871-L922`](https://github.com/NixOS/nixpkgs/blob/e4bae1bd10c9c57b2cf517953ab70060a828ee6f/nixos/modules/services/databases/postgresql.nix#L871-L922)).
Blocky orders itself after `postgresql.service` only, which races DB creation on
a first boot. Order the planner after **`postgresql-setup.service`**.

No `initialScript`, no `initialDatabases`, no extensions are used anywhere in
this config — `ensureDatabases` + `ensureDBOwnership` is the whole vocabulary.
Drizzle migrations are ours to run; do it as an `ExecStartPre` on the unit
(precedent for an `ExecStartPre` script:
[`bar-assistant.nix#L49-L57`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/bar-assistant.nix#L49-L57)).

---

## 4. Secrets: agenix

Setup, in full
([`secrets/secrets.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/secrets/secrets.nix)):
single host, two recipients — thor's ed25519 host key and the `ed@thor` user key
— and every secret is encrypted to `systems ++ users`. Blobs are
`secrets/<name>.age` next to it. The input is `github:ryantm/agenix`
([`flake.nix#L12-L15`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/flake.nix#L12-L15)),
wired into every host by `mkNixosSystem`
([`modules/lib/hosts.nix#L12-L13`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/lib/hosts.nix#L12-L13)).

The identity path is unusual and worth knowing: because root is wiped on boot,
`age.identityPaths` reads the host key straight out of `/persist`
([`modules/persistence.nix#L18`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/persistence.nix#L18)).
Nothing to do for a new secret; it just means agenix works on a wiped root.

Creating one (from
[`.claude/skills/secrets/SKILL.md`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/.claude/skills/secrets/SKILL.md#L28-L47)
— `agenix` is *not* on PATH, and you *must* `cd secrets` first or `RULES`
resolution fails):

```bash
# 1. register in secrets/secrets.nix
#    "planner.age".publicKeys = systems ++ users;
cd secrets
printf 'BETTER_AUTH_SECRET=%s\n' "$(head -c32 /dev/urandom | xxd -p -c 256)" \
  | nix run github:ryantm/agenix -- -e planner.age
nix run github:ryantm/agenix -- -d planner.age    # always verify: empty pipes fail silently
git add secrets/planner.age secrets/secrets.nix
```

At runtime the file is decrypted during activation to `/run/agenix/<name>`, root
owned `0400` by default; add `owner`/`group` when a non-root service reads it
([`SKILL.md#L74-L83`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/.claude/skills/secrets/SKILL.md#L74-L83)).
The path is `config.age.secrets.<name>.path`.

Consumption patterns actually in use
([`SKILL.md#L85-L99`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/.claude/skills/secrets/SKILL.md#L85-L99)),
each with a live example:

| Shape | Example | File format |
|---|---|---|
| `environmentFile` | [`searxng.nix#L20-L23`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/searxng.nix#L20-L23) | `KEY=value` |
| `credentialsFile` | [`mealie.nix#L20-L26`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/mealie.nix#L20-L26) | `KEY=value` |
| `*_FILE` env var → `.path` | [`n8n.nix#L39`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/n8n.nix#L39) | raw value |
| systemd `EnvironmentFile` | [`code-server.nix#L32-L33`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/code-server.nix#L32-L33) | `KEY=value` |
| container `environmentFiles` | [`bar-assistant.nix#L79`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/bar-assistant.nix#L79) | `KEY=value` |

For a hand-written unit, `code-server.nix`'s
`systemd.services.<name>.serviceConfig.EnvironmentFile = config.age.secrets.<name>.path`
is the exact precedent. Put `BETTER_AUTH_SECRET` (and anything else
better-auth needs, e.g. OAuth client secrets) in that file.

---

## 5. Hostname: nginx vhost, TLS, and the tunnel

**One helper does the vhost, the dashboard tile, and the health probe:**
`mkProxiedService`
([`modules/lib/proxy.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/lib/proxy.nix)).
It is a function returning a module, so you put the call in `imports`. Its
arguments are `name`, `subdomain`, `port`, `group`, `description`, `icon`, and
optionally `host` (default `127.0.0.1`), `websockets` (default `true`),
`extraConfig`, `aliases`, `probe`, `probePath`
([`proxy.nix#L6-L19`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/lib/proxy.nix#L6-L19)).
It produces
([`proxy.nix#L23-L55`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/lib/proxy.nix#L23-L55)):

- `services.nginx.virtualHosts."<subdomain>.greensroad.uk"` with `addSSL = true`,
  `useACMEHost = domain`, and `locations."/"` proxying to
  `http://127.0.0.1:<port>` with websocket support;
- a `homepage.services.<group>` tile with a `siteMonitor`;
- a `monitoring.probeTargets.<name>` entry, keyed by display name so alerts say
  "Planner" not "http://127.0.0.1:8090".

nginx itself is a tiny aspect with recommended proxy/TLS/gzip settings and a
websocket `map`, and it **opens no firewall port at all**
([`modules/nginx.nix`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/nginx.nix)).

**TLS needs no work.** `acme.nix` holds a single wildcard cert for
`greensroad.uk` + `*.greensroad.uk` via Cloudflare DNS-01
([`modules/acme.nix#L7-L17`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/acme.nix#L7-L17)),
which every vhost references through `useACMEHost`.

**The tunnel needs no work either.** `cloudflared` runs one named tunnel whose
ingress is a single wildcard rule
([`thor.nix#L84-L94`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/thor.nix#L84-L94)):

```nix
services.cloudflared.tunnels."23c4423f-…" = {
  credentialsFile = config.age.secrets.cloudflared.path;
  default = "http_status:404";
  ingress."*.${domain}" = "http://127.0.0.1:80";
};
```

So `planner.greensroad.uk` is already routed to nginx the moment the vhost
exists — **there is no per-service tunnel edit**. Confirmed in prose at
[`docs/networking.md#L13-L23`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/networking.md#L13-L23).
What is *not* in the repo is the public DNS record pointing
`planner.greensroad.uk` at the tunnel — see
[open questions](#open-questions--gaps).

**Bind loopback.** The convention for a browser-only service with no mobile app
is `127.0.0.1`, described as defence-in-depth rather than the actual boundary
([`searxng.nix#L27-L31`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/searxng.nix#L27-L31),
[`n8n.nix#L30-L35`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/n8n.nix#L30-L35)).
Binding `0.0.0.0` is reserved for services with a mobile app that must reach
`100.84.196.40:<port>` directly
([`immich.nix#L26-L37`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/immich.nix#L26-L37),
[`docs/networking.md#L110-L133`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/networking.md#L110-L133)).
The planner is browser-only → loopback. **Open no firewall port.**

---

## 6. Cloudflare Access — confident negative

**Access is not configured declaratively anywhere in this repo, and there is no
per-service enrolment step in Nix.** The config's own words:

> **Authentication is Cloudflare Access**, which requires a Google login before
> a request ever reaches thor. Access policies are configured in the Cloudflare
> dashboard, not in this repo — there is no password layer in the Nix config
> because Access *is* the auth layer.
> — [`docs/networking.md#L20-L23`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/networking.md#L20-L23)

Corroborating: the only Cloudflare secrets are the tunnel credentials
(`cloudflare-thor.age`) and the DNS-01 API token (`cloudflare-dns.age`)
([`secrets/secrets.nix#L10-L11`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/secrets/secrets.nix#L10-L11));
there is no `cloudflare-access` module, no `cf-terraforming`, no Terraform at
all. Modules only ever *refer* to Access in comments explaining why they need no
auth of their own
([`nginx.nix#L22-L25`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/nginx.nix#L22-L25),
[`portainer.nix#L27-L33`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/portainer.nix#L27-L33)).

**Enrolling the planner is a manual dashboard action**, out of band, exactly as
adding the Tailscale ACLs is. Whether the existing Access application is a
wildcard covering `*.greensroad.uk` or a per-hostname list is not knowable from
the repo.

**The security consequence you must design for:** Access is bypassed on the
tailnet. Blocky resolves `*.greensroad.uk` straight to thor's tailnet address
`100.84.196.40`
([`blocky.nix#L41-L43`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/blocky.nix#L41-L43)),
so a tailnet client hits nginx directly on `:443` and *"Cloudflare Access never
sees tailnet-direct traffic"*
([`docs/networking.md#L129-L133`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/networking.md#L129-L133),
table at
[L135-L144](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/networking.md#L135-L144)).
The planner's better-auth login is therefore the *only* gate on the tailnet path
— which is the right call for this app, and matches how Paperless and Portainer
are reasoned about. Do not treat Access as the sole authentication.

---

## 7. Impermanence / ZFS persistence

`/` (`zroot/root`) is rolled back to a blank snapshot on every boot by a stage-1
initrd oneshot
([`docs/storage.md#L50-L61`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/storage.md#L50-L61)).
Anything that must survive is declared with
`environment.persistence."/persist".directories`, **by the aspect that owns it**
— there is no central list
([`docs/storage.md#L62-L74`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/storage.md#L62-L74),
[`modules/persistence.nix#L20-L47`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/persistence.nix#L20-L47)).
`/persist` is a snapshotted ZFS dataset
([`docs/storage.md#L34-L42`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/storage.md#L34-L42)).

Live examples of the idiom:

- `/var/lib/vaultwarden` ([`vaultwarden.nix#L30`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/vaultwarden.nix#L30))
- `/var/lib/private/n8n` ([`n8n.nix#L43`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/n8n.nix#L43))
- `/var/lib/private/mealie` ([`mealie.nix#L28`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/mealie.nix#L28))

Note the `/var/lib/private/` prefix: services using systemd `DynamicUser` +
`StateDirectory` actually store state there, with `/var/lib/<name>` a symlink
([`paperless.nix#L66-L69`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/paperless.nix#L66-L69)).
Persisting the wrong one is the classic mistake.

**For the planner: nothing.** State lives only in Postgres, and
`/var/lib/postgresql` is already persisted by the shared aspect
([`postgresql.nix#L8`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/postgresql.nix#L8)).
Importing the aspect is the whole of the persistence work.

Two caveats:

1. **Do not use `DynamicUser`** — peer auth needs a stable OS user name matching
   the Postgres role, and the state path would move under `/var/lib/private`.
   Declare `users.users.planner` explicitly.
2. If the planner ever gains uploads or a writable cache, it needs its own
   `environment.persistence` entry *and* the deploy must reach thor via a
   **reboot**, not a live switch: `system.autoUpgrade.operation = "boot"` exists
   precisely because a new persistence line applied live bind-mounts an empty
   directory over a running service's data
   ([`modules/nix.nix#L62-L67`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/nix.nix#L62-L67)).

**Backups: there are none.** `/persist` is snapshotted on the same pool, nothing
leaves the machine
([`docs/storage.md#L221-L237`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/storage.md#L221-L237)).
Planner data will be as protected as Vaultwarden's, i.e. snapshots only.

---

## 8. Monitoring you get for free (and the one thing to build)

`mkProxiedService` registers a blackbox HTTP probe. `probePath` should point at
an **unauthenticated** health endpoint; probing `/` "only proves something is
listening, which a service with an unopenable database will happily keep doing"
([`README.md#L81-L87`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/README.md#L81-L87)).
Targets are consumed by
[`modules/hosts/thor/blackbox-exporter.nix#L35-L67`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/blackbox-exporter.nix#L35-L67).

**Action for the planner app:** add a `GET /healthz` route that returns 200
without auth (and ideally checks the DB). Otherwise pass `probe = false`, as
Joplin does
([`joplin.nix#L16-L18`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/joplin.nix#L16-L18)),
and lose the alert.

A failed unit is caught regardless by the `SystemdUnitFailed` alert
([`modules/alert-rules.nix#L180-L181`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/alert-rules.nix#L180-L181)).

---

## Worked skeleton: `modules/planner.nix`

Modelled on `blocky.nix` (Postgres) + `code-server.nix` (secret as
`EnvironmentFile`) + `searxng.nix` (loopback + `mkProxiedService`). Formatted for
`alejandra`, which the repo's git hooks enforce
([`docs/deploying.md#L58-L74`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/deploying.md#L58-L74)).

```nix
{inputs, ...}: let
  inherit (inputs.self.settings) server ports;
  url = "planner.${server.domain}";
  port = ports.planner;
in {
  flake.modules.nixos.planner = {
    config,
    lib,
    pkgs,
    ...
  }: let
    package = inputs.planner.packages.${pkgs.stdenv.hostPlatform.system}.default;
  in {
    imports = [
      inputs.self.modules.nixos.postgresql
      (inputs.self.lib.mkProxiedService {
        name = "Planner";
        subdomain = "planner";
        inherit port;
        group = "Productivity";
        description = "Teacher planner";
        icon = "calendar.png";
        probePath = "/healthz";
      })
    ];

    # Stable, non-dynamic user: Postgres peer auth matches the OS user name to
    # the role name (nixpkgs default pg_hba: `local all all peer`), so a
    # DynamicUser would break the socket connection - and move state under
    # /var/lib/private into the bargain.
    users.users.planner = {
      isSystemUser = true;
      group = "planner";
    };
    users.groups.planner = {};

    age.secrets.planner = {
      file = ../secrets/planner.age;
      owner = "planner";
      group = "planner";
    };

    services.postgresql = {
      ensureDatabases = ["planner"];
      ensureUsers = [
        {
          name = "planner";
          ensureDBOwnership = true;
        }
      ];
    };

    systemd.services.planner = {
      description = "Teacher planner";
      wantedBy = ["multi-user.target"];
      # postgresql-setup, not postgresql: ensureDatabases/ensureUsers run in
      # that oneshot, so ordering on postgresql.service alone races DB
      # creation on a first boot.
      after = ["network.target" "postgresql-setup.service"];
      requires = ["postgresql-setup.service"];

      environment = {
        NODE_ENV = "production";
        # Loopback only: reached via nginx (cloudflared -> Access-gated, or
        # the tailnet). Same reasoning as searxng.nix's bind_address.
        HOST = "127.0.0.1";
        PORT = toString port;
        # adapter-node needs the public origin for form-action CSRF checks;
        # nginx forwards on loopback so it cannot infer it.
        ORIGIN = "https://${url}";
        BETTER_AUTH_URL = "https://${url}";
        # No password: unix socket + peer auth, same as blocky's query log.
        DATABASE_URL = "postgres://planner@/planner?host=/run/postgresql&sslmode=disable";
      };

      serviceConfig = {
        User = "planner";
        Group = "planner";
        # BETTER_AUTH_SECRET and any OAuth client secrets live here.
        EnvironmentFile = config.age.secrets.planner.path;
        ExecStartPre = "${lib.getExe' package "planner-migrate"}";
        ExecStart = lib.getExe package;
        Restart = "on-failure";
        # Hardening: the app writes nothing outside Postgres.
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        NoNewPrivileges = true;
      };
    };

    # No environment.persistence entry: all state is in Postgres, and
    # /var/lib/postgresql is persisted by the postgresql aspect above.
  };
}
```

Notes on the two lines that are assumptions rather than findings: `planner-migrate`
is a second binary the package must expose (a `drizzle-kit migrate` wrapper with
the schema baked in), and `lib.getExe package` requires `meta.mainProgram` on the
derivation. Both are choices for the planner repo's `package.nix`, not
constraints from nix-config.

---

## Checklist of edits to `nix-config`

In order:

1. **`flake.nix`** — add the `planner` input with `inputs.nixpkgs.follows = "nixpkgs"`, matching the existing style
   ([`flake.nix#L4-L25`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/flake.nix#L4-L25)). Commit `flake.lock`.
2. **`modules/settings/ports.nix`** — add `planner = mkOption { type = types.port; default = 8090; };` in the Applications block
   ([L147-L215](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/settings/ports.nix#L147-L215)).
3. **`secrets/secrets.nix`** — add `"planner.age".publicKeys = systems ++ users;`.
4. **`secrets/planner.age`** — create per §4 (`cd secrets` first), containing `BETTER_AUTH_SECRET=…`. Decrypt to verify.
5. **`modules/planner.nix`** — new file, the skeleton above.
6. **`git add`** everything, especially the new module — untracked files are invisible to `import-tree`
   ([`docs/dendritic.md#L34-L38`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/docs/dendritic.md#L34-L38)).
7. **`modules/hosts/thor/thor.nix`** — add `planner` to the alphabetised import list
   ([L15-L42](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/thor.nix#L15-L42)), between `paperless` and `persistence`.
8. **`nix flake check`**, then `sudo nixos-rebuild test --flake .#thor` on thor.
9. **Docs** (the repo keeps them current): add a Planner row to the Applications table in
   [`README.md#L96-L115`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/README.md#L96-L115)
   and the port table in
   [`modules/hosts/thor/README.md#L48-L70`](https://github.com/edrobertsrayne/nix-config/blob/30564983db7acbce0608d029b3ab41ffc80f0c4a/modules/hosts/thor/README.md#L48-L70).
10. **Out of band, in the Cloudflare dashboard** — confirm/add the DNS record for `planner.greensroad.uk` and enrol the hostname in the Access application (§6). Nothing in Nix does this.
11. **`switch`** and push to `main` (merging *is* deploying, §0).

In the **planner** repo, prerequisites: a flake exposing
`packages.<system>.default` (and a migrate binary), a `GET /healthz` that needs
no auth, and reading `HOST`/`PORT`/`ORIGIN`/`DATABASE_URL`/`BETTER_AUTH_*` from
the environment.

---

## Open questions / gaps

- **Public DNS for `planner.greensroad.uk`.** The tunnel ingress is a wildcard,
  but the DNS record that points a hostname at the tunnel lives in Cloudflare.
  Whether a wildcard `CNAME *.greensroad.uk` already exists (making new
  subdomains zero-touch) or each service got its own record cannot be determined
  from the repo. Check the dashboard before assuming the hostname resolves.
- **Access application scope.** Same reason: cannot tell from source whether the
  policy covers `*.greensroad.uk` or is per-hostname. §6's negative finding is
  solid; the enrolment detail is not knowable here.
- **Driver acceptance of the socket URL.** `postgres://planner@/planner?host=/run/postgresql`
  is proven for Blocky (Go) and Grafana. Drizzle's Postgres driver almost
  certainly accepts it, but that is a planner-repo test, not a nix-config fact.
- **No first-party packaging precedent.** §1's recommendation is reasoned from
  the config's principles, not copied from an existing module — there is no
  example in the repo to check it against. The version-bump friction it
  introduces (a `nix flake update planner` per release) is real and worth
  revisiting if it bites; a self-built container image pinned to a tag is the
  fallback.
- **`icon`** on the Homepage tile is a dashboard-icons filename
  (`n8n.png`, `mealie.png`, …). `calendar.png` in the skeleton is a guess; check
  what the icon set actually has.
