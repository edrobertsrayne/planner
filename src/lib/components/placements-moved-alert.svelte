<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import { formatDate } from '$lib/date';
	import type { PlacementMoved } from '$lib/server/planner';

	// A Placement pushed off its anchor by a write that removed the Slot it was on (a Blocked
	// Day/Slot or a Rewind) — surfaced unconditionally (ADR-0022).
	let { placementsMoved }: { placementsMoved: PlacementMoved[] } = $props();
</script>

{#if placementsMoved.length > 0}
	<Alert.Root class="mb-4">
		<TriangleAlertIcon />
		<Alert.Title>
			{placementsMoved.length === 1
				? 'A Placement moved because its Slot stopped being Available.'
				: `${placementsMoved.length} Placements moved because their Slots stopped being Available.`}
		</Alert.Title>
		<Alert.Description>
			<ul class="mt-1 list-disc pl-4">
				{#each placementsMoved as p (p.placementId)}
					<li>
						{p.classLabel} · {p.lessonTitle} — was {formatDate(p.anchorDate)} P{p.anchorPeriod}, now
						{#if p.stranded}
							has nowhere left to go
						{:else}
							{formatDate(p.date)} P{p.period}
						{/if}
					</li>
				{/each}
			</ul>
		</Alert.Description>
	</Alert.Root>
{/if}
