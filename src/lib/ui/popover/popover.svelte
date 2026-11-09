<!--
	A panel on the platform's popover attribute: the browser supplies the top layer, light dismiss
	and Escape; the trigger's `popovertarget` supplies the toggle. This keeps `open` in step with
	the DOM, so a caller can also bind it to close the panel from code.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setPopoverContext } from './context';

	let { open = $bindable(false), children }: { open?: boolean; children?: Snippet } = $props();

	const key = $props.id();
	const id = `popover-${key}`;

	setPopoverContext({
		id,
		get open() {
			return open;
		},
		setOpen: (next) => (open = next)
	});
</script>

{@render children?.()}
