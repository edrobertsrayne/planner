<script lang="ts">
	import { resolve } from '$app/paths';
	import LinkIcon from '@lucide/svelte/icons/link';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import { formatSize } from '$lib/format-size';
	import type { LessonDetail } from '$lib/server/planner';

	// A Lesson's Links and its Attachments, read-only — the one place that markup lives, because
	// both the Lesson editor's phone view and the Session panel show them and neither writes them.
	// `rows` draws the editor's card rows with their headings; `inline` the Session panel's compact
	// underlined lists, which sit beside the plan and add no headings of their own.
	let {
		links,
		attachments,
		variant
	}: {
		links: LessonDetail['links'];
		attachments: LessonDetail['attachments'];
		variant: 'rows' | 'inline';
	} = $props();

	const heading = 'mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase';
</script>

{#if links.length}
	{#if variant === 'rows'}
		<section>
			<h2 class={heading}>Links</h2>
			<ul class="space-y-2">
				{#each links as link (link.id)}
					<li>
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2"
						>
							<LinkIcon class="size-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate">{link.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<ul class="mt-4 space-y-1">
			{#each links as link (link.id)}
				<li>
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm underline underline-offset-4">{link.label}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

{#if attachments.length}
	{#if variant === 'rows'}
		<section>
			<h2 class={heading}>Attachments</h2>
			<ul class="space-y-2">
				{#each attachments as attachment (attachment.id)}
					<li>
						<a
							href={resolve('/attachments/[id]', { id: attachment.id })}
							class="flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2"
						>
							<PaperclipIcon class="size-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate">{attachment.filename}</span>
							<span class="shrink-0 font-mono text-xs text-muted-foreground">
								{formatSize(attachment.size)}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<ul class="mt-2 space-y-1">
			{#each attachments as attachment (attachment.id)}
				<li class="flex items-baseline gap-2 text-sm">
					<a
						href={resolve('/attachments/[id]', { id: attachment.id })}
						class="min-w-0 flex-1 truncate underline underline-offset-4"
					>
						{attachment.filename}
					</a>
					<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
						{formatSize(attachment.size)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
