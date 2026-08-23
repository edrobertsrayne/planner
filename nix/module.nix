{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.planner;
in
{
  options.services.planner = {
    enable = lib.mkEnableOption "planner, the self-hosted teacher planner";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      description = "The planner package to run.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Address for the server to listen on.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port for the server to listen on.";
    };

    origin = lib.mkOption {
      type = lib.types.str;
      example = "https://planner.example.com";
      description = ''
        Public origin the app is served at. Wired to both `ORIGIN` and
        `BETTER_AUTH_URL`, which better-auth requires to match exactly -
        exposing one option instead of two makes that mismatch impossible.
      '';
    };

    stateDirectory = lib.mkOption {
      type = lib.types.str;
      default = "planner";
      description = ''
        Name of the systemd `StateDirectory` (created under `/var/lib`).
        Also used to build the default `DATABASE_URL`.
      '';
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = {
        DATABASE_URL = "/var/lib/planner/db.sqlite";
      };
      description = ''
        Extra environment variables for the service, merged over the
        defaults this module sets. Use this for non-secret overrides; put
        secrets (e.g. `BETTER_AUTH_SECRET`) in `environmentFile` instead.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/agenix/planner";
      description = ''
        Path to a `KEY=value` file loaded via systemd's `EnvironmentFile`,
        for secrets such as `BETTER_AUTH_SECRET`. Not managed by this
        module - point it at whatever secrets mechanism the host uses.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.planner = {
      description = "planner - self-hosted teacher planner";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        NODE_ENV = "production";
        HOST = cfg.host;
        PORT = toString cfg.port;
        ORIGIN = cfg.origin;
        BETTER_AUTH_URL = cfg.origin;
        DATABASE_URL = "/var/lib/${cfg.stateDirectory}/db.sqlite";
      }
      // cfg.environment;

      serviceConfig = {
        DynamicUser = true;
        StateDirectory = cfg.stateDirectory;
        # Must contain `drizzle/` alongside `build/`: the app reads its own
        # migrations from a `drizzle` folder relative to cwd at startup
        # (src/lib/server/db/index.ts), so this can't default to systemd's
        # usual cwd without breaking self-migration silently.
        WorkingDirectory = cfg.package;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        ExecStart = lib.getExe cfg.package;
        Restart = "on-failure";

        # The app touches nothing outside its state directory.
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        NoNewPrivileges = true;
        ReadWritePaths = [ "/var/lib/${cfg.stateDirectory}" ];
      };
    };
  };
}
