<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input } from '$lib/ui';
	import LinkRow from './link-row.svelte';
	import OwnerFields from './owner-fields.svelte';

	// A Lesson's or a Class's Links as written from a tablet up: the rows, each editable,
	// reorderable and removable, and the add form. The page holds the `?/…Link` actions.
	let {
		links,
		owner
	}: {
		links: { id: string; label: string; url: string }[];
		owner: { lessonId: string } | { classId: string };
	} = $props();

	let adding = $state(false);
</script>

<section class="rounded-2xl border bg-surface p-4">
	<h2 class="mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Links</h2>
	<ul class="mt-1 space-y-1">
		{#each links as link, i (link.id)}
			<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
				<LinkRow {link} {owner} first={i === 0} last={i === links.length - 1} />
			</li>
		{/each}
		{#if !links.length}
			<li class="px-1 py-1 text-xs text-muted-foreground">No Links yet.</li>
		{/if}
	</ul>

	{#if adding}
		<form
			method="POST"
			action="?/createLink"
			class="mt-2 space-y-1"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') adding = false;
				};
			}}
		>
			<OwnerFields {owner} />
			<Input
				autofocus
				name="label"
				required
				autocomplete="off"
				class="h-7 text-xs md:text-xs"
				placeholder="Label"
			/>
			<div class="flex gap-1">
				<Input
					name="url"
					type="url"
					required
					autocomplete="off"
					class="h-7 min-w-0 flex-1 text-xs md:text-xs"
					placeholder="https://…"
				/>
				<Button type="submit" size="sm" class="shrink-0">Add</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="shrink-0"
					onclick={() => (adding = false)}
				>
					Cancel
				</Button>
			</div>
		</form>
	{:else}
		<Button
			type="button"
			variant="ghost"
			size="sm"
			class="mt-2 text-xs text-muted-foreground"
			onclick={() => (adding = true)}
		>
			+ Add Link
		</Button>
	{/if}
</section>
