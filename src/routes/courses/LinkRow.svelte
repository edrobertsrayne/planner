<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import LinkIcon from '@lucide/svelte/icons/link';

	let {
		link,
		lessonId,
		first,
		last
	}: {
		link: { id: string; label: string; url: string };
		lessonId: string;
		first: boolean;
		last: boolean;
	} = $props();

	let editing = $state(false);
</script>

{#if editing}
	<form
		method="POST"
		action="?/updateLink"
		use:enhance={() => {
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') editing = false;
			};
		}}
		class="space-y-1"
	>
		<input type="hidden" name="id" value={link.id} />
		<Input
			autofocus
			name="label"
			value={link.label}
			required
			autocomplete="off"
			class="h-7 text-xs"
			placeholder="Label"
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					editing = false;
				}
			}}
		/>
		<div class="flex gap-1">
			<Input
				name="url"
				type="url"
				value={link.url}
				required
				autocomplete="off"
				class="h-7 min-w-0 flex-1 text-xs"
				placeholder="https://…"
			/>
			<Button type="submit" size="sm" class="h-7 shrink-0 text-xs">Save</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-7 shrink-0 text-xs"
				onclick={() => (editing = false)}
			>
				Cancel
			</Button>
		</div>
	</form>
{:else}
	<div class="group flex items-baseline gap-2">
		<LinkIcon class="size-3.5 shrink-0 text-muted-foreground" />
		<button
			type="button"
			class="min-w-0 flex-1 truncate text-left"
			onclick={() => (editing = true)}
		>
			{link.label}
		</button>
		<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
			{new URL(link.url).hostname.split('.')[0]}
		</span>
		<span class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
			<form method="POST" action="?/moveLink" use:enhance>
				<input type="hidden" name="lessonId" value={lessonId} />
				<input type="hidden" name="id" value={link.id} />
				<input type="hidden" name="direction" value="up" />
				<button
					type="submit"
					class="px-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
					disabled={first}
					aria-label="Move {link.label} up"
				>
					↑
				</button>
			</form>
			<form method="POST" action="?/moveLink" use:enhance>
				<input type="hidden" name="lessonId" value={lessonId} />
				<input type="hidden" name="id" value={link.id} />
				<input type="hidden" name="direction" value="down" />
				<button
					type="submit"
					class="px-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
					disabled={last}
					aria-label="Move {link.label} down"
				>
					↓
				</button>
			</form>
			<form method="POST" action="?/deleteLink" use:enhance>
				<input type="hidden" name="id" value={link.id} />
				<button
					type="submit"
					class="px-1 text-muted-foreground hover:text-destructive"
					aria-label="Remove {link.label}"
				>
					✕
				</button>
			</form>
		</span>
	</div>
{/if}
