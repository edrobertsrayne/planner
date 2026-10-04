<!--
	PROTOTYPE ONLY (issue #307): Draft/Planned for one Lesson. From `md` up it is the two-button
	toggle the screen has today. On a phone it is a read-only badge: nothing in the plan is written
	there.
-->
<script lang="ts">
	import { statusTone } from '$lib/feedback-tone';
	import { setStatus, type Status } from './store.svelte';

	let { id, status, compact = false }: { id: string; status: Status; compact?: boolean } = $props();
	const RUNGS: { key: Status; name: string }[] = [
		{ key: 'planned', name: 'Planned' },
		{ key: 'draft', name: 'Draft' }
	];
	const tone = $derived(statusTone(status));
</script>

<span
	class="rounded-full px-2 py-0.5 text-[11px] font-medium md:hidden"
	style:background-color={tone.bg}
	style:color={tone.fg}
>
	{status === 'draft' ? 'Draft' : 'Planned'}
</span>
<div class="hidden shrink-0 overflow-hidden rounded-md border text-xs md:flex" role="group">
	{#each RUNGS as rung (rung.key)}
		{@const on = status === rung.key}
		{@const t = statusTone(rung.key)}
		<button
			type="button"
			aria-pressed={on}
			class="{compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} font-medium transition-colors {on
				? ''
				: 'text-muted-foreground hover:bg-muted'}"
			style:background-color={on ? t.bg : undefined}
			style:color={on ? t.fg : undefined}
			onclick={(e) => {
				e.stopPropagation();
				e.preventDefault();
				setStatus(id, rung.key);
			}}
		>
			{rung.name}
		</button>
	{/each}
</div>
