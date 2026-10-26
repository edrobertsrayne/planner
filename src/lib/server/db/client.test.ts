import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { removeLeftovers } from './client';

let dir: string;

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
});

test('removes what a crashed Restore or Backup left, and nothing else', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	writeFileSync(join(dir, 'planner.db'), '');
	writeFileSync(join(dir, 'notes.txt'), 'keep');
	mkdirSync(join(dir, 'attachments'));
	mkdirSync(join(dir, '.restore-abc'));
	writeFileSync(join(dir, '.restore-abc', 'upload.tar'), 'staged');
	writeFileSync(join(dir, '.backup-def.db'), 'a copy of the database');

	removeLeftovers(join(dir, 'planner.db'));

	expect(readdirSync(dir).sort()).toEqual(['attachments', 'notes.txt', 'planner.db']);
});
