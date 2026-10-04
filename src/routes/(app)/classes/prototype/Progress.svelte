<!--
	PROTOTYPE ONLY (issue #313). How far the Class has got, as today's ClassProgress. Last taught
	opens the Session page (issue #311), with the Session note beneath it.
-->
<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { formatDate } from '$lib/date';
	import { lane, sessionHref, type Klass } from './store.svelte';

	let { klass, inline = false }: { klass: Klass; inline?: boolean } = $props();
	const l = $derived(lane(klass));
	const pct = $derived(l.total ? Math.round((l.taught / l.total) * 100) : 0);
</script>

<div>
	<div class="flex items-baseline justify-between text-xs">
		<span class="text-muted-foreground">Through the plan</span>
		<span class="font-medium tabular-nums">{l.taught} / {l.total}</span>
	</div>
	<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
		<div
			class="h-full"
			style:width="{pct}%"
			style:background-color={classTone(klass.tone).ring}
		></div>
	</div>

	<dl class="mt-3 text-xs {inline ? 'grid gap-x-6 gap-y-2 sm:grid-cols-3' : 'space-y-2'}">
		<div>
			<dt class="text-muted-foreground">Last taught</dt>
			<dd>
				{#if l.lastTaught}
					<a href={sessionHref(l.lastTaught.row)} class="font-medium hover:underline">
						{l.lastTaught.row.lesson?.title}
					</a>
					{#if l.lastTaught.note}
						<p class="mt-0.5 text-muted-foreground">{l.lastTaught.note}</p>
					{/if}
				{:else}
					<span class="text-muted-foreground">Not taught yet.</span>
				{/if}
			</dd>
		</div>
		<div>
			<dt class="text-muted-foreground">Next up</dt>
			<dd class="font-medium">{l.nextUp?.title ?? '—'}</dd>
			{#if l.nextUp?.topicName}<dd class="text-muted-foreground">{l.nextUp.topicName}</dd>{/if}
		</div>
		<div>
			<dt class="text-muted-foreground">Runway</dt>
			<dd class="font-medium">
				{l.runway ? formatDate(l.runway) : 'open-ended'}
				{#if l.remaining > 0}
					<span class="font-normal text-muted-foreground">
						({l.remaining} Lessons with no Slot left)
					</span>
				{/if}
			</dd>
		</div>
	</dl>
</div>
