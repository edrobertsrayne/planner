// A dialog opened from a nullable pick keeps its last content while it fades out: the binding is
// cleared before the exit animation has finished, so reading the pick directly would blank the
// title mid-close. `latched` remembers the last non-null value and hands it back while the pick
// is null. Call it once during component init; read the returned function wherever the pick is
// displayed.
export function latched<T>(read: () => T | null): () => T | null {
	let last = $state<T | null>(null);
	$effect(() => {
		const value = read();
		if (value !== null) last = value;
	});
	return () => read() ?? last;
}
