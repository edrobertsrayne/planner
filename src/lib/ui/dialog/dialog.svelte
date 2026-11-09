<!--
	A modal on the platform's own <dialog>: showModal() gives the focus trap, inert page and
	top layer. Content is mounted only while open, so a reopened dialog starts from a clean form, and
	focus goes back to whatever held it when the dialog opened.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setDialogContext } from './context';

	let {
		open = $bindable(false),
		onOpenChange,
		children
	}: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: Snippet } = $props();

	let opener: HTMLElement | null = null;

	function setOpen(next: boolean) {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}

	// Before the content mounts and showModal() moves focus, note where it was; once the dialog has
	// closed, put it back. A menu that opened the dialog has already handed focus to its trigger.
	$effect.pre(() => {
		if (open && !opener && document.activeElement instanceof HTMLElement) {
			opener = document.activeElement;
		}
	});

	$effect(() => {
		if (open || !opener) return;
		const back = opener;
		opener = null;
		if (back.isConnected) back.focus();
	});

	const key = $props.id();

	setDialogContext({
		titleId: `dialog-title-${key}`,
		descriptionId: `dialog-description-${key}`,
		get open() {
			return open;
		},
		setOpen
	});
</script>

{@render children?.()}
