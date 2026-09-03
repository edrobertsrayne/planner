// The human-sized form of an Attachment's byte count — "512 kB", not 524288 — for the row that
// shows a file's size beside its name.
const UNITS = ['B', 'kB', 'MB'] as const;

export function formatSize(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	if (unit === 0) return `${value} B`;

	// Rounding can carry a value up to the next unit's own threshold — 1023.53 kB rounds to
	// "1024 kB" rather than promoting to "1.0 MB" — so re-check after rounding, not before.
	if (Math.round(value) >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}

	return value >= 10 ? `${Math.round(value)} ${UNITS[unit]}` : `${value.toFixed(1)} ${UNITS[unit]}`;
}
