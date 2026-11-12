<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { classTone } from '$lib/class-tone';
	import { useBack } from '$lib/client/back';
	import { createDeleteAsk } from '$lib/client/confirm-delete.svelte';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import { withParam } from '$lib/query';
	import AttachmentsSection from '$lib/components/attachments-section.svelte';
	import ConfirmDeleteDialog from '$lib/components/confirm-delete-dialog.svelte';
	import LessonChildren from '$lib/components/lesson-children.svelte';
	import LinksSection from '$lib/components/links-section.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import RenameableRow from '$lib/components/renameable-row.svelte';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import { Badge, Button, Select } from '$lib/ui';
	import * as Tabs from '$lib/ui/tabs';
	import ClassNote from './ClassNote.svelte';
	import SequenceTab from './SequenceTab.svelte';
	import SlotRooms from './SlotRooms.svelte';
	import TimetableGrid from './TimetableGrid.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Every tab writes from a tablet up; on a phone the Overview and the Schedule read only and
	// there is no Timetable (ADR-0032), so the rename pencil — the page's other edit — follows the
	// Course page's rule.
	const md = new MediaQuery('min-width: 768px', true);
	let tab = $state<'overview' | 'schedule' | 'timetable'>('overview');
	// A phone has no Timetable tab, so one chosen on a wider window shows the Overview there.
	const shown = $derived(tab === 'timetable' && !md.current ? 'overview' : tab);

	// The "Timetable as at" date sets one parameter and keeps the rest, like every filter
	// (withParam, issue #338).
	const setAsAt = (date: string) => replaceQuery(withParam(page.url, 'from', date));

	const tone = $derived(classTone(data.class.tone));

	// Other screens open this page (the Agenda's Class chip among them), so Back returns to
	// whichever did; with no in-app previous page, it goes to the Classes list.
	const back = useBack(() => resolve('/classes'));

	// Deleting a Class always asks first (ADR-0022): the unconfirmed post comes back with
	// `needsConfirm` and the reason, which names what goes with it. The dialog then posts the same
	// delete with `confirmed`, and the action lands the teacher on the Classes list.
	const deleter = createDeleteAsk(() => ({ id: data.class.id, name: data.class.label }));
	const slotCount = $derived(data.grid.filter((s) => s.classId === data.class.id).length);

	const labelOf = (classId: string) => data.classes.find((c) => c.id === classId)?.label ?? classId;

	// Named stops: start of year, today, and every date this Class's own Slots start or stop
	// holding — the "Timetable as at" control's job is to make those, plus any date at all, a
	// first-class position to view or edit from (issue #93).
	const asAtOptions = $derived.by(() => {
		const dates = [data.today, data.yearStart, data.on];
		for (const s of data.datedSlots) dates.push(s.holdsFrom, s.holdsTo);
		const unique = dates.filter((d, i): d is string => d !== null && dates.indexOf(d) === i);
		return unique.sort().map((date) => ({
			value: date,
			label:
				date === data.yearStart
					? `Start of year — ${formatDate(date)}`
					: date === data.today
						? `Today — ${formatDate(date)}`
						: formatDate(date)
		}));
	});

	// A date before today shows what was taught, and is never editable (ADR-0006, amended).
	const isPast = $derived(data.on < data.today);

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
</script>

<svelte:head><title>{data.class.label}</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<Button variant="ghost" size="sm" class="-ml-3" onclick={back}>
		<ArrowLeftIcon data-icon="inline-start" />
		Back
	</Button>

	{#if form?.error}
		<p role="alert" class="mt-3 text-xs text-destructive">{form.error}</p>
	{/if}
	<RewindReport report={form?.report} />

	<div class="mt-3 flex items-start gap-3">
		<span
			class="mt-3.5 size-3 shrink-0 rounded-full"
			style:background-color={tone.dot}
			aria-hidden="true"
		></span>
		<div class="min-w-0">
			<RenameableRow
				name={data.class.label}
				action="?/renameClass"
				hidden={{ id: data.class.id }}
				field="label"
				editable={md.current}
			/>
			<Badge variant="outline" class="mt-1">{data.class.courseName}</Badge>
		</div>
		<!-- The rename pencil's partner, and shown on the same widths: a phone writes nothing here. -->
		{#if md.current}
			<form method="POST" action="?/deleteClass" use:enhance={deleter.ask} class="ml-auto shrink-0">
				<input type="hidden" name="id" value={data.class.id} />
				<Button
					type="submit"
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
				>
					<TrashIcon data-icon="inline-start" />
					Delete Class
				</Button>
			</form>
		{/if}
	</div>

	<!-- Overview (the Class note, Links and Attachments), Schedule (the Sequence) and Timetable
	     under the Class's label (ADR-0032). A phone has no Timetable tab. -->
	<Tabs.Root value={shown} onValueChange={(v) => v && (tab = v as typeof tab)} class="mt-3">
		<Tabs.List>
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="schedule">Schedule</Tabs.Trigger>
			<Tabs.Trigger value="timetable" class="max-md:hidden">
				Timetable <span class="text-xs tabular-nums opacity-60">{slotCount}</span>
			</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>

	<!-- Kept mounted while another tab is on, so an unsaved note is never torn down with it. -->
	<div class={shown === 'overview' ? '' : 'hidden'}>
		{#if md.current}
			<div class="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
				<ClassNote classId={data.class.id} note={data.class.note} />
				<aside class="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:self-start">
					<LinksSection links={data.links} owner={{ classId: data.class.id }} />
					<AttachmentsSection attachments={data.attachments} owner={{ classId: data.class.id }} />
				</aside>
			</div>
		{:else}
			<!-- A phone reads the Overview: the note rendered, Links that open, Attachments that
			     download. -->
			<div class="mt-4 space-y-3">
				{#if data.class.note}
					<Markdown source={data.class.note} class="rounded-lg border px-4 py-3" />
				{/if}
				<LessonChildren links={data.links} attachments={data.attachments} variant="rows" />
				{#if !data.class.note && !data.links.length && !data.attachments.length}
					<p class="text-sm text-muted-foreground">Nothing written for this Class yet.</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if data.sequence}
		<div class={shown === 'schedule' ? '' : 'hidden'}>
			<SequenceTab
				classId={data.class.id}
				classLabel={data.class.label}
				entries={data.sequence.entries}
				topics={data.sequence.topics}
				weeks={data.sequence.weeks}
				freeAfter={data.sequence.freeAfter}
				chips={data.sequence.chips}
				sequenceResult={form?.sequenceResult ?? null}
			/>
		</div>
	{/if}

	<!-- The Timetable from a tablet up only (story 116). -->
	<div class={shown === 'timetable' ? '' : 'hidden'}>
		<section class="min-w-0">
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Timetable as at</span>
				<Select
					value={data.on}
					onValueChange={setAsAt}
					options={asAtOptions}
					aria-label="Date"
					class="w-72"
				/>
				<input
					type="date"
					class="h-7 rounded-md border bg-transparent px-2 text-xs"
					value={data.on}
					onchange={(e) => setAsAt(e.currentTarget.value)}
					aria-label="Timetable as at — pick any date"
				/>
				{#if isPast}
					<Badge variant="outline" class="text-muted-foreground">Read-only — past</Badge>
				{/if}
			</div>

			<div class="mt-3 rounded-2xl border bg-surface p-5">
				<TimetableGrid
					classId={data.class.id}
					classLabel={data.class.label}
					on={data.on}
					readOnly={isPast}
					slots={data.grid}
					eventSlots={data.eventSlots}
					{labelOf}
					{tone}
				/>

				<p class="mt-3 text-xs text-muted-foreground">
					A Period held by another Class or an Event carries its name. A double is two Periods,
					ticked separately.
				</p>

				<SlotRooms classId={data.class.id} readOnly={isPast} slots={data.grid} />

				{#if data.datedSlots.length}
					<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2">
						<p class="text-xs font-medium">Slots that do not hold all year</p>
						<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
							{#each data.datedSlots as s (s.id)}
								<li>
									<span class="font-medium text-foreground">
										Week {s.week} · {DAY_NAMES[s.day - 1]} · P{s.period}
									</span>
									{#if s.holdsFrom}from {formatDate(s.holdsFrom)}{/if}
									{#if s.holdsTo}{s.holdsFrom ? ', ' : ''}until {formatDate(s.holdsTo)}{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<ConfirmDeleteDialog bind:target={deleter.pending} />
