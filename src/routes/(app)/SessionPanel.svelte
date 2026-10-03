<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import { closeSession } from '$lib/client/session-panel.svelte';
	import { Button } from '$lib/components/ui/button';
	import SessionBody from '$lib/components/session-body.svelte';

	let { occasion }: { occasion: Occasion } = $props();
	// PROTOTYPE ONLY (issue #305): where each size puts the panel is a placeholder; the Session
	// panel ticket (#311) decides it. Shells set --shell-top and --shell-bottom.
	const placement =
		'fixed inset-x-0 top-(--shell-top) bottom-(--shell-bottom) z-30 md:left-auto md:w-96 md:shadow-xl ' +
		'lg:sticky lg:right-auto lg:bottom-auto lg:left-auto lg:z-auto lg:h-[calc(100vh-var(--shell-top))] lg:self-start lg:shadow-none';

	// Click-away dismissal has to exempt the Session triggers (`data-session-trigger`, caught on
	// pointerdown): their own click is about to open or switch a Session, so if it closed the
	// panel first, clicking the next Agenda row would close and instantly reopen it — a flicker
	// on the app's most common action (issue #62). The panel itself is exempt for the same
	// reason: working in the note is not clicking away.
	function onPointerDown(event: PointerEvent) {
		if (!(event.target instanceof Element)) return;
		if (event.target.closest('[data-session-panel]')) return;
		if (event.target.closest('[data-session-trigger]')) return;
		closeSession();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') closeSession();
	}}
/>
<svelte:document onpointerdown={onPointerDown} />

<!-- In-flow beside the screen — no overlay, no focus trap; what is behind stays usable
(ADR-0012). -->
<aside
	data-session-panel
	class="{placement} w-full shrink-0 overflow-y-auto border-l bg-card px-5 py-5 lg:w-96"
>
	<div class="mb-1 flex justify-end">
		<Button variant="ghost" size="sm" onclick={closeSession} aria-label="Close Session">
			<XIcon class="size-4" />
		</Button>
	</div>
	<SessionBody {occasion} />
</aside>
