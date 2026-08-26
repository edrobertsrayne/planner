{
  stdenv,
  bun,
  hook,
  fetchBunDeps,
  runtimeShell,
  src,
}:

stdenv.mkDerivation {
  pname = "planner";
  version = "0.0.1";

  inherit src;

  nativeBuildInputs = [
    bun
    hook
  ];

  bunDeps = fetchBunDeps { bunNix = ../bun.nix; };

  # `vite build` touches these at module-eval time even though they're never
  # used at runtime in this stage (SvelteKit imports the server modules
  # while prerendering). Same placeholders the Dockerfile's builder stage
  # uses, and for the same reason - a fresh runtime image/store path never
  # inherits them.
  NODE_ENV = "production";
  DATABASE_URL = "build-time-placeholder.db";
  ORIGIN = "http://localhost:3000";
  BETTER_AUTH_URL = "http://localhost:3000";
  BETTER_AUTH_SECRET = "build-time-placeholder-not-used-at-runtime";

  buildPhase = ''
    runHook preBuild
    bun run build
    # bundle scripts/seed.ts into a single file so the installed package can
    # run it without devDependencies (drizzle-orm) or src/ present
    bun build scripts/seed.ts --outfile seed.js --target bun
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out"
    cp -r build "$out/build"
    cp -r drizzle "$out/drizzle"
    cp package.json "$out/package.json"
    cp seed.js "$out/seed.js"
    cp -r seed "$out/seed"

    # bunNodeModulesInstallPhase (run by the hook before buildPhase) installs
    # every dependency, including devDependencies, so svelte/vite/playwright
    # end up in ./node_modules. Only `dependencies` (currently just zod) are
    # actually read at runtime, so reinstall production-only from the same
    # prefetched, offline cache before shipping node_modules.
    rm -rf node_modules
    bun install --production --frozen-lockfile --ignore-scripts --linker=hoisted
    cp -r node_modules "$out/node_modules"

    # `nix run` looks for $out/bin/<mainProgram>. cd into $out first, not
    # wherever the caller invoked `nix run` from: runMigrations' default
    # migrationsFolder = 'drizzle' resolves relative to process.cwd()
    # (src/lib/server/db/index.ts), and drizzle/ only exists next to build/
    # inside $out.
    mkdir -p "$out/bin"
    cat > "$out/bin/planner" <<WRAPPER
    #!${runtimeShell}
    cd "$out"
    exec ${bun}/bin/bun build/index.js "\$@"
    WRAPPER
    chmod +x "$out/bin/planner"

    cat > "$out/bin/planner-seed" <<WRAPPER
    #!${runtimeShell}
    cd "$out"
    exec ${bun}/bin/bun seed.js "\$@"
    WRAPPER
    chmod +x "$out/bin/planner-seed"

    runHook postInstall
  '';

  meta = {
    description = "Self-hosted teacher planner";
    homepage = "https://github.com/edrobertsrayne/planner";
    mainProgram = "planner";
  };
}
