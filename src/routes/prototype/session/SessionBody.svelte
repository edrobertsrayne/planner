<!--
	PROTOTYPE — throwaway. The Session's content, restyled on rhea/shadcn and shared by all three
	variants so the *container* is what's being compared, not the content. The one thing the
	content does vary is hierarchy, via `layout`:

	  narrow — plan first, "How it went" below it. The Lesson is the subject; the note is a detail.
	  wide   — two columns of equal weight. The note is a first-class half of the screen.

	That is deliberately the ticket's third question ("primacy or detail view") made visible: the
	aside and sheet can only really do `narrow`, the route can do either — so if `wide` reads as
	the right hierarchy, that's an argument for the route on its own.

	Reads real data from /session. Writes are stubbed — no mutation from a prototype.
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { classTone } from '$lib/client/class-tone';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import type { SessionDetail } from '$lib/server/planner';

	let { occasion, layout = 'narrow' }: { occasion: Occasion; layout?: 'narrow' | 'wide' } =
		$props();

	let detail = $state<SessionDetail | null>(null);
	let note = $state('');

	$effect(() => {
		const { classId, date, period } = occasion;
		let current = true;
		detail = null;
		fetch(`/session?classId=${encodeURIComponent(classId)}&date=${date}&period=${period}`)
			.then((r) => r.json())
			.then((d: SessionDetail) => {
				if (!current) return;
				detail = d;
				note = d.note ?? '';
			});
		return () => {
			current = false;
		};
	});

	const tone = $derived(classTone(occasion.classId));

	const fmtLongDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});
</script>

{#snippet heading()}
	<div class="flex items-center gap-2">
		<Badge variant="outline" class="{tone.bg} {tone.text}">{detail?.classLabel ?? '···'}</Badge>
		<span class="text-xs text-muted-foreground">
			{fmtLongDay(occasion.date)} · P{occasion.period}
		</span>
	</div>
{/snippet}

{#snippet plan()}
	{#if detail?.lesson}
		<h2 class={layout === 'wide' ? 'text-xl font-semibold' : 'text-lg leading-snug font-semibold'}>
			{detail.lesson.title}
		</h2>
		<p class="mt-1 text-xs text-muted-foreground">{detail.lesson.topicName}</p>

		{#if detail.lesson.body}
			<p class="mt-4 text-sm whitespace-pre-line text-foreground/80">{detail.lesson.body}</p>
		{:else}
			<p class="mt-4 text-sm text-muted-foreground italic">
				No plan written yet — a title alone is a complete Lesson.
			</p>
		{/if}

		{#if detail.lesson.links.length}
			<ul class="mt-4 space-y-1">
				{#each detail.lesson.links as link (link.id)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external resource -->
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm underline underline-offset-4">{link.label}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-5">
			<Button variant="outline" size="sm" disabled>Needs more time</Button>
			<p class="mt-1.5 text-xs text-muted-foreground">
				Widens this Lesson onto the Class's next Available Slot.
			</p>
		</div>
	{:else if detail}
		<h2 class="text-lg font-semibold text-muted-foreground italic">Unplanned</h2>
		<p class="mt-1 text-xs text-muted-foreground">No Lesson planned for this occasion.</p>
	{:else}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{/if}
{/snippet}

{#snippet howItWent()}
	<div class="mb-1.5 flex items-baseline justify-between">
		<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>How it went</span
		>
		<span class="text-xs text-muted-foreground">stays with the occasion</span>
	</div>
	<Textarea
		rows={layout === 'wide' ? 16 : 6}
		placeholder="Notes on this Session…"
		bind:value={note}
	/>
	<p class="mt-1 text-xs text-muted-foreground">Prototype — not saved.</p>
{/snippet}

{#if layout === 'wide'}
	<div class="mx-auto max-w-5xl">
		{@render heading()}
		<Separator class="my-5" />
		<div class="grid gap-10 md:grid-cols-2">
			<div>{@render plan()}</div>
			<div>{@render howItWent()}</div>
		</div>
	</div>
{:else}
	<div>
		{@render heading()}
		<Separator class="my-4" />
		{@render plan()}
		<Separator class="my-5" />
		{@render howItWent()}
	</div>
{/if}
