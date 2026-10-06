<script lang="ts">
	import { page } from '$app/state';
	import { replaceQuery } from '$lib/client/enhance';
	import { withParam } from '$lib/query';
	import type { ToneTokens } from '$lib/class-tone';
	import { cn } from '$lib/utils';

	// One filter chip per option, beside an "All …" chip (issue #338). The chip that is on is
	// filled, and a click on the chip that is on clears the filter. The value lives in the query
	// string, so it survives a reload and a Back into the page. On a phone the row scrolls
	// sideways and the page does not; from `md` the chips wrap instead. A Class chip is filled
	// with its Tone and rings it while off (ADR-0013); the All chip and a chip with no Tone —
	// the Agenda's Tags, issue #340 — fill with the primary color and read muted while off. A
	// chip may carry a count — the rows its Tag holds in the window (issue #340) — muted and
	// tabular beside its name.

	let {
		param,
		value,
		allLabel,
		label,
		options,
		class: className
	}: {
		param: string;
		value: string | null;
		allLabel: string;
		label: string;
		options: { value: string; label: string; tone?: ToneTokens; count?: number }[];
		class?: string;
	} = $props();

	const select = (next: string | null) => replaceQuery(withParam(page.url, param, next));
</script>

{#snippet chip(chipValue: string | null, text: string, tone?: ToneTokens, count?: number)}
	{@const on = value === chipValue}
	<button
		type="button"
		aria-pressed={on}
		class={cn(
			'inline-flex h-7 items-center gap-1 rounded-2xl border px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
			!tone && (on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')
		)}
		style:background-color={on && tone ? tone.bg : undefined}
		style:color={on && tone ? tone.fg : undefined}
		style:border-color={on ? 'transparent' : tone?.ring}
		onclick={() => select(on ? null : chipValue)}
	>
		{text}
		{#if count !== undefined}
			<span class="tabular-nums opacity-60">{count}</span>
		{/if}
	</button>
{/snippet}

{#if options.length}
	<div
		class={cn('flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap', className)}
		role="group"
		aria-label={label}
	>
		{@render chip(null, allLabel)}
		{#each options as option (option.value)}
			{@render chip(option.value, option.label, option.tone, option.count)}
		{/each}
	</div>
{/if}
