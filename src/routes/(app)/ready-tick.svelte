<script lang="ts">
	import { enhance } from '$app/forms';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { failureReason } from '$lib/client/enhance';
	import { toast } from 'svelte-sonner';

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
	class="mr-2 flex shrink-0 items-center"
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
	     unchanged. As a label wrapping the input, a click anywhere here toggles it. -->
	<label class="relative -m-2 inline-flex cursor-pointer items-center p-2">
		<!-- A real checkbox carrying `ready`, so the tick persists without JavaScript; the icon
		     only paints it. Checked sends the field, unchecked sends nothing. -->
		<input
			bind:this={box}
			type="checkbox"
			name="ready"
			value="true"
			checked={ready}
			class="peer size-4 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-transparent bg-input/90 transition-shadow outline-none checked:border-primary checked:bg-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
			aria-label={label}
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		/>
		<CheckIcon
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 left-1/2 hidden size-3.5 -translate-x-1/2 -translate-y-1/2 text-primary-foreground peer-checked:block"
		/>
	</label>
	<noscript>
		<button type="submit" class="ml-2 rounded-md border px-1.5 py-0.5 text-xs">Save</button>
	</noscript>
</form>
