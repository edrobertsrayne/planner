<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let { class: className, children }: { class?: string; children?: Snippet } = $props();

	// Arrow keys move between tabs and select as they go, the pattern for tabs that swap a view
	// at once: roving tabindex keeps one tab in the Tab order.
	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
		const at = tabs.indexOf(document.activeElement as HTMLElement);
		const next =
			e.key === 'ArrowRight'
				? tabs[(at + 1) % tabs.length]
				: e.key === 'ArrowLeft'
					? tabs[(at - 1 + tabs.length) % tabs.length]
					: e.key === 'Home'
						? tabs[0]
						: e.key === 'End'
							? tabs[tabs.length - 1]
							: null;
		if (!next) return;
		e.preventDefault();
		next.focus();
		next.click();
	}
</script>

<div role="tablist" tabindex="-1" {onkeydown} class={cn('ui-tabs', className)}>
	{@render children?.()}
</div>
