<!--
	PROTOTYPE — throwaway. How a day and a Slot are blocked and unblocked, drawn on the settled
	A2 week: a day with no teaching drops its six Periods and becomes one panel.

	Two axes, one at a time:
	  E1–E4 — the day control. E3 won: one menu per day head, holding every act the day allows.
	  F1–F4 — the Slot control, all four drawn with E3's day menu above them, so the pairing of
	          the two gestures is what is being judged.

	A Blocked Day and a Blocked Slot are not symmetrical, and that is the whole difficulty. A
	Blocked Day records no cause (CONTEXT.md), so E3 blocks it in one menu click. A Blocked Slot's
	note is required — a hole in the week is otherwise unexplainable months later — so it can
	never be one click. Every F variant is an answer to where that note is typed.

	The variants are live: blocking really collapses the column and blocking a Slot really drains
	the tile. The state is local — no action is posted and nothing is saved. Reload to start
	again. Delete this file once one variant wins.
-->
<script lang="ts">
	import BanIcon from '@lucide/svelte/icons/ban';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PalmtreeIcon from '@lucide/svelte/icons/palmtree';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { classTone } from '$lib/class-tone';
	import { PERIODS, WEEK, toGrid, type Cell, type Day } from './prototype-fixture';

	let { variant = 'E3' }: { variant?: string } = $props();

	// An F variant judges the Slot control against the day menu that won, so it draws E3 above it.
	const dayVariant = $derived(variant.startsWith('E') ? variant : 'E3');
	// An E variant keeps the Slot control the page has today, so the day control is judged alone.
	const slotVariant = $derived(variant.startsWith('F') ? variant : 'F1');

	// The teacher's edits, held here instead of in the database. A date in `blocked` is a Blocked
	// Day entered in this session; a date in `unblocked` is one the fixture supplied and the
	// teacher has taken off again. `slotBlocks` holds Blocked Slots entered here, keyed by date
	// and Period; `slotsUnblocked` holds the ones let go, fixture and session alike.
	let blocked = $state(new Set<string>());
	let unblocked = $state(new Set<string>());
	let notes = $state(new Map<string, string>());
	let slotBlocks = $state(new Map<string, string>());
	let slotsUnblocked = $state(new Set<string>());
	let lastAction = $state<{ text: string; undo: () => void } | null>(null);

	// One note is being typed at a time, so one draft and one open key are enough. The key is the
	// date for a day and `date-period` for a Slot.
	let draftNote = $state('');
	let openNoteFor = $state<string | null>(null);

	const key = (date: string, period: number) => `${date}-${period}`;

	const week = $derived.by((): Day[] =>
		WEEK.map((day) => {
			const cells = day.cells
				.filter((c) => !slotsUnblocked.has(key(day.date, c.period)))
				.map((c) => {
					const note = slotBlocks.get(key(day.date, c.period));
					return note === undefined
						? c
						: { ...c, kind: 'blocked' as const, blockedSlot: true, note };
				});
			if (blocked.has(day.date) && day.kind === 'teaching')
				return {
					...day,
					kind: 'blocked' as const,
					note: notes.get(day.date) || 'Blocked day',
					cells: cells.map((c) => ({ ...c, kind: 'blocked' as const }))
				};
			if (unblocked.has(day.date) && day.kind === 'blocked')
				return { ...day, kind: 'teaching' as const, note: undefined, cells };
			return { ...day, cells };
		})
	);

	const grid = $derived(toGrid(week));
	const tone = (c: Cell) => classTone(c.tone);
	const isBlockedDay = (day: Day) => day.kind === 'blocked';

	// The Blocked Slots a collapsed column hides: removals in their own right, so their unblock
	// has to reappear somewhere the panel or its head can reach.
	const hiddenSlots = (day: Day) => day.cells.filter((c) => c.blockedSlot);

	// A Blocked Slot is one Slot on one Period. A Lesson with Length > 1 spans several, so "this
	// Period" would be ambiguous and the control is not offered on it — the rule the page holds
	// today. Mon P3 is the span that tests it.
	const canBlockSlot = (cell: Cell) => cell.kind !== 'blocked' && cell.span === 1;

	function blockDay(date: string, note: string) {
		blocked.add(date);
		unblocked.delete(date);
		if (note) notes.set(date, note);
		openNoteFor = null;
		lastAction = { text: `${date} is blocked.`, undo: () => unblockDay(date) };
	}

	function unblockDay(date: string) {
		blocked.delete(date);
		unblocked.add(date);
		notes.delete(date);
		lastAction = { text: `${date} is open again.`, undo: () => blockDay(date, '') };
	}

	function blockSlot(day: Day, cell: Cell, note: string) {
		if (!note.trim()) return;
		slotBlocks.set(key(day.date, cell.period), note.trim());
		slotsUnblocked.delete(key(day.date, cell.period));
		openNoteFor = null;
		lastAction = {
			text: `${cell.classLabel} P${cell.period} is blocked.`,
			undo: () => unblockSlot(day, cell)
		};
	}

	function unblockSlot(day: Day, cell: Cell) {
		const k = key(day.date, cell.period);
		slotBlocks.delete(k);
		slotsUnblocked.add(k);
		lastAction = {
			text: `${cell.classLabel} P${cell.period} is unblocked.`,
			undo: () => slotsUnblocked.delete(k)
		};
	}

	function openNote(k: string) {
		draftNote = '';
		openNoteFor = k;
	}

	const CAPTIONS: Record<string, string> = {
		E1: 'E1 — The header does the doing. The day head carries the control in both directions: a faint "Block day" on a day that is taught, "blocked · unblock" on a day that is not. The panel below states the reason and holds no control at all. A Blocked Slot under a collapsed column keeps no unblock — the loss is accepted.',
		E2: 'E2 — The panel does the undoing. Blocking starts in the head; unblocking sits inside the panel, beside the reason it undoes, with the Blocked Slots the collapse hid listed alongside it. Nothing is lost. A School Holiday head offers no "Block day".',
		E3: 'E3 — One menu per day. The day head carries a single quiet button, on every day of the week. The menu holds every act the day allows — Block day, Unblock day, and one line per Blocked Slot the collapse would otherwise hide. Blocking asks for no note, because CONTEXT.md records no cause for a Blocked Day, so it is one menu click and an undo line under the grid.',
		E4: 'E4 — The panel is the button. Click the panel to unblock, click a ban icon in the head to block. Biggest target, fewest words, no note. The risk is an accidental undo; the undo line catches it.',
		F1: 'F1 — The hover ban icon, as the page has it today. A ban icon appears on a tile you point at, top right, and opens a small form for the required note. Two gestures in one grid: a menu on the day head, an icon on the tile. It is the smallest change, and the icon is discoverable only by pointing, which a touch screen cannot do.',
		F2: 'F2 — The same menu, one level down. The tile carries the same quiet button as the day head, so one gesture serves the whole grid: point at a thing, open its menu, choose. "Block this Slot…" ends in an ellipsis because it opens the note form rather than acting, which is the honest reading of a required note. Two clicks and a typed line, against the day\'s one click.',
		F3: "F3 — The day menu owns everything. No control on a tile at all. The day head's menu lists that day's taught Slots under a heading, so every block on that day starts in one place, and the grid keeps no hover state and no hidden icon. The menu is longer, and the Slot is named rather than pointed at, which is a step further from the thing on the screen.",
		F4: 'F4 — Type the reason on the tile. The menu item does not open a popover: the tile becomes the note field in place, and Enter blocks it. The reason is typed where the hole will be, so no layer sits over the grid. Escape leaves it alone. It is the fewest surfaces, and an in-place edit inside a table cell is the most to build.'
	};
</script>

{#snippet noteForm(id: string, label: string, placeholder: string, submit: () => void)}
	<Label for={id}>{label}</Label>
	<Input
		{id}
		bind:value={draftNote}
		class="mt-2 h-7 text-xs"
		{placeholder}
		onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submit()}
	/>
	<p class="mt-1.5 text-xs text-muted-foreground">
		The Class is not taught this Period; the school is open.
	</p>
	<Button size="sm" class="mt-3 w-full" disabled={!draftNote.trim()} onclick={submit}>Block</Button>
{/snippet}

<!-- The Slot note form, anchored to whatever opened it. -->
{#snippet slotNotePopover(day: Day, cell: Cell, trigger: import('svelte').Snippet, cls: string)}
	{@const k = key(day.date, cell.period)}
	<Popover.Root
		open={openNoteFor === k}
		onOpenChange={(o) => {
			openNoteFor = o ? k : null;
			draftNote = '';
		}}
	>
		<Popover.Trigger class={cls} aria-label="Block {cell.classLabel}, P{cell.period}">
			{@render trigger()}
		</Popover.Trigger>
		<Popover.Content class="w-64 p-3" align="end">
			{@render noteForm(
				`slot-${k}`,
				`Block ${cell.classLabel}, P${cell.period}`,
				'Why (required)',
				() => blockSlot(day, cell, draftNote)
			)}
		</Popover.Content>
	</Popover.Root>
{/snippet}

{#snippet lessonBody(cell: Cell, t: ReturnType<typeof classTone>)}
	<span class="truncate text-xs font-semibold" style:color={t.fg}>{cell.classLabel}</span>
	{#if cell.kind === 'lesson'}
		<span class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium" style:color={t.fg}
			>{cell.title}</span
		>
		<span class="mt-auto line-clamp-1 text-[11px] opacity-80" style:color={t.fg}
			>{cell.topicName}</span
		>
	{:else}
		<span class="mt-0.5 text-xs italic" style:color={t.fg}>Open Slot</span>
	{/if}
{/snippet}

<div class="overflow-x-auto">
	<table class="w-full table-fixed border-separate border-spacing-1.5">
		<thead>
			<tr>
				<th class="w-12"></th>
				{#each week as day (day.date)}
					<th class="pb-1 text-left align-bottom">
						<div class="flex items-baseline gap-1.5">
							<span
								class="text-sm font-semibold {day.kind === 'teaching'
									? ''
									: 'text-muted-foreground'}">{day.name}</span
							>
							<span class="text-xs font-normal text-muted-foreground">{day.date}</span>

							{#if dayVariant === 'E1'}
								{#if isBlockedDay(day)}
									<button
										type="button"
										class="ml-auto rounded px-1 text-xs font-normal text-muted-foreground hover:text-foreground"
										title={day.note}
										onclick={() => unblockDay(day.date)}>blocked · unblock</button
									>
								{:else}
									<Popover.Root
										open={openNoteFor === day.date}
										onOpenChange={(o) => {
											openNoteFor = o ? day.date : null;
											draftNote = '';
										}}
									>
										<Popover.Trigger
											class="ml-auto rounded px-1 text-xs font-normal text-muted-foreground/50 hover:text-foreground"
											>Block day</Popover.Trigger
										>
										<Popover.Content class="w-64 p-3" align="end">
											<Label for="day-{day.date}">Block {day.name} {day.date}</Label>
											<Input
												id="day-{day.date}"
												bind:value={draftNote}
												class="mt-2 h-7 text-xs"
												placeholder="Note (optional)"
											/>
											<p class="mt-1.5 text-xs text-muted-foreground">
												No Class is taught on this date. Every Slot on it is blocked.
											</p>
											<Button
												size="sm"
												class="mt-3 w-full"
												onclick={() => blockDay(day.date, draftNote)}>Block</Button
											>
										</Popover.Content>
									</Popover.Root>
								{/if}
							{:else if dayVariant === 'E2'}
								{#if day.kind === 'teaching'}
									<Popover.Root
										open={openNoteFor === day.date}
										onOpenChange={(o) => {
											openNoteFor = o ? day.date : null;
											draftNote = '';
										}}
									>
										<Popover.Trigger
											class="ml-auto rounded px-1 text-xs font-normal text-muted-foreground/50 hover:text-foreground"
											>Block day</Popover.Trigger
										>
										<Popover.Content class="w-64 p-3" align="end">
											<Label for="day2-{day.date}">Block {day.name} {day.date}</Label>
											<Input
												id="day2-{day.date}"
												bind:value={draftNote}
												class="mt-2 h-7 text-xs"
												placeholder="Note (optional)"
											/>
											<Button
												size="sm"
												class="mt-3 w-full"
												onclick={() => blockDay(day.date, draftNote)}>Block</Button
											>
										</Popover.Content>
									</Popover.Root>
								{/if}
							{:else if dayVariant === 'E3'}
								<!-- E3, the day control that won. F3 adds this day's Slots to the same menu. -->
								<DropdownMenu.Root>
									<DropdownMenu.Trigger
										class="ml-auto rounded px-0.5 text-muted-foreground/50 hover:text-foreground"
										aria-label="{day.name} {day.date} actions"
									>
										<EllipsisIcon class="size-4" />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content class="w-60" align="end">
										{#if day.kind === 'holiday'}
											<DropdownMenu.Label class="text-[11px] font-normal text-muted-foreground"
												>Outside every Term</DropdownMenu.Label
											>
											<DropdownMenu.Separator />
										{/if}
										{#if isBlockedDay(day)}
											<DropdownMenu.Item onSelect={() => unblockDay(day.date)}
												>Unblock day</DropdownMenu.Item
											>
										{:else}
											<DropdownMenu.Item onSelect={() => blockDay(day.date, '')}
												>Block day</DropdownMenu.Item
											>
										{/if}

										{#if slotVariant === 'F3' && day.kind === 'teaching'}
											{@const openSlots = day.cells.filter(canBlockSlot)}
											{#if openSlots.length > 0}
												<DropdownMenu.Separator />
												<DropdownMenu.Group>
													<DropdownMenu.GroupHeading
														class="text-[11px] font-normal text-muted-foreground"
														>Block one Slot</DropdownMenu.GroupHeading
													>
													{#each openSlots as slot (slot.period)}
														<DropdownMenu.Item onSelect={() => openNote(key(day.date, slot.period))}
															>{slot.classLabel}, P{slot.period}…</DropdownMenu.Item
														>
													{/each}
												</DropdownMenu.Group>
											{/if}
										{/if}

										{#if hiddenSlots(day).length > 0}
											<DropdownMenu.Separator />
											<DropdownMenu.Group>
												<DropdownMenu.GroupHeading
													class="text-[11px] font-normal text-muted-foreground"
													>Blocked Slots</DropdownMenu.GroupHeading
												>
												{#each hiddenSlots(day) as slot (slot.period)}
													<DropdownMenu.Item onSelect={() => unblockSlot(day, slot)}
														>Unblock {slot.classLabel}, P{slot.period}</DropdownMenu.Item
													>
												{/each}
											</DropdownMenu.Group>
										{/if}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{:else if dayVariant === 'E4'}
								{#if day.kind === 'teaching'}
									<button
										type="button"
										class="ml-auto rounded px-0.5 text-muted-foreground/40 hover:text-foreground"
										aria-label="Block {day.name} {day.date}"
										onclick={() => blockDay(day.date, '')}
									>
										<BanIcon class="size-3.5" />
									</button>
								{/if}
							{/if}
						</div>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each PERIODS as period (period)}
				<tr>
					<th class="pr-1 text-right align-top">
						<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">
							P{period}
						</div>
					</th>
					{#each week as day, di (day.date)}
						{#if day.kind !== 'teaching'}
							{#if period === 1}
								{@const holiday = day.kind === 'holiday'}
								<td rowspan={6} class="h-16 align-middle">
									<svelte:element
										this={dayVariant === 'E4' && !holiday ? 'button' : 'div'}
										role={dayVariant === 'E4' && !holiday ? 'button' : undefined}
										onclick={dayVariant === 'E4' && !holiday
											? () => unblockDay(day.date)
											: undefined}
										class="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center {holiday
											? 'proto-holiday'
											: 'proto-hatch border border-dashed border-muted-foreground/30'} {dayVariant ===
											'E4' && !holiday
											? 'cursor-pointer hover:brightness-95'
											: ''}"
									>
										{#if holiday}
											<PalmtreeIcon class="proto-icon size-5" />
										{/if}
										<div class="text-xs font-semibold text-muted-foreground">{day.note}</div>
										<div class="text-[11px] text-muted-foreground/70">
											{holiday ? 'Outside every Term' : 'No teaching'}
										</div>

										{#if dayVariant === 'E2'}
											{#each hiddenSlots(day) as slot (slot.period)}
												<div class="mt-1 w-full border-t border-muted-foreground/20 pt-1">
													<div class="text-[11px] font-medium text-muted-foreground">
														{slot.classLabel} · P{slot.period}
													</div>
													<div class="text-[11px] text-muted-foreground/70 italic">
														{slot.note}
													</div>
													<button
														type="button"
														class="text-[11px] text-muted-foreground underline underline-offset-2"
														onclick={() => unblockSlot(day, slot)}>Unblock Slot</button
													>
												</div>
											{/each}
											{#if !holiday}
												<button
													type="button"
													class="mt-2 rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
													onclick={() => unblockDay(day.date)}>Unblock day</button
												>
											{/if}
										{:else if dayVariant === 'E4' && !holiday}
											<div class="mt-1 text-[11px] text-muted-foreground/60">Click to unblock</div>
										{/if}
									</svelte:element>
								</td>
							{/if}
						{:else}
							{@const entry = grid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- spanned by an earlier Period -->
							{:else if entry.type === 'free'}
								<td class="h-16 rounded-lg bg-muted/40"></td>
							{:else}
								{@const cell = entry.cell}
								{@const k = key(day.date, cell.period)}
								<td rowspan={cell.span} class="group/cell relative h-16 align-top">
									{#if cell.kind === 'blocked'}
										<div
											class="proto-hatch flex h-full min-h-16 flex-col rounded-lg border border-dashed border-muted-foreground/30 px-2 py-1.5"
										>
											<div class="text-xs font-semibold text-muted-foreground line-through">
												{cell.classLabel}
											</div>
											<div class="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80 italic">
												{cell.note}
											</div>
											{#if cell.blockedSlot}
												<button
													type="button"
													class="mt-auto self-start text-xs text-muted-foreground underline underline-offset-2"
													onclick={() => unblockSlot(day, cell)}>Unblock</button
												>
											{/if}
										</div>
									{:else if slotVariant === 'F4' && openNoteFor === k}
										<!-- F4 — the tile becomes the note field, in place. -->
										{@const t = tone(cell)}
										<!-- svelte-ignore a11y_autofocus -->
										<div
											class="flex h-full min-h-16 flex-col rounded-lg border-2 px-2 py-1.5"
											style:background-color={t.bg}
											style:border-color={t.ring}
										>
											<span class="truncate text-xs font-semibold" style:color={t.fg}
												>{cell.classLabel}</span
											>
											<input
												autofocus
												bind:value={draftNote}
												placeholder="Why is it blocked?"
												class="mt-1 w-full rounded border border-background/60 bg-background/80 px-1 py-0.5 text-xs outline-none"
												onkeydown={(e) => {
													if (e.key === 'Enter') blockSlot(day, cell, draftNote);
													if (e.key === 'Escape') openNoteFor = null;
												}}
											/>
											<span class="mt-auto text-[11px]" style:color={t.fg}
												>Enter to block · Esc to leave</span
											>
										</div>
									{:else}
										{@const t = tone(cell)}
										<div
											class="flex h-full min-h-16 flex-col overflow-hidden rounded-lg border px-2 py-1.5"
											style:background-color={t.bg}
											style:border-color={t.ring}
										>
											{@render lessonBody(cell, t)}
										</div>

										{#if canBlockSlot(cell)}
											{#if slotVariant === 'F1'}
												<!-- F1 — today's hover ban icon. -->
												{#snippet ban()}<BanIcon class="size-3" />{/snippet}
												{@render slotNotePopover(
													day,
													cell,
													ban,
													'absolute top-1 right-1 rounded-sm bg-background/70 p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 hover:text-foreground'
												)}
											{:else if slotVariant === 'F2' || slotVariant === 'F4'}
												<!-- F2 and F4 — the same menu as the day head, one level down. They
												     differ only in where the note is then typed. -->
												<DropdownMenu.Root>
													<DropdownMenu.Trigger
														class="absolute top-1 right-1 rounded-sm bg-background/70 p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 hover:text-foreground focus-visible:opacity-100"
														aria-label="{cell.classLabel}, P{cell.period} actions"
													>
														<EllipsisIcon class="size-3.5" />
													</DropdownMenu.Trigger>
													<DropdownMenu.Content class="w-52" align="end">
														<DropdownMenu.Item onSelect={() => openNote(k)}
															>Block this Slot…</DropdownMenu.Item
														>
														<DropdownMenu.Item disabled>Open Session</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu.Root>

												{#if slotVariant === 'F2'}
													<!-- The note form the menu item opens, anchored to the tile. -->
													<Popover.Root
														open={openNoteFor === k}
														onOpenChange={(o) => {
															if (!o) openNoteFor = null;
														}}
													>
														<Popover.Trigger class="absolute top-1 right-1 size-0" />
														<Popover.Content class="w-64 p-3" align="end">
															{@render noteForm(
																`slot-${k}`,
																`Block ${cell.classLabel}, P${cell.period}`,
																'Why (required)',
																() => blockSlot(day, cell, draftNote)
															)}
														</Popover.Content>
													</Popover.Root>
												{/if}
											{/if}
										{/if}

										{#if slotVariant === 'F3' && openNoteFor === k}
											<!-- F3 — the day menu chose the Slot; the note is asked for over the tile
											     it names, so the teacher can see which one they picked. -->
											<Popover.Root
												open
												onOpenChange={(o) => {
													if (!o) openNoteFor = null;
												}}
											>
												<Popover.Trigger class="absolute top-1 right-1 size-0" />
												<Popover.Content class="w-64 p-3" align="end">
													{@render noteForm(
														`slot-${k}`,
														`Block ${cell.classLabel}, P${cell.period}`,
														'Why (required)',
														() => blockSlot(day, cell, draftNote)
													)}
												</Popover.Content>
											</Popover.Root>
										{/if}
									{/if}
								</td>
							{/if}
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- The undo line. E3, E4 and F4 lean on it, because none of them asks twice. -->
<div class="mt-3 flex h-6 items-center gap-2 text-xs text-muted-foreground">
	{#if lastAction}
		<span>{lastAction.text}</span>
		<button
			type="button"
			class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
			onclick={() => {
				lastAction?.undo();
				lastAction = null;
			}}
		>
			<RotateCcwIcon class="size-3" /> Undo
		</button>
	{/if}
</div>

<p class="mt-2 max-w-3xl text-[11px] text-muted-foreground">{CAPTIONS[variant]}</p>

<style>
	.proto-hatch {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}

	/* A2, the settled School Holiday panel: no colour, a step in shade from an empty Period. */
	.proto-holiday {
		background-color: color-mix(in oklab, var(--muted-foreground) 16%, transparent);
	}

	.proto-holiday :global(.proto-icon) {
		color: var(--muted-foreground);
		opacity: 0.7;
	}
</style>
