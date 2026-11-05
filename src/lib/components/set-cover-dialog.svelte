<script lang="ts" module>
	// The Slot of an Absence a Cover is being set for. The Agenda and the Calendar both open this
	// dialog, so both build this shape.
	export interface CoverPick {
		classId: string;
		classLabel: string;
		date: string;
		slotId: string;
		period: number;
	}
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { failureReason } from '$lib/client/enhance';
	import { latched } from '$lib/client/latch.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatWeekday } from '$lib/date';

	// Set cover (ADR-0030): a new Lesson, which opens in the Lesson editor at once so the teacher
	// decides what is set, or an existing Standalone Lesson such as a standard cover task. Mounted
	// once and opened through the bound pick, as BlockSlotDialog is.
	let {
		pick = $bindable(null),
		choices
	}: { pick: CoverPick | null; choices: { id: string; title: string }[] } = $props();

	const shown = latched(() => pick);
	const viewed = $derived(shown());
	const label = $derived(viewed ? `Cover for ${viewed.classLabel}, P${viewed.period}` : '');

	let mode = $state<'new' | 'existing'>('new');
	let chosen = $state('');

	let refusal = $state<{ pick: CoverPick; message: string } | null>(null);
	const error = $derived(refusal?.pick === pick ? refusal.message : null);
</script>

<Dialog.Root
	open={pick !== null}
	onOpenChange={(open) => {
		if (!open) {
			pick = null;
			mode = 'new';
			chosen = '';
		}
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{label}</Dialog.Title>
			<Dialog.Description>
				{viewed ? formatWeekday(viewed.date) : ''}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/setCover"
			use:enhance={() =>
				async ({ result, update }) => {
					// A new Lesson answers with a redirect to the editor, which `update` follows.
					await update({ invalidateAll: true, reset: false });
					if (result.type === 'success') pick = null;
					else if (result.type === 'failure' && pick)
						refusal = { pick, message: failureReason(result, 'The Cover was refused.') };
				}}
		>
			{#if viewed}
				<input type="hidden" name="classId" value={viewed.classId} />
				<input type="hidden" name="date" value={viewed.date} />
				<input type="hidden" name="slotId" value={viewed.slotId} />
			{/if}

			<div class="flex gap-1 rounded-lg bg-muted p-0.5">
				<Button
					type="button"
					size="sm"
					variant={mode === 'new' ? 'secondary' : 'ghost'}
					aria-pressed={mode === 'new'}
					class="flex-1"
					onclick={() => (mode = 'new')}>New Lesson</Button
				>
				<Button
					type="button"
					size="sm"
					variant={mode === 'existing' ? 'secondary' : 'ghost'}
					aria-pressed={mode === 'existing'}
					class="flex-1"
					onclick={() => (mode = 'existing')}>Existing Lesson</Button
				>
			</div>

			{#if mode === 'new'}
				<Input
					class="mt-3"
					name="title"
					aria-label="Title"
					required
					value={viewed ? `Cover: ${viewed.classLabel}` : ''}
				/>
				<p class="mt-2 text-xs text-muted-foreground">
					You will write what is set in the Lesson editor next. Leave it blank and Back takes it
					away.
				</p>
			{:else if choices.length === 0}
				<p class="mt-3 text-sm text-muted-foreground">No Standalone Lessons yet.</p>
			{:else}
				<ul class="mt-3 grid gap-1.5">
					{#each choices as choice (choice.id)}
						<li>
							<label
								class="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-checked:border-foreground has-checked:bg-muted/50"
							>
								<input
									type="radio"
									name="lessonId"
									value={choice.id}
									bind:group={chosen}
									required
									class="accent-primary"
								/>
								{choice.title}
							</label>
						</li>
					{/each}
				</ul>
				<p class="mt-2 text-xs text-muted-foreground">
					Standalone Lessons only. A Lesson in a Topic stays out, so a Cover never moves a Sequence.
				</p>
			{/if}

			{#if error}
				<p role="alert" class="mt-1.5 text-xs text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={mode === 'existing' && !chosen}>
					{mode === 'new' ? 'Create and open' : 'Use this Lesson'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
