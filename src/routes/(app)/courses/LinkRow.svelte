<script lang="ts">
	import { enhance } from '$app/forms';

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
		<!-- svelte-ignore a11y_autofocus -->
		<input
			autofocus
			name="label"
			value={link.label}
			required
			autocomplete="off"
			class="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
			placeholder="Label"
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					editing = false;
				}
			}}
		/>
		<div class="flex gap-1">
			<input
				name="url"
				type="url"
				value={link.url}
				required
				autocomplete="off"
				class="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
				placeholder="https://…"
			/>
			<button type="submit" class="shrink-0 rounded bg-neutral-900 px-2.5 text-xs text-white">
				Save
			</button>
			<button
				type="button"
				class="shrink-0 rounded px-2.5 text-xs text-neutral-400 hover:text-neutral-900"
				onclick={() => (editing = false)}
			>
				Cancel
			</button>
		</div>
	</form>
{:else}
	<div class="group flex items-baseline gap-2">
		<span class="text-neutral-300">🔗</span>
		<button
			type="button"
			class="min-w-0 flex-1 truncate text-left"
			onclick={() => (editing = true)}
		>
			{link.label}
		</button>
		<span class="shrink-0 font-mono text-[10px] text-neutral-400">
			{new URL(link.url).hostname.split('.')[0]}
		</span>
		<span class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
			<form method="POST" action="?/moveLink" use:enhance>
				<input type="hidden" name="lessonId" value={lessonId} />
				<input type="hidden" name="id" value={link.id} />
				<input type="hidden" name="direction" value="up" />
				<button
					type="submit"
					class="px-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-25"
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
					class="px-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-25"
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
					class="px-1 text-neutral-400 hover:text-red-600"
					aria-label="Remove {link.label}"
				>
					✕
				</button>
			</form>
		</span>
	</div>
{/if}
