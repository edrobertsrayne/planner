// `bun test` starts Bun's own test runner, which cannot load this repo's Vitest tests.
console.error('Do not use `bun test`. Use `bun run test:unit` (Vitest) or `bun run test`.');
process.exit(1);
