<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dayRows, rowIndexOf, type Bell } from '$lib/bell';
	import { failureReason } from '$lib/client/enhance';
	import { dayRowLabel } from '$lib/events';
	import { Input } from '$lib/ui';
	import { toast } from '$lib/ui/toast';

	type RoomSlot = {
		id: string;
		eventId: string;
		week: 'A' | 'B';
		day: number;
		position: number;
		scheduleId: string | null;
		room: string | null;
	};

	let {
		eventId,
		readOnly,
		slots,
		bell
	}: {
		eventId: string;
		readOnly: boolean;
		slots: RoomSlot[];
		bell: Bell;
	} = $props();

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	const rows = $derived(dayRows(bell.schedules));

	const mine = $derived(
		slots
			.filter((s) => s.eventId === eventId)
			.sort(
				(a, b) =>
					a.week.localeCompare(b.week) ||
					a.day - b.day ||
					rowIndexOf(rows, a.position, a.scheduleId) - rowIndexOf(rows, b.position, b.scheduleId)
			)
	);
</script>

{#if mine.length}
	<div class="mt-4">
		<p class="text-xs font-medium">Rooms</p>
		<ul class="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
			{#each mine as s (s.id)}
				{@const label = `Week ${s.week} · ${DAY_NAMES[s.day - 1]} · ${dayRowLabel(rows, s.position, s.scheduleId)}`}
				<li class="flex items-center justify-between gap-2">
					<span class="text-xs text-muted-foreground">{label}</span>
					{#if readOnly}
						<span class="text-xs">{s.room ?? '—'}</span>
					{:else}
						<form
							method="POST"
							action="?/setEventSlotRoom"
							use:enhance={() =>
								async ({ result }) => {
									// As on the Class page: keep the caret in the box the teacher just left by tabbing.
									if (result.type === 'redirect' || result.type === 'error')
										return applyAction(result);
									if (result.type === 'failure')
										toast.error(failureReason(result, 'Could not save the Room.'));
									await invalidateAll();
								}}
						>
							<input type="hidden" name="id" value={s.id} />
							<Input
								name="room"
								value={s.room ?? ''}
								placeholder="Room"
								autocomplete="off"
								aria-label="Room for {label}"
								class="h-7 w-28 text-xs"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
