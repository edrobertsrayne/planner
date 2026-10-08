<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { failureReason } from '$lib/client/enhance';
	import { Input } from '$lib/components/ui/input/index.js';

	type RoomSlot = {
		id: string;
		classId: string;
		week: 'A' | 'B';
		day: number;
		period: number;
		room: string | null;
	};

	let { classId, readOnly, slots }: { classId: string; readOnly: boolean; slots: RoomSlot[] } =
		$props();

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	const mine = $derived(
		slots
			.filter((s) => s.classId === classId)
			.sort((a, b) => a.week.localeCompare(b.week) || a.day - b.day || a.period - b.period)
	);
</script>

{#if mine.length}
	<div class="mt-4">
		<p class="text-xs font-medium">Rooms</p>
		<ul class="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
			{#each mine as s (s.id)}
				{@const label = `Week ${s.week} · ${DAY_NAMES[s.day - 1]} · P${s.period}`}
				<li class="flex items-center justify-between gap-2">
					<span class="text-xs text-muted-foreground">{label}</span>
					{#if readOnly}
						<span class="text-xs">{s.room ?? '—'}</span>
					{:else}
						<form
							method="POST"
							action="?/setSlotRoom"
							use:enhance={() =>
								async ({ result, update }) => {
									if (result.type === 'failure')
										toast.error(failureReason(result, 'Could not save the Room.'));
									await update({ invalidateAll: true, reset: false });
								}}
						>
							<input type="hidden" name="id" value={s.id} />
							<Input
								name="room"
								value={s.room ?? ''}
								placeholder="Room"
								autocomplete="off"
								aria-label="Room for Week {s.week} {DAY_NAMES[s.day - 1]} P{s.period}"
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
