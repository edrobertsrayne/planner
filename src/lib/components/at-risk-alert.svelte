<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import type { AtRiskSession } from '$lib/server/planner';

	// A Rewind's report, wherever a scheduling write can produce one (ADR-0007): the Calendar, the
	// Class page's Assigned Topics, and a recorded Continuation all share this one rendering, so a
	// noted Session whose Lesson changed is never silently relabelled just because the write that
	// caused it happened to surface on a different screen.
	let { atRisk }: { atRisk: AtRiskSession[] } = $props();
</script>

{#if atRisk.length > 0}
	<Alert.Root class="mb-4">
		<TriangleAlertIcon />
		<Alert.Title>
			The Rewind changed the Lesson on {atRisk.length === 1
				? 'a noted Session'
				: `${atRisk.length} noted Sessions`} — check the note still applies.
		</Alert.Title>
		<Alert.Description>
			<ul class="mt-1 list-disc pl-4">
				{#each atRisk as s (s.classId + s.date + s.period)}
					<li>{s.classLabel} · {s.date} P{s.period} — now {s.lessonTitle}</li>
				{/each}
			</ul>
		</Alert.Description>
	</Alert.Root>
{/if}
