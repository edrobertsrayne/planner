<!--
	PROTOTYPE — throwaway. Issue #80: what does Settings look like, now that it stays what it is —
	one change-password form and nothing else?

	Three variants (`?variant=A|B|C`) that disagree about how much screen one small form deserves:
	a card on its own page, a section on a full-width page, or no page at all. Three more axes on
	the bar: `?feedback=inline|toast` for where the result of the submit lands, `?outcome=ok|bad`
	for which result the stubbed action returns, and `?tint=rich|token` for where a coloured toast
	takes its status colours from.

	SETTLED: A, on `toast`, with `rich` — the card, its result in a coloured toast wearing sonner's
	own status palette. See the resolution on #80.

	The action is stubbed (see ./stub.ts) — no database, no login, nothing is written.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import SettingsShell from './SettingsShell.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import { mode } from 'mode-watcher';
	import { changePassword, type Outcome, type Result } from './stub.js';
	import { toasterStyle, type Tint } from './toast-tint.js';

	const VARIANTS = [
		{ key: 'A', name: 'The card' },
		{ key: 'B', name: 'The section list' },
		{ key: 'C', name: 'Not a screen' }
	];

	const param = (name: string, allowed: string[], fallback: string) => {
		const v = page.url.searchParams.get(name);
		return v && allowed.includes(v) ? v : fallback;
	};

	const key = $derived(param('variant', ['A', 'B', 'C'], 'A'));
	const feedback = $derived(param('feedback', ['inline', 'toast'], 'inline'));
	const outcome = $derived(param('outcome', ['ok', 'bad'], 'ok') as Outcome);
	// `rich` is the settled answer: sonner's stock status palette, so colouring the toast costs the
	// design system no new colour. `token` is the rejected alternative, kept for the record.
	const tint = $derived(param('tint', ['rich', 'token'], 'rich') as Tint);

	// The result is stamped with the axes it was produced under, so flipping a switch mid-flow
	// retires a stale message without an effect that writes state back.
	let stamped = $state<{ axes: string; value: Result } | null>(null);
	let pending = $state(false);
	let dialogOpen = $state(true);

	const axes = $derived(`${key}|${feedback}|${outcome}|${tint}`);
	const result = $derived(stamped?.axes === axes ? stamped.value : null);

	// Inline feedback is only rendered where the variant can hold it. C on `inline` deliberately
	// renders a success nobody sees — that is the point being demonstrated, not a bug.
	const showInline = $derived(feedback === 'inline');

	async function onsubmit() {
		pending = true;
		stamped = null;
		const r = await changePassword(outcome);
		pending = false;
		stamped = { axes, value: r };

		if (feedback === 'toast') {
			if (r.ok) toast.success(r.message);
			else toast.error(r.message);
		}
		// The dialog closes on success whatever the feedback setting — leaving it open on a done
		// job is the stuck-open feeling #74 already rejected once.
		if (key === 'C' && r.ok) dialogOpen = false;
	}
</script>

<svelte:head><title>Prototype — Settings</title></svelte:head>

<Toaster position="bottom-right" richColors style={toasterStyle(tint, mode.current === 'dark')} />

<SettingsShell
	activeTab={key === 'C' ? 'Agenda' : null}
	settingsActive={key !== 'C'}
	onsettings={() => {
		if (key === 'C') dialogOpen = true;
	}}
>
	{#if key === 'A'}
		<VariantA {result} {pending} {onsubmit} {showInline} />
	{:else if key === 'B'}
		<VariantB {result} {pending} {onsubmit} {showInline} />
	{:else}
		<VariantC bind:open={dialogOpen} {result} {pending} {onsubmit} {showInline} />
	{/if}
</SettingsShell>

<PrototypeSwitcher variants={VARIANTS} current={key} {feedback} {outcome} {tint} />
