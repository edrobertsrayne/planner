<!--
	PROTOTYPE — throwaway. List variant C — "Launcher tiles".
	A responsive grid of compact tiles carrying the Class tone, showing only what you need to decide
	whether to open the Class: how far through, what's next, when it runs out. Argues Classes is a
	launcher into the Class page, and the detail belongs there — and it is the only variant that
	puts the Class colour on this screen, which is the tone question (#67) arriving early.
-->
<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from './PageHeader.svelte';
	import NewClassDialog from './NewClassDialog.svelte';
	import { LANES, TONES, fmtShort } from './fixtures';

	let open = $state(false);

	const pct = (l: (typeof LANES)[number]) => (l.total ? Math.round((l.taught / l.total) * 100) : 0);
</script>

<div class="mx-auto max-w-5xl px-6 py-6">
	<PageHeader title="Classes" description="Pick a Class to timetable it or give it a Topic." />

	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each LANES as lane (lane.classId)}
			{@const tone = TONES[lane.tone]}
			<li>
				<a
					href="##"
					class="flex h-full flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
				>
					<div class="flex items-start gap-3">
						<span
							class="mt-0.5 size-2.5 shrink-0 rounded-full ring-2"
							style:background-color={tone.bg}
							style:--tw-ring-color={tone.ring}
						></span>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">{lane.classLabel}</div>
							<div class="truncate text-xs text-muted-foreground">{lane.courseName}</div>
						</div>
						<div class="text-right text-xs text-muted-foreground tabular-nums">
							{pct(lane)}%
						</div>
					</div>

					<div class="h-1 overflow-hidden rounded-full bg-muted">
						<div class="h-full" style:width="{pct(lane)}%" style:background-color={tone.ring}></div>
					</div>

					<dl class="mt-auto space-y-1 text-xs">
						<div class="flex gap-1.5">
							<dt class="shrink-0 text-muted-foreground">Next</dt>
							<dd class="truncate font-medium">{lane.nextUp?.title ?? '—'}</dd>
						</div>
						<div class="flex gap-1.5">
							<dt class="shrink-0 text-muted-foreground">Runway</dt>
							<dd class="truncate tabular-nums">
								{lane.runway.date ? fmtShort(lane.runway.date) : 'open-ended'}
							</dd>
						</div>
					</dl>
				</a>
			</li>
		{/each}

		<li>
			<button
				type="button"
				onclick={() => (open = true)}
				class="flex h-full min-h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
			>
				<PlusIcon class="size-4" />
				<span class="text-sm font-medium">New Class</span>
			</button>
		</li>
	</ul>

	<p class="mt-4 text-xs text-muted-foreground">
		Tone values here are provisional placeholders — the real tokens are settled on the Class tone
		swatches ticket.
	</p>
</div>

<NewClassDialog bind:open />
