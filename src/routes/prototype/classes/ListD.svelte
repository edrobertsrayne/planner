<!--
	PROTOTYPE — throwaway. List variant D — "launcher tiles that do something".
	C's tile grid with A's two card-footer actions folded in: assign the next Topic without leaving
	the list, and an explicit "Open Class page" rather than a whole-tile hit area.

	That last part is forced, not a preference: C made the entire tile one <a>, and a Select and a
	second link cannot live inside a link. So the tile stops being a link and the actions move to a
	footer, with the Class label carrying the navigation.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PageHeader from './PageHeader.svelte';
	import NewClassDialog from './NewClassDialog.svelte';
	import { LANES, TONES, COURSE_TOPICS, fmtShort } from './fixtures';

	let open = $state(false);

	const pct = (l: (typeof LANES)[number]) => (l.total ? Math.round((l.taught / l.total) * 100) : 0);
</script>

<div class="mx-auto max-w-5xl px-6 py-6">
	<PageHeader
		title="Classes"
		description="Pick a Class to timetable it, or give it its next Topic from here."
	/>

	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each LANES as lane (lane.classId)}
			{@const tone = TONES[lane.tone]}
			<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
				<div class="flex flex-1 flex-col gap-3 p-4">
					<div class="flex items-start gap-3">
						<span
							class="mt-0.5 size-2.5 shrink-0 rounded-full ring-2"
							style:background-color={tone.bg}
							style:--tw-ring-color={tone.ring}
						></span>
						<div class="min-w-0 flex-1">
							<a href="##" class="block truncate text-sm font-semibold hover:underline">
								{lane.classLabel}
							</a>
							<div class="truncate text-xs text-muted-foreground">{lane.courseName}</div>
						</div>
						<div class="text-right text-xs text-muted-foreground tabular-nums">{pct(lane)}%</div>
					</div>

					<div class="h-1 overflow-hidden rounded-full bg-muted">
						<div class="h-full" style:width="{pct(lane)}%" style:background-color={tone.ring}></div>
					</div>

					<dl class="mt-auto space-y-1 text-xs">
						<!-- The Topic sits above the Lesson because the Lesson is inside it: the tile now reads
						     "you are in Electricity, and the next one is Resistance". -->
						<div class="flex gap-1.5">
							<dt class="shrink-0 text-muted-foreground">Topic</dt>
							<dd class="truncate font-medium">{lane.currentTopic ?? '—'}</dd>
						</div>
						<div class="flex gap-1.5">
							<dt class="shrink-0 text-muted-foreground">Next</dt>
							<dd class="truncate">{lane.nextUp?.title ?? '—'}</dd>
						</div>
						<div class="flex gap-1.5">
							<dt class="shrink-0 text-muted-foreground">Runway</dt>
							<dd class="truncate tabular-nums">
								{lane.runway.date ? fmtShort(lane.runway.date) : 'open-ended'}
							</dd>
						</div>
					</dl>
				</div>

				<div class="flex items-center gap-1 border-t px-2 py-1.5">
					<Select.Root type="single">
						<Select.Trigger
							size="sm"
							class="min-w-0 flex-1 justify-start border-0 bg-transparent px-2 text-xs text-muted-foreground"
						>
							Assign next Topic
						</Select.Trigger>
						<Select.Content>
							{#each COURSE_TOPICS as t (t.id)}
								<Select.Item value={t.id} label={t.name} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Button variant="ghost" size="sm" class="shrink-0 px-2 text-xs" href="##">
						Open Class page<ChevronRightIcon />
					</Button>
				</div>
			</li>
		{/each}

		<li>
			<button
				type="button"
				onclick={() => (open = true)}
				class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
