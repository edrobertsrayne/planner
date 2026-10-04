<!--
	PROTOTYPE ONLY (issue #314). Variant B: no cards. Each section is a row: its title and
	instructions on the left third, its controls on the right, a rule between rows. One column
	below `md`, the instructions above the controls.
-->
<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import type { PageData } from '../$types';
	import ApiKey from './ApiKey.svelte';
	import BackupAction from './BackupAction.svelte';
	import Help from './Help.svelte';
	import PasswordForm from './PasswordForm.svelte';
	import { COPY } from './parts';

	let { data }: { data: PageData } = $props();
</script>

{#snippet row(section: { title: string; help: string }, body: import('svelte').Snippet)}
	<section class="grid gap-4 border-t py-6 first:border-t-0 first:pt-0 md:grid-cols-3 md:gap-8">
		<div>
			<h2 class="text-sm font-semibold">{section.title}</h2>
			<Help text={section.help} class="mt-1" />
		</div>
		<div class="max-w-xl md:col-span-2">{@render body()}</div>
	</section>
{/snippet}

{#snippet password()}<PasswordForm id="b" />{/snippet}
{#snippet apiKey()}<ApiKey {...data.key} />{/snippet}
{#snippet backup()}<BackupAction size={data.backupSize} />{/snippet}

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
	<PageHeader title="Settings" />
	{@render row(COPY.password, password)}
	{@render row(COPY.apiKey, apiKey)}
	{@render row(COPY.backup, backup)}
</div>
