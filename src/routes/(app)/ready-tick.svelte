<script lang="ts">
	import { enhance } from '$app/forms';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { failureReason } from '$lib/client/enhance';
	import { touchTarget } from '$lib/ui';
	import { toast } from '$lib/ui/toast';

	let {
		lessonId,
		classId,
		ready,
		label
	}: { lessonId: string; classId: string; ready: boolean; label: string } = $props();

	let box = $state<HTMLInputElement | null>(null);
</script>

<form
	method="POST"
	action="?/setReadiness"
	class="mr-3 flex shrink-0 items-center"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				toast.error(failureReason(result, 'Could not save Ready.'));
			}
			await update({ invalidateAll: true, reset: false });
			// The refreshed data is the truth, whichever way the write went — the checkbox reads
			// it directly rather than trusting either the click or the form's default checkedness.
			if (box) box.checked = ready;
		};
	}}
>
	<input type="hidden" name="lessonId" value={lessonId} />
	<input type="hidden" name="classId" value={classId} />
	<!-- The padding widens the tick's click target; the negative margin keeps its footprint
	     unchanged. As a label wrapping the input, a click anywhere here toggles it. On touch the
	     shared invisible rule pads the target out to 44 px (issue #342). -->
	<label
		class="relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-outline-soft bg-surface px-3 text-[13px] font-semibold has-checked:border-transparent has-checked:bg-ready has-checked:text-ready-foreground {touchTarget}"
	>
		<!-- A real checkbox carrying `ready`, so the tick persists without JavaScript; the icon
		     only paints it. Checked sends the field, unchecked sends nothing. -->
		<input
			bind:this={box}
			type="checkbox"
			name="ready"
			value="true"
			checked={ready}
			class="peer size-4 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-outline bg-surface transition-shadow outline-none checked:border-ready-foreground checked:bg-ready-foreground focus-visible:ring-2 focus-visible:ring-ring"
			aria-label={label}
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		/>
		<CheckIcon
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 left-3 hidden size-3.5 translate-x-px -translate-y-1/2 text-ready peer-checked:block"
		/>
		<span aria-hidden="true">Ready</span>
	</label>
	<noscript>
		<button type="submit" class="ml-2 rounded-md border px-1.5 py-0.5 text-xs">Save</button>
	</noscript>
</form>
