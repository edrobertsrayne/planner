<script lang="ts">
	import { enhance } from '$app/forms';
	import LinkIcon from '@lucide/svelte/icons/link';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

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
			class="h-7 text-xs md:text-xs"
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
				class="h-7 min-w-0 flex-1 text-xs md:text-xs"
				placeholder="https://…"
			/>
			<Button type="submit" size="sm" class="shrink-0">Save</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="shrink-0"
				onclick={() => (editing = false)}
			>
				Cancel
			</Button>
		</div>
	</form>
{:else}
	<div class="group flex items-baseline gap-2">
		<LinkIcon class="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
		<!-- eslint-disable svelte/no-navigation-without-resolve -- a Link's url is external -->
		<a
			href={link.url}
			target="_blank"
			rel="noopener noreferrer"
			class="min-w-0 flex-1 truncate hover:underline"
		>
			{link.label}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
			{new URL(link.url).hostname.split('.')[0]}
		</span>
		<span class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={() => (editing = true)}
				aria-label="Edit {link.label}"
			>
				<PencilIcon class="size-3.5" />
			</Button>
			<form method="POST" action="?/moveLink" use:enhance>
				<input type="hidden" name="lessonId" value={lessonId} />
				<input type="hidden" name="id" value={link.id} />
				<input type="hidden" name="direction" value="up" />
				<Button
					type="submit"
					variant="ghost"
					size="icon-sm"
					disabled={first}
					aria-label="Move {link.label} up"
				>
					<ChevronUpIcon class="size-3.5" />
				</Button>
			</form>
			<form method="POST" action="?/moveLink" use:enhance>
				<input type="hidden" name="lessonId" value={lessonId} />
				<input type="hidden" name="id" value={link.id} />
				<input type="hidden" name="direction" value="down" />
				<Button
					type="submit"
					variant="ghost"
					size="icon-sm"
					disabled={last}
					aria-label="Move {link.label} down"
				>
					<ChevronDownIcon class="size-3.5" />
				</Button>
			</form>
			<form method="POST" action="?/deleteLink" use:enhance>
				<input type="hidden" name="id" value={link.id} />
				<Button
					type="submit"
					variant="ghost"
					size="icon-sm"
					class="hover:text-destructive"
					aria-label="Remove {link.label}"
				>
					<XIcon class="size-3.5" />
				</Button>
			</form>
		</span>
	</div>
{/if}
