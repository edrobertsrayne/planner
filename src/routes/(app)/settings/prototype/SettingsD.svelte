<!--
	PROTOTYPE ONLY (issue #314). Variant D: one section at a time. From `md`, a list of the three
	sections stands on the left, as on GitHub's settings; below `md`, tabs across the top. The
	chosen section is in the URL (`?section=`), so a reload keeps it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/page-header.svelte';
	import type { PageData } from '../$types';
	import ApiKey from './ApiKey.svelte';
	import BackupAction from './BackupAction.svelte';
	import Help from './Help.svelte';
	import PasswordForm from './PasswordForm.svelte';
	import { COPY } from './parts';

	let { data }: { data: PageData } = $props();

	const SECTIONS = [
		{ key: 'password', label: 'Password' },
		{ key: 'api-key', label: 'API key' },
		{ key: 'backup', label: 'Backup' }
	] as const;
	const current = $derived(page.url.searchParams.get('section') ?? 'password');

	function to(key: string) {
		const url = new URL(page.url);
		url.searchParams.set('section', key);
		return `${url.pathname}${url.search}`;
	}
	const section = $derived(
		current === 'api-key' ? COPY.apiKey : current === 'backup' ? COPY.backup : COPY.password
	);
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
	<PageHeader title="Settings" />
	<div class="flex flex-col gap-6 md:flex-row md:gap-10">
		<nav
			aria-label="Settings"
			class="flex shrink-0 border-b text-sm md:w-44 md:flex-col md:gap-0.5 md:border-b-0"
		>
			{#each SECTIONS as s (s.key)}
				{@const active = current === s.key}
				<a
					href={to(s.key)}
					data-sveltekit-replacestate
					data-sveltekit-noscroll
					aria-current={active ? 'page' : undefined}
					class="-mb-px border-b-2 px-3 py-2.5 font-medium transition-colors max-md:min-h-11 md:mb-0 md:rounded-md md:border-b-0 md:px-2.5 md:py-2 {active
						? 'border-primary text-foreground md:bg-muted'
						: 'border-transparent text-muted-foreground hover:text-foreground md:hover:bg-muted/60'}"
				>
					{s.label}
				</a>
			{/each}
		</nav>
		<section class="max-w-xl min-w-0 flex-1">
			<h2 class="text-base font-semibold">{section.title}</h2>
			<Help text={section.help} class="mt-1 mb-6" />
			{#if current === 'api-key'}
				<ApiKey {...data.key} />
			{:else if current === 'backup'}
				<BackupAction size={data.backupSize} />
			{:else}
				<PasswordForm id="d" />
			{/if}
		</section>
	</div>
</div>
